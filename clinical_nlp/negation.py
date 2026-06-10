"""Context-aware negation and assertion scoping.

This module implements a lightweight NegEx-style resolver tailored for clinical
prototype extraction. It deliberately scopes triggers to the sentence containing
the mention and cuts the scope at termination cues such as ``but`` or
``however``. It is deterministic, fast, and easy to replace with a richer
clinical assertion model later.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum
from typing import Iterable, Sequence

from pydantic import BaseModel, ConfigDict

from clinical_nlp.lexicons import is_chronic_condition
from clinical_nlp.schemas import AssertionStatus, ClinicalMention

#: Recurring trigger circumstances for CONDITIONAL assertions (guideline A3
#: rule 2: "pain with exertion", "dizziness when standing"). Lexicon-limited;
#: expansion is gated on dev-split miss analysis.
CONDITIONAL_CIRCUMSTANCE_REGEX = re.compile(
    r"\b(?:with|when|upon|during|after|on)\s+"
    r"(?:exertion|exercise|activity|ambulation|stairs|standing|walking|sitting|"
    r"movement|lifting|bending|weight[- ]?bearing|palpation|prolonged\s+[a-z]+)\b",
    re.IGNORECASE,
)

#: Active-management cues for the chronic-active exception (guideline A3 rule
#: 4). The lookahead excludes temporal idioms ("on admission") that do not
#: indicate management.
ACTIVE_MANAGEMENT_REGEX = re.compile(
    r"\b(?:on|taking|takes|managed with|controlled (?:on|with)|stable on|continues|continuing)\s+"
    r"(?!(?:admission|arrival|exam|examination|presentation|review)\b)[A-Za-z]",
    re.IGNORECASE,
)


class ScopeDecision(StrEnum):
    """Reason category for assertion scoping."""

    PRE_NEGATION = "pre-negation"
    POST_NEGATION = "post-negation"
    FAMILY_HISTORY = "family-history"
    CONDITIONAL = "conditional"
    HYPOTHETICAL = "hypothetical"
    HISTORICAL = "historical"
    POST_HISTORICAL = "post-historical"
    CHRONIC_ACTIVE = "chronic-active-present"
    POSSIBLE = "possible"
    TERMINATED = "terminated"
    DEFAULT_PRESENT = "default-present"
    UNRESOLVED = "unresolved"


class AssertionScopeResult(BaseModel):
    """Assertion decision for a single mention."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    mention: ClinicalMention
    assertion: AssertionStatus
    decision: ScopeDecision
    trigger: str | None = None
    sentence_text: str


@dataclass(frozen=True, slots=True)
class SentenceSpan:
    """Half-open sentence span in source text."""

    text: str
    start_char: int
    end_char: int


