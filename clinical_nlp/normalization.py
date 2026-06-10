"""Terminology normalization layer for extracted clinical mentions.

AUDIT SCAFFOLD: the Python pipeline previously emitted ``normalized_text`` as a
raw string with no mapping to standard vocabularies, which blocks
interoperability (FHIR CodeableConcept, quality measures, downstream joins).
This module defines the contract plus a static starter resolver so callers can
code against the interface now and swap in a real terminology service later.

TODO(audit): replace ``StaticTerminologyResolver`` with an adapter backed by a
licensed terminology service (UMLS/UTS, RxNorm API, or a FHIR $lookup endpoint),
pin the vocabulary release versions in the emitted codings, and cache lookups
locally (never log lookup query strings — they contain clinical text).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from enum import StrEnum
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field

from clinical_nlp.schemas import ClinicalMention, EntityType


class CodingSystem(StrEnum):
    """Standard clinical vocabularies."""

    SNOMED_CT = "http://snomed.info/sct"
    RXNORM = "http://www.nlm.nih.gov/research/umls/rxnorm"
    LOINC = "http://loinc.org"
    ICD_10_CM = "http://hl7.org/fhir/sid/icd-10-cm"


class ConceptCoding(BaseModel):
    """A candidate code for a mention in a standard vocabulary."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    system: CodingSystem
    code: str = Field(min_length=1)
    display: str = Field(min_length=1)
    vocabulary_version: str | None = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class NormalizedMention(BaseModel):
    """A clinical mention enriched with candidate vocabulary codings."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    mention: ClinicalMention
    codings: list[ConceptCoding] = Field(default_factory=list)

    @property
    def is_coded(self) -> bool:
        """Return whether at least one candidate coding was resolved."""

        return bool(self.codings)


class TerminologyResolver(Protocol):
    """Provider-neutral terminology lookup contract."""

    def resolve(self, normalized_text: str, entity_type: EntityType) -> list[ConceptCoding]:
        """Return candidate codings for a canonical mention string."""


_STARTER_MAP: Mapping[tuple[str, EntityType], tuple[ConceptCoding, ...]] = {
    ("heart rate", EntityType.VITAL): (
        ConceptCoding(system=CodingSystem.LOINC, code="8867-4", display="Heart rate", confidence=0.9),
    ),
    ("blood pressure", EntityType.VITAL): (
        ConceptCoding(system=CodingSystem.LOINC, code="85354-9", display="Blood pressure panel", confidence=0.9),
    ),
    ("PHQ-9", EntityType.SCORE): (
        ConceptCoding(system=CodingSystem.LOINC, code="44261-6", display="PHQ-9 total score", confidence=0.9),
    ),
    ("pain rating", EntityType.SEVERITY): (
        ConceptCoding(system=CodingSystem.LOINC, code="72514-3", display="Pain severity 0-10 score", confidence=0.8),
    ),
    ("suicidal ideation", EntityType.RISK): (
        ConceptCoding(system=CodingSystem.SNOMED_CT, code="6471006", display="Suicidal thoughts", confidence=0.8),
    ),
}


class StaticTerminologyResolver:
    """Starter in-memory resolver covering the deterministic extractor concepts.

    This intentionally mirrors ``default_regex_concepts`` so NLP-mode output is
    fully coded today. It is NOT a terminology service: no synonyms, no fuzzy
    match, no release pinning.
    """

    def __init__(self, mapping: Mapping[tuple[str, EntityType], tuple[ConceptCoding, ...]] | None = None) -> None:
        """Initialize the resolver with an optional custom mapping."""

        self._mapping = dict(mapping or _STARTER_MAP)

    def resolve(self, normalized_text: str, entity_type: EntityType) -> list[ConceptCoding]:
        """Return starter candidate codings for an exact canonical-string match."""

        return list(self._mapping.get((normalized_text, entity_type), ()))


def normalize_mentions(
    mentions: Sequence[ClinicalMention],
    resolver: TerminologyResolver | None = None,
) -> list[NormalizedMention]:
    """Attach candidate vocabulary codings to extracted mentions.

    Args:
        mentions: Extracted clinical mentions.
        resolver: Terminology resolver; defaults to the static starter map.

    Returns:
        Normalized mentions; ``is_coded`` is False where no candidate exists,
        which downstream consumers should treat as a review trigger rather than
        emitting an uncoded entity silently.
    """

    active_resolver = resolver or StaticTerminologyResolver()
    return [
        NormalizedMention(
            mention=mention,
            codings=active_resolver.resolve(mention.normalized_text or mention.text, mention.entity_type),
        )
        for mention in mentions
    ]
