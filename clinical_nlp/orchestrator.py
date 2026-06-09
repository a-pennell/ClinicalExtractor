"""Configuration-driven clinical extraction orchestration."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from clinical_nlp.extractors import BaseExtractor, ExtractionMode, HybridExtractor, LLMExtractor, NLPExtractor
from clinical_nlp.llm_bridge import LLMExtractionClient
from clinical_nlp.schemas import ClinicalMention


class OrchestratorConfig(BaseModel):
    """Runtime extraction configuration."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    mode: ExtractionMode = ExtractionMode.NLP
    hybrid_max_context_chars: int = Field(default=2_400, ge=256, le=32_000)
    llm_max_retries: int = Field(default=2, ge=0, le=5)

    @classmethod
    def from_json_file(cls, path: str | Path) -> OrchestratorConfig:
        """Load orchestrator config from JSON."""

        with Path(path).open(encoding="utf-8") as config_file:
            return cls.model_validate(json.load(config_file))


class ClinicalExtractionOrchestrator:
    """Unified facade for clinical mention extraction.

    The orchestrator owns strategy selection. All strategies return the same
    validated ``ClinicalMention`` schema, so consumers do not branch on mode.
    """

    def __init__(
        self,
        config: OrchestratorConfig,
        *,
        nlp_extractor: NLPExtractor | None = None,
        llm_client: LLMExtractionClient | None = None,
    ) -> None:
        """Initialize the orchestrator from config and optional dependencies."""

        self.config = config
        self.extractor = build_extractor(config, nlp_extractor=nlp_extractor, llm_client=llm_client)

    def extract(self, text: str) -> list[ClinicalMention]:
        """Extract clinical mentions using the configured strategy."""

        return self.extractor.extract(text)

    async def extract_async(self, text: str) -> list[ClinicalMention]:
        """Extract clinical mentions asynchronously when supported."""

        if isinstance(self.extractor, LLMExtractor | HybridExtractor):
            return await self.extractor.extract_async(text)
        return self.extractor.extract(text)


def build_extractor(
    config: OrchestratorConfig,
    *,
    nlp_extractor: NLPExtractor | None = None,
    llm_client: LLMExtractionClient | None = None,
) -> BaseExtractor:
    """Build an extractor strategy from configuration."""

    nlp = nlp_extractor or NLPExtractor()
    if config.mode == ExtractionMode.NLP:
        return nlp

    if llm_client is None:
        msg = f"Mode {config.mode.value!r} requires an LLMExtractionClient."
        raise ValueError(msg)

    llm = LLMExtractor(llm_client, max_retries=config.llm_max_retries)
    if config.mode == ExtractionMode.LLM:
        return llm
    if config.mode == ExtractionMode.HYBRID:
        from clinical_nlp.extractors import TriagePolicy

        return HybridExtractor(
            nlp,
            llm,
            triage_policy=TriagePolicy(max_chars=config.hybrid_max_context_chars),
        )

    msg = f"Unsupported extraction mode: {config.mode.value!r}."
    raise ValueError(msg)
