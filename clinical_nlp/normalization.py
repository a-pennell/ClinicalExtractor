"""Terminology normalization layer for extracted clinical mentions (audit B5).

Defines the resolver contract plus a static starter resolver seeded from the
prototype's migrated TS terminology map (``data/terminology_seed.json``,
ADR-001: migrated, not discarded). Codings carry ``release_version``; per
audit B5, a coding without a pinned vocabulary release is not safely
comparable across time, so entities whose codings are all unpinned report
``is_coded: False`` until pinned.

TODO(audit): replace ``StaticTerminologyResolver`` with an adapter backed by a
licensed terminology service (UMLS/UTS, RxNorm API, or a FHIR $lookup
endpoint), pin the remaining vocabulary releases, and cache lookups locally
(never log lookup query strings — they contain clinical text).
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field

from clinical_nlp.schemas import ClinicalMention, EntityType

TERMINOLOGY_SEED_PATH = Path(__file__).parent / "data" / "terminology_seed.json"

#: TS prototype system labels -> FHIR system URIs.
SYSTEM_URI_BY_LABEL: Mapping[str, str] = {
    "SNOMED-CT": "http://snomed.info/sct",
    "RxNorm": "http://www.nlm.nih.gov/research/umls/rxnorm",
    "LOINC": "http://loinc.org",
    "ICD-10-CM": "http://hl7.org/fhir/sid/icd-10-cm",
    "CPT": "http://www.ama-assn.org/go/cpt",
    "HCPCS": "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets",
}

#: Heuristic confidence for migrated string-confidence codings.
CONFIDENCE_BY_LABEL: Mapping[str, float] = {"high": 0.8, "medium": 0.6, "low": 0.4}


class CodingSystem(StrEnum):
    """Standard clinical vocabularies (FHIR system URIs)."""

    SNOMED_CT = "http://snomed.info/sct"
    RXNORM = "http://www.nlm.nih.gov/research/umls/rxnorm"
    LOINC = "http://loinc.org"
    ICD_10_CM = "http://hl7.org/fhir/sid/icd-10-cm"
    CPT = "http://www.ama-assn.org/go/cpt"
    HCPCS = "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets"


class ConceptCoding(BaseModel):
    """A candidate code for a mention in a standard vocabulary."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    system: CodingSystem
    code: str = Field(min_length=1)
    display: str = Field(min_length=1)
    release_version: str | None = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    rationale: str | None = None

    @property
    def is_release_pinned(self) -> bool:
        """Return whether the coding carries a pinned vocabulary release."""

        return bool(self.release_version)


class NormalizedMention(BaseModel):
    """A clinical mention enriched with candidate vocabulary codings."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    mention: ClinicalMention
    codings: list[ConceptCoding] = Field(default_factory=list)

    @property
    def is_coded(self) -> bool:
        """Return whether at least one RELEASE-PINNED candidate coding exists.

        Audit B5: codings without a pinned vocabulary release stay
        ``is_coded: False`` until pinned; they remain visible as candidates.
        """

        return any(coding.is_release_pinned for coding in self.codings)


class TerminologyResolver(Protocol):
    """Provider-neutral terminology lookup contract."""

    def resolve(self, normalized_text: str, entity_type: EntityType) -> list[ConceptCoding]:
        """Return candidate codings for a canonical mention string."""


@lru_cache(maxsize=1)
def load_terminology_seed() -> Mapping[str, tuple[ConceptCoding, ...]]:
    """Load the migrated TS terminology map, keyed by casefolded canonical name."""

    with TERMINOLOGY_SEED_PATH.open(encoding="utf-8") as seed_file:
        rows = json.load(seed_file)

    seeded: dict[str, list[ConceptCoding]] = {}
    for row in rows:
        coding = ConceptCoding(
            system=CodingSystem(SYSTEM_URI_BY_LABEL[row["system"]]),
            code=row["code"],
            display=row["display"],
            release_version=row.get("release_version"),
            confidence=CONFIDENCE_BY_LABEL.get(row.get("confidence", ""), 0.5),
            rationale=row.get("rationale"),
        )
        seeded.setdefault(row["canonical_name"].casefold(), []).append(coding)
    return {name: tuple(codings) for name, codings in seeded.items()}


#: Deterministic-extractor concepts not present in the migrated TS map.
#: LOINC/SNOMED releases are deliberately NOT pinned here — inventing a pin is
#: worse than reporting is_coded False (audit B5).
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
    """Static resolver over the deterministic-concept map plus the migrated seed.

    This is NOT a terminology service: exact-match only, no synonyms, and only
    ICD-10-CM rows carry a pinned release (FY2026, from the TS prototype map).
    """

    def __init__(self, mapping: Mapping[tuple[str, EntityType], tuple[ConceptCoding, ...]] | None = None) -> None:
        """Initialize the resolver with an optional custom typed mapping."""

        self._mapping = dict(mapping or _STARTER_MAP)
        self._seed = load_terminology_seed()

    def resolve(self, normalized_text: str, entity_type: EntityType) -> list[ConceptCoding]:
        """Return candidate codings: typed starter match first, then seed by name."""

        typed = self._mapping.get((normalized_text, entity_type))
        if typed:
            return list(typed)
        return list(self._seed.get(normalized_text.casefold().strip(), ()))


def normalize_mentions(
    mentions: Sequence[ClinicalMention],
    resolver: TerminologyResolver | None = None,
) -> list[NormalizedMention]:
    """Attach candidate vocabulary codings to extracted mentions.

    Args:
        mentions: Extracted clinical mentions.
        resolver: Terminology resolver; defaults to the static starter map.

    Returns:
        Normalized mentions; ``is_coded`` is False where no release-pinned
        candidate exists, which downstream consumers should treat as a review
        trigger rather than emitting an uncoded entity silently.
    """

    active_resolver = resolver or StaticTerminologyResolver()
    return [
        NormalizedMention(
            mention=mention,
            codings=active_resolver.resolve(mention.normalized_text or mention.text, mention.entity_type),
        )
        for mention in mentions
    ]
