"""Demo kontras reproducibility Random Forest untuk sidang.

Menjawab argumen "RF itu random, kalau di-train ulang pasti beda hasil":
- Dengan random_state dikunci (mis. 42) -> MAE/R2 identik di setiap run.
- Tanpa random_state (None, default sklearn) -> tiap run beda, karena
  bootstrap sampling & pemilihan fitur di-seed dari entropi sistem.

Split di demo ini per-baris (bukan group-by kendaraan seperti generator
resmi) karena fokusnya membuktikan perilaku seed, bukan metodologi split.

Jalankan dari ml-service:
    ./.venv-v4/Scripts/python.exe scripts/_demo_seed_contrast.py
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

DATASET_PATH = Path("datasets/car_rental_xyz_dynamic_pricing_v4.csv")
METADATA_PATH = Path("artifacts/v4_final/training_metadata_adjustment_v4.json")


def main() -> None:
    metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    features = list(metadata["model_features"])
    target = str(metadata["target"])
    df = pd.read_csv(DATASET_PATH)

    for label, seed in (("seed=42 (run 1)", 42), ("seed=42 (run 2)", 42), ("seed=None (run 1)", None), ("seed=None (run 2)", None)):
        start = time.perf_counter()
        if seed is None:
            train_df, test_df = train_test_split(df, test_size=0.2, shuffle=True)
        else:
            train_df, test_df = train_test_split(
                df, test_size=0.2, random_state=seed, shuffle=True
            )
        params: dict = {
            "n_estimators": 200,
            "max_depth": 15,
            "max_features": "sqrt",
            "min_samples_split": 5,
            "min_samples_leaf": 1,
            "n_jobs": -1,
        }
        if seed is not None:
            params["random_state"] = seed
        categorical = [c for c in ("vehicle_category", "trip_type") if c in features]
        numeric = [c for c in features if c not in categorical]
        preprocessor = ColumnTransformer(
            transformers=[
                ("categorical", OneHotEncoder(handle_unknown="ignore"), categorical),
                ("numeric", "passthrough", numeric),
            ]
        )
        model = Pipeline(
            steps=[("preprocess", preprocessor), ("model", RandomForestRegressor(**params))]
        )
        model.fit(train_df[features], train_df[target].astype(float))
        predictions = model.predict(test_df[features])
        y_true = test_df[target].astype(float)
        mae = mean_absolute_error(y_true, predictions)
        r2 = r2_score(y_true, predictions)
        elapsed = time.perf_counter() - start
        print(
            f"{label:18s} MAE={mae:.6f}  R2={r2:.6f}  ({elapsed:.1f}s, "
            f"train={len(train_df)}, test={len(test_df)})"
        )


if __name__ == "__main__":
    main()
