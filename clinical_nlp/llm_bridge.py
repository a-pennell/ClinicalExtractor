"""LLM-to-structured clinical extraction bridge."""

from __future__ import annotations

import asyncio
import json
from collections.abc import Sequence
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from clinical_nlp.schemas import ClinicalMention, EntityType
from clinical_nlp.validators import (
    VitalType,
    validate_blood_pressure,
    validate_clinical_score,
    validate_pain_scale,
    validate_strength_grade,
    validate_vital,
)


class LLMExtractionError(RuntimeError):
    """Raised when LLM extraction cannot produce valid mentions."""


class LLMMessage(BaseModel):
    """Provider-neutral chat message."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    role: str
    content: str


class ClinicalMentionBatch(BaseModel):
    """Structured LLM output schema."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    mentions: list[ClinicalMention] = Field(default_factory=list)


class LLMExtractionClient(Protocol):
    """Provider-neutral LLM client protocol.

    Implement this with OpenAI JSON mode, instructor, LangChain structured
    output, or an internal clinical extraction service. The client receives the
    Pydantic JSON schema so providers that support schema-guided decoding can
    enforce the same contract used by application validation.
    """

    async def complete_json(
        self,
        messages: Sequence[LLMMessage],
        *,
        response_schema: type[BaseModel],
        temperature: float = 0.0,
    ) -> str:
        """Return raw JSON text for the requested Pydantic schema."""

    def extract_sync(self, text: str) -> list[ClinicalMention]:
        """Optional sync extraction path for strategy compatibility."""

        raise NotImplementedError


async def extract_mentions_with_retries(
    client: LLMExtractionClient,
    text: str,
    *,
    max_retries: int = 2,
    max_note_chars: int = 8_000,
) -> list[ClinicalMention]:
    """Extract mentions with schema and plausibility self-correction.

    Args:
        client: Provider-neutral LLM client.
        text: Clinical note text.
        max_retries: Number of correction attempts after the initial call.
        max_note_chars: Hard character budget for raw note text.

    Returns:
        Validated clinical mentions.

    Raises:
        LLMExtractionError: If all attempts fail validation.
    """

    note_text = text[:max_note_chars]
    correction_context = ""
    last_error: Exception | None = None

    for attempt in range(max_retries + 1):
        messages = build_extraction_messages(note_text, correction_context=correction_context)
        raw_json = await client.complete_json(
            messages,
            response_schema=ClinicalMentionBatch,
            temperature=0.0,
        )
        try:
            batch = parse_llm_mention_batch(raw_json)
            validate_mention_plausibility(batch.mentions)
            return batch.mentions
        except (ValidationError, ValueError) as exc:
            last_error = exc
            correction_context = (
                "The previous extraction failed validation. Correct only the JSON output. "
                f"Validation error: {exc}"
            )
            if attempt < max_retries:
                await asyncio.sleep(0)

    msg = f"LLM extraction failed after {max_retries + 1} attempts."
    raise LLMExtractionError(msg) from last_error


def build_extraction_messages(text: str, *, correction_context: str = "") -> list[LLMMessage]:
    """Build schema-constrained extraction prompts."""

    schema_json = json.dumps(ClinicalMentionBatch.model_json_schema(), indent=2)
    system = (
        "You extract clinical mentions into strict JSON. "
        "Return only JSON matching the provided schema. "
        "Use half-open character offsets from the provided note. "
        "Mark explicit denials as absent and uncertain concepts as possible."
    )
    if correction_context:
        system = f"{system}\n{correction_context}"

    return [
        LLMMessage(role="system", content=system),
        LLMMessage(role="system", content=f"Required JSON schema:\n{schema_json}"),
        LLMMessage(role="user", content=f"Clinical note:\n{text}"),
    ]


def parse_llm_mention_batch(raw_json: str) -> ClinicalMentionBatch:
    """Parse provider JSON into a validated mention batch."""

    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        msg = "LLM output was not valid JSON."
        raise ValueError(msg) from exc

    if isinstance(payload, list):
        payload = {"mentions": payload}
    return ClinicalMentionBatch.model_validate(payload)


def validate_mention_plausibility(mentions: Sequence[ClinicalMention]) -> None:
    """Run clinical plausibility checks over LLM mentions.

    Raises:
        ValueError: If any mention carries an implausible structured value.
    """

    errors: list[str] = []
    for index, mention in enumerate(mentions):
        try:
            validate_single_mention_plausibility(mention)
        except ValueError as exc:
            # AUDIT FIX (PHI): the raised message propagates into exception chains
            # and application logs; identify mentions by index/type/span instead of
            # quoting raw clinical text.
            errors.append(f"mention[{index}] type={mention.entity_type.value} span={mention.span}: {exc}")
    if errors:
        raise ValueError("; ".join(errors))


def validate_single_mention_plausibility(mention: ClinicalMention) -> None:
    """Validate a single mention against known clinical ranges."""

    attributes = mention.attributes
    if mention.entity_type == EntityType.VITAL:
        measurement = str(attributes.get("measurement", mention.normalized_text or "")).casefold()
        if measurement == "blood-pressure":
            validate_blood_pressure(int(attributes["systolic"]), int(attributes["diastolic"]))
            return
        if "heart" in measurement:
            validate_vital(VitalType.HEART_RATE, float(attributes["value"]))
            return
    if mention.entity_type == EntityType.SCORE and "value" in attributes and "scale" in attributes:
        validate_clinical_score(str(attributes["scale"]), int(attributes["value"]))
    if mention.normalized_text == "pain rating" and "value" in attributes:
        validate_pain_scale(int(attributes["value"]))
    if mention.normalized_text == "manual muscle test" and "value" in attributes:
        validate_strength_grade(str(attributes["value"]))
