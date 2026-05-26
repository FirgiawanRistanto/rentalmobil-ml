from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = BASE_DIR / "artifacts" / "v4_final"
MODEL_PATH = ARTIFACT_DIR / "dynamic_pricing_adjustment_rf_pipeline_v4.pkl"
METADATA_PATH = ARTIFACT_DIR / "training_metadata_adjustment_v4.json"
INFERENCE_ENVIRONMENT_PATH = ARTIFACT_DIR / "inference_environment_local_v4.json"

MODEL_VERSION = "rf_adjustment_v4_final"
TARGET_NAME = "price_adjustment_pct"
FEATURE_CONTRACT_VERSION = "v4"
DISPLAY_ROUNDING_UNIT_IDR = 1000

MODEL_FEATURES = [
    "vehicle_category",
    "trip_type",
    "duration_days",
    "is_weekend",
    "is_holiday",
    "is_peak_season",
    "utilization_rate",
    "booking_lead_days",
]

MODEL_VEHICLE_CATEGORIES = ("passenger_car", "mpv", "suv", "van")
MODEL_TRIP_TYPES = ("dalam_kota", "luar_kota")

