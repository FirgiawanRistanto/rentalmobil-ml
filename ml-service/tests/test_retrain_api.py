"""Uji endpoint continuous learning: retrain + aktivasi versi model.

Fixture menyiapkan dataset mini (120 baris / 12 kendaraan), metadata baseline,
dan artefak baseline kecil di tmp_path, lalu mengarahkan konstanta
``app.retrain`` / ``app.model_loader`` ke lokasi itu (jamur monkeypatch) supaya
uji cepat dan tidak menyentuh artefak produksi 340MB.
"""

import json
import os
from pathlib import Path
from types import SimpleNamespace

import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import model_loader, retrain
from app import labeler
from app.constants import (
    ARTIFACT_FILE_NAME,
    METADATA_FILE_NAME,
    MODEL_FEATURES,
    MODEL_VERSION,
    TARGET_NAME,
)
from app.model_loader import DynamicPricingV4ModelService, resolve_active_artifact
from main import create_app

BEST_PARAMS = {
    "model__n_estimators": 7,
    "model__max_depth": 5,
    "model__max_features": 1.0,
    "model__min_samples_split": 2,
    "model__min_samples_leaf": 1,
}
LIVE_VERSION = "rf_adjustment_v4_live_20261004120000"

# Baseline sengaja "jelek" sehingga guardrail selalu lolos pada uji positif.
PERMISSIVE_BASELINE_METRICS = {
    "mae_decimal": 5.0,
    "rmse_decimal": 6.0,
    "mae_percentage_points": 500.0,
    "rmse_percentage_points": 600.0,
    "r2": -100.0,
}

# Baseline "sempurna" sehingga hasil retrain apa pun pasti gagal guardrail.
IMPOSSIBLE_BASELINE_METRICS = {
    "mae_decimal": 0.0,
    "rmse_decimal": 0.0,
    "mae_percentage_points": 0.0,
    "rmse_percentage_points": 0.0,
    "r2": 1.0,
}


def build_dataset() -> pd.DataFrame:
    rng = np.random.default_rng(7)
    categories = ["mpv", "suv", "van", "passenger_car"]
    rows = []
    for vehicle in range(12):
        for _ in range(10):
            features = {
                "vehicle_category": categories[int(rng.integers(0, len(categories)))],
                "trip_type": "luar_kota" if rng.random() < 0.5 else "dalam_kota",
                "duration_days": int(rng.choice([1, 3, 5, 7, 14])),
                "is_weekend": int(rng.random() < 0.4),
                "is_holiday": int(rng.random() < 0.2),
                "is_peak_season": int(rng.random() < 0.3),
                "utilization_rate": round(float(rng.uniform(0.05, 0.95)), 3),
                "booking_lead_days": int(rng.choice([1, 3, 7, 21, 30])),
            }
            target = labeler.label_adjustment(features) + float(rng.normal(0, 0.01))
            rows.append(
                {
                    **features,
                    TARGET_NAME: round(target, 6),
                    "source_vehicle_id": f"veh-{vehicle}",
                    "base_price_idr_per_day": 500000,
                }
            )
    return pd.DataFrame(rows)


def baseline_metadata(metrics: dict | None = None) -> dict:
    return {
        "version": MODEL_VERSION,
        "target": TARGET_NAME,
        "model_features": list(MODEL_FEATURES),
        "display_price_rounding_unit_idr": 1000,
        "overlap_source_vehicle_id": 0,
        "best_params": dict(BEST_PARAMS),
        "rows": 120,
        "train_rows": 90,
        "test_rows": 30,
        "test_adjustment_metrics": dict(metrics or PERMISSIVE_BASELINE_METRICS),
    }


def live_row(**overrides) -> dict:
    row = {
        "quote_id": "11111111-2222-3333-4444-555555555555",
        "vehicle_category": "suv",
        "trip_type": "luar_kota",
        "duration_days": 3,
        "is_weekend": 1,
        "is_holiday": 0,
        "is_peak_season": 1,
        "utilization_rate": 0.8,
        "booking_lead_days": 7,
    }
    row.update(overrides)
    return row


