#!/usr/bin/env bash
# Single local entrypoint, mirroring .github/workflows/ci.yml (audit C6).
# Runs the same pinned-ruff / pytest / eval-gate / eslint / typecheck / vitest
# checks CI runs, in the same order.
set -euo pipefail

cd "$(dirname "$0")"

if ! python3 -m ruff --version >/dev/null 2>&1; then
  echo "Missing pinned Python tooling. Install with: pip install -r requirements-dev.lock && pip install -e . --no-deps" >&2
  exit 2
fi

echo "== Python: ruff (pinned 0.15.16) =="
python3 -m ruff check clinical_nlp tests scripts

echo "== Python: pytest =="
python3 -m pytest tests -q "$@"

echo "== Python: gold-eval regression gate =="
# Current dev partial-F1 = 0.414; gate = current − 0.02. Update ONLY from the
# harness output (scripts/run_eval.py), never by hand-tuning to pass.
python3 scripts/run_eval.py --min-f1 0.39

echo "== Node: eslint (ADR-001 frozen-import enforcement) =="
npm run lint

echo "== Node: typecheck =="
npx tsc -b

echo "== Node: vitest =="
npm test

echo "All checks passed."
