"""Tests for gold-style clinical mention evaluation."""

from clinical_nlp.evaluation import OverlapStrategy, evaluate_mentions
from clinical_nlp.schemas import AssertionStatus, ClinicalMention, EntityType


def mention(
    text: str,
    start: int,
    end: int,
    entity_type: EntityType,
    *,
    assertion: AssertionStatus = AssertionStatus.PRESENT,
    source_id: str = "note-1",
) -> ClinicalMention:
    """Create a clinical mention for tests."""
    return ClinicalMention(
        text=text,
        entity_type=entity_type,
        start_char=start,
        end_char=end,
        assertion=assertion,
        source_id=source_id,
    )


def test_evaluate_mentions_reports_exact_and_partial_metrics() -> None:
    """Partial matching should reward overlapping spans while exact remains strict."""
    gold = [
        mention("chest pain", 7, 17, EntityType.SYMPTOM, assertion=AssertionStatus.ABSENT),
        mention("shortness of breath", 27, 46, EntityType.SYMPTOM),
    ]
    predicted = [
        mention("chest pain", 7, 17, EntityType.SYMPTOM, assertion=AssertionStatus.ABSENT),
        mention("breath", 40, 46, EntityType.SYMPTOM),
        mention("lisinopril", 50, 60, EntityType.MEDICATION),
    ]

    report = evaluate_mentions(predicted, gold, partial_threshold=0.3)

    assert report.exact.true_positive == 1
    assert report.exact.false_positive == 2
    assert report.exact.false_negative == 1
    assert report.partial.true_positive == 2
    assert report.partial_by_type[EntityType.SYMPTOM].recall == 1.0
    assert report.attribute_accuracy["assertion"].accuracy == 1.0


def test_evaluate_mentions_tracks_attribute_mismatches() -> None:
    """Assertion accuracy should identify matched spans with incorrect attributes."""
    gold = [mention("SI", 10, 12, EntityType.RISK, assertion=AssertionStatus.ABSENT)]
    predicted = [mention("SI", 10, 12, EntityType.RISK, assertion=AssertionStatus.PRESENT)]

    report = evaluate_mentions(predicted, gold)

    assertion_accuracy = report.attribute_accuracy["assertion"]
    assert assertion_accuracy.total == 1
    assert assertion_accuracy.correct == 0
    assert assertion_accuracy.accuracy == 0.0
    assert assertion_accuracy.mismatches


def test_token_jaccard_partial_matching() -> None:
    """Token overlap can be used when character spans are noisy."""
    gold = [mention("low back pain", 100, 113, EntityType.PROBLEM)]
    predicted = [mention("back pain", 300, 309, EntityType.PROBLEM)]

    report = evaluate_mentions(
        predicted,
        gold,
        partial_threshold=0.5,
        overlap_strategy=OverlapStrategy.TOKEN_JACCARD,
    )

    assert report.partial.true_positive == 1
    assert report.partial.f1 == 1.0
