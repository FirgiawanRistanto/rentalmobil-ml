"""Uji penarget otomatis (aturan ahli v4) untuk baris training live."""

import pytest

from app.labeler import (
    LABEL_MAX_ADJUSTMENT,
    LabelerError,
    label_adjustment,
    utilization_effect,
)


def base_features(**overrides):
    features = {
        "vehicle_category": "mpv",
        "trip_type": "dalam_kota",
        "duration_days": 1,
        "is_weekend": 0,
        "is_holiday": 0,
        "is_peak_season": 0,
        "utilization_rate": 0.50,
        "booking_lead_days": 14,
    }
    features.update(overrides)
    return features


def test_neutral_context_labels_zero_adjustment():
    assert label_adjustment(base_features()) == pytest.approx(0.0)


def test_utilization_effect_matches_dataset_knots():
    assert utilization_effect(0.05) == pytest.approx(-0.12)
    assert utilization_effect(0.50) == pytest.approx(0.0)
    assert utilization_effect(0.95) == pytest.approx(0.20)
    # np.interp menahan nilai di luar titik kumpat.
    assert utilization_effect(1.0) == pytest.approx(0.20)
    assert utilization_effect(0.0) == pytest.approx(-0.12)


def test_component_sum_matches_reference_formula():
    features = base_features(
        utilization_rate=0.80,  # +0.125
        is_weekend=1,  # +0.045
        trip_type="luar_kota",  # +0.115
        duration_days=5,  # -0.035
        booking_lead_days=1,  # +0.045
        vehicle_category="mpv",  # van+lK tidak berlaku
    )
    # interaksi utilisasi>=0.70 + luar kota = +0.025
    expected = 0.125 + 0.045 + 0.115 - 0.035 + 0.045 + 0.025

    assert label_adjustment(features) == pytest.approx(expected, abs=1e-9)


def test_interaction_rules_apply():
    base = base_features(utilization_rate=0.80, trip_type="luar_kota", is_holiday=1, is_peak_season=1)
    # interaksi: luar kota + holiday pada utilisasi tinggi + holiday*peak
    expected = 0.125 + 0.095 + 0.065 + 0.115 + 0.025 + 0.030 + 0.025
    assert label_adjustment(base) == pytest.approx(expected, abs=1e-9)

    van = base_features(
        utilization_rate=0.20,
        trip_type="luar_kota",
        vehicle_category="van",
        duration_days=7,
    )
    # -0.09 + 0.115 - 0.085 + interaksi durasi>=7 pada utilisasi<=0.30 (-0.025) + van luar kota (+0.020)
    assert label_adjustment(van) == pytest.approx(-0.09 + 0.115 - 0.085 - 0.025 + 0.020, abs=1e-9)


def test_low_extreme_matches_reference_formula():
    features = base_features(utilization_rate=0.05, duration_days=14, booking_lead_days=30)
    # -0.12 (util) -0.12 (durasi>=14) -0.025 (lead>=30) -0.025 (interaksi durasi>=7 & utilisasi<=0.30)
    assert label_adjustment(features) == pytest.approx(-0.29, abs=1e-9)


def test_high_extreme_is_clamped_to_dataset_bounds():
    features = base_features(
        vehicle_category="van",
        trip_type="luar_kota",
        utilization_rate=0.95,
        is_weekend=1,
        is_holiday=1,
        is_peak_season=1,
        booking_lead_days=1,
    )
    assert label_adjustment(features) == LABEL_MAX_ADJUSTMENT


def test_label_is_deterministic():
    features = base_features(utilization_rate=0.63, is_weekend=1, duration_days=4)
    assert label_adjustment(features) == label_adjustment(features)


def test_missing_feature_raises_labeler_error():
    with pytest.raises(LabelerError):
        label_adjustment({"vehicle_category": "mpv"})


def test_invalid_feature_value_raises_labeler_error():
    with pytest.raises(LabelerError):
        label_adjustment(base_features(duration_days="tiga"))
