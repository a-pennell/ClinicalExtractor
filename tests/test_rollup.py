"""Tests for conflict-aware entity rollup (audit B6)."""

from clinical_nlp.negation import NegationScopeResolver
from clinical_nlp.rollup import ReviewPriority, rollup_mentions
from clinical_nlp.schemas import AssertionStatus, ClinicalMention, EntityType


def mention_at(text: str, phrase: str, occurrence: int = 1, entity_type: EntityType = EntityType.SYMPTOM) -> ClinicalMention:
    start = -1
    for _ in range(occurrence):
        start = text.index(phrase, start + 1)
    return ClinicalMention(text=phrase, entity_type=entity_type, start_char=start, end_char=start + len(phrase))


def test_b6_contradicting_mentions_roll_up_to_conflicting_not_absent() -> None:
    """The audit's TS reproduction: sticky-absent must become CONFLICTING.

    "Denies chest pain" + "reports chest pain" is one entity demanding human
    resolution; it must never resolve silently in either direction, and both
    mentions keep their own assertions.
    """

    text = "Denies chest pain.\nNow reports chest pain worse with exertion."
    resolver = NegationScopeResolver()
    mentions = resolver.annotate_mentions(text, [mention_at(text, "chest pain", 1), mention_at(text, "chest pain", 2)])

    entities = rollup_mentions(mentions)

    assert len(entities) == 1
    entity = entities[0]
    assert entity.assertion == AssertionStatus.CONFLICTING
    assert entity.review_priority == ReviewPriority.HIGH
    assert len(entity.mentions) == 2
    assert entity.mentions[0].assertion == AssertionStatus.ABSENT
    assert entity.mentions[1].assertion != AssertionStatus.ABSENT


def test_agreeing_mentions_share_their_assertion() -> None:
    text = "Denies fever. Still denies fever today."
    resolver = NegationScopeResolver()
    mentions = resolver.annotate_mentions(text, [mention_at(text, "fever", 1), mention_at(text, "fever", 2)])

    entities = rollup_mentions(mentions)

    assert len(entities) == 1
    assert entities[0].assertion == AssertionStatus.ABSENT
    assert entities[0].review_priority == ReviewPriority.ROUTINE


def test_mixed_temporal_assertions_are_conflicting_until_phase_2() -> None:
    """Mixed HISTORICAL/PRESENT is CONFLICTING until guideline A3 rule 4 lands (Phase 2)."""

    text = "HTN noted. HTN again."
    historical = mention_at(text, "HTN", 1, EntityType.PROBLEM).with_assertion(AssertionStatus.HISTORICAL)
    present = mention_at(text, "HTN", 2, EntityType.PROBLEM).with_assertion(AssertionStatus.PRESENT)

    entities = rollup_mentions([historical, present])

    assert len(entities) == 1
    assert entities[0].assertion == AssertionStatus.CONFLICTING
    assert entities[0].review_priority == ReviewPriority.HIGH


def test_distinct_entities_do_not_merge() -> None:
    text = "Reports fever and cough."
    mentions = [mention_at(text, "fever"), mention_at(text, "cough")]

    entities = rollup_mentions(mentions)

    assert len(entities) == 2
    assert [entity.canonical_text for entity in entities] == ["fever", "cough"]
