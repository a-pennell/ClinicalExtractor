"""Tests for the terminology normalization scaffold."""

from clinical_nlp.extractors import NLPExtractor
from clinical_nlp.normalization import CodingSystem, StaticTerminologyResolver, normalize_mentions
from clinical_nlp.schemas import ClinicalMention, EntityType


def test_deterministic_extractor_output_is_fully_coded() -> None:
    mentions = NLPExtractor().extract("BP 142/91. HR 88. PHQ-9 14. Pain 6/10. Denies SI.")
    normalized = normalize_mentions(mentions)

    assert normalized
    assert all(item.is_coded for item in normalized)
    assert any(
        coding.system == CodingSystem.LOINC and coding.code == "85354-9"
        for item in normalized
        for coding in item.codings
    )


def test_unmapped_mentions_are_flagged_not_silently_coded() -> None:
    mention = ClinicalMention(text="metformin", entity_type=EntityType.MEDICATION, start_char=0, end_char=9)
    normalized = normalize_mentions([mention], resolver=StaticTerminologyResolver())

    assert len(normalized) == 1
    assert not normalized[0].is_coded