class NegationScopeResolver:
    """Rule-based clinical assertion resolver.

    Args:
        pre_negation_triggers: Phrases that negate following mentions.
        post_negation_triggers: Phrases that negate preceding mentions.
        hypothetical_triggers: Phrases that mark following mentions as
            hypothetical rather than absent.
        termination_cues: Phrases that terminate the active trigger scope.
        post_scope_chars: Maximum number of characters after a mention to look
            for post-negation triggers like ``is denied``.
    """

    def __init__(
        self,
        *,
        pre_negation_triggers: Sequence[str] | None = None,
        post_negation_triggers: Sequence[str] | None = None,
        hypothetical_triggers: Sequence[str] | None = None,
        family_history_triggers: Sequence[str] | None = None,
        historical_triggers: Sequence[str] | None = None,
        post_historical_triggers: Sequence[str] | None = None,
        possible_triggers: Sequence[str] | None = None,
        termination_cues: Sequence[str] | None = None,
        post_scope_chars: int = 40,
    ) -> None:
        """Initialize compiled assertion-scope patterns."""

        self.pre_negation_triggers = tuple(
            pre_negation_triggers
            or (
                "denies",
                "denied",
                "no",
                "not",
                "without",
                "w/o",
                "negative for",
                "free of",
                "absence of",
            )
        )
        self.post_negation_triggers = tuple(post_negation_triggers or ("is denied", "are denied", "denied"))
        # REVIEW: annotation guideline A3 rule 5 classifies "rule out X" as
        # POSSIBLE, but tests/test_negation.py::test_hypothetical_and_post_negation_are_scoped
        # pins "Rule out pneumonia" as HYPOTHETICAL and per the ground rules we
        # do not change existing tests. Keeping rule-out triggers HYPOTHETICAL
        # until the author rules on the conflict; the operating-point policy
        # treats both classes identically (never an active problem-list entry),
        # so the routing consequence is nil either way.
        self.hypothetical_triggers = tuple(
            hypothetical_triggers
            or (
                "rule out",
                "r/o",
                "evaluate for",
                "monitor for",
                "concern for",
                "if develops",
                "watch for",
                "if",
                "in case of",
                "educated on",
                "education on",
                "warning signs of",
                "return precautions for",
                "precautions for",
                "instructed to report",
            )
        )
        self.family_history_triggers = tuple(
            family_history_triggers
            or (
                "family history of",
                "family history",
                "family hx",
                "fhx",
                "mother",
                "father",
                "brother",
                "sister",
                "sibling",
                "maternal",
                "paternal",
                "grandmother",
                "grandfather",
                "aunt",
                "uncle",
                "son",
                "daughter",
            )
        )
        self.historical_triggers = tuple(
            historical_triggers
            or (
                "history of",
                "hx of",
                "h/o",
                "status post",
                "s/p",
                "prior",
                "previous",
                "past episode of",
            )
        )
        self.post_historical_triggers = tuple(post_historical_triggers or ("resolved", "has resolved", "had resolved"))
        self.possible_triggers = tuple(
            possible_triggers
            or (
                "possible",
                "probable",
                "likely",
                "presumed",
                "suspected",
                "suspect",
                "cannot exclude",
                "cannot rule out",
                "questionable",
            )
        )
        self.termination_cues = tuple(
            termination_cues
            or (
                "but",
                "however",
                "except",
                "although",
                "though",
                "yet",
                "nevertheless",
                "other than",
            )
        )
        self.post_scope_chars = post_scope_chars
        self._pre_negation_regex = compile_phrase_regex(self.pre_negation_triggers)
        self._post_negation_regex = compile_phrase_regex(self.post_negation_triggers)
        self._hypothetical_regex = compile_phrase_regex(self.hypothetical_triggers)
        self._family_history_regex = compile_phrase_regex(self.family_history_triggers)
        self._historical_regex = compile_phrase_regex(self.historical_triggers)
        self._post_historical_regex = compile_phrase_regex(self.post_historical_triggers)
        self._possible_regex = compile_phrase_regex(self.possible_triggers)
        self._termination_regex = compile_phrase_regex(self.termination_cues)
        # Backward-scoping cues that, when found after the mention beyond the
        # post-scope window, make the assertion unresolvable (-> UNKNOWN)
        # rather than silently PRESENT. Forward-scoping cues ("no", "denies")
        # after a mention bind to *later* concepts and are deliberately
        # excluded; flagging them would mark every list construction UNKNOWN.
        self._unbound_backward_regex = compile_phrase_regex(
            tuple(dict.fromkeys(self.post_negation_triggers + self.post_historical_triggers))
        )

    def annotate_mentions(self, text: str, mentions: Iterable[ClinicalMention]) -> list[ClinicalMention]:
        """Return mention copies with scoped assertion labels.

        Args:
            text: Source clinical note.
            mentions: Predicted or gold mentions with valid source offsets.

        Returns:
            New ``ClinicalMention`` objects with assertion labels updated.
        """

        return [self.resolve_mention(text, mention).mention for mention in mentions]

    def resolve_mentions(self, text: str, mentions: Iterable[ClinicalMention]) -> list[AssertionScopeResult]:
        """Resolve scoped assertion for multiple mentions."""

        sentence_spans = split_sentence_spans(text)
        return [self.resolve_mention(text, mention, sentence_spans=sentence_spans) for mention in mentions]

    def resolve_mention(
        self,
        text: str,
        mention: ClinicalMention,
        *,
        sentence_spans: Sequence[SentenceSpan] | None = None,
    ) -> AssertionScopeResult:
        """Resolve assertion for a single mention.

        Raises:
            ValueError: If mention offsets are outside the source text.
        """

        if mention.end_char > len(text):
            msg = f"Mention span {mention.span} exceeds source text length {len(text)}."
            raise ValueError(msg)

        sentence = find_sentence_for_mention(sentence_spans or split_sentence_spans(text), mention)
        relative_start = mention.start_char - sentence.start_char
        relative_end = mention.end_char - sentence.start_char
        before = sentence.text[:relative_start]
        after = sentence.text[relative_end : relative_end + self.post_scope_chars]
        after_sentence = sentence.text[relative_end:]

        # Annotation guideline A3 decision order: family-history, conditional,
        # hypothetical, historical (with the chronic-active exception),
        # possible, negation, then default. First matching rule wins.

        family = self._find_pre_trigger_unless_negated(before, self._family_history_regex)
        if family is not None:
            assertion, decision, trigger = family
            return self._build_result(mention, assertion, decision, trigger, sentence)

        pre_negation_trigger = find_active_trigger(before, self._pre_negation_regex, self._termination_regex)

        conditional = None if pre_negation_trigger else find_conditional_circumstance(after_sentence, self._termination_regex)
        if conditional:
            return self._build_result(
                mention,
                AssertionStatus.CONDITIONAL,
                ScopeDecision.CONDITIONAL,
                conditional,
                sentence,
            )

        hypothetical = find_active_trigger(before, self._hypothetical_regex, self._termination_regex)
        if hypothetical:
            return self._build_result(
                mention,
                AssertionStatus.HYPOTHETICAL,
                ScopeDecision.HYPOTHETICAL,
                hypothetical,
                sentence,
            )

        historical = self._find_pre_trigger_unless_negated(before, self._historical_regex)
        if historical is not None:
            assertion, decision, trigger = historical
            if assertion == AssertionStatus.HISTORICAL and self._is_chronic_active(mention, after_sentence):
                # Guideline A3 rule 4 boundary: "history of <chronic condition>,
                # on <management>" means longstanding and active, not resolved.
                return self._build_result(
                    mention,
                    AssertionStatus.PRESENT,
                    ScopeDecision.CHRONIC_ACTIVE,
                    trigger,
                    sentence,
                )
            return self._build_result(mention, assertion, decision, trigger, sentence)

        post_historical = find_post_negation(after, self._post_historical_regex, self._termination_regex)
        if post_historical:
            return self._build_result(
                mention,
                AssertionStatus.HISTORICAL,
                ScopeDecision.POST_HISTORICAL,
                post_historical,
                sentence,
            )

        possible = find_active_trigger(before, self._possible_regex, self._termination_regex)
        if possible:
            return self._build_result(
                mention,
                AssertionStatus.POSSIBLE,
                ScopeDecision.POSSIBLE,
                possible,
                sentence,
            )

        if pre_negation_trigger:
            return self._build_result(
                mention,
                AssertionStatus.ABSENT,
                ScopeDecision.PRE_NEGATION,
                pre_negation_trigger,
                sentence,
            )

        post_negation = find_post_negation(after, self._post_negation_regex, self._termination_regex)
        if post_negation:
            return self._build_result(
                mention,
                AssertionStatus.ABSENT,
                ScopeDecision.POST_NEGATION,
                post_negation,
                sentence,
            )

        # Default-PRESENT is abolished for unresolvable cases (audit C2,
        # operating-point policy section 3): a backward-scoping cue beyond the
        # post-scope window, or a mention that arrived UNKNOWN with no rule
        # evidence, yields UNKNOWN (high review priority via rollup) instead
        # of silently asserting presence.
        unbound = find_unbound_backward_cue(
            after_sentence,
            self._unbound_backward_regex,
            self._termination_regex,
            window_chars=self.post_scope_chars,
        )
        if unbound:
            return self._build_result(mention, AssertionStatus.UNKNOWN, ScopeDecision.UNRESOLVED, unbound, sentence)
        if mention.assertion == AssertionStatus.UNKNOWN:
            return self._build_result(mention, AssertionStatus.UNKNOWN, ScopeDecision.UNRESOLVED, None, sentence)

        return self._build_result(
            mention,
            mention.assertion,
            ScopeDecision.DEFAULT_PRESENT,
            None,
            sentence,
        )

    def _find_pre_trigger_unless_negated(
        self,
        before: str,
        trigger_regex: re.Pattern[str],
    ) -> tuple[AssertionStatus, ScopeDecision, str] | None:
        """Find a pre-mention family/historical trigger, honoring negation precedence.

        "No history of MI" and "denies family history of cancer" are ABSENT,
        not HISTORICAL/FAMILY_HISTORY: a negation trigger immediately scoping
        the family/historical cue wins.
        """

        scoped = trim_to_last_termination(before, self._termination_regex)
        matches = list(trigger_regex.finditer(scoped))
        if not matches:
            return None
        match = matches[-1]
        if self._pre_negation_regex.search(scoped[: match.start()]):
            return (AssertionStatus.ABSENT, ScopeDecision.PRE_NEGATION, scoped[: match.end()].strip()[-60:])
        assertion = (
            AssertionStatus.FAMILY_HISTORY
            if trigger_regex is self._family_history_regex
            else AssertionStatus.HISTORICAL
        )
        decision = (
            ScopeDecision.FAMILY_HISTORY
            if trigger_regex is self._family_history_regex
            else ScopeDecision.HISTORICAL
        )
        return (assertion, decision, match.group(0).strip())

    def _is_chronic_active(self, mention: ClinicalMention, after_sentence: str) -> bool:
        """Return whether the chronic-active exception (A3 rule 4) applies."""

        if not is_chronic_condition(mention.canonical_text):
            return False
        return bool(ACTIVE_MANAGEMENT_REGEX.search(after_sentence))

    def _build_result(
        self,
        mention: ClinicalMention,
        assertion: AssertionStatus,
        decision: ScopeDecision,
        trigger: str | None,
        sentence: SentenceSpan,
    ) -> AssertionScopeResult:
        reason = f"{decision.value}: {trigger}" if trigger else decision.value
        return AssertionScopeResult(
            mention=mention.with_assertion(assertion, reason=reason),
            assertion=assertion,
            decision=decision,
            trigger=trigger,
            sentence_text=sentence.text,
        )


