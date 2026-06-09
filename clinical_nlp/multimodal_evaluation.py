"""Consolidated evaluation for NLP, LLM, hybrid, and classic ML modes."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from pydantic import BaseModel, ConfigDict, Field

from clinical_nlp.evaluation import EvaluationReport, evaluate_mentions
from clinical_nlp.extractors import ExtractionMode
from clinical_nlp.schemas import ClinicalMention


class ClassificationMetricReport(BaseModel):
    """Classic ML binary classification metrics."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    sample_count: int = Field(ge=0)
    positive_count: int = Field(ge=0)
    negative_count: int = Field(ge=0)
    roc_auc: float | None = Field(default=None, ge=0.0, le=1.0)
    pr_auc: float | None = Field(default=None, ge=0.0, le=1.0)


class ExtractionRun(BaseModel):
    """Predicted extraction output for one modality."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    mode: ExtractionMode
    mentions: list[ClinicalMention]
    latency_ms: float | None = Field(default=None, ge=0.0)
    cost_usd: float | None = Field(default=None, ge=0.0)


class MultiModalEvaluationReport(BaseModel):
    """Unified comparison across extraction and classic ML modalities."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    extraction_reports: Mapping[ExtractionMode, EvaluationReport]
    classification_report: ClassificationMetricReport | None = None


def evaluate_multimodal_runs(
    runs: Sequence[ExtractionRun],
    gold_mentions: Sequence[ClinicalMention],
    *,
    y_true: Sequence[int] | None = None,
    y_score: Sequence[float] | None = None,
) -> MultiModalEvaluationReport:
    """Benchmark extraction modes and optional classic ML predictions."""

    extraction_reports = {
        run.mode: evaluate_mentions(run.mentions, gold_mentions)
        for run in runs
    }
    classification_report = None
    if y_true is not None and y_score is not None:
        classification_report = evaluate_binary_classifier(y_true, y_score)
    return MultiModalEvaluationReport(
        extraction_reports=extraction_reports,
        classification_report=classification_report,
    )


def evaluate_binary_classifier(y_true: Sequence[int], y_score: Sequence[float]) -> ClassificationMetricReport:
    """Evaluate binary classification probabilities.

    Args:
        y_true: Binary labels as ``0`` or ``1``.
        y_score: Scores where larger values indicate greater positive risk.

    Returns:
        ROC-AUC and PR-AUC. Metrics are ``None`` when undefined because only
        one class is present.
    """

    if len(y_true) != len(y_score):
        msg = "y_true and y_score must have the same length."
        raise ValueError(msg)
    if any(label not in {0, 1} for label in y_true):
        msg = "y_true must contain only 0 and 1 labels."
        raise ValueError(msg)

    positives = sum(y_true)
    negatives = len(y_true) - positives
    return ClassificationMetricReport(
        sample_count=len(y_true),
        positive_count=positives,
        negative_count=negatives,
        roc_auc=roc_auc(y_true, y_score) if positives and negatives else None,
        pr_auc=average_precision(y_true, y_score) if positives else None,
    )


def roc_auc(y_true: Sequence[int], y_score: Sequence[float]) -> float:
    """Compute ROC-AUC using rank statistics with tie handling."""

    ranked = sorted(zip(y_score, y_true, strict=True), key=lambda item: item[0])
    rank_sum = 0.0
    index = 0
    while index < len(ranked):
        tie_end = index + 1
        while tie_end < len(ranked) and ranked[tie_end][0] == ranked[index][0]:
            tie_end += 1
        average_rank = (index + 1 + tie_end) / 2
        rank_sum += sum(label for _, label in ranked[index:tie_end]) * average_rank
        index = tie_end

    positives = sum(y_true)
    negatives = len(y_true) - positives
    return (rank_sum - positives * (positives + 1) / 2) / (positives * negatives)


def average_precision(y_true: Sequence[int], y_score: Sequence[float]) -> float:
    """Compute average precision for a binary classifier."""

    ranked = sorted(zip(y_score, y_true, strict=True), key=lambda item: item[0], reverse=True)
    positives = sum(y_true)
    if positives == 0:
        return 0.0

    true_positives = 0
    precision_sum = 0.0
    for index, (_, label) in enumerate(ranked, start=1):
        if label == 1:
            true_positives += 1
            precision_sum += true_positives / index
    return precision_sum / positives
