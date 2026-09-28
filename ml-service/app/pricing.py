from decimal import Decimal, ROUND_HALF_UP

import pandas as pd

from .constants import DISPLAY_ROUNDING_UNIT_IDR, MODEL_FEATURES
from .schemas import PredictPriceRequest, PredictPriceResponse


def build_model_input(request: PredictPriceRequest) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "vehicle_category": request.vehicle_category,
                "trip_type": request.trip_type,
                "duration_days": request.duration_days,
                "is_weekend": request.is_weekend,
                "is_holiday": request.is_holiday,
                "is_peak_season": request.is_peak_season,
                "utilization_rate": request.utilization_rate,
                "booking_lead_days": request.booking_lead_days,
            }
        ],
        columns=MODEL_FEATURES,
    )


def round_idr_half_up(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def round_price_for_display(raw_price_idr: int, unit_idr: int = DISPLAY_ROUNDING_UNIT_IDR) -> int:
    rounded_units = (Decimal(raw_price_idr) / Decimal(unit_idr)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(rounded_units * Decimal(unit_idr))


def build_price_response(request: PredictPriceRequest, predicted_adjustment: float) -> PredictPriceResponse:
    adjustment = Decimal(str(predicted_adjustment))
    base_price = Decimal(request.base_price_idr_per_day)
    dynamic_price_raw_per_day = round_idr_half_up(base_price * (Decimal("1") + adjustment))
    dynamic_price_display_per_day = round_price_for_display(dynamic_price_raw_per_day)
    total_invoice_display = dynamic_price_display_per_day * request.duration_days
    percent_display = (adjustment * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return PredictPriceResponse(
        predicted_price_adjustment_pct=float(adjustment),
        predicted_price_adjustment_percent_display=float(percent_display),
        base_price_idr_per_day=request.base_price_idr_per_day,
        dynamic_price_raw_per_day=dynamic_price_raw_per_day,
        dynamic_price_display_per_day=dynamic_price_display_per_day,
        duration_days=request.duration_days,
        total_invoice_display=total_invoice_display,
    )

