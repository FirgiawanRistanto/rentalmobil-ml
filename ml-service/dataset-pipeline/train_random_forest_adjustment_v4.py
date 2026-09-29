"""Training Random Forest v4 untuk rekomendasi penyesuaian harga Rental Mobil XYZ.

Model memprediksi price_adjustment_pct. Harga akhir/invoice dihitung setelah prediksi
menggunakan harga dasar mobil pilihan customer.

Konsistensi backend:
- Website menghitung availability_ratio dari database booking.
- Website menghitung utilization_rate = 1 - availability_ratio.
- demand_level adalah status UI/business rule turunan utilization_rate.
- Model menggunakan utilization_rate; demand_level dan availability_ratio tidak dipakai
  sekaligus sebagai fitur agar tidak ada redundansi deterministik.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV, GroupKFold, GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

SEED = 42
DISPLAY_PRICE_ROUNDING_UNIT = 1_000
TARGET = "price_adjustment_pct"
GROUP = "source_vehicle_id"
CATEGORICAL_FEATURES = ["vehicle_category", "trip_type"]
NUMERICAL_FEATURES = [
    "duration_days", "is_weekend", "is_holiday", "is_peak_season",
    "utilization_rate", "booking_lead_days",
]
FEATURES = CATEGORICAL_FEATURES + NUMERICAL_FEATURES
EVALUATION_COLUMNS = [
    "simulation_case_id", GROUP, "demand_level", "availability_ratio", "utilization_rate",
    "base_price_idr_per_day", "dynamic_price_raw_per_day", "dynamic_price_display_per_day",
    "total_invoice_raw", "total_invoice_display", "duration_days", "pricing_reason", TARGET,
]


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Training RF v4 untuk target price_adjustment_pct.")
    parser.add_argument("--input", type=Path, default=root / "car_rental_xyz_dynamic_pricing_v4.csv")
    parser.add_argument("--output-dir", type=Path, default=root / "rf_adjustment_v4_outputs")
    parser.add_argument("--full-grid", action="store_true", help="Gunakan 72 kandidat x 5 fold untuk eksperimen final.")
    parser.add_argument("--n-jobs", type=int, default=1)
    return parser.parse_args()


def derive_demand(utilization_rate: float) -> str:
    if utilization_rate <= 0.30:
        return "sepi"
    if utilization_rate >= 0.70:
        return "ramai"
    return "normal"


def validate_dataset(df: pd.DataFrame) -> None:
    required = set(FEATURES + EVALUATION_COLUMNS + [GROUP])
    missing = sorted(required.difference(df.columns))
    if missing:
        raise ValueError(f"Kolom wajib tidak tersedia: {missing}")
    if df.empty:
        raise ValueError("Dataset training kosong.")
    if df[TARGET].isna().any() or df[GROUP].isna().any():
        raise ValueError("Target atau group source_vehicle_id memiliki nilai kosong.")
    expected_utilization = (1.0 - df["availability_ratio"]).round(3)
    if not (df["utilization_rate"].round(3) == expected_utilization).all():
        raise ValueError("Mismatch: utilization_rate bukan 1 - availability_ratio.")
    expected_demand = df["utilization_rate"].map(derive_demand)
    if not (df["demand_level"] == expected_demand).all():
        raise ValueError("Mismatch: demand_level tidak diturunkan dari utilization_rate.")
    forbidden_in_features = {"availability_ratio", "demand_level", "base_price_idr_per_day", "operational_variation_pct"}.intersection(FEATURES)
    if forbidden_in_features:
        raise ValueError(f"Fitur redundant/leakage tidak boleh dipakai model: {sorted(forbidden_in_features)}")


def build_pipeline() -> Pipeline:
    categorical_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ])
    numeric_pipe = Pipeline([("imputer", SimpleImputer(strategy="median"))])
    preprocessor = ColumnTransformer([
        ("categorical", categorical_pipe, CATEGORICAL_FEATURES),
        ("numerical", numeric_pipe, NUMERICAL_FEATURES),
    ])
    model = RandomForestRegressor(random_state=SEED, n_jobs=1)
    return Pipeline([("preprocessor", preprocessor), ("model", model)])


def param_grid(full_grid: bool) -> dict[str, list[Any]]:
    if full_grid:
        return {
            "model__n_estimators": [150, 300, 500],
            "model__max_depth": [None, 15, 25],
            "model__min_samples_split": [2, 5],
            "model__min_samples_leaf": [1, 3],
            "model__max_features": [1.0, "sqrt"],
        }
    # Smoke/development run: satu kandidat agar kontrak data-model dapat diverifikasi cepat.
    # Gunakan --full-grid untuk hasil final Colab.
    return {
        "model__n_estimators": [40],
        "model__max_depth": [15],
        "model__min_samples_split": [2],
        "model__min_samples_leaf": [6],
        "model__max_features": [1.0],
    }


def adjustment_metrics(actual: pd.Series, predicted: np.ndarray) -> dict[str, float]:
    return {
        "mae_decimal": float(mean_absolute_error(actual, predicted)),
        "rmse_decimal": float(np.sqrt(mean_squared_error(actual, predicted))),
        "mae_percentage_points": float(mean_absolute_error(actual, predicted) * 100),
        "rmse_percentage_points": float(np.sqrt(mean_squared_error(actual, predicted)) * 100),
        "r2": float(r2_score(actual, predicted)),
    }


def round_display_price(values: np.ndarray) -> np.ndarray:
    return np.maximum(
        DISPLAY_PRICE_ROUNDING_UNIT,
        np.rint(np.asarray(values) / DISPLAY_PRICE_ROUNDING_UNIT) * DISPLAY_PRICE_ROUNDING_UNIT,
    ).astype(int)


def rupiah_metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float]:
    return {
        "mae_idr": float(mean_absolute_error(actual, predicted)),
        "rmse_idr": float(np.sqrt(mean_squared_error(actual, predicted))),
        "r2": float(r2_score(actual, predicted)),
    }


def feature_importance_table(best_model: Pipeline) -> pd.DataFrame:
    names = best_model.named_steps["preprocessor"].get_feature_names_out()
    importance = best_model.named_steps["model"].feature_importances_
    clean = [name.replace("categorical__", "").replace("numerical__", "") for name in names]
    return pd.DataFrame({"feature": clean, "importance": importance}).sort_values("importance", ascending=False).reset_index(drop=True)


def make_plot(y_true: pd.Series, y_pred: np.ndarray, fi: pd.DataFrame, output: Path, r2: float) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    axes[0].scatter(y_true * 100, y_pred * 100, alpha=0.25, edgecolors="none")
    low = min(float(y_true.min() * 100), float(y_pred.min() * 100))
    high = max(float(y_true.max() * 100), float(y_pred.max() * 100))
    axes[0].plot([low, high], [low, high], "--", linewidth=1)
    axes[0].set_xlabel("Adjustment Aktual (%)")
    axes[0].set_ylabel("Adjustment Prediksi (%)")
    axes[0].set_title(f"Actual vs Predicted Adjustment\nR² = {r2:.4f}")
    top = fi.head(12).sort_values("importance", ascending=True)
    axes[1].barh(top["feature"], top["importance"])
    axes[1].set_xlabel("Importance")
    axes[1].set_title("Feature Importance - Adjustment Model V4")
    plt.tight_layout()
    plt.savefig(output, dpi=180, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(args.input)
    validate_dataset(df)
    X, y, groups = df[FEATURES].copy(), df[TARGET].astype(float).copy(), df[GROUP].copy()

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=SEED)
    train_idx, test_idx = next(splitter.split(X, y, groups=groups))
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    train_groups, test_groups = groups.iloc[train_idx], groups.iloc[test_idx]
    overlap = set(train_groups).intersection(set(test_groups))
    if overlap:
        raise AssertionError(f"Leakage terdeteksi: {len(overlap)} source vehicle overlap.")

    cv_splits = 5 if args.full_grid else 2
    search = GridSearchCV(
        estimator=build_pipeline(), param_grid=param_grid(args.full_grid),
        scoring="neg_mean_absolute_error", cv=GroupKFold(n_splits=cv_splits),
        n_jobs=args.n_jobs, verbose=1, return_train_score=True,
    )
    search.fit(X_train, y_train, groups=train_groups)
    best_model = search.best_estimator_
    y_pred = best_model.predict(X_test)

    baseline = DummyRegressor(strategy="mean")
    baseline.fit(np.zeros((len(y_train), 1)), y_train)
    baseline_pred = baseline.predict(np.zeros((len(y_test), 1)))
    model_metrics = adjustment_metrics(y_test, y_pred)
    baseline_metrics = adjustment_metrics(y_test, baseline_pred)

    test_eval = df.iloc[test_idx][EVALUATION_COLUMNS].copy()
    test_eval["predicted_price_adjustment_pct"] = y_pred
    test_eval["predicted_price_adjustment_percent_display"] = np.round(y_pred * 100, 2)
    predicted_raw = np.rint(test_eval["base_price_idr_per_day"].to_numpy() * (1 + y_pred)).astype(int)
    test_eval["predicted_dynamic_price_raw_per_day"] = predicted_raw
    test_eval["predicted_dynamic_price_display_per_day"] = round_display_price(predicted_raw)
    test_eval["predicted_total_invoice_raw"] = test_eval["predicted_dynamic_price_raw_per_day"] * test_eval["duration_days"]
    test_eval["predicted_total_invoice_display"] = test_eval["predicted_dynamic_price_display_per_day"] * test_eval["duration_days"]
    raw_daily_metrics = rupiah_metrics(test_eval["dynamic_price_raw_per_day"].to_numpy(), test_eval["predicted_dynamic_price_raw_per_day"].to_numpy())
    display_daily_metrics = rupiah_metrics(test_eval["dynamic_price_display_per_day"].to_numpy(), test_eval["predicted_dynamic_price_display_per_day"].to_numpy())

    fi = feature_importance_table(best_model)
    grid_results = pd.DataFrame(search.cv_results_).sort_values("rank_test_score")
    pipeline_path = args.output_dir / "dynamic_pricing_adjustment_rf_pipeline_v4.pkl"
    metadata_path = args.output_dir / "training_metadata_adjustment_v4.json"
    predictions_path = args.output_dir / "test_predictions_adjustment_v4.csv"
    fi_path = args.output_dir / "feature_importance_adjustment_v4.csv"
    grid_path = args.output_dir / "grid_search_results_adjustment_v4.csv"
    plot_path = args.output_dir / "rf_adjustment_evaluation_v4.png"
    joblib.dump(best_model, pipeline_path)
    test_eval.to_csv(predictions_path, index=False)
    fi.to_csv(fi_path, index=False)
    grid_results.to_csv(grid_path, index=False)
    make_plot(y_test, y_pred, fi, plot_path, model_metrics["r2"])

    metadata = {
        "study_case": "Rental Mobil XYZ (objek simulasi)",
        "data_version": "v4_demand_derived_from_utilization_round_display_1000",
        "dataset": args.input.name,
        "target": TARGET,
        "model_features": FEATURES,
        "derived_for_ui_not_model_features": ["availability_ratio", "demand_level"],
        "demand_derivation_rule": {
            "formula": "utilization_rate = 1 - availability_ratio",
            "sepi": "utilization_rate <= 0.30",
            "normal": "0.30 < utilization_rate < 0.70",
            "ramai": "utilization_rate >= 0.70",
        },
        "rows": int(len(df)), "source_vehicles": int(groups.nunique()),
        "train_rows": int(len(train_idx)), "test_rows": int(len(test_idx)),
        "train_source_vehicles": int(train_groups.nunique()), "test_source_vehicles": int(test_groups.nunique()),
        "overlap_source_vehicle_id": int(len(overlap)),
        "grid_mode": "full" if args.full_grid else "development", "cv_splits": int(cv_splits),
        "candidate_count": int(len(grid_results)), "best_params": search.best_params_,
        "best_cv_mae_percentage_points": float(-search.best_score_ * 100),
        "test_adjustment_metrics": model_metrics, "dummy_baseline_metrics": baseline_metrics,
        "raw_dynamic_daily_price_metrics_idr": raw_daily_metrics,
        "display_dynamic_daily_price_metrics_idr": display_daily_metrics,
        "display_price_rounding_unit_idr": DISPLAY_PRICE_ROUNDING_UNIT,
        "integration_contract": "Backend calculates availability_ratio, derives utilization_rate and demand_level; FastAPI model consumes utilization_rate and other booking context; UI displays demand_level as explanation.",
        "methodological_note": "Target adalah label simulasi yang tetap perlu validasi praktisi sebelum diposisikan sebagai rekomendasi kebijakan harga.",
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=" * 86)
    print("TRAINING RANDOM FOREST V4 - DEMAND BERBASIS UTILIZATION")
    print("=" * 86)
    print(f"Dataset / rows                  : {args.input.name} / {len(df):,}")
    print(f"Kendaraan sumber unik           : {groups.nunique():,}")
    print(f"Train/Test rows                 : {len(train_idx):,} / {len(test_idx):,}")
    print(f"Overlap source_vehicle_id       : {len(overlap)} (harus 0)")
    print(f"Fitur model                     : {FEATURES}")
    print("Status UI bukan fitur model     : availability_ratio, demand_level")
    print(f"Grid mode / CV folds            : {'full' if args.full_grid else 'development'} / {cv_splits}")
    print("-" * 86)
    print(f"Parameter terbaik               : {search.best_params_}")
    print(f"MAE CV terbaik                  : {-search.best_score_ * 100:.3f} percentage points")
    print(f"MAE test adjustment             : {model_metrics['mae_percentage_points']:.3f} percentage points")
    print(f"RMSE test adjustment            : {model_metrics['rmse_percentage_points']:.3f} percentage points")
    print(f"R² test adjustment              : {model_metrics['r2']:.4f}")
    print(f"R² dummy baseline               : {baseline_metrics['r2']:.4f}")
    print(f"MAE harga tampilan              : Rp {display_daily_metrics['mae_idr']:,.0f}")
    print("-" * 86)
    print("Lima feature importance teratas:")
    for _, row in fi.head(5).iterrows():
        print(f"  {row['feature']:<34} {row['importance']:.4f}")
    print("-" * 86)
    print(f"Model pipeline                  : {pipeline_path}")
    print(f"Metadata evaluasi               : {metadata_path}")
    print(f"Grafik evaluasi                 : {plot_path}")
    print("=" * 86)


if __name__ == "__main__":
    main()
