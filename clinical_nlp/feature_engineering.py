"""Feature engineering bridge from clinical mentions to tabular ML inputs."""

from __future__ import annotations

import importlib
from collections import defaultdict
from collections.abc import Iterable, Sequence
from datetime import UTC, datetime, timedelta

from pydantic import BaseModel, ConfigDict, Field, field_validator

from clinical_nlp.schemas import AssertionStatus, ClinicalMention, EntityType

FeatureValue = int | float | str | bool | None


class MentionRecord(BaseModel):
    """A mention aligned to patient and visit time.

    Attributes:
        patient_id: Stable patient identifier.
        visit_id: Visit, encounter, or prediction-row identifier.
        observed_at: Timestamp when the source note/mention was available.
        mention: Validated clinical mention.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    patient_id: str = Field(min_length=1)
    visit_id: str = Field(min_length=1)
    observed_at: datetime
    mention: ClinicalMention

    @field_validator("observed_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        """Require timezone-aware timestamps to prevent split leakage."""
        if value.tzinfo is None or value.utcoffset() is None:
            msg = "observed_at must be timezone-aware."
            raise ValueError(msg)
        return value


class PredictionIndexRow(BaseModel):
    """A row for which static model features should be generated."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    patient_id: str = Field(min_length=1)
    visit_id: str = Field(min_length=1)
    prediction_time: datetime

    @field_validator("prediction_time")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        """Require timezone-aware prediction timestamps."""
        if value.tzinfo is None or value.utcoffset() is None:
            msg = "prediction_time must be timezone-aware."
            raise ValueError(msg)
        return value


class FeatureSpec(BaseModel):
    """Static feature aggregation configuration."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    feature_name: str = Field(min_length=1)
    entity_type: EntityType
    normalized_text: str | None = None
    numeric_attribute: str | None = "value"
    lookback_days: int = Field(default=365, ge=0)
    include_assertion_counts: bool = True
    include_missing_indicator: bool = True


class FeatureMatrix(BaseModel):
    """Dependency-light tabular feature matrix.

    ``rows`` is intentionally a list of dictionaries so callers can convert to
    pandas, NumPy, Polars, Arrow, or sklearn dict vectorizers without this core
    package forcing a heavy dependency.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    rows: list[dict[str, FeatureValue]]
    feature_names: list[str]

    def to_pandas(self) -> object:
        """Convert rows to a pandas DataFrame if pandas is installed."""
        try:
            pandas = importlib.import_module("pandas")
        except ImportError as exc:
            msg = "pandas is not installed. Install optional classic ML dependencies first."
            raise RuntimeError(msg) from exc
        return pandas.DataFrame(self.rows)


class MentionFeatureEngineer:
    """Aggregate validated mentions into leakage-safe tabular features."""

    def __init__(self, specs: Sequence[FeatureSpec]) -> None:
        """Initialize feature specs."""
        self.specs = tuple(specs)

    def build_matrix(
        self,
        records: Sequence[MentionRecord],
        prediction_index: Sequence[PredictionIndexRow],
    ) -> FeatureMatrix:
        """Build a static model matrix with temporal lookback constraints.

        Only mentions with ``observed_at < prediction_time`` are eligible. This
        strict cutoff prevents same-visit or future-note leakage by default.
        """
        records_by_patient: dict[str, list[MentionRecord]] = defaultdict(list)
        for record in records:
            records_by_patient[record.patient_id].append(record)
        for patient_records in records_by_patient.values():
            patient_records.sort(key=lambda item: item.observed_at)

        rows: list[dict[str, FeatureValue]] = []
        all_feature_names: set[str] = {"patient_id", "visit_id", "prediction_time"}
        for index_row in prediction_index:
            row: dict[str, FeatureValue] = {
                "patient_id": index_row.patient_id,
                "visit_id": index_row.visit_id,
                "prediction_time": index_row.prediction_time.isoformat(),
            }
            patient_records = records_by_patient.get(index_row.patient_id, [])
            for spec in self.specs:
                mention_window = filter_lookback_records(patient_records, index_row.prediction_time, spec.lookback_days)
                feature_values = aggregate_spec(spec, mention_window)
                row.update(feature_values)
                all_feature_names.update(feature_values)
            rows.append(row)

        feature_names = [
            "patient_id",
            "visit_id",
            "prediction_time",
            *sorted(name for name in all_feature_names if name not in {"patient_id", "visit_id", "prediction_time"}),
        ]
        return FeatureMatrix(rows=rows, feature_names=feature_names)


