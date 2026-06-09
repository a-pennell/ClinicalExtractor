"""Tests for clinical plausibility validators."""

import pytest
from pydantic import ValidationError

from clinical_nlp.validators import (
    VitalType,
    validate_blood_pressure,
    validate_clinical_score,
    validate_pain_scale,
    validate_rom,
    validate_strength_grade,
    validate_vital,
)


def test_vital_validation_accepts_plausible_values() -> None:
    """Vitals inside conservative physiologic ranges should validate."""

    heart_rate = validate_vital(VitalType.HEART_RATE, 72)
    temperature = validate_vital(VitalType.TEMPERATURE, 98.6, "F")
    blood_pressure = validate_blood_pressure(128, 76)

    assert heart_rate.value == 72
    assert temperature.value == 98.6
    assert blood_pressure.systolic == 128


def test_vital_validation_rejects_implausible_values() -> None:
    """Impossible vitals should fail before downstream use."""

    with pytest.raises(ValidationError):
        validate_vital(VitalType.HEART_RATE, 500)

    with pytest.raises(ValidationError):
        validate_blood_pressure(70, 120)


def test_score_and_pain_validation() -> None:
    """Clinical scores and pain ratings should respect known ranges."""

    assert validate_clinical_score("PHQ-9", 18).value == 18
    assert validate_pain_scale(6).value == 6

    with pytest.raises(ValidationError):
        validate_clinical_score("PHQ-9", 99)

    with pytest.raises(ValidationError):
        validate_pain_scale(11)


def test_rom_and_strength_validation() -> None:
    """ROM degrees and MMT grades should parse into normalized values."""

    assert validate_rom("flexion", 120, body_site="shoulder").degrees == 120
    assert validate_strength_grade("4-/5").normalized_grade == pytest.approx(3.7)

    with pytest.raises(ValidationError):
        validate_rom("flexion", 500)

    with pytest.raises(ValidationError):
        validate_strength_grade("6/5")
