from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt

from .constants import FEATURE_CONTRACT_VERSION, MODEL_VERSION, TARGET_NAME

VehicleCategory = Literal["passenger_car", "mpv", "suv", "van"]
TripType = Literal["dalam_kota", "luar_kota"]
BinaryFlag = Annotated[StrictInt, Field(ge=0, le=1)]


class PredictPriceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vehicle_category: VehicleCategory
    trip_type: TripType
    duration_days: Annotated[StrictInt, Field(ge=1)]
    is_weekend: BinaryFlag
    is_holiday: BinaryFlag
    is_peak_season: BinaryFlag
    utilization_rate: Annotated[float, Field(ge=0, le=1)]
    booking_lead_days: Annotated[StrictInt, Field(ge=0)]
    base_price_idr_per_day: Annotated[StrictInt, Field(gt=0)]


class PredictPriceResponse(BaseModel):
    model_version: str = MODEL_VERSION
    target_name: str = TARGET_NAME
    feature_contract_version: str = FEATURE_CONTRACT_VERSION
    predicted_price_adjustment_pct: float
    predicted_price_adjustment_percent_display: float
    base_price_idr_per_day: int
    dynamic_price_raw_per_day: int
    dynamic_price_display_per_day: int
    duration_days: int
    total_invoice_display: int


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    model_ready: bool
    model_version: str = MODEL_VERSION
    target_name: str = TARGET_NAME
    feature_contract_version: str = FEATURE_CONTRACT_VERSION
    error: str | None = None


class ModelParameters(BaseModel):
    n_estimators: int
    max_depth: int | None
    max_features: str | int | None
    min_samples_split: int
    min_samples_leaf: int


class ModelMetrics(BaseModel):
    test_mae_percentage_points: float
    test_rmse_percentage_points: float
    test_r2: float


class ModelInfoResponse(BaseModel):
    model_name: str
    model_version: str = MODEL_VERSION
    target_name: str = TARGET_NAME
    feature_contract_version: str = FEATURE_CONTRACT_VERSION
    n_estimators: int
    parameters: ModelParameters
    raw_input_features: list[str]
    preprocessed_features: list[str]
    dataset_rows: int
    train_rows: int
    test_rows: int
    metrics: ModelMetrics


class TreeNode(BaseModel):
    id: int
    depth: int
    is_leaf: bool
    feature_index: int | None = None
    feature: str | None = None
    threshold: float | None = None
    left: int | None = None
    right: int | None = None
    prediction: float | None = None


class TreeStatistics(BaseModel):
    tree_index: int
    max_depth: int
    node_count: int
    leaf_count: int


class TreeStructureResponse(BaseModel):
    tree_index: int
    tree_statistics: TreeStatistics
    nodes: list[TreeNode]
    feature_names: list[str]


# ---------------------------------------------------------------------------
# Continuous learning (retrain + aktivasi versi model)
# ---------------------------------------------------------------------------

VERSION_SLUG_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$"


class LiveTrainingRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quote_id: str = Field(min_length=1, max_length=64)
    vehicle_category: VehicleCategory
    trip_type: TripType
    duration_days: Annotated[StrictInt, Field(ge=1)]
    is_weekend: BinaryFlag
    is_holiday: BinaryFlag
    is_peak_season: BinaryFlag
    utilization_rate: Annotated[float, Field(ge=0, le=1)]
    booking_lead_days: Annotated[StrictInt, Field(ge=0)]
    target_price_adjustment_pct: Annotated[float, Field(ge=-1, le=1)] | None = None


class RetrainGuardrailConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_mae_regression_ratio: Annotated[float, Field(gt=0, le=1)] = 0.10
    min_r2_drop: Annotated[float, Field(ge=0, le=1)] = 0.02


class RetrainRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: str = Field(min_length=3, max_length=80, pattern=VERSION_SLUG_PATTERN)
    live_rows: list[LiveTrainingRow] = Field(default_factory=list, max_length=5000)
    live_weight: Annotated[float, Field(gt=0, le=50)] = 5.0
    guardrail: RetrainGuardrailConfig = Field(default_factory=RetrainGuardrailConfig)


class RetrainMetrics(BaseModel):
    mae_percentage_points: float
    rmse_percentage_points: float
    r2: float


class RetrainGuardrailResult(BaseModel):
    passed: bool
    max_mae_regression_ratio: float
    min_r2_drop: float
    reasons: list[str]


class RetrainResponse(BaseModel):
    status: Literal["completed", "guardrail_failed"]
    version: str
    artifact_path: str | None
    duration_seconds: float
    live_rows_received: int
    live_rows_used: int
    live_rows_skipped_invalid: int
    live_rows_labeled_rule: int
    live_rows_labeled_manual: int
    base_rows: int
    train_rows: int
    test_rows: int
    live_holdout_rows: int
    baseline_metrics: RetrainMetrics
    metrics: RetrainMetrics
    live_metrics: RetrainMetrics | None
    guardrail: RetrainGuardrailResult


class ActivateModelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: str = Field(min_length=3, max_length=80, pattern=VERSION_SLUG_PATTERN)


class ActivateModelResponse(BaseModel):
    status: Literal["activated"] = "activated"
    model_version: str
    artifact_path: str


