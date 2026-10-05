"""Retrain model Dynamic Pricing v4 memakai data live (continuous learning).

Alur:
  1. Baca dataset dasar ``datasets/car_rental_xyz_dynamic_pricing_v4.csv``
     (label simulasi) dan split grup per ``source_vehicle_id`` (identik dengan
     ``scripts/retrain_v4_model.py`` supaya metrik bisa dibandingkan apple-to-apples
     dengan baseline MAE 2.104 poin persentase / R2 0.9764).
  2. Terima baris live dari website (fitur + target). Target dihitung oleh
     :func:`app.labeler.label_adjustment` (aturan ahli v4) kecuali website
     mengirimkan koreksi manual admin (``target_price_adjustment_pct``).
  3. Train ulang dengan hyperparameter terkunci dari metadata baseline,
     baris live diberi bobot ``live_weight``.
  4. Guardrail: MAE test-split tidak boleh memburuk melewati toleransi dan
      R2 tidak boleh turun melewati toleransi. Lolos -> tulis artefak versi
      baru; gagal -> TIDAK ada artefak (website mendaftarkan versi hanya
      jika guardrail lolos).
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from .constants import (
    ARTIFACT_FILE_NAME,
    BASE_DATASET_PATH,
    DEFAULT_MAX_MAE_REGRESSION_RATIO,
    DEFAULT_MIN_R2_DROP,
    LIVE_HOLDOUT_MIN_ROWS,
    METADATA_FILE_NAME,
    METADATA_PATH,
    MODEL_FEATURES,
    TARGET_NAME,
    MODEL_VERSION,
    VERSIONS_DIR,
    is_valid_version_slug,
)
from .labeler import LabelerError, clamp_adjustment, label_adjustment

RANDOM_STATE = 42
TRAIN_RATIO = 0.80
TEST_RATIO = 0.20
LIVE_HOLDOUT_RATIO = 0.20
SUPPORTED_VEHICLE_CATEGORIES = ("passenger_car", "mpv", "suv", "van")
SUPPORTED_TRIP_TYPES = ("dalam_kota", "luar_kota")

CATEGORICAL_FEATURES = ["vehicle_category", "trip_type"]


class RetrainError(RuntimeError):
    """Retrain gagal karena kondisi dataset/konfigurasi."""


class DatasetMissingError(RetrainError):
    """Dataset dasar tidak tersedia di mesin ml-service."""


def split_by_source_vehicle(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    source_ids = pd.Series(df["source_vehicle_id"].dropna().unique())
    train_ids, test_ids = train_test_split(
        source_ids,
        train_size=TRAIN_RATIO,
        test_size=TEST_RATIO,
        random_state=RANDOM_STATE,
        shuffle=True,
    )
    train_df = df[df["source_vehicle_id"].isin(set(train_ids))].copy()
    test_df = df[df["source_vehicle_id"].isin(set(test_ids))].copy()
    if len(set(train_ids).intersection(test_ids)) != 0:
        raise AssertionError("source_vehicle_id overlap between train and test must be 0.")
    return train_df, test_df


def build_pipeline(best_params: Mapping[str, Any]) -> Pipeline:
    features = list(MODEL_FEATURES)
    numeric = [name for name in features if name not in CATEGORICAL_FEATURES]

    model_params = {key.removeprefix("model__"): value for key, value in best_params.items()}
    model_params["random_state"] = RANDOM_STATE
    model_params["n_jobs"] = -1

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
            ("numeric", "passthrough", numeric),
        ],
        remainder="drop",
    )
    model = RandomForestRegressor(**model_params)
    return Pipeline(steps=[("preprocessor", preprocessor), ("model", model)])


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _extract_metrics(container: Mapping[str, Any]) -> dict[str, float]:
    try:
        return {
            "mae_percentage_points": float(container["mae_percentage_points"]),
            "rmse_percentage_points": float(container["rmse_percentage_points"]),
            "r2": float(container["r2"]),
        }
    except (KeyError, TypeError, ValueError) as exc:
        raise RetrainError(f"Metadata baseline tidak memuat metrik evaluasi yang valid: {exc}") from exc


def trim_metrics(metrics: Mapping[str, float]) -> dict[str, float]:
    return {
        key: float(metrics[key])
        for key in ("mae_percentage_points", "rmse_percentage_points", "r2")
    }


def compute_metrics(y_true: np.ndarray, predictions: np.ndarray) -> dict[str, float]:
    mae = float(mean_absolute_error(y_true, predictions))
    rmse = float(np.sqrt(mean_squared_error(y_true, predictions)))
    r2 = float(r2_score(y_true, predictions)) if len(y_true) > 1 else 0.0
    return {
        "mae_decimal": mae,
        "rmse_decimal": rmse,
        "mae_percentage_points": mae * 100,
        "rmse_percentage_points": rmse * 100,
        "r2": r2,
    }


def build_live_rows(
    live_rows: Iterable[Mapping[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Validasi + labeli baris live, dedupe per (fitur, target)."""
    counts = {
        "received": 0,
        "skipped_invalid": 0,
        "labeled_rule": 0,
        "labeled_manual": 0,
        "used": 0,
    }
    prepared: list[dict[str, Any]] = []
    seen: set[tuple[Any, ...]] = set()

    for row in live_rows:
        counts["received"] += 1
        features = {name: row.get(name) for name in MODEL_FEATURES}
        vehicle_category = features.get("vehicle_category")
        trip_type = features.get("trip_type")
        if vehicle_category not in SUPPORTED_VEHICLE_CATEGORIES or trip_type not in SUPPORTED_TRIP_TYPES:
            counts["skipped_invalid"] += 1
            continue

        manual_target = row.get("target_price_adjustment_pct")
        try:
            if manual_target is None:
                target_value = label_adjustment(features)
                labeled_manual = False
            else:
                target_value = clamp_adjustment(float(manual_target))
                labeled_manual = True
        except (LabelerError, TypeError, ValueError):
            counts["skipped_invalid"] += 1
            continue

        key = tuple(
            [
                *(str(features[name]) for name in ("vehicle_category", "trip_type")),
                int(features["duration_days"]),
                int(features["is_weekend"]),
                int(features["is_holiday"]),
                int(features["is_peak_season"]),
                round(float(features["utilization_rate"]), 4),
                int(features["booking_lead_days"]),
                round(target_value, 6),
            ]
        )
        if key in seen:
            continue
        seen.add(key)

        if labeled_manual:
            counts["labeled_manual"] += 1
        else:
            counts["labeled_rule"] += 1

        prepared.append(
            {
                **features,
                TARGET_NAME: target_value,
                "source_vehicle_id": f"live-{row.get('quote_id', 'unknown')}",
            }
        )

    counts["used"] = len(prepared)
    return prepared, counts