def make_service(env) -> DynamicPricingV4ModelService:
    return DynamicPricingV4ModelService(
        model_path=env.baseline_model,
        metadata_path=env.metadata_path,
    )


@pytest.fixture()
def env(tmp_path, monkeypatch) -> SimpleNamespace:
    dataset_path = tmp_path / "dataset.csv"
    build_dataset().to_csv(dataset_path, index=False)

    metadata_path = tmp_path / "metadata.json"
    metadata_path.write_text(json.dumps(baseline_metadata()), encoding="utf-8")

    frame = pd.read_csv(dataset_path)
    pipeline = retrain.build_pipeline(BEST_PARAMS)
    pipeline.fit(frame[list(MODEL_FEATURES)], frame[TARGET_NAME].astype(float))
    baseline_model = tmp_path / "baseline.pkl"
    joblib.dump(pipeline, baseline_model)

    versions_dir = tmp_path / "versions"
    pointer_path = tmp_path / "current.json"

    monkeypatch.setattr(retrain, "BASE_DATASET_PATH", dataset_path)
    monkeypatch.setattr(retrain, "METADATA_PATH", metadata_path)
    monkeypatch.setattr(retrain, "VERSIONS_DIR", versions_dir)
    monkeypatch.setattr(model_loader, "VERSIONS_DIR", versions_dir)
    monkeypatch.setattr(model_loader, "CURRENT_POINTER_PATH", pointer_path)
    # Baseline versi uji: file tmp, bukan artefak produksi 340MB.
    monkeypatch.setattr(model_loader, "MODEL_PATH", baseline_model)
    monkeypatch.setattr(model_loader, "METADATA_PATH", metadata_path)

    return SimpleNamespace(
        tmp_path=tmp_path,
        dataset_path=dataset_path,
        metadata_path=metadata_path,
        baseline_model=baseline_model,
        versions_dir=versions_dir,
        pointer_path=pointer_path,
    )


def run_local_retrain(env, version: str = LIVE_VERSION, live_rows=None) -> dict:
    return retrain.run_retrain(
        version=version,
        live_rows=[live_row()] if live_rows is None else live_rows,
        live_weight=5.0,
        guardrail={"max_mae_regression_ratio": 0.10, "min_r2_drop": 0.02},
    )


