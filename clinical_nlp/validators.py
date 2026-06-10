"""Clinical plausibility validators for extracted measurements.

These validators are intentionally conservative. They do not determine whether
documentation is clinically correct; they only prevent obviously impossible or
malformed values from flowing into evaluation, coding, or downstream modeling.
"""

from __future__ import annotations

import math
import re
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class VitalType(StrEnum):
    """Supported vital sign types."""

    HEART_RATE = "heart-rate"
    RESPIRATORY_RATE = "respiratory-rate"
    TEMPERATURE = "temperature"
    SYSTOLIC_BP = "systolic-blood-pressure"
    DIASTOLIC_BP = "diastolic-blood-pressure"
    OXYGEN_SATURATION = "oxygen-saturation"
    BODY_MASS_INDEX = "body-mass-index"


class TemperatureUnit(StrEnum):
    """Temperature units."""

    CELSIUS = "C"
    FAHRENHEIT = "F"


class VitalMeasurement(BaseModel):
    """Validated vital sign measurement."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    vital_type: VitalType
    value: float
    unit: str | None = None

    @field_validator("value")
    @classmethod
    def finite_value(cls, value: float) -> float:
        """Require finite numeric values."""
        if not math.isfinite(value):
            msg = "Vital value must be finite."
            raise ValueError(msg)
        return value

    @model_validator(mode="after")
    def validate_range(self) -> VitalMeasurement:
        """Validate type-specific physiologic ranges."""
        ranges = {
            VitalType.HEART_RATE: (20.0, 300.0),
            VitalType.RESPIRATORY_RATE: (4.0, 80.0),
            VitalType.SYSTOLIC_BP: (40.0, 300.0),
            VitalType.DIASTOLIC_BP: (20.0, 200.0),
            VitalType.OXYGEN_SATURATION: (0.0, 100.0),
            VitalType.BODY_MASS_INDEX: (5.0, 100.0),
        }
        if self.vital_type == VitalType.TEMPERATURE:
            unit = normalize_temperature_unit(self.unit)
            low, high = (25.0, 45.0) if unit == TemperatureUnit.CELSIUS else (77.0, 113.0)
        else:
            low, high = ranges[self.vital_type]

        if not low <= self.value <= high:
            msg = f"{self.vital_type.value} value {self.value:g} is outside plausible range {low:g}-{high:g}."
            raise ValueError(msg)
        return self


class BloodPressureMeasurement(BaseModel):
    """Validated blood pressure measurement."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    systolic: int = Field(ge=40, le=300)
    diastolic: int = Field(ge=20, le=200)
    unit: str = "mmHg"

    @model_validator(mode="after")
    def validate_ordering(self) -> BloodPressureMeasurement:
        """Require systolic pressure to exceed diastolic pressure."""
        if self.systolic <= self.diastolic:
            msg = "Systolic blood pressure must be greater than diastolic blood pressure."
            raise ValueError(msg)
        return self


class LabValue(BaseModel):
    """Validated generic lab value."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str = Field(min_length=1)
    value: float
    unit: str | None = None
    reference_low: float | None = None
    reference_high: float | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        """Strip whitespace from lab names."""
        stripped = value.strip()
        if not stripped:
            msg = "Lab name must not be blank."
            raise ValueError(msg)
        return stripped

    @field_validator("value", "reference_low", "reference_high")
    @classmethod
    def finite_optional_value(cls, value: float | None) -> float | None:
        """Require finite numeric lab values when present."""
        if value is not None and not math.isfinite(value):
            msg = "Lab values must be finite."
            raise ValueError(msg)
        return value

    @model_validator(mode="after")
    def validate_reference_range(self) -> LabValue:
        """Validate optional reference ranges."""
        has_both_bounds = self.reference_low is not None and self.reference_high is not None
        if has_both_bounds and self.reference_low >= self.reference_high:
            msg = "reference_low must be less than reference_high."
            raise ValueError(msg)
        if self.value < 0 and self.name.casefold() not in {"base excess"}:
            msg = f"{self.name} should not be negative in this prototype validator."
            raise ValueError(msg)
        return self


class ClinicalScore(BaseModel):
    """Validated clinical score or screener result."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    scale: str = Field(min_length=1)
    value: int

    @field_validator("scale")
    @classmethod
    def normalize_scale(cls, value: str) -> str:
        """Normalize score scale labels."""
        stripped = value.strip()
        if not stripped:
            msg = "Clinical score scale must not be blank."
            raise ValueError(msg)
        return stripped

    @model_validator(mode="after")
    def validate_score_range(self) -> ClinicalScore:
        """Validate known score ranges."""
        ranges = {
            "phq-9": (0, 27),
            "gad-7": (0, 21),
            "audit-c": (0, 12),
            "cssrs": (0, 25),
            "c-ssrs": (0, 25),
            "tug": (0, 300),
            "5xsts": (0, 300),
        }
        key = self.scale.casefold().replace(" ", "").replace("_", "-")
        low, high = ranges.get(key, (0, 10_000))
        if not low <= self.value <= high:
            msg = f"{self.scale} score {self.value} is outside plausible range {low}-{high}."
            raise ValueError(msg)
        return self


