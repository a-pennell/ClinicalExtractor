"""Edge-case audit tests for clinical assertion scoping and hybrid extraction.

Tests marked ``xfail(strict=True)`` document KNOWN GAPS found in the
pre-review audit (docs/pre-review-audit.md). They are expected to fail today;
when the gap is fixed they will flip to errors and force the marker removal.
"""

from __future__ import annotations

from collections.abc import Sequence

import pytest
from pydantic import BaseModel

from clinical_nlp.extractors import HybridExtractor, LLMExtractor, NLPExtractor, TriagePolicy, compress_note_for_llm
from clinical_nlp.extractors import remap_mentions_to_source
from clinical_nlp.llm_bridge import LLMExtractionError, LLMMessage
from clinical_nlp.negation import NegationScopeResolver
from clinical_nlp.schemas import AssertionStatus, ClinicalMention, EntityType


def mention_in(text: str, phrase: str, entity_type: EntityType = EntityType.PROBLEM) -> ClinicalMention:
    start = text.index(phrase)
    return ClinicalMention(text=phrase, entity_type=entity_type, start_char=start, end_char=start + len(phrase))


def resolve(text: str, phrase: str, entity_type: EntityType = EntityType.PROBLEM) -> AssertionStatus:
    resolver = NegationScopeResolver()
    return resolver.resolve_mention(text, mention_in(text, phrase, entity_type)).assertion


# --- Known strengths (regression guards) -------------------------------------------------------


def test_long_negated_list_stays_absent() -> None:
    text = "No fever, chills, nausea, vomiting, diarrhea, or headache."
    assert resolve(text, "headache", EntityType.SYMPTOM) == AssertionStatus.ABSENT


def test_termination_cue_ends_negation_scope() -> None:
    text = "Denies chest pain but reports palpitations."
    assert resolve(text, "palpitations", EntityType.SYMPTOM) == AssertionStatus.PRESENT


# --- Known gaps: assertion classes that exist in the schema but have no triggers ---------------


@pytest.mark.xfail(strict=True, reason="AUDIT GAP: no 'history of' / 'status post' triggers; resolver returns PRESENT")
def test_historical_condition_is_not_active() -> None:
    assert resolve("History of myocardial infarction in 2019.", "myocardial infarction") == AssertionStatus.HISTORICAL


@pytest.mark.xfail(strict=True, reason="AUDIT GAP: 'status post' not recognized as historical")
def test_status_post_procedure_is_historical() -> None:
    assert resolve("Status post CABG.", "CABG", EntityType.PROCEDURE) == AssertionStatus.HISTORICAL


@pytest.mark.xfail(strict=True, reason="AUDIT GAP: family-member subjects not detected; 'mother has X' returns PRESENT")
def test_family_member_condition_is_family_history() -> None:
    assert resolve("Mother has breast cancer.", "breast cancer") == AssertionStatus.FAMILY_HISTORY


@pytest.mark.xfail(strict=True, reason="AUDIT GAP: conditional 'if X recurs' not in hypothetical triggers")
def test_conditional_mention_is_hypothetical() -> None:
    assert resolve("If chest pain recurs, return to ED.", "chest pain", EntityType.SYMPTOM) == AssertionStatus.HYPOTHETICAL


@pytest.mark.xfail(strict=True, reason="AUDIT GAP: patient-education context treated as an active finding")
def test_education_context_is_not_present() -> None:
    assert resolve("Patient educated on warning signs of stroke.", "stroke") != AssertionStatus.PRESENT


# --- Hybrid extraction failure modes ------------------------------------------------------------


class _StubLLMClient:
    """LLM stub returning mentions whose offsets refer to the compressed excerpt."""

    def __init__(self, source_text: str, phrase: str, *, fail: bool = False) -> None:
        self.source_text = source_text
        self.phrase = phrase
        self.fail = fail

    async def complete_json(
        self,
        messages: Sequence[LLMMessage],
        *,
        response_schema: type[BaseModel],
        temperature: float = 0.0,
    ) -> str:
        raise NotImplementedError

    def extract_sync(self, text: str) -> list[ClinicalMention]:
        if self.fail:
            msg = "provider outage"
            raise LLMExtractionError(msg)
        start = text.index(self.phrase)
        return [
            ClinicalMention(
                text=self.phrase,
                entity_type=EntityType.PROBLEM,
                start_char=start,
                end_char=start + len(self.phrase),
                assertion=AssertionStatus.FAMILY_HISTORY,
            )
        ]


NOTE = "Vitals stable.\nHR 88 today.\nFamily history significant: mother with breast cancer.\nPlan follow up."


def test_hybrid_llm_mention_offsets_map_back_to_source_text() -> None:
    """LLM sees a compressed excerpt; merged spans must still index the ORIGINAL note."""

    client = _StubLLMClient(compress_note_for_llm(NOTE, NLPExtractor().extract(NOTE), max_chars=2400), "breast cancer")
    hybrid = HybridExtractor(NLPExtractor(), LLMExtractor(client), triage_policy=TriagePolicy())

    mentions = hybrid.extract(NOTE)

    for mention in mentions:
        assert NOTE[mention.start_char : mention.end_char] == mention.text


def test_hybrid_degrades_to_nlp_mentions_when_llm_fails() -> None:
    """Provider failure must not throw away deterministic results."""

    client = _StubLLMClient("", "", fail=True)
    hybrid = HybridExtractor(NLPExtractor(), LLMExtractor(client), triage_policy=TriagePolicy())

    mentions = hybrid.extract(NOTE)

    assert any(mention.normalized_text == "heart rate" for mention in mentions)


def test_remap_drops_mentions_that_cannot_be_located_in_source() -> None:
    compressed = "Sentence not in the source at all."
    mention = ClinicalMention(text="not in", entity_type=EntityType.OTHER, start_char=9, end_char=15)
    assert remap_mentions_to_source(NOTE, compressed, [mention]) == []