def run_retrain(
    version: str,
    live_rows: Iterable[Mapping[str, Any]],
    live_weight: float,
    guardrail: Mapping[str, float],
    *,
    dataset_path: Path | str | None = None,
    baseline_metadata_path: Path | str | None = None,
    output_dir: Path | str | None = None,
) -> dict[str, Any]:
    started_at = time.perf_counter()

    if not is_valid_version_slug(version):
        raise RetrainError(f"Nama versi tidak valid: {version}")
    if live_weight <= 0:
        raise RetrainError("live_weight harus lebih besar dari 0.")

    dataset_file = Path(dataset_path) if dataset_path else BASE_DATASET_PATH
    metadata_file = Path(baseline_metadata_path) if baseline_metadata_path else METADATA_PATH
    destination = Path(output_dir) if output_dir else VERSIONS_DIR / version

    if not dataset_file.exists():
        raise DatasetMissingError(
            "Dataset dasar tidak ditemukan di ml-service; retrain live memerlukan "
            f"{dataset_file.name}."
        )

    if not metadata_file.exists():
        raise RetrainError(f"Metadata model baseline tidak ditemukan: {metadata_file.name}")

    baseline_metadata = _read_json(metadata_file)
    best_params = baseline_metadata.get("best_params")
    if not isinstance(best_params, Mapping) or not best_params:
        raise RetrainError("Metadata baseline tidak memuat best_params.")
    target = str(baseline_metadata.get("target", TARGET_NAME))
    if target != TARGET_NAME:
        raise RetrainError(f"Target baseline ({target}) tidak sesuai kontrak v4.")
    baseline_metrics = _extract_metrics(baseline_metadata.get("test_adjustment_metrics", {}))

    base_df = pd.read_csv(dataset_file)
    required_columns = set(MODEL_FEATURES) | {target, "source_vehicle_id"}
    missing_columns = sorted(required_columns - set(base_df.columns))
    if missing_columns:
        raise RetrainError(f"Dataset dasar kekurangan kolom: {', '.join(missing_columns)}")

    train_df, test_df = split_by_source_vehicle(base_df)
    live_prepared, live_counts = build_live_rows(live_rows)
    live_df = pd.DataFrame(live_prepared, columns=[*MODEL_FEATURES, target, "source_vehicle_id"])

    live_metrics: dict[str, float] | None = None
    live_holdout_rows = 0
    live_train_df = live_df
    live_holdout_df: pd.DataFrame | None = None
    if len(live_df) >= LIVE_HOLDOUT_MIN_ROWS:
        live_train_df, live_holdout_df = train_test_split(
            live_df,
            test_size=LIVE_HOLDOUT_RATIO,
            random_state=RANDOM_STATE,
            shuffle=True,
        )
        live_holdout_rows = len(live_holdout_df)

    features = list(MODEL_FEATURES)
    frames = [train_df[features + [target]]]
    weight_parts = [np.ones(len(train_df), dtype=float)]
    if len(live_train_df) > 0:
        frames.append(live_train_df[features + [target]])
        weight_parts.append(np.full(len(live_train_df), float(live_weight), dtype=float))
    combined = pd.concat(frames, ignore_index=True)
    weights = np.concatenate(weight_parts)

    pipeline = build_pipeline(best_params)
    pipeline.fit(
        combined[features],
        combined[target].astype(float),
        model__sample_weight=weights,
    )

    predictions = pipeline.predict(test_df[features])
    metrics = compute_metrics(test_df[target].astype(float).to_numpy(), predictions)

    if live_holdout_df is not None and live_holdout_rows > 0:
        live_predictions = pipeline.predict(live_holdout_df[features])
        live_metrics = compute_metrics(
            live_holdout_df[target].astype(float).to_numpy(),
            live_predictions,
        )

    max_mae_regression_ratio = float(guardrail.get("max_mae_regression_ratio", DEFAULT_MAX_MAE_REGRESSION_RATIO))
    min_r2_drop = float(guardrail.get("min_r2_drop", DEFAULT_MIN_R2_DROP))

    reasons: list[str] = []
    mae_limit = baseline_metrics["mae_percentage_points"] * (1 + max_mae_regression_ratio)
    if metrics["mae_percentage_points"] > mae_limit:
        reasons.append(
            f"MAE {metrics['mae_percentage_points']:.3f} poin melewati batas "
            f"{mae_limit:.3f} (baseline {baseline_metrics['mae_percentage_points']:.3f})."
        )
    r2_floor = baseline_metrics["r2"] - min_r2_drop
    if metrics["r2"] < r2_floor:
        reasons.append(
            f"R2 {metrics['r2']:.4f} di bawah batas {r2_floor:.4f} "
            f"(baseline {baseline_metrics['r2']:.4f})."
        )
    guardrail_passed = len(reasons) == 0

    artifact_path: Path | None = None
    if guardrail_passed:
        destination.mkdir(parents=True, exist_ok=True)
        artifact_path = destination / ARTIFACT_FILE_NAME
        joblib.dump(pipeline, artifact_path)

        updated_metadata = dict(baseline_metadata)
        updated_metadata.update(
            {
                "rows": int(len(base_df) + len(live_df)),
                "train_rows": int(len(combined)),
                "test_rows": int(len(test_df)),
                "train_source_vehicles": int(train_df["source_vehicle_id"].nunique()),
                "test_source_vehicles": int(test_df["source_vehicle_id"].nunique()),
                "overlap_source_vehicle_id": 0,
                "test_adjustment_metrics": metrics,
                "parent_version": str(baseline_metadata.get("version") or MODEL_VERSION),
                "version": version,
                "live_rows_used": int(live_counts["used"]),
                "live_rows_labeled_rule": int(live_counts["labeled_rule"]),
                "live_rows_labeled_manual": int(live_counts["labeled_manual"]),
                "live_weight": float(live_weight),
                "live_holdout_rows": int(live_holdout_rows),
                "live_metrics": live_metrics,
                "baseline_metrics": baseline_metrics,
                "guardrail": {
                    "passed": guardrail_passed,
                    "max_mae_regression_ratio": max_mae_regression_ratio,
                    "min_r2_drop": min_r2_drop,
                    "reasons": reasons,
                },
                "retrained_at": datetime.now(timezone.utc).isoformat(),
                "retrain_script": "app/retrain.py",
            }
        )
        (destination / METADATA_FILE_NAME).write_text(
            json.dumps(updated_metadata, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    return {
        "status": "completed" if guardrail_passed else "guardrail_failed",
        "version": version,
        "artifact_path": str(artifact_path) if artifact_path else None,
        "duration_seconds": round(time.perf_counter() - started_at, 3),
        "live_rows_received": live_counts["received"],
        "live_rows_used": live_counts["used"],
        "live_rows_skipped_invalid": live_counts["skipped_invalid"],
        "live_rows_labeled_rule": live_counts["labeled_rule"],
        "live_rows_labeled_manual": live_counts["labeled_manual"],
        "base_rows": int(len(base_df)),
        "train_rows": int(len(combined)),
        "test_rows": int(len(test_df)),
        "live_holdout_rows": int(live_holdout_rows),
        "baseline_metrics": baseline_metrics,
        "metrics": trim_metrics(metrics),
        "live_metrics": trim_metrics(live_metrics) if live_metrics else None,
        "guardrail": {
            "passed": guardrail_passed,
            "max_mae_regression_ratio": max_mae_regression_ratio,
            "min_r2_drop": min_r2_drop,
            "reasons": reasons,
        },
    }
