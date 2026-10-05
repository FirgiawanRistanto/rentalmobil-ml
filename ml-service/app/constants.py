import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
ARTIFACT_FILE_NAME = "dynamic_pricing_adjustment_rf_pipeline_v4.pkl"
METADATA_FILE_NAME = "training_metadata_adjustment_v4.json"
ARTIFACT_DIR = BASE_DIR / "artifacts" / "v4_final"
MODEL_PATH = ARTIFACT_DIR / ARTIFACT_FILE_NAME
METADATA_PATH = ARTIFACT_DIR / METADATA_FILE_NAME
INFERENCE_ENVIRONMENT_PATH = ARTIFACT_DIR / "inference_environment_local_v4.json"

# Continuous learning: artefak per versi + pointer versi yang sedang aktif.
VERSIONS_DIR = BASE_DIR / "artifacts" / "versions"
CURRENT_POINTER_PATH = BASE_DIR / "artifacts" / "current.json"
BASE_DATASET_PATH = BASE_DIR / "datasets" / "car_rental_xyz_dynamic_pricing_v4.csv"

# Slug versi aman terhadap path traversal (tanpa slash/backslash).
VERSION_SLUG_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$"
VERSION_SLUG_RE = re.compile(VERSION_SLUG_PATTERN)

# Kebijakan retrain continuous learning (bisa di-override per request).
LIVE_ROW_DEFAULT_WEIGHT = 5.0
DEFAULT_MAX_MAE_REGRESSION_RATIO = 0.10
DEFAULT_MIN_R2_DROP = 0.02
LIVE_HOLDOUT_MIN_ROWS = 20

# Auto-prune: sisakan maksimal N direktori versi di artifacts/versions/
# (~340MB per versi) setelah aktivasi model sukses.
VERSIONS_TO_KEEP = 3


def is_valid_version_slug(version: str) -> bool:
    return bool(VERSION_SLUG_RE.match(version))


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

