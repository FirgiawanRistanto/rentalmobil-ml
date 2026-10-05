"""Penarget otomatis (aturan ahli v4) untuk baris training live.

Formula ini adalah port dari ``build_adjustment()`` pada
``dataset-pipeline/adapt_kaggle_to_rental_xyz_v4.py`` — sumber label
``price_adjustment_pct`` pada dataset simulasi 41.088 baris.

Perbedaan yang disengaja: komponen laten ``operational_variation_pct``
(noise Gaussian) TIDAK direplikasi, sehingga penargetan live bersifat
deterministik: baris fitur yang sama selalu menghasilkan target yang sama.
Batas clamp tetap sama dengan dataset awal: [-0.32, 0.52].
"""

from __future__ import annotations

from typing import Any, Mapping

import numpy as np

LABEL_MIN_ADJUSTMENT = -0.32
LABEL_MAX_ADJUSTMENT = 0.52

# Titik kumpat (utilization_rate -> penyesuaian) identik dengan dataset v4.
UTILIZATION_INTERP_POINTS = [0.05, 0.20, 0.30, 0.50, 0.70, 0.85, 0.95]
UTILIZATION_INTERP_VALUES = [-0.12, -0.09, -0.055, 0.0, 0.075, 0.15, 0.20]

REQUIRED_FEATURES = (
    "vehicle_category",
    "trip_type",
    "duration_days",
    "is_weekend",
    "is_holiday",
    "is_peak_season",
    "utilization_rate",
    "booking_lead_days",
)


class LabelerError(ValueError):
    """Fitur live tidak lengkap/tidak sah untuk penargetan."""


def clamp_adjustment(value: float) -> float:
    return float(min(max(value, LABEL_MIN_ADJUSTMENT), LABEL_MAX_ADJUSTMENT))


def utilization_effect(rate: float) -> float:
    """Efek kontinu okupansi armada: utilisasi rendah menekan harga, tinggi menaikkan."""
    return float(
        np.interp(
            float(rate),
            UTILIZATION_INTERP_POINTS,
            UTILIZATION_INTERP_VALUES,
        )
    )


def label_adjustment(features: Mapping[str, Any]) -> float:
    """Hitung ``price_adjustment_pct`` (desimal) dari 8 fitur kontrak v4.

    Contoh: ``0.125`` berarti kenaikan harga ``+12,5%``.
    """
    missing = [name for name in REQUIRED_FEATURES if name not in features]
    if missing:
        raise LabelerError(f"Fitur live tidak lengkap: {', '.join(missing)}")

    try:
        duration = int(features["duration_days"])
        lead_days = int(features["booking_lead_days"])
        utilization = float(features["utilization_rate"])
        is_weekend = int(features["is_weekend"]) != 0
        is_holiday = int(features["is_holiday"]) != 0
        is_peak = int(features["is_peak_season"]) != 0
        trip_type = str(features["trip_type"])
        vehicle_category = str(features["vehicle_category"])
    except (TypeError, ValueError) as exc:
        raise LabelerError(f"Fitur live tidak valid: {exc}") from exc

    duration_value = (
        -0.12 if duration >= 14 else (-0.085 if duration >= 7 else (-0.035 if duration >= 3 else 0.0))
    )
    if lead_days <= 2:
        lead_value = 0.045
    elif lead_days <= 7:
        lead_value = 0.020
    elif lead_days >= 30:
        lead_value = -0.025
    else:
        lead_value = 0.0

    components = [
        utilization_effect(utilization),
        0.045 if is_weekend else 0.0,
        0.095 if is_holiday else 0.0,
        0.065 if is_peak else 0.0,
        0.115 if trip_type == "luar_kota" else 0.0,
        duration_value,
        lead_value,
    ]

    interaction = 0.0
    if utilization >= 0.70 and trip_type == "luar_kota":
        interaction += 0.025
    if utilization >= 0.70 and is_holiday:
        interaction += 0.030
    if utilization <= 0.30 and duration >= 7:
        interaction -= 0.025
    if is_holiday and is_peak:
        interaction += 0.025
    if vehicle_category == "van" and trip_type == "luar_kota":
        interaction += 0.020
    components.append(interaction)

    return clamp_adjustment(float(sum(components)))
