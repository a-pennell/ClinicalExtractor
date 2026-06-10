"""Long-lived extraction engine worker speaking NDJSON over stdio (ADR-001).

The node server spawns this process once and pipes one JSON request per line:

    {"id": "r1", "op": "extract", "text": "..."}
    {"id": "r2", "op": "ping"}

and receives one JSON response per line:

    {"id": "r1", "ok": true, "result": {<envelope>}}
    {"id": "r2", "ok": true, "result": {"pong": true}}

Envelope contract (ADR-001 decision 2): mentions with source-text offsets and
mention-level assertions, entity rollups with CONFLICTING/UNKNOWN status and
review priority, candidate codings with ``is_coded`` release-pinning flags,
and the B2 ``escalation_failed`` field.

Transport choice (stdio worker over an HTTP sidecar) is documented in
ADR-001's implementation notes: the repo's run scripts support plain
``node server.mjs`` + stdlib Python; a FastAPI sidecar would add the first
Python web dependency and a second listening port for no contract benefit.

PHI discipline: error responses carry codes only — never note text, mention
text, or exception strings that could embed clinical content.
"""

from __future__ import annotations

import json
import sys
from typing import Any

from clinical_nlp.extractors import ExtractionOutcome, HybridExtractor
from clinical_nlp.normalization import StaticTerminologyResolver
from clinical_nlp.orchestrator import ClinicalExtractionOrchestrator, OrchestratorConfig
from clinical_nlp.rollup import rollup_mentions
from clinical_nlp.schemas import ClinicalMention

ENGINE_SCHEMA_VERSION = "engine-1"
MAX_NOTE_CHARS = 100_000


def build_envelope(
    orchestrator: ClinicalExtractionOrchestrator,
    resolver: StaticTerminologyResolver,
    text: str,
) -> dict[str, Any]:
    """Run extraction, rollup, and normalization into the API envelope."""
    if isinstance(orchestrator.extractor, HybridExtractor):
        outcome = orchestrator.extractor.extract_outcome(text)
    else:
        outcome = ExtractionOutcome(mentions=orchestrator.extract(text), escalation_failed=False, escalated=False)

    mentions = outcome.mentions
    mention_index = {id(mention): index for index, mention in enumerate(mentions)}
    entities = []
    for entity in rollup_mentions(mentions):
        codings = resolver.resolve(entity.canonical_text, entity.entity_type)
        entities.append(
            {
                "canonical_text": entity.canonical_text,
                "entity_type": entity.entity_type.value,
                "assertion": entity.assertion.value,
                "review_priority": entity.review_priority.value,
                "mention_indexes": [mention_index[id(mention)] for mention in entity.mentions],
                "codings": [
                    {
                        "system": coding.system.value,
                        "code": coding.code,
                        "display": coding.display,
                        "release_version": coding.release_version,
                        "confidence": coding.confidence,
                    }
                    for coding in codings
                ],
                "is_coded": any(coding.is_release_pinned for coding in codings),
            }
        )

    return {
        "schema_version": ENGINE_SCHEMA_VERSION,
        "mentions": [serialize_mention(mention) for mention in mentions],
        "entities": entities,
        "escalation_failed": outcome.escalation_failed,
        "escalated": outcome.escalated,
        "engine": {"package": "clinical_nlp", "mode": orchestrator.config.mode.value},
    }


def serialize_mention(mention: ClinicalMention) -> dict[str, Any]:
    """Serialize a mention with source-text offsets for the envelope."""
    return {
        "text": mention.text,
        "entity_type": mention.entity_type.value,
        "start_char": mention.start_char,
        "end_char": mention.end_char,
        "assertion": mention.assertion.value,
        "confidence_score": mention.confidence_score,
        "normalized_text": mention.normalized_text,
        "section_context": str(mention.section_context),
        "attributes": dict(mention.attributes),
    }


def handle_request(
    orchestrator: ClinicalExtractionOrchestrator,
    resolver: StaticTerminologyResolver,
    request: dict[str, Any],
) -> dict[str, Any]:
    """Dispatch one engine request to a response payload."""
    request_id = request.get("id")
    op = request.get("op")
    if op == "ping":
        return {"id": request_id, "ok": True, "result": {"pong": True, "schema_version": ENGINE_SCHEMA_VERSION}}
    if op == "extract":
        text = request.get("text")
        if not isinstance(text, str):
            return {"id": request_id, "ok": False, "error": {"code": "invalid-text"}}
        if len(text) > MAX_NOTE_CHARS:
            return {"id": request_id, "ok": False, "error": {"code": "note-too-large"}}
        return {"id": request_id, "ok": True, "result": build_envelope(orchestrator, resolver, text)}
    return {"id": request_id, "ok": False, "error": {"code": "unknown-op"}}


def main() -> int:
    """Run the NDJSON request loop until stdin closes."""
    orchestrator = ClinicalExtractionOrchestrator(OrchestratorConfig())
    resolver = StaticTerminologyResolver()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            response = handle_request(orchestrator, resolver, request)
        except json.JSONDecodeError:
            response = {"id": None, "ok": False, "error": {"code": "invalid-json"}}
        except Exception:
            response = {"id": None, "ok": False, "error": {"code": "engine-error"}}
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
