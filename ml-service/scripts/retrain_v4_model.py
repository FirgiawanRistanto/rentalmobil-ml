"""Retrain the Dynamic Pricing v4 Random Forest into a production .pkl artifact.

Reproduces the original training run recorded in
artifacts/v4_final/training_metadata_adjustment_v4.json:

  - dataset : datasets/car_rental_xyz_dynamic_pricing_v4.csv (41.088 rows)
  - split   : group-based by source_vehicle_id, 80/20, random_state=42
              (identical to scripts/generate_ml_evaluation_artifacts.py,
              so train/test membership is bit-identical: 32.868 / 8.220)
  - pipeline: ColumnTransformer(OneHotEncoder) -> RandomForestRegressor
              using the locked best_params from metadata. The original
              72-candidate x 5-fold CV grid search was the offline tuning
              phase; its winning hyperparameters are reused verbatim here.
  - seed    : random_state=42 for the split and the forest.

Safety: by default the new artifact is written to artifacts/v4_final_staging/
and the production .pkl is NOT touched. Pass --commit to replace the
production artifact + metadata (retraining is deterministic, so the replaced
artifact is equivalent to the original).

Run from ml-service:
    ./.venv-v4/Scripts/python.exe scripts/retrain_v4_model.py
    ./.venv-v4/Scripts/python.exe scripts/retrain_v4_model.py --commit
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

BASE_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = BASE_DIR / "datasets" / "car_rental_xyz_dynamic_pricing_v4.csv"
METADATA_PATH = BASE_DIR / "artifacts" / "v4_final" / "training_metadata_adjustment_v4.json"
PRODUCTION_ARTIFACT_PATH = BASE_DIR / "artifacts" / "v4_final" / "dynamic_pricing_adjustment_rf_pipeline_v4.pkl"
STAGING_DIR = BASE_DIR / "artifacts" / "v4_final_staging"

RANDOM_STATE = 42
TRAIN_RATIO = 0.80
TEST_RATIO = 0.20
DISPLAY_ROUNDING_UNIT_IDR = 1000


def load_metadata() -> dict[str, Any]:
    if not METADATA_PATH.exists():
        raise FileNotFoundError("training_metadata_adjustment_v4.json not found.")
    return json.loads(METADATA_PATH.read_text(encoding="utf-8"))


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


def build_pipeline(best_params: dict[str, Any]) -> Pipeline:
    features = [
        "vehicle_category",
        "trip_type",
        "duration_days",
        "is_weekend",
        "is_holiday",
        "is_peak_season",
        "utilization_rate",
        "booking_lead_days",
    ]
    categorical = [f for f in ("vehicle_category", "trip_type") if f in features]
    numeric = [f for f in features if f not in categorical]

    model_params = {
        key.removeprefix("model__"): value for key, value in best_params.items()
    }
    model_params["random_state"] = RANDOM_STATE
    model_params["n_jobs"] = -1

    preprocessor = ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical),
            ("numeric", "passthrough", numeric),
        ],
        remainder="drop",
    )
    model = RandomForestRegressor(**model_params)
    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )


def rounding_safe(values: pd.Series | np.ndarray) -> np.ndarray:
    return (np.asarray(values, dtype=float) / DISPLAY_ROUNDING_UNIT_IDR).round() * DISPLAY_ROUNDING_UNIT_IDR


def compute_metrics(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    predictions: np.ndarray,
    target: str,
) -> dict[str, Any]:
    y_true = test_df[target].astype(float).to_numpy()
    mae = float(mean_absolute_error(y_true, predictions))
    rmse = float(np.sqrt(mean_squared_error(y_true, predictions)))
    r2 = float(r2_score(y_true, predictions))

    adjustment_metrics = {
        "mae_decimal": mae,
        "rmse_decimal": rmse,
        "mae_percentage_points": mae * 100,
        "rmse_percentage_points": rmse * 100,
        "r2": r2,
    }

    idr_metrics: dict[str, Any] = {}
    if {"base_price_idr_per_day"}.issubset(test_df.columns):
        base = test_df["base_price_idr_per_day"].astype(float).to_numpy()
        actual_display = test_df["dynamic_price_display_per_day"].astype(float).to_numpy() \
            if "dynamic_price_display_per_day" in test_df.columns else base * (1 + y_true)
        raw_pred_idr = base * (1 + predictions)
        raw_actual_idr = base * (1 + y_true)
        display_pred_idr = rounding_safe(raw_pred_idr)

        idr_metrics = {
            "raw_dynamic_daily_price_metrics_idr": {
                "mae_idr": float(np.mean(np.abs(raw_actual_idr - raw_pred_idr))),
                "rmse_idr": float(np.sqrt(np.mean((raw_actual_idr - raw_pred_idr) ** 2))),
                "r2": float(r2_score(raw_actual_idr, raw_pred_idr)),
            },
            "display_dynamic_daily_price_metrics_idr": {
                "mae_idr": float(np.mean(np.abs(actual_display - display_pred_idr))),
                "rmse_idr": float(np.sqrt(np.mean((actual_display - display_pred_idr) ** 2))),
                "r2": float(r2_score(actual_display, display_pred_idr)),
            },
        }

    baseline_prediction = np.full_like(y_true, float(np.mean(train_df[target].astype(float))))
    baseline_metrics = {
        "mae_decimal": float(mean_absolute_error(y_true, baseline_prediction)),
        "rmse_decimal": float(np.sqrt(mean_squared_error(y_true, baseline_prediction))),
        "r2": float(r2_score(y_true, baseline_prediction)),
    }

    return {
        "test_adjustment_metrics": adjustment_metrics,
        "dummy_baseline_metrics": baseline_metrics,
        **idr_metrics,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Retrain Dynamic Pricing v4 model.")
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Replace the production .pkl + metadata instead of writing to staging.",
    )
    args = parser.parse_args()

    metadata = load_metadata()
    features = list(metadata["model_features"])
    target = str(metadata["target"])
    best_params = dict(metadata["best_params"])

    df = pd.read_csv(DATASET_PATH)
    if "simulation_case_id" in df.columns:
        df["id_data"] = df["simulation_case_id"].astype(str)

    train_df, test_df = split_by_source_vehicle(df)

    print(f"Dataset rows: {len(df)} (train={len(train_df)}, test={len(test_df)})")
    print("Training RandomForest with locked best_params:")
    for key, value in best_params.items():
        print(f"  {key}: {value}")

    pipeline = build_pipeline(best_params)
    pipeline.fit(train_df[features], train_df[target].astype(float))
    predictions = pipeline.predict(test_df[features])

    metrics = compute_metrics(train_df, test_df, predictions, target)

    previous = metadata.get("test_adjustment_metrics", {})
    print("\nMetric comparison (current production vs retrained):")
    print(f"  MAE pct point : {previous.get('mae_percentage_points')} -> {metrics['test_adjustment_metrics']['mae_percentage_points']}")
    print(f"  RMSE pct point: {previous.get('rmse_percentage_points')} -> {metrics['test_adjustment_metrics']['rmse_percentage_points']}")
    print(f"  R2            : {previous.get('r2')} -> {metrics['test_adjustment_metrics']['r2']}")

    updated_metadata = dict(metadata)
    updated_metadata.update(
        {
            "rows": int(len(df)),
            "train_rows": int(len(train_df)),
            "test_rows": int(len(test_df)),
            "train_source_vehicles": int(train_df["source_vehicle_id"].nunique()),
            "test_source_vehicles": int(test_df["source_vehicle_id"].nunique()),
            "overlap_source_vehicle_id": 0,
            **metrics,
            "retrained_at": datetime.now(timezone.utc).isoformat(),
            "retrain_script": "scripts/retrain_v4_model.py",
        }
    )

    output_dir = PRODUCTION_ARTIFACT_PATH.parent if args.commit else STAGING_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = output_dir / PRODUCTION_ARTIFACT_PATH.name
    metadata_output_path = output_dir / METADATA_PATH.name

    print(f"\nWriting artifact to {artifact_path} ...")
    joblib.dump(pipeline, artifact_path)
    metadata_output_path.write_text(
        json.dumps(updated_metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Writing metadata to {metadata_output_path} ...")

    if args.commit:
        print("\nPRODUCTION artifact replaced. The FastAPI service must be restarted to load it.")
    else:
        print("\nStaging write complete; production artifact is untouched.")
        print("Inspect the metrics above, then re-run with --commit to replace production.")


if __name__ == "__main__":
    main()
