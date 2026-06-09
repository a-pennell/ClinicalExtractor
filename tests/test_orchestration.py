"""Tests for multimodal extraction orchestration."""

import asyncio
import json
from collections.abc import Sequence

from pydantic import BaseModel

from clinical_nlp.extractors import ExtractionMode, HybridExtractor, LLMExtractor, NLPExtractor
from clinical_nlp.llm_bridge import ClinicalMentionBatch, LLMMessage, extract_mentions_with_retries
from clinical_nlp.orchestrator import ClinicalExtractionOrchestrator, OrchestratorConfig
from clinical_nlp.schemas import ClinicalMention, EntityType


class FakeLLMClient:
    """Fake structured-output LLM client for tests."""

    def __init__(self, responses: Sequence[str]) -> None:
        """Initialize queued JSON responses."""

        self.responses = list(responses)
        self.calls = 0

    async def complete_json(
        self,
        messages: Sequence[LLMMessage],
        *,
        response_schema: type[BaseModel],
        temperature: float = 0.0,
    ) -> str:
        """Return the next queued response."""

        assert response_schema is ClinicalMentionBatch
        assert temperature == 0.0
        assert messages
        self.calls += 1
        return self.responses.pop(0)

    def extract_sync(self, text: str) -> list[ClinicalMention]:
        """Synchronous extraction used by strategy tests."""

        start = text.casefold().find("family history")
        if start < 0:
            start = 0
        return [
            ClinicalMention(
                text=text[start : start + 14] or "family history",
                entity_type=EntityType.RISK,
                start_char=start,
                end_char=start + 14,
                normalized_text="family history",
                confidence_score=0.8,
            )
        ]


def mention_json(value: int = 7) -> str:
    """Build a valid mention batch JSON payload."""

    return json.dumps(
        {
            "mentions": [
                {
                    "text": "pain 7/10",
                    "entity_type": "severity",
                    "start_char": 0,
                    "end_char": 9,
                    "assertion": "present",
                    "section_context": "unknown",
                    "confidence_score": 0.9,
                    "normalized_text": "pain rating",
                    "attributes": {"value": value},
                }
            ]
        }
    )


def test_orchestrator_switches_modes_and_preserves_schema() -> None:
    """All extractor modes should return ClinicalMention objects."""

    nlp_orchestrator = ClinicalExtractionOrchestrator(OrchestratorConfig(mode=ExtractionMode.NLP))
    nlp_mentions = nlp_orchestrator.extract("HR 88. Denies SI.")

    assert all(isinstance(mention, ClinicalMention) for mention in nlp_mentions)
    assert {mention.normalized_text for mention in nlp_mentions} >= {"heart rate", "suicidal ideation"}


def test_hybrid_extractor_routes_ambiguous_context_to_llm() -> None:
    """Hybrid mode should escalate complex family-history context."""

    hybrid = HybridExtractor(NLPExtractor(), LLMExtractor(FakeLLMClient([mention_json()])))
    mentions = hybrid.extract("Family history: mother with diabetes. HR 90.")

    assert any(mention.normalized_text == "heart rate" for mention in mentions)
    assert any(mention.normalized_text == "family history" for mention in mentions)


def test_llm_self_correction_retries_after_plausibility_error() -> None:
    """Invalid LLM values should trigger correction feedback and retry."""

    invalid = mention_json(value=99)
    valid = mention_json(value=6)
    client = FakeLLMClient([invalid, valid])

    mentions = asyncio.run(extract_mentions_with_retries(client, "pain 6/10", max_retries=1))

    assert client.calls == 2
    assert mentions[0].attributes["value"] == 6
