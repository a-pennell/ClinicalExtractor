"""Gold-style evaluation for clinical entity mentions."""

from __future__ import annotations

import re
from collections import defaultdict
from enum import StrEnum
from typing import Iterable, Mapping, Sequence, cast

from pydantic import BaseModel, ConfigDict, Field

from clinical_nlp.schemas import ClinicalMention, EntityType


class OverlapStrategy(StrEnum):
    """Partial span scoring strategy."""

    CHAR_JACCARD = "char-jaccard"
    TOKEN_JACCARD = "token-jaccard"


class MetricSummary(BaseModel):
    """Precision, recall, and F1 counts.

    Metrics are ``None`` ("n/a") when their denominator is empty — a type
    with zero predictions must not report precision 1.000 (audit C3).
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    true_positive: int = Field(ge=0)
    false_positive: int = Field(ge=0)
    false_negative: int = Field(ge=0)
    precision: float | None = Field(default=None)
    recall: float | None = Field(default=None)
    f1: float | None = Field(default=None)


class MentionMatch(BaseModel):
    """A matched predicted/gold mention pair."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    predicted_index: int
    gold_index: int
    entity_type: EntityType
    score: float = Field(ge=0.0, le=1.0)
    exact: bool


class AttributeAccuracy(BaseModel):
    """Accuracy for a categorical or binary attribute on matched mentions."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    attribute_name: str
    correct: int = Field(ge=0)
    total: int = Field(ge=0)
    accuracy: float | None = Field(default=None)
    mismatches: list[str] = Field(default_factory=list)


class EvaluationReport(BaseModel):
    """Complete evaluation report."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    exact: MetricSummary
    partial: MetricSummary
    exact_by_type: Mapping[EntityType, MetricSummary]
    partial_by_type: Mapping[EntityType, MetricSummary]
    attribute_accuracy: Mapping[str, AttributeAccuracy]
    exact_matches: list[MentionMatch]
    partial_matches: list[MentionMatch]


def evaluate_mentions(
    predicted: Sequence[ClinicalMention],
    gold: Sequence[ClinicalMention],
    *,
    partial_threshold: float = 0.5,
    overlap_strategy: OverlapStrategy | str = OverlapStrategy.CHAR_JACCARD,
    attribute_names: Iterable[str] = ("assertion",),
) -> EvaluationReport:
    """Evaluate predicted mentions against gold-standard mentions.

    Args:
        predicted: Predicted clinical mentions.
        gold: Gold-standard clinical mentions.
        partial_threshold: Minimum overlap score for partial credit.
        overlap_strategy: Character-span or token-set Jaccard scoring.
        attribute_names: Mention fields or ``attributes`` keys to score over
            partial matches.

    Returns:
        Evaluation report with exact and partial PRF globally and by type.

    Raises:
        ValueError: If ``partial_threshold`` is outside ``[0, 1]``.
    """

    if not 0.0 <= partial_threshold <= 1.0:
        msg = "partial_threshold must be between 0 and 1."
        raise ValueError(msg)

    strategy = OverlapStrategy(overlap_strategy)
    exact_matches = match_mentions(predicted, gold, threshold=1.0, exact_only=True, strategy=strategy)
    partial_matches = match_mentions(
        predicted,
        gold,
        threshold=partial_threshold,
        exact_only=False,
        strategy=strategy,
    )

    return EvaluationReport(
        exact=build_metric_summary(len(exact_matches), len(predicted), len(gold)),
        partial=build_metric_summary(len(partial_matches), len(predicted), len(gold)),
        exact_by_type=build_metrics_by_type(predicted, gold, exact_matches),
        partial_by_type=build_metrics_by_type(predicted, gold, partial_matches),
        attribute_accuracy=score_attribute_accuracy(predicted, gold, partial_matches, tuple(attribute_names)),
        exact_matches=exact_matches,
        partial_matches=partial_matches,
    )


def match_mentions(
    predicted: Sequence[ClinicalMention],
    gold: Sequence[ClinicalMention],
    *,
    threshold: float,
    exact_only: bool,
    strategy: OverlapStrategy,
) -> list[MentionMatch]:
    """Greedily match predicted mentions to gold mentions.

    Candidate pairs are constrained by entity type and compatible ``source_id``.
    Greedy matching by score is deterministic and performant for fixture-sized
    eval sets; it can be replaced with Hungarian matching for large corpora.
    """

    candidates: list[tuple[float, int, int, bool]] = []
    for predicted_index, predicted_mention in enumerate(predicted):
        for gold_index, gold_mention in enumerate(gold):
            if not are_comparable(predicted_mention, gold_mention):
                continue
            exact = is_exact_match(predicted_mention, gold_mention)
            score = 1.0 if exact else span_overlap_score(predicted_mention, gold_mention, strategy)
            if exact_only and not exact:
                continue
            if score >= threshold:
                candidates.append((score, predicted_index, gold_index, exact))

    candidates.sort(key=lambda item: (-item[0], item[1], item[2]))
    used_predicted: set[int] = set()
    used_gold: set[int] = set()
    matches: list[MentionMatch] = []
    for score, predicted_index, gold_index, exact in candidates:
        if predicted_index in used_predicted or gold_index in used_gold:
            continue
        used_predicted.add(predicted_index)
        used_gold.add(gold_index)
        matches.append(
            MentionMatch(
                predicted_index=predicted_index,
                gold_index=gold_index,
                entity_type=gold[gold_index].entity_type,
                score=score,
                exact=exact,
            )
        )
    return matches


