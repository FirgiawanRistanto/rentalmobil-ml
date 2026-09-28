"""Generate precomputed Random Forest evaluation artifacts for Dynamic Pricing v4.

This script is offline/dev-only. It reads the v4 dataset, trains temporary
Random Forest models for 70/30, 80/20, and 90/10 splits, and writes CSV/JSON
artifacts for the future admin Machine Learning page.

Run from repository root:
    ml-service/.venv-v4/Scripts/python.exe ml-service/scripts/generate_ml_evaluation_artifacts.py

Run from ml-service:
    .venv-v4/Scripts/python.exe scripts/generate_ml_evaluation_artifacts.py
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


RANDOM_STATE = 42
TRAIN_OUTPUT_SHUFFLE_SEED = RANDOM_STATE + 101
TEST_OUTPUT_SHUFFLE_SEED = RANDOM_STATE + 202
SPLITS = (
    ("split_70_30", 0.70, 0.30),
    ("split_80_20", 0.80, 0.20),
    ("split_90_10", 0.90, 0.10),
)

MODEL_PARAMS = {
    "n_estimators": 500,
    "max_depth": 15,
    "max_features": "sqrt",
    "min_samples_split": 5,
    "min_samples_leaf": 1,
    "random_state": RANDOM_STATE,
    "n_jobs": -1,
}

REQUIRED_TRAIN_COLUMNS = [
    "id_data",
    "source_vehicle_id",
    "vehicle_category",
    "trip_type",
    "duration_days",
    "is_weekend",
    "is_holiday",
    "is_peak_season",
    "utilization_rate",
]

OPTIONAL_TRAIN_COLUMNS = [
    "booking_lead_days",
    "dynamic_price_display_per_day",
    "total_invoice_display",
]

REQUIRED_PREDICTION_COLUMNS = [
    "id_data",
    "source_vehicle_id",
    "vehicle_category",
    "trip_type",
    "duration_days",
    "is_weekend",
    "is_holiday",
    "is_peak_season",
    "utilization_rate",
]


def find_ml_service_dir() -> Path:
    current = Path.cwd().resolve()
    if (current / "datasets" / "car_rental_xyz_dynamic_pricing_v4.csv").exists():
        return current

    candidate = current / "ml-service"
    if (candidate / "datasets" / "car_rental_xyz_dynamic_pricing_v4.csv").exists():
        return candidate

    raise FileNotFoundError(
        "Cannot find ml-service directory. Run from repo root or ml-service."
    )


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def load_training_metadata(ml_service_dir: Path) -> dict[str, Any]:
    candidates = [
        ml_service_dir / "artifacts" / "v4_final" / "training_metadata_adjustment_v4.json",
        ml_service_dir / "artifacts" / "v4_finals" / "training_metadata_adjustment_v4.json",
    ]

    for path in candidates:
        if path.exists():
            return read_json(path)

    raise FileNotFoundError("training_metadata_adjustment_v4.json was not found.")


def ensure_required_columns(df: pd.DataFrame, columns: list[str], context: str) -> None:
    missing = [column for column in columns if column not in df.columns]
    if missing:
        raise ValueError(f"Missing {context} columns: {', '.join(missing)}")


def build_pipeline(features: list[str]) -> Pipeline:
    categorical_features = [
        feature for feature in ("vehicle_category", "trip_type") if feature in features
    ]
    numeric_features = [feature for feature in features if feature not in categorical_features]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                categorical_features,
            ),
            ("numeric", "passthrough", numeric_features),
        ],
        remainder="drop",
    )

    model = RandomForestRegressor(**MODEL_PARAMS)
    return Pipeline(
        steps=[
            ("preprocess", preprocessor),
            ("model", model),
        ]
    )


def split_dataframe_by_source_vehicle(
    df: pd.DataFrame,
    train_ratio: float,
    test_ratio: float,
) -> tuple[pd.DataFrame, pd.DataFrame, int]:
    if "source_vehicle_id" not in df.columns:
        train_df, test_df = train_test_split(
            df,
            test_size=test_ratio,
            random_state=RANDOM_STATE,
            shuffle=True,
        )
        return train_df.copy(), test_df.copy(), 0

    source_ids = pd.Series(df["source_vehicle_id"].dropna().unique())
    train_source_ids, test_source_ids = train_test_split(
        source_ids,
        train_size=train_ratio,
        test_size=test_ratio,
        random_state=RANDOM_STATE,
        shuffle=True,
    )
    train_sources = set(train_source_ids)
    test_sources = set(test_source_ids)
    overlap = len(train_sources.intersection(test_sources))

    train_df = df[df["source_vehicle_id"].isin(train_sources)].copy()
    test_df = df[df["source_vehicle_id"].isin(test_sources)].copy()
    return train_df, test_df, overlap


def ensure_id_column(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    if "simulation_case_id" in result.columns:
        result["id_data"] = result["simulation_case_id"].astype(str)
    else:
        result["id_data"] = result.index.astype(str)
    return result


def round_display_price(value: pd.Series) -> pd.Series:
    return (value / 1000).round() * 1000


def build_train_dataset(train_df: pd.DataFrame, target: str) -> pd.DataFrame:
    columns = REQUIRED_TRAIN_COLUMNS + [
        column for column in OPTIONAL_TRAIN_COLUMNS if column in train_df.columns
    ]
    if target not in columns:
        columns.append(target)

    output = train_df[[column for column in columns if column in train_df.columns]].copy()
    if target in output.columns:
        output["target_adjustment_pct"] = output[target].astype(float) * 100
        output = output.drop(columns=[target])

    ordered_columns = [
        "id_data",
        "source_vehicle_id",
        "vehicle_category",
        "trip_type",
        "duration_days",
        "is_weekend",
        "is_holiday",
        "is_peak_season",
        "utilization_rate",
        "booking_lead_days",
        "target_adjustment_pct",
        "dynamic_price_display_per_day",
        "total_invoice_display",
    ]
    return output[[column for column in ordered_columns if column in output.columns]]


def build_test_predictions(
    test_df: pd.DataFrame,
    target: str,
    predictions: np.ndarray,
) -> tuple[pd.DataFrame, float | None]:
    output = test_df[[column for column in REQUIRED_PREDICTION_COLUMNS if column in test_df.columns]].copy()
    actual = test_df[target].astype(float)
    predicted = pd.Series(predictions, index=test_df.index)

    output["actual_adjustment_pct"] = actual * 100
    output["predicted_adjustment_pct"] = predicted * 100
    output["absolute_error_pct_point"] = (actual - predicted).abs() * 100

    mae_display_price_idr: float | None = None
    if {
        "base_price_idr_per_day",
        "dynamic_price_display_per_day",
    }.issubset(test_df.columns):
        predicted_display = round_display_price(
            test_df["base_price_idr_per_day"].astype(float) * (1 + predicted)
        )
        actual_display = test_df["dynamic_price_display_per_day"].astype(float)
        output["absolute_error_idr"] = (actual_display - predicted_display).abs()
        mae_display_price_idr = float(output["absolute_error_idr"].mean())

    ordered_columns = [
        "id_data",
        "source_vehicle_id",
        "vehicle_category",
        "trip_type",
        "duration_days",
        "is_weekend",
        "is_holiday",
        "is_peak_season",
        "utilization_rate",
        "actual_adjustment_pct",
        "predicted_adjustment_pct",
        "absolute_error_pct_point",
        "absolute_error_idr",
    ]
    return output[[column for column in ordered_columns if column in output.columns]], mae_display_price_idr


def shuffle_output_rows(df: pd.DataFrame, seed: int) -> pd.DataFrame:
    """Shuffle artifact row order without changing split membership or row values."""
    return df.sample(frac=1, random_state=seed).reset_index(drop=True)


def evaluate_split(
    df: pd.DataFrame,
    output_dir: Path,
    split_name: str,
    train_ratio: float,
    test_ratio: float,
    features: list[str],
    target: str,
) -> dict[str, Any]:
    split_dir = output_dir / split_name
    split_dir.mkdir(parents=True, exist_ok=True)

    train_df, test_df, source_overlap = split_dataframe_by_source_vehicle(
        df,
        train_ratio=train_ratio,
        test_ratio=test_ratio,
    )

    pipeline = build_pipeline(features)
    pipeline.fit(train_df[features], train_df[target].astype(float))
    predictions = pipeline.predict(test_df[features])

    y_true = test_df[target].astype(float)
    mae = float(mean_absolute_error(y_true, predictions))
    r2 = float(r2_score(y_true, predictions))

    train_artifact = build_train_dataset(train_df, target)
    predictions_artifact, mae_display_price_idr = build_test_predictions(
        test_df,
        target,
        predictions,
    )
    train_artifact = shuffle_output_rows(train_artifact, TRAIN_OUTPUT_SHUFFLE_SEED)
    predictions_artifact = shuffle_output_rows(predictions_artifact, TEST_OUTPUT_SHUFFLE_SEED)

    train_artifact.to_csv(split_dir / "train_dataset.csv", index=False)
    predictions_artifact.to_csv(split_dir / "test_predictions.csv", index=False)

    train_sources = set(train_df["source_vehicle_id"].dropna()) if "source_vehicle_id" in train_df.columns else set()
    test_sources = set(test_df["source_vehicle_id"].dropna()) if "source_vehicle_id" in test_df.columns else set()
    unique_sources = set(df["source_vehicle_id"].dropna()) if "source_vehicle_id" in df.columns else set()

    evaluation = {
        "split": split_name,
        "trainRatio": train_ratio,
        "testRatio": test_ratio,
        "model": {
            "type": "RandomForestRegressor",
            "params": MODEL_PARAMS,
        },
        "randomState": RANDOM_STATE,
        "totalRows": int(len(df)),
        "trainRows": int(len(train_df)),
        "testRows": int(len(test_df)),
        "uniqueSourceVehicles": int(len(unique_sources)),
        "trainSourceVehicles": int(len(train_sources)),
        "testSourceVehicles": int(len(test_sources)),
        "sourceVehicleOverlap": int(source_overlap),
        "features": features,
        "target": target,
        "mae": mae,
        "r2": r2,
        "maePctPoint": mae * 100,
        "r2Percent": r2 * 100,
        "maeDisplayPriceIdr": mae_display_price_idr,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    write_json(split_dir / "evaluation.json", evaluation)
    return evaluation


def validate_outputs(evaluations: list[dict[str, Any]]) -> None:
    for evaluation in evaluations:
        split = evaluation["split"]
        if evaluation["trainRows"] + evaluation["testRows"] != evaluation["totalRows"]:
            raise AssertionError(f"{split}: trainRows + testRows != totalRows")
        if evaluation["sourceVehicleOverlap"] != 0:
            raise AssertionError(f"{split}: sourceVehicleOverlap must be 0")


def main() -> None:
    ml_service_dir = find_ml_service_dir()
    dataset_path = ml_service_dir / "datasets" / "car_rental_xyz_dynamic_pricing_v4.csv"
    output_dir = ml_service_dir / "artifacts" / "ml_evaluation"
    metadata = load_training_metadata(ml_service_dir)

    features = list(metadata["model_features"])
    target = str(metadata["target"])

    df = pd.read_csv(dataset_path)
    df = ensure_id_column(df)

    ensure_required_columns(df, features, "model feature")
    ensure_required_columns(df, [target], "target")
    ensure_required_columns(df, REQUIRED_TRAIN_COLUMNS, "artifact")

    output_dir.mkdir(parents=True, exist_ok=True)

    evaluations = [
        evaluate_split(
            df=df,
            output_dir=output_dir,
            split_name=split_name,
            train_ratio=train_ratio,
            test_ratio=test_ratio,
            features=features,
            target=target,
        )
        for split_name, train_ratio, test_ratio in SPLITS
    ]
    validate_outputs(evaluations)

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "dataset": str(dataset_path.relative_to(ml_service_dir)),
        "outputRoot": str(output_dir.relative_to(ml_service_dir)),
        "note": "Precomputed evaluation artifacts for the admin Machine Learning page. The web app must not train models at request time.",
        "splits": [
            {
                "split": evaluation["split"],
                "trainRatio": evaluation["trainRatio"],
                "testRatio": evaluation["testRatio"],
                "paths": {
                    "trainDataset": f"{evaluation['split']}/train_dataset.csv",
                    "testPredictions": f"{evaluation['split']}/test_predictions.csv",
                    "evaluation": f"{evaluation['split']}/evaluation.json",
                },
                "trainRows": evaluation["trainRows"],
                "testRows": evaluation["testRows"],
                "mae": evaluation["mae"],
                "r2": evaluation["r2"],
                "maePctPoint": evaluation["maePctPoint"],
                "r2Percent": evaluation["r2Percent"],
                "maeDisplayPriceIdr": evaluation["maeDisplayPriceIdr"],
                "sourceVehicleOverlap": evaluation["sourceVehicleOverlap"],
            }
            for evaluation in evaluations
        ],
    }
    write_json(output_dir / "manifest.json", manifest)

    print("Generated ML evaluation artifacts:")
    for evaluation in evaluations:
        print(
            f"- {evaluation['split']}: "
            f"train={evaluation['trainRows']}, "
            f"test={evaluation['testRows']}, "
            f"MAE={evaluation['mae']:.6f}, "
            f"R2={evaluation['r2']:.6f}, "
            f"overlap={evaluation['sourceVehicleOverlap']}"
        )
    print(f"Manifest: {output_dir / 'manifest.json'}")


if __name__ == "__main__":
    main()
