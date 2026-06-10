#!/usr/bin/env python3
"""Minimal gold-standard evaluation harness for the Python extraction pipeline.

AUDIT SCAFFOLD: ``clinical_nlp.evaluation`` already computes per-entity-type
precision/recall/F1 and assertion accuracy, but nothing in the repo ran it
against labeled data. This harness closes that loop:

    python3 scripts/run_eval.py                       # NLP mode vs data/gold/*.jsonl
    python3 scripts/run_eval.py --min-f1 0.8          # gate for CI

Gold format (JSON Lines, one note per line)::

    {"source_id": "note-001", "text": "...", "mentions": [
        {"text": "fever", "entity_type": "symptom", "start_char": 7,
         "end_char": 12, "assertion": "absent"}]}

Notes must be SYNTHETIC or properly de-identified — gold files live in the
repo and therefore must never contain PHI.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from clinical_nlp.evaluation import EvaluationReport, evaluate_mentions  # noqa: E402
from clinical_nlp.orchestrator import ClinicalExtractionOrchestrator, OrchestratorConfig  # noqa: E402
from clinical_nlp.schemas import ClinicalMention  # noqa: E402


def load_gold_notes(gold_dir: Path) -> list[dict]:
    """Load gold notes from every JSONL file in a directory."""

    notes: list[dict] = []
    for path in sorted(gold_dir.glob("*.jsonl")):
        with path.open(encoding="utf-8") as handle:
            notes.extend(json.loads(line) for line in handle if line.strip())
    return notes


def to_mentions(note: dict) -> list[ClinicalMention]:
    """Validate gold mention payloads, including span/text agreement."""

    mentions = []
    for raw in note["mentions"]:
        mention = ClinicalMention(source_id=note["source_id"], **raw)
        covered = note["text"][mention.start_char : mention.end_char]
        if covered != mention.text:
            msg = f"{note['source_id']}: gold span {mention.span} covers {covered!r}, not {mention.text!r}"
            raise ValueError(msg)
        mentions.append(mention)
    return mentions


def run(gold_dir: Path, min_f1: float) -> int:
    """Run extraction over gold notes and print per-type PRF."""

    notes = load_gold_notes(gold_dir)
    if not notes:
        print(f"No gold notes found in {gold_dir}.", file=sys.stderr)
        return 2

    orchestrator = ClinicalExtractionOrchestrator(OrchestratorConfig())
    predicted: list[ClinicalMention] = []
    gold: list[ClinicalMention] = []
    for note in notes:
        gold.extend(to_mentions(note))
        predicted.extend(
            mention.model_copy(update={"source_id": note["source_id"]})
            for mention in orchestrator.extract(note["text"])
        )

    report = evaluate_mentions(predicted, gold, attribute_names=("assertion",))
    print_report(report, note_count=len(notes))

    if report.partial.f1 < min_f1:
        print(f"\nFAIL: partial-match F1 {report.partial.f1:.3f} < gate {min_f1:.3f}", file=sys.stderr)
        return 1
    return 0


def print_report(report: EvaluationReport, *, note_count: int) -> None:
    """Print overall and per-entity-type metrics."""

    print(f"Gold notes: {note_count}")
    print(f"{'':24}{'P':>8}{'R':>8}{'F1':>8}{'TP':>6}{'FP':>6}{'FN':>6}")
    for label, summary in (("overall (exact)", report.exact), ("overall (partial)", report.partial)):
        print(
            f"{label:<24}{summary.precision:>8.3f}{summary.recall:>8.3f}{summary.f1:>8.3f}"
            f"{summary.true_positive:>6}{summary.false_positive:>6}{summary.false_negative:>6}"
        )
    print("\nPer entity type (partial match):")
    for entity_type, summary in report.partial_by_type.items():
        print(
            f"  {entity_type.value:<22}{summary.precision:>8.3f}{summary.recall:>8.3f}{summary.f1:>8.3f}"
            f"{summary.true_positive:>6}{summary.false_positive:>6}{summary.false_negative:>6}"
        )
    assertion = report.attribute_accuracy.get("assertion")
    if assertion and assertion.total:
        print(f"\nAssertion accuracy on matched mentions: {assertion.accuracy:.3f} ({assertion.correct}/{assertion.total})")
        for mismatch in assertion.mismatches:
            print(f"  mismatch: {mismatch}")


def main() -> int:
    """CLI entry point."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gold-dir", type=Path, default=REPO_ROOT / "data" / "gold")
    parser.add_argument("--min-f1", type=float, default=0.0, help="Fail (exit 1) if partial F1 is below this gate.")
    args = parser.parse_args()
    return run(args.gold_dir, args.min_f1)


if __name__ == "__main__":
    raise SystemExit(main())
