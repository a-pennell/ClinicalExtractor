"""Tests for the terminology normalization layer (audit B5).

NOTE: `is_coded` semantics changed in the ADR-001 terminology migration per
the B5 remediation instruction: codings without a pinned vocabulary release
report `is_coded: False` until pinned. The earlier all-coded assertion was
superseded by that instruction, not weakened.
"""

from clinical_nlp.extractors import NLPExtractor
from clinical_nlp.normalization import (
    CodingSystem,
    StaticTerminologyResolver,
    load_terminology_seed,
    normalize_mentions,
)
from clinical_nlp.schemas import ClinicalMention, EntityType


def test_deterministic_extractor_output_has_candidate_codings() -> None:
    mentions = NLPExtractor().extract("BP 142/91. HR 88. PHQ-9 14. Pain 6/10. Denies SI.")
    normalized = normalize_mentions(mentions)

    assert normalized
    assert all(item.codings for item in normalized)
    assert any(
        coding.system == CodingSystem.LOINC and coding.code == "85354-9"
        for item in normalized
        for coding in item.codings
    )
    # LOINC/SNOMED starter codings are deliberately unpinned -> not is_coded
    # until a release is pinned (audit B5).
    assert all(not item.is_coded for item in normalized)


def test_migrated_seed_resolves_with_release_pinning() -> None:
    """Migrated TS map: ICD-10-CM rows are FY2026-pinned, others unpinned."""
    seed = load_terminology_seed()
    assert len(seed) >= 80  # 86 canonical names migrated from terminologyMappings.ts

    mention = ClinicalMention(
        text="hypertension",
        entity_type=EntityType.PROBLEM,
        start_char=0,
        end_char=12,
        normalized_text="hypertension",
    )
    normalized = normalize_mentions([mention], resolver=StaticTerminologyResolver())

    codings = normalized[0].codings
    assert any(
        c.system == CodingSystem.ICD_10_CM and c.code == "I10" and c.release_version == "FY2026" for c in codings
    )
    assert any(c.system == CodingSystem.SNOMED_CT and not c.is_release_pinned for c in codings)
    assert normalized[0].is_coded  # the pinned ICD-10-CM candidate qualifies


def test_unmapped_mentions_are_flagged_not_silently_coded() -> None:
    mention = ClinicalMention(text="xyzzyamab", entity_type=EntityType.MEDICATION, start_char=0, end_char=9)
    normalized = normalize_mentions([mention], resolver=StaticTerminologyResolver())

    assert len(normalized) == 1
    assert not normalized[0].codings
    assert not normalized[0].is_coded
