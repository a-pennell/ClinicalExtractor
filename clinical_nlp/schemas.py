"""Typed clinical NLP schemas.

The models in this module intentionally follow common spaCy and HuggingFace
NER conventions: character offsets are half-open ``[start_char, end_char)``,
entity labels are explicit, and predictions carry normalized confidence
scores. They are framework-agnostic and can be constructed from rule systems,
spaCy ``Span`` objects, token-classification pipelines, or human annotation.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Mapping, Protocol

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class EntityType(StrEnum):
    """Supported clinical entity labels."""

    PROBLEM = "problem"
    SYMPTOM = "symptom"
    FINDING = "finding"
    MEDICATION = "medication"
    ALLERGY = "allergy"
    PROCEDURE = "procedure"
    LAB = "lab"
    VITAL = "vital"
    SCORE = "score"
    BODY_SITE = "body-site"
    LATERALITY = "laterality"
    DURATION = "duration"
    SEVERITY = "severity"
    FUNCTIONAL_LIMITATION = "functional-limitation"
    PLAN = "plan"
    REFERRAL = "referral"
    IMAGING = "imaging"
    EXERCISE = "exercise"
    SPECIAL_TEST = "special-test"
    RISK = "risk"
    OTHER = "other"


class AssertionStatus(StrEnum):
    """Assertion labels used for clinical mention context."""

    PRESENT = "present"
    ABSENT = "absent"
    POSSIBLE = "possible"
    HYPOTHETICAL = "hypothetical"
    HISTORICAL = "historical"
    FAMILY_HISTORY = "family-history"
    PLANNED = "planned"
    ORDERED = "ordered"
    CONFLICTING = "conflicting"
    UNKNOWN = "unknown"


class SectionContext(StrEnum):
    """Common note section contexts."""

    CHIEF_COMPLAINT = "chief-complaint"
    HISTORY = "history"
    REVIEW_OF_SYSTEMS = "review-of-systems"
    PAST_MEDICAL_HISTORY = "past-medical-history"
    MEDICATIONS = "medications"
    ALLERGIES = "allergies"
    FAMILY_HISTORY = "family-history"
    SOCIAL_HISTORY = "social-history"
    VITALS = "vitals"
    OBJECTIVE = "objective"
    ASSESSMENT = "assessment"
    PLAN = "plan"
    UNKNOWN = "unknown"


ScalarAttribute = str | int | float | bool | None


class ClinicalMention(BaseModel):
    """A single clinical entity mention with rich local attributes.

    Attributes:
        text: Exact source text covered by the mention span.
        entity_type: Normalized entity label.
        start_char: Inclusive character offset into the source document.
        end_char: Exclusive character offset into the source document.
        assertion: Assertion status scoped to this mention.
        section_context: Clinical note section that contains the mention.
        resolved_abbreviation: Expanded abbreviation for this mention, if any.
        confidence_score: Calibrated or heuristic confidence in ``[0.0, 1.0]``.
        source_id: Optional document, note, or encounter identifier.
        mention_id: Optional stable mention identifier from an upstream system.
        normalized_text: Optional canonical normalized text.
        attributes: Additional scalar attributes such as value, unit, dose, or
            laterality. Nested structures are deliberately avoided here so the
            mention can be serialized cleanly for spaCy/HF-style datasets.
    """

    model_config = ConfigDict(extra="forbid", frozen=True, validate_assignment=True)

    text: str = Field(min_length=1)
    entity_type: EntityType
    start_char: int = Field(ge=0)
    end_char: int = Field(ge=0)
    assertion: AssertionStatus = AssertionStatus.PRESENT
    section_context: SectionContext | str = SectionContext.UNKNOWN
    resolved_abbreviation: str | None = None
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0)
    source_id: str | None = None
    mention_id: str | None = None
    normalized_text: str | None = None
    attributes: Mapping[str, ScalarAttribute] = Field(default_factory=dict)

    @field_validator("text", "resolved_abbreviation", "source_id", "mention_id", "normalized_text", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> object:
        """Normalize incoming strings without changing null values."""

        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("attributes")
    @classmethod
    def validate_flat_attributes(cls, value: Mapping[str, ScalarAttribute]) -> Mapping[str, ScalarAttribute]:
        """Ensure attribute payloads stay flat and serializable."""

        for key in value:
            if not key or not key.strip():
                msg = "Attribute keys must be non-empty strings."
                raise ValueError(msg)
        return dict(value)

    @model_validator(mode="after")
    def validate_offsets(self) -> ClinicalMention:
        """Validate mention character offsets."""

        if self.end_char <= self.start_char:
            msg = "end_char must be greater than start_char."
            raise ValueError(msg)
        return self

    @property
    def span(self) -> tuple[int, int]:
        """Return the half-open character span for this mention."""

        return (self.start_char, self.end_char)

    @property
    def canonical_text(self) -> str:
        """Return canonical text used for exact text comparisons."""

        return (self.normalized_text or self.resolved_abbreviation or self.text).casefold().strip()

    def with_assertion(self, assertion: AssertionStatus, *, reason: str | None = None) -> ClinicalMention:
        """Return a copy with a new assertion label.

        Args:
            assertion: Scoped assertion to assign.
            reason: Optional diagnostic reason stored in attributes.

        Returns:
            A new immutable ``ClinicalMention`` instance.
        """

        attributes = dict(self.attributes)
        if reason:
            attributes["assertion_reason"] = reason
        return self.model_copy(update={"assertion": assertion, "attributes": attributes})


class SpanLike(Protocol):
    """Minimal protocol for constructing mentions from spaCy-like spans."""

    text: str
    start_char: int
    end_char: int
    label_: str


def mention_from_spacy_span(
    span: SpanLike,
    *,
    assertion: AssertionStatus = AssertionStatus.PRESENT,
    section_context: SectionContext | str = SectionContext.UNKNOWN,
    confidence_score: float = 1.0,
    attributes: Mapping[str, ScalarAttribute] | None = None,
) -> ClinicalMention:
    """Build a ``ClinicalMention`` from a spaCy-style ``Span``.

    Args:
        span: Object exposing ``text``, ``start_char``, ``end_char``, and
            ``label_`` attributes.
        assertion: Assertion scoped to the span.
        section_context: Section containing the span.
        confidence_score: Confidence in ``[0, 1]``.
        attributes: Optional flat scalar attributes.

    Returns:
        A validated ``ClinicalMention``.
    """

    return ClinicalMention(
        text=span.text,
        entity_type=EntityType(span.label_),
        start_char=span.start_char,
        end_char=span.end_char,
        assertion=assertion,
        section_context=section_context,
        confidence_score=confidence_score,
        attributes=attributes or {},
    )


def mentions_from_hf_token_classification(
    predictions: list[Mapping[str, object]],
    *,
    entity_type_key: str = "entity_group",
    score_key: str = "score",
) -> list[ClinicalMention]:
    """Convert HuggingFace token-classification outputs to mentions.

    Args:
        predictions: Pipeline outputs containing ``word``, ``start``, ``end``,
            an entity label key, and a score.
        entity_type_key: Key containing the entity label.
        score_key: Key containing the confidence score.

    Returns:
        Validated clinical mentions.

    Raises:
        ValueError: If a prediction is missing required offsets or labels.
    """

    mentions: list[ClinicalMention] = []
    for prediction in predictions:
        try:
            text = str(prediction["word"])
            entity_type = EntityType(str(prediction[entity_type_key]))
            start_char = int(prediction["start"])
            end_char = int(prediction["end"])
            confidence_score = float(prediction.get(score_key, 1.0))
        except (KeyError, TypeError, ValueError) as exc:
            msg = f"Invalid HuggingFace token-classification prediction: {prediction!r}"
            raise ValueError(msg) from exc

        mentions.append(
            ClinicalMention(
                text=text,
                entity_type=entity_type,
                start_char=start_char,
                end_char=end_char,
                confidence_score=confidence_score,
            )
        )
    return mentions
