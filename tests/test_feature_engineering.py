"""Tests for NLP-to-classic-ML feature aggregation."""

from datetime import UTC, datetime

from clinical_nlp.feature_engineering import FeatureSpec, MentionFeatureEngineer, MentionRecord, PredictionIndexRow
from clinical_nlp.schemas import AssertionStatus, ClinicalMention, EntityType


def clinical_mention(
    text: str,
    *,
    assertion: AssertionStatus = AssertionStatus.PRESENT,
    value: int | None = None,
) -> ClinicalMention:
    """Build a simple test mention."""
    attributes = {"value": value} if value is not None else {}
    return ClinicalMention(
        text=text,
        entity_type=EntityType.SEVERITY,
        start_char=0,
        end_char=len(text),
        assertion=assertion,
        normalized_text="pain rating",
        attributes=attributes,
    )


def test_feature_engineering_respects_temporal_cutoff_and_negation() -> None:
    """Features should include prior data only and distinguish negated from missing."""
    engineer = MentionFeatureEngineer(
        [FeatureSpec(feature_name="pain_rating", entity_type=EntityType.SEVERITY, normalized_text="pain rating")]
    )
    prediction_time = datetime(2026, 1, 10, tzinfo=UTC)
    records = [
        MentionRecord(
            patient_id="p1",
            visit_id="v1",
            observed_at=datetime(2026, 1, 1, tzinfo=UTC),
            mention=clinical_mention("pain 6/10", value=6),
        ),
        MentionRecord(
            patient_id="p1",
            visit_id="future",
            observed_at=datetime(2026, 1, 12, tzinfo=UTC),
            mention=clinical_mention("pain 9/10", value=9),
        ),
        MentionRecord(
            patient_id="p2",
            visit_id="v2",
            observed_at=datetime(2026, 1, 1, tzinfo=UTC),
            mention=clinical_mention("pain", assertion=AssertionStatus.ABSENT),
        ),
    ]
    index = [
        PredictionIndexRow(patient_id="p1", visit_id="target-1", prediction_time=prediction_time),
        PredictionIndexRow(patient_id="p2", visit_id="target-2", prediction_time=prediction_time),
        PredictionIndexRow(patient_id="p3", visit_id="target-3", prediction_time=prediction_time),
    ]

    matrix = engineer.build_matrix(records, index)

    assert matrix.rows[0]["pain_rating__last"] == 6
    assert matrix.rows[0]["pain_rating__max"] == 6
    assert matrix.rows[0]["pain_rating__missing"] is False
    assert matrix.rows[1]["pain_rating__explicitly_negated"] is True
    assert matrix.rows[1]["pain_rating__missing"] is False
    assert matrix.rows[2]["pain_rating__missing"] is True
