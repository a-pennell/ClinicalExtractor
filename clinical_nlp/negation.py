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

from clinical_nlp.schemas import AssertionStatus, ClinicalMention


class ScopeDecision(StrEnum):
    """Reason category for assertion scoping."""

    PRE_NEGATION = "pre-negation"
    POST_NEGATION = "post-negation"
    HYPOTHETICAL = "hypothetical"
    TERMINATED = "terminated"
    DEFAULT_PRESENT = "default-present"


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
        self._termination_regex = compile_phrase_regex(self.termination_cues)

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

        hypothetical = find_active_trigger(before, self._hypothetical_regex, self._termination_regex)
        if hypothetical:
            return self._build_result(
                mention,
                AssertionStatus.HYPOTHETICAL,
                ScopeDecision.HYPOTHETICAL,
                hypothetical,
                sentence,
            )

        pre_negation = find_active_trigger(before, self._pre_negation_regex, self._termination_regex)
        if pre_negation:
            return self._build_result(
                mention,
                AssertionStatus.ABSENT,
                ScopeDecision.PRE_NEGATION,
                pre_negation,
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

        return self._build_result(
            mention,
            mention.assertion if mention.assertion != AssertionStatus.UNKNOWN else AssertionStatus.PRESENT,
            ScopeDecision.DEFAULT_PRESENT,
            None,
            sentence,
        )

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


def trim_to_last_termination(text: str, termination_regex: re.Pattern[str]) -> str:
    """Return text after the last termination cue."""

    matches = list(termination_regex.finditer(text))
    if not matches:
        return text
    return text[matches[-1].end() :]