def are_comparable(predicted: ClinicalMention, gold: ClinicalMention) -> bool:
    """Return whether predicted and gold mentions can be matched."""

    if predicted.entity_type != gold.entity_type:
        return False
    if predicted.source_id and gold.source_id and predicted.source_id != gold.source_id:
        return False
    return True


def is_exact_match(predicted: ClinicalMention, gold: ClinicalMention) -> bool:
    """Return whether two mentions have the same label and exact span."""

    return are_comparable(predicted, gold) and predicted.span == gold.span


def span_overlap_score(
    predicted: ClinicalMention,
    gold: ClinicalMention,
    strategy: OverlapStrategy,
) -> float:
    """Score partial mention overlap."""

    if strategy == OverlapStrategy.CHAR_JACCARD:
        return char_span_jaccard(predicted.span, gold.span)
    return token_jaccard(predicted.text, gold.text)


def char_span_jaccard(predicted_span: tuple[int, int], gold_span: tuple[int, int]) -> float:
    """Return Jaccard similarity for half-open character spans."""

    predicted_start, predicted_end = predicted_span
    gold_start, gold_end = gold_span
    intersection = max(0, min(predicted_end, gold_end) - max(predicted_start, gold_start))
    if intersection == 0:
        return 0.0
    union = max(predicted_end, gold_end) - min(predicted_start, gold_start)
    return intersection / union


def token_jaccard(predicted_text: str, gold_text: str) -> float:
    """Return token-set Jaccard similarity for two mention strings."""

    predicted_tokens = set(tokenize_for_overlap(predicted_text))
    gold_tokens = set(tokenize_for_overlap(gold_text))
    if not predicted_tokens and not gold_tokens:
        return 1.0
    if not predicted_tokens or not gold_tokens:
        return 0.0
    return len(predicted_tokens & gold_tokens) / len(predicted_tokens | gold_tokens)


def tokenize_for_overlap(text: str) -> list[str]:
    """Tokenize text for overlap scoring."""

    return re.findall(r"[A-Za-z0-9]+", text.casefold())


def build_metric_summary(match_count: int, predicted_count: int, gold_count: int) -> MetricSummary:
    """Build precision, recall, and F1 metrics from counts."""

    false_positive = max(0, predicted_count - match_count)
    false_negative = max(0, gold_count - match_count)
    precision = safe_ratio(match_count, predicted_count)
    recall = safe_ratio(match_count, gold_count)
    return MetricSummary(
        true_positive=match_count,
        false_positive=false_positive,
        false_negative=false_negative,
        precision=precision,
        recall=recall,
        f1=harmonic_mean(precision, recall),
    )


def build_metrics_by_type(
    predicted: Sequence[ClinicalMention],
    gold: Sequence[ClinicalMention],
    matches: Sequence[MentionMatch],
) -> Mapping[EntityType, MetricSummary]:
    """Build PRF metrics grouped by entity type."""

    predicted_counts: dict[EntityType, int] = defaultdict(int)
    gold_counts: dict[EntityType, int] = defaultdict(int)
    match_counts: dict[EntityType, int] = defaultdict(int)

    for mention in predicted:
        predicted_counts[mention.entity_type] += 1
    for mention in gold:
        gold_counts[mention.entity_type] += 1
    for match in matches:
        match_counts[match.entity_type] += 1

    entity_types = sorted(set(predicted_counts) | set(gold_counts), key=lambda entity_type: entity_type.value)
    return {
        entity_type: build_metric_summary(
            match_counts[entity_type],
            predicted_counts[entity_type],
            gold_counts[entity_type],
        )
        for entity_type in entity_types
    }


def score_attribute_accuracy(
    predicted: Sequence[ClinicalMention],
    gold: Sequence[ClinicalMention],
    matches: Sequence[MentionMatch],
    attribute_names: Sequence[str],
) -> Mapping[str, AttributeAccuracy]:
    """Calculate categorical attribute accuracy over matched mentions."""

    scores: dict[str, AttributeAccuracy] = {}
    for attribute_name in attribute_names:
        correct = 0
        total = 0
        mismatches: list[str] = []
        for match in matches:
            predicted_value = get_attribute_value(predicted[match.predicted_index], attribute_name)
            gold_value = get_attribute_value(gold[match.gold_index], attribute_name)
            if gold_value is None:
                continue
            total += 1
            if predicted_value == gold_value:
                correct += 1
            else:
                mismatches.append(
                    f"pred[{match.predicted_index}]={predicted_value!r} gold[{match.gold_index}]={gold_value!r}"
                )
        scores[attribute_name] = AttributeAccuracy(
            attribute_name=attribute_name,
            correct=correct,
            total=total,
            accuracy=safe_ratio(correct, total),
            mismatches=mismatches,
        )
    return scores


def get_attribute_value(mention: ClinicalMention, attribute_name: str) -> object:
    """Get a field or flat attribute value from a mention."""

    if hasattr(mention, attribute_name):
        return cast(object, getattr(mention, attribute_name))
    return mention.attributes.get(attribute_name)


def safe_ratio(numerator: int, denominator: int) -> float | None:
    """Return a ratio, or ``None`` ("n/a") for an empty denominator.

    Audit C3: the previous treat-as-perfect convention reported precision
    1.000 for entity types with zero predictions, masking absent coverage.
    """

    if denominator == 0:
        return None
    return numerator / denominator


def harmonic_mean(precision: float | None, recall: float | None) -> float | None:
    """Calculate F1 as harmonic mean; ``None`` when either input is n/a."""

    if precision is None or recall is None:
        return None
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)
