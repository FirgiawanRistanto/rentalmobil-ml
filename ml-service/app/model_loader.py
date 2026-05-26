import json
import logging
import time
import warnings
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from .constants import (
    DISPLAY_ROUNDING_UNIT_IDR,
    FEATURE_CONTRACT_VERSION,
    METADATA_PATH,
    MODEL_FEATURES,
    MODEL_PATH,
    MODEL_VERSION,
    TARGET_NAME,
)
from .pricing import build_model_input
from .schemas import HealthResponse, PredictPriceRequest

logger = logging.getLogger(__name__)


class ModelNotReadyError(RuntimeError):
    pass


class ModelPredictionError(RuntimeError):
    pass


@dataclass
class ModelLoadStatus:
    ready: bool = False
    safe_error: str | None = "Model artifact is not ready."
    load_seconds: float | None = None
    smoke_prediction_seconds: float | None = None
    artifact_size_bytes: int | None = None
    warnings: list[str] = field(default_factory=list)


class DynamicPricingV4ModelService:
    def __init__(self, model_path: Path = MODEL_PATH, metadata_path: Path = METADATA_PATH):
        self.model_path = model_path
        self.metadata_path = metadata_path
        self.model: Any | None = None
        self.status = ModelLoadStatus()
        self._load_attempted = False

    def ensure_loaded(self) -> None:
        if not self._load_attempted:
            self.load()

    def load(self) -> None:
        self._load_attempted = True
        self.model = None
        self.status = ModelLoadStatus()

        try:
            metadata = self._load_metadata()
            self._validate_metadata(metadata)
            self.status.artifact_size_bytes = self.model_path.stat().st_size

            started_at = time.perf_counter()
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                self.model = joblib.load(self.model_path)

            self.status.load_seconds = time.perf_counter() - started_at
            self.status.warnings.extend(_unique_messages(str(warning.message) for warning in caught))
            self._run_smoke_prediction()
            self.status.ready = True
            self.status.safe_error = None
        except Exception as exc:
            logger.exception("Dynamic Pricing v4 model failed to load.")
            self.model = None
            self.status.ready = False
            self.status.safe_error = "Model artifact is not ready."
            self.status.warnings.append(f"{type(exc).__name__}: {exc}")

    def _load_metadata(self) -> dict[str, Any]:
        if not self.metadata_path.exists():
            raise FileNotFoundError("Metadata file is missing.")
        if not self.model_path.exists():
            raise FileNotFoundError("Model artifact file is missing.")

        return json.loads(self.metadata_path.read_text(encoding="utf-8"))

    def _validate_metadata(self, metadata: dict[str, Any]) -> None:
        if metadata.get("target") != TARGET_NAME:
            raise ValueError("Metadata target does not match Dynamic Pricing v4 contract.")
        if metadata.get("model_features") != MODEL_FEATURES:
            raise ValueError("Metadata feature list/order does not match Dynamic Pricing v4 contract.")
        if metadata.get("display_price_rounding_unit_idr") != DISPLAY_ROUNDING_UNIT_IDR:
            raise ValueError("Metadata display rounding unit does not match service contract.")
        if metadata.get("overlap_source_vehicle_id") != 0:
            raise ValueError("Metadata train/test group overlap must be 0.")

    def _run_smoke_prediction(self) -> None:
        request = PredictPriceRequest(
            vehicle_category="suv",
            trip_type="luar_kota",
            duration_days=3,
            is_weekend=1,
            is_holiday=0,
            is_peak_season=1,
            utilization_rate=0.8,
            booking_lead_days=7,
            base_price_idr_per_day=800000,
        )
        started_at = time.perf_counter()
        prediction = self._predict_raw(request)
        self.status.smoke_prediction_seconds = time.perf_counter() - started_at

        if not np.isfinite(prediction):
            raise ValueError("Smoke prediction returned a non-finite value.")

    def _predict_raw(self, request: PredictPriceRequest) -> float:
        if self.model is None:
            raise ModelNotReadyError("Model artifact is not ready.")

        model_input = build_model_input(request)
        prediction = self.model.predict(model_input)[0]
        prediction_value = float(prediction)
        if not np.isfinite(prediction_value):
            raise ModelPredictionError("Model returned a non-finite prediction.")

        return prediction_value

    def predict_adjustment(self, request: PredictPriceRequest) -> float:
        self.ensure_loaded()
        if not self.status.ready:
            raise ModelNotReadyError("Model artifact is not ready.")

        try:
            return self._predict_raw(request)
        except ModelNotReadyError:
            raise
        except Exception as exc:
            logger.exception("Dynamic Pricing v4 prediction failed.")
            raise ModelPredictionError("Prediction failed.") from exc

    def health(self) -> HealthResponse:
        self.ensure_loaded()
        if self.status.ready:
            return HealthResponse(status="ok", model_ready=True)

        return HealthResponse(status="degraded", model_ready=False, error=self.status.safe_error)


default_model_service = DynamicPricingV4ModelService()


def _unique_messages(messages) -> list[str]:
    seen = set()
    unique = []
    for message in messages:
        if message in seen:
            continue
        seen.add(message)
        unique.append(message)
    return unique