def filter_lookback_records(
    records: Sequence[MentionRecord],
    prediction_time: datetime,
    lookback_days: int,
) -> list[MentionRecord]:
    """Return records available before prediction time and inside lookback."""
    lookback_start = prediction_time - timedelta(days=lookback_days)
    return [
        record
        for record in records
        if lookback_start <= record.observed_at < prediction_time
    ]


def aggregate_spec(spec: FeatureSpec, records: Iterable[MentionRecord]) -> dict[str, FeatureValue]:
    """Aggregate one feature spec over a temporal mention window."""
    matching_mentions = [record.mention for record in records if mention_matches_spec(record.mention, spec)]
    prefix = spec.feature_name
    present_mentions = [mention for mention in matching_mentions if mention.assertion == AssertionStatus.PRESENT]
    absent_mentions = [mention for mention in matching_mentions if mention.assertion == AssertionStatus.ABSENT]

    features: dict[str, FeatureValue] = {}
    if spec.include_assertion_counts:
        features[f"{prefix}__present_count"] = len(present_mentions)
        features[f"{prefix}__absent_count"] = len(absent_mentions)
        features[f"{prefix}__possible_count"] = sum(
            mention.assertion in {AssertionStatus.POSSIBLE, AssertionStatus.HYPOTHETICAL}
            for mention in matching_mentions
        )

    numeric_values = [
        numeric_value
        for mention in present_mentions
        if spec.numeric_attribute is not None
        for numeric_value in [coerce_float(mention.attributes.get(spec.numeric_attribute))]
        if numeric_value is not None
    ]
    if numeric_values:
        features[f"{prefix}__last"] = numeric_values[-1]
        features[f"{prefix}__min"] = min(numeric_values)
        features[f"{prefix}__max"] = max(numeric_values)
        features[f"{prefix}__mean"] = sum(numeric_values) / len(numeric_values)
    else:
        features[f"{prefix}__last"] = None
        features[f"{prefix}__min"] = None
        features[f"{prefix}__max"] = None
        features[f"{prefix}__mean"] = None

    if spec.include_missing_indicator:
        features[f"{prefix}__missing"] = len(matching_mentions) == 0
        features[f"{prefix}__explicitly_negated"] = bool(absent_mentions) and not present_mentions

    return features


def mention_matches_spec(mention: ClinicalMention, spec: FeatureSpec) -> bool:
    """Return whether a mention should contribute to a feature spec."""
    if mention.entity_type != spec.entity_type:
        return False
    return not (spec.normalized_text and mention.canonical_text != spec.normalized_text.casefold())


def coerce_float(value: object) -> float | None:
    """Safely coerce scalar mention attributes to float."""
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def default_feature_specs() -> list[FeatureSpec]:
    """Starter feature specs for common clinical predictors."""
    return [
        FeatureSpec(feature_name="heart_rate", entity_type=EntityType.VITAL, normalized_text="heart rate"),
        FeatureSpec(feature_name="pain_rating", entity_type=EntityType.SEVERITY, normalized_text="pain rating"),
        FeatureSpec(feature_name="phq9", entity_type=EntityType.SCORE, normalized_text="PHQ-9"),
        FeatureSpec(feature_name="suicidal_ideation", entity_type=EntityType.RISK, normalized_text="suicidal ideation"),
    ]


def utc_datetime(year: int, month: int, day: int) -> datetime:
    """Convenience helper for tests and examples."""
    return datetime(year, month, day, tzinfo=UTC)