def split_sentence_spans(text: str) -> list[SentenceSpan]:
    """Split text into sentence-like spans with source offsets.

    The splitter keeps line breaks as hard boundaries and uses punctuation only
    when followed by whitespace or the end of the document. This avoids many
    decimal-number failures while staying dependency-free.
    """

    spans: list[SentenceSpan] = []
    start = 0
    for match in re.finditer(r"(?:[.!?](?=\s|$)|\n+)", text):
        end = match.end()
        append_sentence_span(spans, text, start, end)
        start = end
    append_sentence_span(spans, text, start, len(text))
    return spans or [SentenceSpan(text=text, start_char=0, end_char=len(text))]


def append_sentence_span(spans: list[SentenceSpan], text: str, start: int, end: int) -> None:
    """Append a trimmed sentence span if it contains non-whitespace text."""

    raw = text[start:end]
    leading = len(raw) - len(raw.lstrip())
    trailing = len(raw.rstrip())
    trimmed_start = start + leading
    trimmed_end = start + trailing
    if trimmed_start >= trimmed_end:
        return
    spans.append(
        SentenceSpan(
            text=text[trimmed_start:trimmed_end],
            start_char=trimmed_start,
            end_char=trimmed_end,
        )
    )


def find_sentence_for_mention(sentences: Sequence[SentenceSpan], mention: ClinicalMention) -> SentenceSpan:
    """Find the sentence span containing a mention."""

    for sentence in sentences:
        if sentence.start_char <= mention.start_char < sentence.end_char:
            return sentence
    msg = f"No sentence span contains mention offsets {mention.span}."
    raise ValueError(msg)