class PainScale(BaseModel):
    """Validated 0-10 pain rating."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    value: int = Field(ge=0, le=10)
    scale: str = "0-10"


class RangeOfMotionMeasurement(BaseModel):
    """Validated range-of-motion measurement in degrees."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    movement: str = Field(min_length=1)
    degrees: float = Field(ge=0.0, le=360.0)
    body_site: str | None = None
    laterality: str | None = None

    @field_validator("movement", "body_site", "laterality")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Strip whitespace from ROM text fields."""
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if not stripped:
            msg = "ROM text fields must not be blank when provided."
            raise ValueError(msg)
        return stripped


class StrengthGrade(BaseModel):
    """Validated manual muscle test grade.

    The ``raw_grade`` parser accepts values such as ``4-/5``, ``4+/5``, ``3``,
    or ``5/5``. The normalized grade is stored as a float where ``+`` adds 0.3
    and ``-`` subtracts 0.3 for ordering purposes.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    raw_grade: str = Field(min_length=1)
    normalized_grade: float

    @model_validator(mode="before")
    @classmethod
    def parse_raw_grade(cls, data: object) -> object:
        """Parse ``raw_grade`` into ``normalized_grade``."""
        if not isinstance(data, dict) or "raw_grade" not in data:
            return data
        raw_grade = str(data["raw_grade"]).strip()
        match = re.fullmatch(r"([0-5])\s*([+-]?)\s*(?:/\s*5)?", raw_grade)
        if not match:
            msg = f"Invalid strength grade: {raw_grade!r}."
            raise ValueError(msg)

        base = float(match.group(1))
        modifier = match.group(2)
        normalized = base + (0.3 if modifier == "+" else -0.3 if modifier == "-" else 0.0)
        if not 0.0 <= normalized <= 5.0:
            msg = f"Strength grade {raw_grade!r} is outside 0-5 scale."
            raise ValueError(msg)
        return {**data, "raw_grade": raw_grade, "normalized_grade": normalized}


def normalize_temperature_unit(unit: str | None) -> TemperatureUnit:
    """Normalize temperature units, defaulting to Fahrenheit for US notes."""
    if unit is None:
        return TemperatureUnit.FAHRENHEIT
    normalized = unit.strip().casefold()
    if normalized in {"c", "cel", "celsius", "°c"}:
        return TemperatureUnit.CELSIUS
    if normalized in {"f", "degf", "fahrenheit", "°f"}:
        return TemperatureUnit.FAHRENHEIT
    msg = f"Unsupported temperature unit: {unit!r}."
    raise ValueError(msg)


def validate_vital(vital_type: VitalType | str, value: float, unit: str | None = None) -> VitalMeasurement:
    """Validate a vital sign measurement."""
    return VitalMeasurement(vital_type=VitalType(vital_type), value=value, unit=unit)


def validate_blood_pressure(systolic: int, diastolic: int) -> BloodPressureMeasurement:
    """Validate a blood pressure measurement."""
    return BloodPressureMeasurement(systolic=systolic, diastolic=diastolic)


def validate_lab_value(
    name: str,
    value: float,
    unit: str | None = None,
    reference_low: float | None = None,
    reference_high: float | None = None,
) -> LabValue:
    """Validate a lab value."""
    return LabValue(
        name=name,
        value=value,
        unit=unit,
        reference_low=reference_low,
        reference_high=reference_high,
    )


def validate_clinical_score(scale: str, value: int) -> ClinicalScore:
    """Validate a clinical score."""
    return ClinicalScore(scale=scale, value=value)


def validate_pain_scale(value: int) -> PainScale:
    """Validate a 0-10 pain scale."""
    return PainScale(value=value)


def validate_rom(
    movement: str,
    degrees: float,
    *,
    body_site: str | None = None,
    laterality: str | None = None,
) -> RangeOfMotionMeasurement:
    """Validate a range-of-motion value."""
    return RangeOfMotionMeasurement(
        movement=movement,
        degrees=degrees,
        body_site=body_site,
        laterality=laterality,
    )


def validate_strength_grade(raw_grade: str) -> StrengthGrade:
    """Validate a manual muscle testing grade."""
    return StrengthGrade(raw_grade=raw_grade, normalized_grade=0.0)
