"""Tests for the audit nitpick fixes (merge_mentions overlap, SI context guard)."""

from clinical_nlp.extractors import NLPExtractor, merge_mentions
from clinical_nlp.schemas import AssertionStatus, ClinicalMention, EntityType


def mention(
    text: str,
    start: int,
    end: int,
    *,
    entity_type: EntityType = EntityType.PROBLEM,
    normalized: str | None = None,
) -> ClinicalMention:
    return ClinicalMention(
        text=text,
        entity_type=entity_type,
        start_char=start,
        end_char=end,
        normalized_text=normalized or text,
    )


def test_merge_drops_near_duplicate_overlapping_span() -> None:
    primary = [mention("chest pain", 0, 10, normalized="chest pain")]
    # LLM span one char off, same canonical text -> dropped as a near-duplicate.
    secondary = [mention("chest pain", 1, 11, normalized="chest pain")]

    merged = merge_mentions(primary, secondary)

    assert len(merged) == 1
    assert merged[0].span == (0, 10)


def test_merge_keeps_distinct_non_overlapping_mentions() -> None:
    primary = [mention("chest pain", 0, 10, normalized="chest pain")]
    secondary = [mention("chest pain", 40, 50, normalized="chest pain")]

    merged = merge_mentions(primary, secondary)

    assert len(merged) == 2


def test_bare_si_without_psych_context_is_downgraded_not_suppressed() -> None:
    mentions = NLPExtractor().extract("SI joint tenderness on exam. ROM limited.")
    si = [m for m in mentions if m.normalized_text == "suicidal ideation"]

    assert len(si) == 1  # never suppressed
    assert si[0].confidence_score <= 0.4
    assert si[0].attributes.get("review_reason") == "ambiguous-SI-no-psych-context"


def test_bare_si_with_psych_context_keeps_confidence() -> None:
    mentions = NLPExtractor().extract("PHQ-9 18. Denies SI.")
    si = [m for m in mentions if m.normalized_text == "suicidal ideation"]

    assert len(si) == 1
    assert si[0].confidence_score > 0.4
    assert si[0].assertion == AssertionStatus.ABSENT