def compile_phrase_regex(phrases: Sequence[str]) -> re.Pattern[str]:
    """Compile phrases into a boundary-aware regex."""

    if not phrases:
        return re.compile(r"a\A")
    escaped = [re.escape(phrase).replace(r"\ ", r"\s+") for phrase in sorted(phrases, key=len, reverse=True)]
    pattern = r"(?<![A-Za-z0-9])(?:" + "|".join(escaped) + r")(?![A-Za-z0-9])"
    return re.compile(pattern, re.IGNORECASE)


def find_active_trigger(
    text_before_mention: str,
    trigger_regex: re.Pattern[str],
    termination_regex: re.Pattern[str],
) -> str | None:
    """Find the nearest trigger not cut off by a termination cue."""

    scoped_text = trim_to_last_termination(text_before_mention, termination_regex)
    matches = list(trigger_regex.finditer(scoped_text))
    if not matches:
        return None
    trigger = matches[-1].group(0).strip()
    if trigger.casefold() == "not" and re.search(r"\bnot\s+only\b", scoped_text, flags=re.IGNORECASE):
        return None
    return trigger


def find_post_negation(
    text_after_mention: str,
    trigger_regex: re.Pattern[str],
    termination_regex: re.Pattern[str],
) -> str | None:
    """Find a post-negation trigger before any termination cue."""

    termination_match = termination_regex.search(text_after_mention)
    search_text = text_after_mention[: termination_match.start()] if termination_match else text_after_mention
    match = trigger_regex.search(search_text)
    return match.group(0).strip() if match else None


def find_conditional_circumstance(text_after_mention: str, termination_regex: re.Pattern[str]) -> str | None:
    """Find a recurring trigger circumstance after the mention (A3 rule 2)."""

    termination_match = termination_regex.search(text_after_mention)
    search_text = text_after_mention[: termination_match.start()] if termination_match else text_after_mention
    match = CONDITIONAL_CIRCUMSTANCE_REGEX.search(search_text)
    return match.group(0).strip() if match else None


def find_unbound_backward_cue(
    text_after_mention: str,
    backward_regex: re.Pattern[str],
    termination_regex: re.Pattern[str],
    *,
    window_chars: int,
) -> str | None:
    """Find a backward-scoping cue beyond the post-scope window.

    Such a cue ("...later categorically denied") plausibly bears on the
    mention but is too far away for the windowed post rules to bind safely;
    the mention is unresolvable rather than silently present (audit C2).
    """

    termination_match = termination_regex.search(text_after_mention)
    search_text = text_after_mention[: termination_match.start()] if termination_match else text_after_mention
    match = backward_regex.search(search_text)
    if match and match.start() >= window_chars:
        return match.group(0).strip()
    return None


def trim_to_last_termination(text: str, termination_regex: re.Pattern[str]) -> str:
    """Return text after the last termination cue."""

    matches = list(termination_regex.finditer(text))
    if not matches:
        return text
    return text[matches[-1].end() :]
