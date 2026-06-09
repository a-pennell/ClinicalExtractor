"""Tests for consolidated multimodal evaluation."""

from clinical_nlp.extractors import ExtractionMode
from clinical_nlp.multimodal_evaluation import ExtractionRun, evaluate_binary_classifier, evaluate_multimodal_runs
from clinical_nlp.schemas import ClinicalMention, EntityType


def mention(text: str, start: int, end: int) -> ClinicalMention:
    """Create a symptom mention."""

    return ClinicalMention(text=text, entity_type=EntityType.SYMPTOM, start_char=start, end_char=end)


def test_binary_classifier_metrics_are_computed_without_sklearn() -> None:
    """ROC-AUC and PR-AUC should work through pure Python fallback metrics."""

    report = evaluate_binary_classifier([0, 0, 1, 1], [0.1, 0.4, 0.35, 0.9])

    assert report.roc_auc == 0.75
    assert report.pr_auc is not None
    assert report.pr_auc > 0.7


def test_multimodal_evaluation_compares_extraction_modes_and_ml() -> None:
    """Rule-based and LLM extraction reports should be evaluated side by side."""

    gold = [mention("chest pain", 0, 10)]
    nlp_run = ExtractionRun(mode=ExtractionMode.NLP, mentions=[mention("pain", 6, 10)])
    llm_run = ExtractionRun(mode=ExtractionMode.LLM, mentions=[mention("chest pain", 0, 10)])

    report = evaluate_multimodal_runs(
        [nlp_run, llm_run],
        gold,
        y_true=[0, 1],
        y_score=[0.2, 0.8],
    )

    assert report.extraction_reports[ExtractionMode.NLP].exact.f1 == 0.0
    assert report.extraction_reports[ExtractionMode.LLM].exact.f1 == 1.0
    assert report.classification_report is not None
    assert report.classification_report.roc_auc == 1.0
