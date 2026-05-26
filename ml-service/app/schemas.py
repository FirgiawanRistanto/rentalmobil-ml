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

