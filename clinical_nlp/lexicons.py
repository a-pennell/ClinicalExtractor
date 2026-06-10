"""Shared clinical lexicons for assertion scoping and entity rollup.

Deliberately small and exact-match. Expansion is gated on dev-split miss
analysis from the labeling plan (annotation guideline, Part B) — never on
eyeballing (audit B4 discipline).
"""

from __future__ import annotations

#: Canonical strings treated as chronic conditions for annotation guideline
#: A3 rule 4 ("history of" a chronic condition under active management means
#: longstanding, not resolved).
CHRONIC_CONDITION_TERMS: frozenset[str] = frozenset(
    {
        "hypertension",
        "htn",
        "type 2 diabetes mellitus",
        "type 2 diabetes",
        "t2dm",
        "diabetes",
        "diabetes mellitus",
        "dm",
        "hyperlipidemia",
        "hld",
        "asthma",
        "copd",
        "chronic obstructive pulmonary disease",
        "ckd",
        "chronic kidney disease",
        "chf",
        "congestive heart failure",
        "heart failure",
        "major depressive disorder",
        "mdd",
        "depression",
        "generalized anxiety disorder",
        "gad",
        "osteoarthritis",
        "hypothyroidism",
    }
)


def is_chronic_condition(canonical_text: str) -> bool:
    """Return whether a canonical string names a known chronic condition."""

    return canonical_text.casefold().strip() in CHRONIC_CONDITION_TERMS
