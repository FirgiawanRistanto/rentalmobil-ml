import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.constants import (
    DISPLAY_ROUNDING_UNIT_IDR,
    FEATURE_CONTRACT_VERSION,
    MODEL_FEATURES,
    MODEL_VERSION,
    TARGET_NAME,
)
from app.model_loader import DynamicPricingV4ModelService, ModelLoadStatus, ModelNotReadyError
from app.pricing import build_model_input, build_price_response, round_price_for_display
from app.schemas import HealthResponse, PredictPriceRequest
from main import create_app


VALID_PAYLOAD = {
    "vehicle_category": "suv",
    "trip_type": "luar_kota",
    "duration_days": 3,
    "is_weekend": 1,
    "is_holiday": 0,
    "is_peak_season": 1,
    "utilization_rate": 0.8,
    "booking_lead_days": 7,
    "base_price_idr_per_day": 800000,
}


class StubModelService:
    def __init__(self, adjustment=0.2185, ready=True):
        self.adjustment = adjustment
        self.ready = ready
        self.received_request = None
        self.status = ModelLoadStatus(ready=ready, safe_error=None if ready else "Model artifact is not ready.")

    def ensure_loaded(self):
        return None

    def health(self):
        if self.ready:
            return HealthResponse(status="ok", model_ready=True)
        return HealthResponse(status="degraded", model_ready=False, error="Model artifact is not ready.")

    def predict_adjustment(self, request):
        if not self.ready:
            raise ModelNotReadyError("Model artifact is not ready.")
        self.received_request = request
        return self.adjustment


@pytest.fixture(scope="session")
def real_model_service():
    service = DynamicPricingV4ModelService()
    service.ensure_loaded()
    return service


@pytest.fixture()
def stub_client():
    service = StubModelService()
    with TestClient(create_app(service)) as client:
        yield client, service


def test_health_reports_model_ready_with_real_artifact(real_model_service):
    assert real_model_service.status.ready is True
    with TestClient(create_app(real_model_service)) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "model_ready": True,
        "model_version": "rf_adjustment_v4_final",
        "target_name": "price_adjustment_pct",
        "feature_contract_version": "v4",
        "error": None,
    }


def test_metadata_contract_is_validated(real_model_service):
    assert real_model_service.status.ready is True
    assert real_model_service.status.artifact_size_bytes and real_model_service.status.artifact_size_bytes > 300_000_000


def test_invalid_metadata_degrades_and_rejects_inference(tmp_path):
    metadata_path = tmp_path / "training_metadata_adjustment_v4.json"
    model_path = tmp_path / "model.pkl"
    metadata_path.write_text(
        json.dumps(
            {
                "target": "estimated_price",
                "model_features": MODEL_FEATURES,
                "display_price_rounding_unit_idr": DISPLAY_ROUNDING_UNIT_IDR,
                "overlap_source_vehicle_id": 0,
            }
        ),
        encoding="utf-8",
    )
    model_path.write_bytes(b"not-used")
    service = DynamicPricingV4ModelService(model_path=model_path, metadata_path=metadata_path)

    with TestClient(create_app(service)) as client:
        health_response = client.get("/health")
        predict_response = client.post("/v1/predict-price", json=VALID_PAYLOAD)

    assert health_response.status_code == 200
    assert health_response.json()["status"] == "degraded"
    assert health_response.json()["model_ready"] is False
    assert predict_response.status_code == 503
    assert predict_response.json()["detail"] == "Model artifact is not ready."


def test_missing_artifact_degrades_and_rejects_inference(tmp_path):
    metadata_path = tmp_path / "training_metadata_adjustment_v4.json"
    metadata_path.write_text(
        json.dumps(
            {
                "target": TARGET_NAME,
                "model_features": MODEL_FEATURES,
                "display_price_rounding_unit_idr": DISPLAY_ROUNDING_UNIT_IDR,
                "overlap_source_vehicle_id": 0,
            }
        ),
        encoding="utf-8",
    )
    service = DynamicPricingV4ModelService(model_path=tmp_path / "missing.pkl", metadata_path=metadata_path)

    with TestClient(create_app(service)) as client:
        health_response = client.get("/health")
        predict_response = client.post("/v1/predict-price", json=VALID_PAYLOAD)

    assert health_response.json()["status"] == "degraded"
    assert predict_response.status_code == 503


