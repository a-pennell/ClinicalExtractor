"""Edge-case audit tests for clinical assertion scoping and hybrid extraction.

The xfail markers documenting the audit's C2 gaps were removed when the
guideline-A3 assertion triggers landed (Phase 2); the former gap tests now run
as permanent regression guards.
"""

from __future__ import annotations

from collections.abc import Sequence

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


# --- C2 fixed: assertion classes per annotation guideline A3 decision order --------------------


def test_historical_condition_is_not_active() -> None:
    assert resolve("History of myocardial infarction in 2019.", "myocardial infarction") == AssertionStatus.HISTORICAL


def test_status_post_procedure_is_historical() -> None:
    assert resolve("Status post CABG.", "CABG", EntityType.PROCEDURE) == AssertionStatus.HISTORICAL


def test_family_member_condition_is_family_history() -> None:
    assert resolve("Mother has breast cancer.", "breast cancer") == AssertionStatus.FAMILY_HISTORY


def test_conditional_mention_is_hypothetical() -> None:
    assert resolve("If chest pain recurs, return to ED.", "chest pain", EntityType.SYMPTOM) == AssertionStatus.HYPOTHETICAL


def test_education_context_is_not_present() -> None:
    assert resolve("Patient educated on warning signs of stroke.", "stroke") == AssertionStatus.HYPOTHETICAL


def test_conditional_circumstance_is_conditional() -> None:
    """Guideline A3 rule 2: 'pain with exertion' occurs only under a circumstance."""

    assert resolve("Reports pain with exertion.", "pain", EntityType.SYMPTOM) == AssertionStatus.CONDITIONAL


def test_negation_takes_precedence_over_historical_and_family() -> None:
    """'No history of X' / 'denies family history of X' are ABSENT (A3 negation precedence)."""

    assert resolve("No history of myocardial infarction.", "myocardial infarction") == AssertionStatus.ABSENT
    assert resolve("Denies family history of colon cancer.", "colon cancer") == AssertionStatus.ABSENT


def test_chronic_active_exception_is_present() -> None:
    """Guideline A3 rule 4 boundary: chronic condition under active management is PRESENT."""

    assert resolve("History of hypertension, on lisinopril.", "hypertension") == AssertionStatus.PRESENT
    assert resolve("History of asthma.", "asthma") == AssertionStatus.HISTORICAL


def test_smothered_does_not_trigger_family_history() -> None:
    """C2 regression: trigger matching is boundary-aware, never raw substring."""

    assert resolve("The fire was smothered; patient reports anxiety.", "anxiety", EntityType.SYMPTOM) == AssertionStatus.PRESENT


def test_unbound_trailing_cue_is_unknown_not_present() -> None:
    """Default-PRESENT abolished: a backward cue beyond the post-scope window -> UNKNOWN."""

    text = "Fever was reported by spouse and later categorically denied by the patient."
    assert resolve(text, "Fever", EntityType.SYMPTOM) == AssertionStatus.UNKNOWN


def test_incoming_unknown_assertion_is_preserved_not_coerced_to_present() -> None:
    """Default-PRESENT abolished: UNKNOWN in, no evidence -> UNKNOWN out (review, not presence)."""

    text = "Gait steady today."
    resolver = NegationScopeResolver()
    start = text.index("Gait")
    mention = ClinicalMention(
        text="Gait",
        entity_type=EntityType.FINDING,
        start_char=start,
        end_char=start + 4,
        assertion=AssertionStatus.UNKNOWN,
    )
    assert resolver.resolve_mention(text, mention).assertion == AssertionStatus.UNKNOWN


def test_triage_policy_ambiguity_matching_is_boundary_aware() -> None:
    """C2 regression: 'smothered' must not trip the 'mother' ambiguity term."""

    nlp = NLPExtractor()
    clean_text = "HR 88. The fire smothered itself overnight."
    flagged_text = "HR 88. Mother with MI at 54."

    clean = TriagePolicy().triage(clean_text, nlp.extract(clean_text))
    flagged = TriagePolicy().triage(flagged_text, nlp.extract(flagged_text))

    assert "ambiguous_or_reasoning_context" not in clean.reasons
    assert "ambiguous_or_reasoning_context" in flagged.reasons


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
