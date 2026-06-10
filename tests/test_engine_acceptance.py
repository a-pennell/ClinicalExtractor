"""ADR-001 cutover acceptance suite (acceptance criteria 1-2).

These exercise the full engine envelope (clinical_nlp.service.build_envelope):
extraction -> assertion scoping -> conflict-aware rollup -> normalization.

They are the Python-side port of the TS `clinicalEdgeCases.test.ts` cases, per
ADR-001 decision 5 / acceptance criterion 2. The assertion-class edge cases
(historical, family-history, conditional, rule-out, termination cues) are
proven at the resolver level in test_clinical_edge_cases.py; here we prove they
survive end-to-end through the envelope on entities the engine extracts.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from clinical_nlp.normalization import StaticTerminologyResolver
from clinical_nlp.orchestrator import ClinicalExtractionOrchestrator, OrchestratorConfig
from clinical_nlp.service import build_envelope

GOLD_PATH = Path(__file__).parent.parent / "data" / "gold" / "seed_notes.jsonl"


@pytest.fixture(scope="module")
def engine() -> tuple[ClinicalExtractionOrchestrator, StaticTerminologyResolver]:
    return ClinicalExtractionOrchestrator(OrchestratorConfig()), StaticTerminologyResolver()


def envelope_for(engine: tuple[ClinicalExtractionOrchestrator, StaticTerminologyResolver], text: str) -> dict:
    orchestrator, resolver = engine
    return build_envelope(orchestrator, resolver, text)


def test_criterion_1_envelope_for_every_gold_note_with_validated_spans(engine) -> None:
    """Criterion 1: envelope returned for all gold notes; spans index source text."""

    notes = [json.loads(line) for line in GOLD_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(notes) >= 6

    for note in notes:
        envelope = envelope_for(engine, note["text"])
        assert envelope["schema_version"] == "engine-1"
        assert "escalation_failed" in envelope
        for mention in envelope["mentions"]:
            assert note["text"][mention["start_char"] : mention["end_char"]] == mention["text"]
        for entity in envelope["entities"]:
            assert entity["review_priority"] in {"high", "needs-review", "routine"}
            assert isinstance(entity["is_coded"], bool)


def test_criterion_2_negation_survives_to_envelope(engine) -> None:
    """Termination-cue / denial negation reaches the envelope (TS gap, engine fixes)."""

    envelope = envelope_for(engine, "Denies SI. Reports HR 88.")
    si = next(entity for entity in envelope["entities"] if entity["canonical_text"] == "suicidal ideation")
    assert si["assertion"] == "absent"


def test_criterion_2_contradiction_rolls_up_conflicting_in_envelope(engine) -> None:
    """B6 end-to-end: contradicting SI mentions -> conflicting entity, high priority."""

    envelope = envelope_for(engine, "Denies SI.\nLater the patient reports SI with a plan.")
    si = next(entity for entity in envelope["entities"] if entity["canonical_text"] == "suicidal ideation")
    assert si["assertion"] == "conflicting"
    assert si["review_priority"] == "high"
    assert len(si["mention_indexes"]) == 2


def test_criterion_2_codings_carry_release_pinning_flags(engine) -> None:
    """Envelope codings expose is_coded release-pinning (audit B5)."""

    envelope = envelope_for(engine, "Denies SI.")
    si = next(entity for entity in envelope["entities"] if entity["canonical_text"] == "suicidal ideation")
    assert si["codings"]  # SNOMED candidate present
    assert "is_coded" in si  # unpinned SNOMED starter -> False until pinned


def test_envelope_serializes_to_json(engine) -> None:
    """The envelope must be JSON-serializable for the stdio transport."""

    envelope = envelope_for(engine, "BP 142/91. PHQ-9 14.")
    json.dumps(envelope)  # raises if any non-serializable value leaked in