def test_retrain_completes_and_writes_version_artifact(env):
    with TestClient(create_app(make_service(env))) as client:
        response = client.post(
            "/v1/model/retrain",
            json={
                "version": LIVE_VERSION,
                "live_rows": [live_row()],
                "live_weight": 5.0,
            },
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "completed"
    assert body["guardrail"]["passed"] is True
    assert body["version"] == LIVE_VERSION
    assert body["live_rows_received"] == 1
    assert body["live_rows_used"] == 1
    assert body["live_rows_labeled_rule"] == 1
    assert body["live_rows_labeled_manual"] == 0
    assert body["baseline_metrics"]["mae_percentage_points"] == 500.0

    artifact_path = Path(body["artifact_path"])
    assert artifact_path.exists()
    assert artifact_path == env.versions_dir / LIVE_VERSION / ARTIFACT_FILE_NAME
    assert (env.versions_dir / LIVE_VERSION / METADATA_FILE_NAME).exists()
    # Aktivasi belum dilakukan: pointer versi aktif tidak boleh berubah.
    assert not env.pointer_path.exists()


def test_retrain_counts_manual_labels_and_skips_invalid_rows(env):
    with TestClient(create_app(make_service(env))) as client:
        response = client.post(
            "/v1/model/retrain",
            json={
                "version": LIVE_VERSION,
                "live_rows": [
                    live_row(target_price_adjustment_pct=0.12),
                    live_row(quote_id="22222222-2222-3333-4444-555555555555"),
                ],
            },
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["live_rows_received"] == 2
    assert body["live_rows_used"] == 2
    assert body["live_rows_labeled_manual"] == 1
    assert body["live_rows_labeled_rule"] == 1
    assert body["live_rows_skipped_invalid"] == 0


def test_retrain_deduplicates_identical_live_rows(env):
    with TestClient(create_app(make_service(env))) as client:
        response = client.post(
            "/v1/model/retrain",
            json={
                "version": LIVE_VERSION,
                "live_rows": [live_row(), live_row()],
            },
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["live_rows_received"] == 2
    assert body["live_rows_used"] == 1


def test_retrain_guardrail_failure_writes_no_artifact(env):
    env.metadata_path.write_text(
        json.dumps(baseline_metadata(IMPOSSIBLE_BASELINE_METRICS)),
        encoding="utf-8",
    )

    with TestClient(create_app(make_service(env))) as client:
        response = client.post(
            "/v1/model/retrain",
            json={"version": LIVE_VERSION, "live_rows": [live_row()]},
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "guardrail_failed"
    assert body["guardrail"]["passed"] is False
    assert body["guardrail"]["reasons"]
    assert body["artifact_path"] is None
    assert not (env.versions_dir / LIVE_VERSION).exists()


def test_retrain_rejects_invalid_version_slug(env):
    with TestClient(create_app(make_service(env))) as client:
        response = client.post(
            "/v1/model/retrain",
            json={"version": "../escape", "live_rows": [live_row()]},
        )

    assert response.status_code == 422


def test_retrain_missing_dataset_returns_conflict(env, monkeypatch):
    monkeypatch.setattr(retrain, "BASE_DATASET_PATH", env.tmp_path / "missing.csv")

    with TestClient(create_app(make_service(env))) as client:
        response = client.post(
            "/v1/model/retrain",
            json={"version": LIVE_VERSION, "live_rows": [live_row()]},
        )

    assert response.status_code == 409
    assert "Dataset dasar" in response.json()["detail"]


def test_activate_swaps_model_and_persists_pointer(env):
    report = run_local_retrain(env)
    assert report["status"] == "completed"

    service = make_service(env)
    with TestClient(create_app(service)) as client:
        before = client.get("/health").json()
        response = client.post("/v1/model/activate", json={"version": LIVE_VERSION})
        after = client.get("/health").json()

    assert response.status_code == 200, response.text
    assert response.json() == {
        "status": "activated",
        "model_version": LIVE_VERSION,
        "artifact_path": str(env.versions_dir / LIVE_VERSION / ARTIFACT_FILE_NAME),
    }
    assert before["model_version"] == MODEL_VERSION
    assert after["model_version"] == LIVE_VERSION
    assert json.loads(env.pointer_path.read_text(encoding="utf-8"))["version"] == LIVE_VERSION
    assert service.model_path == env.versions_dir / LIVE_VERSION / ARTIFACT_FILE_NAME


def test_startup_resolves_artifact_from_pointer(env):
    run_local_retrain(env)
    with TestClient(create_app(make_service(env))) as client:
        client.post("/v1/model/activate", json={"version": LIVE_VERSION})

    version, model_path, metadata_path = resolve_active_artifact()
    assert version == LIVE_VERSION
    assert model_path == env.versions_dir / LIVE_VERSION / ARTIFACT_FILE_NAME
    assert metadata_path == env.versions_dir / LIVE_VERSION / METADATA_FILE_NAME

    # Service tanpa argumen (dipakai uvicorn) ikut pointer itu.
    fresh_service = DynamicPricingV4ModelService()
    assert fresh_service.version == LIVE_VERSION
    assert fresh_service.model_path == model_path


def test_prediction_reports_activated_model_version(env):
    run_local_retrain(env)
    service = make_service(env)

    with TestClient(create_app(service)) as client:
        client.post("/v1/model/activate", json={"version": LIVE_VERSION})
        response = client.post(
            "/v1/predict-price",
            json={
                "vehicle_category": "suv",
                "trip_type": "luar_kota",
                "duration_days": 3,
                "is_weekend": 1,
                "is_holiday": 0,
                "is_peak_season": 1,
                "utilization_rate": 0.8,
                "booking_lead_days": 7,
                "base_price_idr_per_day": 800000,
            },
        )

    assert response.status_code == 200, response.text
    assert response.json()["model_version"] == LIVE_VERSION


def test_activate_baseline_rolls_back_to_production_artifact(env):
    run_local_retrain(env)
    service = make_service(env)

    with TestClient(create_app(service)) as client:
        client.post("/v1/model/activate", json={"version": LIVE_VERSION})
        response = client.post("/v1/model/activate", json={"version": MODEL_VERSION})
        health = client.get("/health").json()

    assert response.status_code == 200, response.text
    assert response.json()["model_version"] == MODEL_VERSION
    assert health["model_version"] == MODEL_VERSION
    assert service.model_path == env.baseline_model
    assert json.loads(env.pointer_path.read_text(encoding="utf-8"))["version"] == MODEL_VERSION


def test_activate_missing_version_returns_404_and_keeps_current_model(env):
    with TestClient(create_app(make_service(env))) as client:
        response = client.post("/v1/model/activate", json={"version": "rf_adjustment_v4_live_missing"})
        health = client.get("/health").json()

    assert response.status_code == 404
    assert health["model_version"] == MODEL_VERSION
    assert not env.pointer_path.exists()


def test_activate_invalid_artifact_keeps_current_model(env):
    version_dir = env.versions_dir / LIVE_VERSION
    version_dir.mkdir(parents=True)
    broken_metadata = baseline_metadata()
    broken_metadata["target"] = "not_the_contract_target"
    (version_dir / METADATA_FILE_NAME).write_text(json.dumps(broken_metadata), encoding="utf-8")
    (version_dir / ARTIFACT_FILE_NAME).write_bytes(b"not-a-real-pickle")

    with TestClient(create_app(make_service(env))) as client:
        response = client.post("/v1/model/activate", json={"version": LIVE_VERSION})
        health = client.get("/health").json()

    assert response.status_code == 400
    assert health["model_version"] == MODEL_VERSION
    assert not env.pointer_path.exists()


def _train_versions(env, count: int) -> list[str]:
    """Buat `count` direktori versi hasil retrain dengan mtime berurutan."""
    versions = []
    for index in range(count):
        version = f"rf_adjustment_v4_live_2026010{index + 1}00000{index + 1}"
        report = run_local_retrain(env, version=version)
        assert report["status"] == "completed"
        directory = env.versions_dir / version
        assert directory.is_dir()
        stamp = 1_700_000_000 + index * 86_400
        os.utime(directory, (stamp, stamp))
        versions.append(version)
    return versions


def test_activate_prunes_oldest_versions_after_success(env):
    versions = _train_versions(env, 4)
    # Aktifkan versi TERBARU: 3 terbaru dipertahankan, yang paling tua dihapus.
    with TestClient(create_app(make_service(env))) as client:
        response = client.post("/v1/model/activate", json={"version": versions[3]})

    assert response.status_code == 200, response.text
    remaining = sorted(entry.name for entry in env.versions_dir.iterdir() if entry.is_dir())
    assert remaining == sorted(versions[1:])
    assert (env.versions_dir / versions[3] / ARTIFACT_FILE_NAME).exists()
    assert not (env.versions_dir / versions[0]).exists()
    assert json.loads(env.pointer_path.read_text(encoding="utf-8"))["version"] == versions[3]


def test_activate_never_prunes_the_active_version(env):
    versions = _train_versions(env, 4)
    # Aktifkan versi PALING TUA: wajib selamat walau di luar 3 terbaru.
    with TestClient(create_app(make_service(env))) as client:
        response = client.post("/v1/model/activate", json={"version": versions[0]})

    assert response.status_code == 200, response.text
    remaining = sorted(entry.name for entry in env.versions_dir.iterdir() if entry.is_dir())
    assert len(remaining) <= 3
    assert versions[0] in remaining
    assert (env.versions_dir / versions[0] / ARTIFACT_FILE_NAME).exists()


def test_prune_ignores_non_version_directories(env):
    versions = _train_versions(env, 4)
    # Direktori yang bukan slug versi valid tidak boleh disentuh prune.
    outsider = env.versions_dir / "bukan versi!"
    outsider.mkdir(parents=True, exist_ok=True)
    (outsider / "junk.txt").write_text("keep me", encoding="utf-8")

    with TestClient(create_app(make_service(env))) as client:
        response = client.post("/v1/model/activate", json={"version": versions[3]})

    assert response.status_code == 200, response.text
    assert outsider.exists()
    assert (outsider / "junk.txt").read_text(encoding="utf-8") == "keep me"
