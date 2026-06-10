"""Unified clinical extraction strategy interfaces and implementations."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from clinical_nlp.llm_bridge import LLMExtractionClient, LLMExtractionError, extract_mentions_with_retries
from clinical_nlp.negation import NegationScopeResolver, compile_phrase_regex
from clinical_nlp.schemas import ClinicalMention, EntityType, SectionContext


class ExtractionMode(StrEnum):
    """Supported extraction strategy modes."""

    NLP = "nlp"
    LLM = "llm"
    HYBRID = "hybrid"


class BaseExtractor(ABC):
    """Strict extraction strategy interface.

    Concrete extractors must always return validated ``ClinicalMention``
    objects so downstream feature engineering, evaluation, and persistence do
    not need modality-specific branches.
    """

    @abstractmethod
    def extract(self, text: str) -> list[ClinicalMention]:
        """Extract structured mentions from raw clinical text.

        Args:
            text: Source clinical text.

        Returns:
            Validated clinical mentions.
        """


@dataclass(frozen=True, slots=True)
class RegexConcept:
    """Deterministic regex concept definition."""

    entity_type: EntityType
    pattern: re.Pattern[str]
    normalized_text: str
    attributes: dict[str, str | int | float | bool | None]
    section_context: SectionContext = SectionContext.UNKNOWN
    confidence_score: float = 0.92


class NLPExtractor(BaseExtractor):
    """Lightweight deterministic clinical mention extractor.

    This intentionally covers standard deterministic facts first: vitals,
    clinical scores, pain ratings, and a few common concepts. It is not a full
    clinical NLP engine; it is the stable baseline used before LLM escalation.
    """

    def __init__(
        self,
        *,
        concepts: Sequence[RegexConcept] | None = None,
        assertion_resolver: NegationScopeResolver | None = None,
    ) -> None:
        """Initialize deterministic extraction patterns."""

        self.concepts = tuple(concepts or default_regex_concepts())
        self.assertion_resolver = assertion_resolver or NegationScopeResolver()

    def extract(self, text: str) -> list[ClinicalMention]:
        """Extract deterministic mentions and apply sentence-local assertion scope."""

        mentions: list[ClinicalMention] = []
        for concept in self.concepts:
            for match in concept.pattern.finditer(text):
                mention_text = match.group(0)
                attributes = dict(concept.attributes)
                attributes.update(extract_match_attributes(match))
                mentions.append(
                    ClinicalMention(
                        text=mention_text,
                        entity_type=concept.entity_type,
                        start_char=match.start(),
                        end_char=match.end(),
                        section_context=concept.section_context,
                        confidence_score=concept.confidence_score,
                        normalized_text=concept.normalized_text,
                        attributes=attributes,
                    )
                )
        return self.assertion_resolver.annotate_mentions(text, dedupe_mentions(mentions))


class LLMExtractor(BaseExtractor):
    """Extractor that routes all extraction work to an LLM client."""

    def __init__(self, client: LLMExtractionClient, *, max_retries: int = 2) -> None:
        """Initialize an LLM-backed extractor."""

        self.client = client
        self.max_retries = max_retries

    def extract(self, text: str) -> list[ClinicalMention]:
        """Extract mentions using an LLM client.

        Raises:
            LLMExtractionError: If called with an asynchronous-only client.
        """

        try:
            return self.client.extract_sync(text)
        except NotImplementedError as exc:
            msg = "This LLM client only supports async extraction. Use extract_async or HybridExtractor.extract_async."
            raise LLMExtractionError(msg) from exc

    async def extract_async(self, text: str) -> list[ClinicalMention]:
        """Extract mentions asynchronously with validation retries."""

        return await extract_mentions_with_retries(self.client, text, max_retries=self.max_retries)


class HybridExtractor(BaseExtractor):
    """Cascading extractor that combines deterministic NLP with LLM escalation."""

    def __init__(
        self,
        nlp_extractor: NLPExtractor,
        llm_extractor: LLMExtractor,
        *,
        triage_policy: "TriagePolicy | None" = None,
    ) -> None:
        """Initialize the hybrid extraction strategy."""

        self.nlp_extractor = nlp_extractor
        self.llm_extractor = llm_extractor
        self.triage_policy = triage_policy or TriagePolicy()

    def extract(self, text: str) -> list[ClinicalMention]:
        """Run deterministic extraction and synchronously escalate complex text."""

        nlp_mentions = self.nlp_extractor.extract(text)
        triage = self.triage_policy.triage(text, nlp_mentions)
        if not triage.requires_llm:
            return nlp_mentions
        try:
            llm_mentions = self.llm_extractor.extract(triage.compressed_text)
        except LLMExtractionError:
            # AUDIT FIX: a provider failure previously discarded all deterministic
            # results. Degrade to NLP-only output instead of failing the document.
            # TODO(audit): surface the degradation to callers (e.g. an
            # ExtractionResult envelope with `escalation_failed=True`) so review
            # queues can prioritize these notes instead of silently passing them.
            return nlp_mentions
        return merge_mentions(nlp_mentions, remap_mentions_to_source(text, triage.compressed_text, llm_mentions))

    async def extract_async(self, text: str) -> list[ClinicalMention]:
        """Run deterministic extraction and asynchronously escalate complex text."""

        nlp_mentions = self.nlp_extractor.extract(text)
        triage = self.triage_policy.triage(text, nlp_mentions)
        if not triage.requires_llm:
            return nlp_mentions
        try:
            llm_mentions = await self.llm_extractor.extract_async(triage.compressed_text)
        except LLMExtractionError:
            return nlp_mentions
        return merge_mentions(nlp_mentions, remap_mentions_to_source(text, triage.compressed_text, llm_mentions))


@dataclass(frozen=True, slots=True)
class TriageDecision:
    """LLM escalation decision."""

    requires_llm: bool
    reasons: tuple[str, ...]
    compressed_text: str


class TriagePolicy:
    """Policy for routing ambiguous or high-complexity note fragments to an LLM."""

    ambiguous_terms = (
        "family history",
        "mother",
        "father",
        "sister",
        "brother",
        "concern for",
        "rule out",
        "complex",
        "unclear",
        "differential",
    )
    # C2 fix: boundary-aware matching — raw substring matching flagged
    # "smothered" (contains "mother") as an ambiguity signal.
    ambiguous_terms_regex = compile_phrase_regex(ambiguous_terms)

    def __init__(self, *, max_chars: int = 2_400, min_confidence_for_skip: float = 0.75) -> None:
        """Initialize triage thresholds."""

        self.max_chars = max_chars
        self.min_confidence_for_skip = min_confidence_for_skip

    def triage(self, text: str, nlp_mentions: Sequence[ClinicalMention]) -> TriageDecision:
        """Decide whether the LLM should process a compressed note context."""

        reasons: list[str] = []
        if self.ambiguous_terms_regex.search(text):
            reasons.append("ambiguous_or_reasoning_context")
        if nlp_mentions and min(mention.confidence_score for mention in nlp_mentions) < self.min_confidence_for_skip:
            reasons.append("low_confidence_nlp")
        if not nlp_mentions and text.strip():
            reasons.append("no_deterministic_mentions")

        requires_llm = bool(reasons)
        compressed = compress_note_for_llm(text, nlp_mentions, max_chars=self.max_chars) if requires_llm else ""
        return TriageDecision(requires_llm=requires_llm, reasons=tuple(reasons), compressed_text=compressed)


def default_regex_concepts() -> list[RegexConcept]:
    """Return starter deterministic concepts for production bootstrapping."""

    return [
        RegexConcept(
            EntityType.VITAL,
            re.compile(r"\b(?:HR|heart rate)\s*(?:=|:)?\s*(?P<value>\d{2,3})\b", re.IGNORECASE),
            "heart rate",
            {"measurement": "heart-rate", "unit": "beats/min"},
            SectionContext.VITALS,
        ),
        RegexConcept(
            EntityType.VITAL,
            re.compile(
                r"\b(?:BP|blood pressure)\s*(?:=|:)?\s*(?P<systolic>\d{2,3})/(?P<diastolic>\d{2,3})\b",
                re.IGNORECASE,
            ),
            "blood pressure",
            {"measurement": "blood-pressure", "unit": "mmHg"},
            SectionContext.VITALS,
        ),
        RegexConcept(
            EntityType.SCORE,
            re.compile(r"\bPHQ-?9\s*(?:=|:)?\s*(?P<value>\d{1,2})\b", re.IGNORECASE),
            "PHQ-9",
            {"scale": "PHQ-9"},
        ),
        RegexConcept(
            EntityType.SEVERITY,
            re.compile(r"\bpain\s*(?:=|:)?\s*(?P<value>\d{1,2})/10\b", re.IGNORECASE),
            "pain rating",
            {"scale": "0-10"},
        ),
        RegexConcept(
            EntityType.RISK,
            re.compile(r"\bSI\b|\bsuicidal ideation\b", re.IGNORECASE),
            "suicidal ideation",
            {},
            confidence_score=0.86,
        ),
    ]


def extract_match_attributes(match: re.Match[str]) -> dict[str, str | int | float | bool | None]:
    """Extract named regex groups into scalar attributes."""

    attributes: dict[str, str | int | float | bool | None] = {}
    for key, value in match.groupdict().items():
        if value is None:
            continue
        attributes[key] = int(value) if value.isdigit() else value
    return attributes


def dedupe_mentions(mentions: Sequence[ClinicalMention]) -> list[ClinicalMention]:
    """Dedupe exact same label/span pairs while preserving first occurrence."""

    seen: set[tuple[EntityType, int, int]] = set()
    deduped: list[ClinicalMention] = []
    for mention in sorted(mentions, key=lambda item: (item.start_char, item.end_char, item.entity_type.value)):
        key = (mention.entity_type, mention.start_char, mention.end_char)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(mention)
    return deduped


def merge_mentions(primary: Sequence[ClinicalMention], secondary: Sequence[ClinicalMention]) -> list[ClinicalMention]:
    """Merge deterministic and LLM mentions, preferring deterministic overlaps."""

    merged = list(primary)
    existing_keys = {(mention.entity_type, mention.start_char, mention.end_char) for mention in primary}
    for mention in secondary:
        key = (mention.entity_type, mention.start_char, mention.end_char)
        if key not in existing_keys:
            merged.append(mention)
            existing_keys.add(key)
    return sorted(merged, key=lambda item: (item.start_char, item.end_char, item.entity_type.value))


def remap_mentions_to_source(
    original_text: str,
    compressed_text: str,
    mentions: Sequence[ClinicalMention],
) -> list[ClinicalMention]:
    """Remap mention offsets from a compressed LLM excerpt back to the source note.

    AUDIT FIX: ``HybridExtractor`` sends ``compress_note_for_llm`` output to the
    LLM, so LLM mention offsets index the excerpt, not the original note. Merging
    them unchanged silently corrupted every downstream span (highlighting,
    evaluation, dedupe). Compressed excerpts are newline-joined verbatim sentence
    substrings of the source, so each line can be located in the source and the
    delta applied.

    Mentions that cannot be located, or whose remapped span does not reproduce
    the mention text exactly, are dropped rather than emitted with bad offsets.
    TODO(audit): count drops and emit telemetry; duplicated sentences map to the
    first occurrence, which copy-forwarded notes can make ambiguous.

    Args:
        original_text: Full source clinical note.
        compressed_text: Excerpt produced by ``compress_note_for_llm``.
        mentions: Mentions with offsets into ``compressed_text``.

    Returns:
        Mentions with offsets validated against ``original_text``.
    """

    line_maps: list[tuple[int, int, int]] = []
    cursor = 0
    search_from = 0
    for line in compressed_text.split("\n"):
        line_start = cursor
        line_end = cursor + len(line)
        found_at = original_text.find(line, search_from)
        if found_at < 0:
            found_at = original_text.find(line)
        if found_at >= 0 and line:
            line_maps.append((line_start, line_end, found_at))
            search_from = found_at + len(line)
        cursor = line_end + 1

    remapped: list[ClinicalMention] = []
    for mention in mentions:
        target = next(
            (entry for entry in line_maps if entry[0] <= mention.start_char and mention.end_char <= entry[1]),
            None,
        )
        if target is None:
            continue
        delta = target[2] - target[0]
        start, end = mention.start_char + delta, mention.end_char + delta
        if original_text[start:end] != mention.text:
            continue
        remapped.append(mention.model_copy(update={"start_char": start, "end_char": end}))
    return remapped


def compress_note_for_llm(text: str, mentions: Sequence[ClinicalMention], *, max_chars: int) -> str:
    """Build a high-signal note excerpt for LLM extraction.

    Uses mention-local sentences plus reasoning-heavy sections/phrases. This is
    deliberately character-budgeted to map cleanly onto token budgets without
    requiring a tokenizer dependency.
    """

    from clinical_nlp.negation import split_sentence_spans

    sentences = split_sentence_spans(text)
    selected: list[str] = []
    mention_offsets = {mention.start_char for mention in mentions}
    for sentence in sentences:
        sentence_text = sentence.text.strip()
        if any(sentence.start_char <= offset < sentence.end_char for offset in mention_offsets):
            selected.append(sentence_text)
            continue
        if TriagePolicy.ambiguous_terms_regex.search(sentence_text):
            selected.append(sentence_text)

    compressed = "\n".join(dict.fromkeys(selected)) or text.strip()
    if len(compressed) <= max_chars:
        return compressed
    return compressed[: max_chars - 24].rstrip() + "\n[truncated for budget]"
