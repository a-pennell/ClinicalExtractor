#!/usr/bin/env bash
set -euo pipefail

if ! python3 -m ruff --version >/dev/null 2>&1; then
  echo "Missing Python dev dependencies. Install with: python3 -m pip install -e '.[dev]'" >&2
  exit 2
fi

python3 -m ruff check clinical_nlp tests
python3 -m mypy clinical_nlp tests
python3 -m coverage run -m pytest tests "$@"
python3 -m coverage report --fail-under=80
