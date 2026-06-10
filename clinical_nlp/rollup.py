"""Conflict-aware entity-level rollup of mention-level assertions (audit B6).

Assertion lives at the mention level (operating-point policy section 3). The
rollup groups mentions into entities and computes an entity-level assertion
only when all mentions agree. Any disagreement yields ``CONFLICTING`` and
``review_priority: high`` — contradictions (e.g. copy-forwarded "denies chest
pain" followed by "reports chest pain") must surface as conflicts demanding
human resolution, never resolve silently in either direction.

The single sanctioned exception (annotation guideline A3 rule 4, audit C2):
a chronic condition with mixed HISTORICAL/PRESENT mentions rolls up to PRESENT
("history of hypertension, on lisinopril" means longstanding, not resolved).
"""

from __future__ import annotations

from collections.abc import Sequence
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from clinical_nlp.lexicons import is_chronic_condition
from clinical_nlp.schemas import AssertionStatus, ClinicalMention, EntityType


class ReviewPriority(StrEnum):
    """Review queue priority for an entity, mirroring the UI tiers."""

    HIGH = "high"
    NEEDS_REVIEW = "needs-review"
    ROUTINE = "routine"


class RolledUpEntity(BaseModel):
    """An entity-level view over mentions that share a canonical identity.

    Mention-level assertions are retained verbatim; ``assertion`` is the
    computed entity-level rollup.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    canonical_text: str = Field(min_length=1)
    entity_type: EntityType
    assertion: AssertionStatus
    review_priority: ReviewPriority
    mentions: list[ClinicalMention] = Field(min_length=1)

    @property
    def mention_assertions(self) -> list[AssertionStatus]:
        """Return the per-mention assertions in source order."""
        return [mention.assertion for mention in self.mentions]


def rollup_mentions(mentions: Sequence[ClinicalMention]) -> list[RolledUpEntity]:
    """Group mentions into entities and compute conflict-aware assertions.

    Args:
        mentions: Mentions with mention-level assertions already resolved.

    Returns:
        Entities ordered by first mention offset. All-agree groups carry the
        shared assertion; disagreeing groups carry ``CONFLICTING`` with high
        review priority, except the chronic-active case (guideline A3 rule 4)
        which rolls up to PRESENT.
    """
    groups: dict[tuple[EntityType, str], list[ClinicalMention]] = {}
    for mention in sorted(mentions, key=lambda item: (item.start_char, item.end_char)):
        groups.setdefault((mention.entity_type, mention.canonical_text), []).append(mention)

    entities = [
        build_entity(entity_type, canonical_text, group)
        for (entity_type, canonical_text), group in groups.items()
    ]
    return sorted(entities, key=lambda entity: (entity.mentions[0].start_char, entity.mentions[0].end_char))


def build_entity(entity_type: EntityType, canonical_text: str, mentions: list[ClinicalMention]) -> RolledUpEntity:
    """Build one rolled-up entity from a mention group."""
    assertion = resolve_entity_assertion(canonical_text, {mention.assertion for mention in mentions})
    return RolledUpEntity(
        canonical_text=canonical_text,
        entity_type=entity_type,
        assertion=assertion,
        review_priority=resolve_review_priority(assertion),
        mentions=mentions,
    )


def resolve_entity_assertion(canonical_text: str, assertions: set[AssertionStatus]) -> AssertionStatus:
    """Compute the entity-level assertion from distinct mention assertions.

    Any disagreement is CONFLICTING, except guideline A3 rule 4: a chronic
    condition with mixed HISTORICAL/PRESENT mentions is PRESENT (longstanding
    under management, not a contradiction).
    """
    if len(assertions) == 1:
        return next(iter(assertions))
    if assertions == {AssertionStatus.PRESENT, AssertionStatus.HISTORICAL} and is_chronic_condition(canonical_text):
        return AssertionStatus.PRESENT
    return AssertionStatus.CONFLICTING


def resolve_review_priority(assertion: AssertionStatus) -> ReviewPriority:
    """Map an entity-level assertion to a review priority tier."""
    if assertion in (AssertionStatus.CONFLICTING, AssertionStatus.UNKNOWN):
        return ReviewPriority.HIGH
    return ReviewPriority.ROUTINE
