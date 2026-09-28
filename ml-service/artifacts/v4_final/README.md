# Random Forest Dynamic Pricing Model v4 Final

## Model

- Model version: `rf_adjustment_v4_final`
- Target: `price_adjustment_pct`
- Feature contract version: `v4`
- Display rounding: Rp1.000

## Input Features

FastAPI must send exactly these eight features to the pipeline, in this order:

1. `vehicle_category`
2. `trip_type`
3. `duration_days`
4. `is_weekend`
5. `is_holiday`
6. `is_peak_season`
7. `utilization_rate`
8. `booking_lead_days`

`base_price_idr_per_day` is used only for post-processing and must not be included as a model feature.

## Final Evaluation

- MAE adjustment: 2.104 percentage points
- RMSE adjustment: 2.598 percentage points
- R2 adjustment: 0.9764
- MAE harga tampilan: Rp12.262/hari
- Display rounding: Rp1.000

## Study Scope

Rental Mobil XYZ is a simulation object for an academic information-system implementation. The dataset and labels are simulation-based adaptations from secondary data, so this model is not a claim of optimal real-world market pricing.

## Local Artifact Placement

Place the final local artifact here before running the service:

```text
ml-service/artifacts/v4_final/dynamic_pricing_adjustment_rf_pipeline_v4.pkl
ml-service/artifacts/v4_final/training_metadata_adjustment_v4.json
```

The `.pkl` file is about 340 MB and must not be committed through regular Git. The metadata JSON, this README, and `inference_environment_local_v4.json` may be tracked.

`inference_environment_local_v4.json` documents the local inference environment that successfully loaded and predicted with the artifact. It is not the original Google Colab training environment.