def test_predict_price_v4_valid_request_returns_complete_schema(stub_client):
    client, service = stub_client
    response = client.post("/v1/predict-price", json=VALID_PAYLOAD)

    assert response.status_code == 200
    assert response.json() == {
        "model_version": MODEL_VERSION,
        "target_name": TARGET_NAME,
        "feature_contract_version": FEATURE_CONTRACT_VERSION,
        "predicted_price_adjustment_pct": 0.2185,
        "predicted_price_adjustment_percent_display": 21.85,
        "base_price_idr_per_day": 800000,
        "dynamic_price_raw_per_day": 974800,
        "dynamic_price_display_per_day": 975000,
        "duration_days": 3,
        "total_invoice_display": 2925000,
    }
    assert service.received_request.base_price_idr_per_day == 800000


def test_predict_price_v4_response_contract_fields_use_constants(stub_client):
    client, _ = stub_client
    response = client.post("/v1/predict-price", json=VALID_PAYLOAD)
    body = response.json()

    assert body["model_version"] == MODEL_VERSION
    assert body["target_name"] == TARGET_NAME
    assert body["feature_contract_version"] == FEATURE_CONTRACT_VERSION


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("vehicle_category", "truck"),
        ("trip_type", "DALAM_KOTA"),
        ("utilization_rate", -0.01),
        ("utilization_rate", 1.01),
        ("duration_days", 0),
        ("booking_lead_days", -1),
        ("base_price_idr_per_day", 0),
        ("is_weekend", 2),
        ("is_holiday", -1),
        ("is_peak_season", True),
    ],
)
def test_request_validation_rejects_invalid_payloads(stub_client, field, value):
    client, _ = stub_client
    payload = {**VALID_PAYLOAD, field: value}
    response = client.post("/v1/predict-price", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize("extra_field", ["availability_ratio", "demand_level"])
def test_context_only_fields_are_rejected(stub_client, extra_field):
    client, _ = stub_client
    response = client.post("/v1/predict-price", json={**VALID_PAYLOAD, extra_field: "normal"})

    assert response.status_code == 422


def test_model_input_contains_only_eight_v4_features():
    request = PredictPriceRequest(**VALID_PAYLOAD)
    model_input = build_model_input(request)

    assert list(model_input.columns) == MODEL_FEATURES
    assert "base_price_idr_per_day" not in model_input.columns
    assert "availability_ratio" not in model_input.columns
    assert "demand_level" not in model_input.columns


def test_model_loader_does_not_use_sklearn_compatibility_shim():
    loader_source = Path("app/model_loader.py").read_text(encoding="utf-8")

    assert "sklearn_compat" not in loader_source
    assert "_RemainderColsList" not in loader_source
    assert "_fill_dtype" not in loader_source
    assert not Path("app/sklearn_compat.py").exists()


def test_price_post_processing_and_half_up_rounding():
    request = PredictPriceRequest(**VALID_PAYLOAD)
    response = build_price_response(request, 0.2185)

    assert response.dynamic_price_raw_per_day == 974800
    assert response.dynamic_price_display_per_day == 975000
    assert response.total_invoice_display == 2925000
    assert round_price_for_display(365396) == 365000
    assert round_price_for_display(365500) == 366000
    assert round_price_for_display(365600) == 366000


def test_real_artifact_smoke_prediction_returns_finite_adjustment(real_model_service):
    request = PredictPriceRequest(**VALID_PAYLOAD)
    prediction = real_model_service.predict_adjustment(request)

    assert isinstance(prediction, float)
    assert prediction == pytest.approx(prediction)


def test_legacy_endpoint_is_gone(stub_client):
    client, _ = stub_client
    response = client.post("/predict_price", json={})

    assert response.status_code == 410
    assert response.json()["detail"] == "Legacy pricing endpoint is deprecated. Migrate client to POST /v1/predict-price."
