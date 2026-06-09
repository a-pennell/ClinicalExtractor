"""Tests for context-aware negation and assertion scoping."""

from clinical_nlp.negation import NegationScopeResolver, ScopeDecision
from clinical_nlp.schemas import AssertionStatus, ClinicalMention, EntityType


def mention_from_text(text: str, phrase: str, entity_type: EntityType = EntityType.SYMPTOM) -> ClinicalMention:
    """Create a mention at the first occurrence of a phrase."""

    start = text.index(phrase)
    return ClinicalMention(
        text=phrase,
        entity_type=entity_type,
        start_char=start,
        end_char=start + len(phrase),
    )


def test_negation_respects_termination_cues() -> None:
    """A negation trigger should stop at cues such as 'but'."""

    text = "Denies chest pain but has SOB."
    resolver = NegationScopeResolver()
    chest_pain = mention_from_text(text, "chest pain")
    sob = mention_from_text(text, "SOB")

    results = resolver.resolve_mentions(text, [chest_pain, sob])

    assert results[0].assertion == AssertionStatus.ABSENT
    assert results[0].decision == ScopeDecision.PRE_NEGATION
    assert results[1].assertion == AssertionStatus.PRESENT


def test_negation_scopes_over_clinical_lists() -> None:
    """A list after a negation trigger should remain absent until sentence end."""

    text = "No numbness or tingling. Strength intact."
    resolver = NegationScopeResolver()
    numbness = mention_from_text(text, "numbness")
    tingling = mention_from_text(text, "tingling")

    annotated = resolver.annotate_mentions(text, [numbness, tingling])

    assert [mention.assertion for mention in annotated] == [AssertionStatus.ABSENT, AssertionStatus.ABSENT]


def test_hypothetical_and_post_negation_are_scoped() -> None:
    """Rule-out and post-negation phrasing should be handled locally."""

    resolver = NegationScopeResolver()
    rule_out_text = "Rule out pneumonia if fever develops."
    fever_denied_text = "Fever is denied. Cough present."

    pneumonia = mention_from_text(rule_out_text, "pneumonia", EntityType.PROBLEM)
    fever = mention_from_text(fever_denied_text, "Fever")
    cough = mention_from_text(fever_denied_text, "Cough")

    rule_out_result = resolver.resolve_mention(rule_out_text, pneumonia)
    fever_results = resolver.resolve_mentions(fever_denied_text, [fever, cough])

    assert rule_out_result.assertion == AssertionStatus.HYPOTHETICAL
    assert fever_results[0].assertion == AssertionStatus.ABSENT
    assert fever_results[1].assertion == AssertionStatus.PRESENT
