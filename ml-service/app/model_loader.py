import json
import logging
import shutil
import time
import warnings
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from .constants import (
    ARTIFACT_FILE_NAME,
    CURRENT_POINTER_PATH,
    DISPLAY_ROUNDING_UNIT_IDR,
    FEATURE_CONTRACT_VERSION,
    METADATA_FILE_NAME,
    METADATA_PATH,
    MODEL_FEATURES,
    MODEL_PATH,
    MODEL_VERSION,
    TARGET_NAME,
    VERSIONS_DIR,
    VERSIONS_TO_KEEP,
    is_valid_version_slug,
)
from .pricing import build_model_input
from .schemas import (
    HealthResponse,
    ModelInfoResponse,
    ModelMetrics,
    ModelParameters,
    PredictPriceRequest,
    TreeNode,
    TreeStatistics,
    TreeStructureResponse,
)

logger = logging.getLogger(__name__)


class ModelNotReadyError(RuntimeError):
    pass


class ModelPredictionError(RuntimeError):
    pass


class ModelActivationError(RuntimeError):
    pass


class ModelVersionNotFoundError(ModelActivationError):
    pass


def resolve_active_artifact() -> tuple[str, Path, Path]:
    """Baca pointer ``artifacts/current.json``; fallback ke artefak baseline.

    Dengan pointer ini, restart ml-service tetap memuat versi model yang terakhir
    diaktifkan admin (bukan kembali ke baseline).
    """
    try:
        if CURRENT_POINTER_PATH.exists():
            payload = json.loads(CURRENT_POINTER_PATH.read_text(encoding="utf-8"))
            version = str(payload.get("version", ""))
            if is_valid_version_slug(version):
                if version == MODEL_VERSION:
                    return MODEL_VERSION, MODEL_PATH, METADATA_PATH
                model_path = VERSIONS_DIR / version / ARTIFACT_FILE_NAME
                metadata_path = VERSIONS_DIR / version / METADATA_FILE_NAME
                if model_path.exists() and metadata_path.exists():
                    return version, model_path, metadata_path
    except Exception:
        logger.warning(
            "Pointer versi model aktif tidak terbaca; memakai artefak baseline.",
            exc_info=True,
        )

    return MODEL_VERSION, MODEL_PATH, METADATA_PATH


def _write_current_pointer(version: str) -> None:
    payload = {
        "version": version,
        "activated_at": datetime.now(timezone.utc).isoformat(),
    }
    CURRENT_POINTER_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = CURRENT_POINTER_PATH.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(CURRENT_POINTER_PATH)


def prune_version_artifacts(active_version: str, keep: int = VERSIONS_TO_KEEP) -> list[str]:
    """Sisakan maksimal ``keep`` direktori versi terbaru di ``artifacts/versions/``.

    Setiap versi ±340MB; tanpa pruning, retrain berkala lama-lama memenuhi disk.
    Dipanggil setelah aktivasi sukses. Direktori yang bukan slug versi valid
    diabaikan, dan versi yang sedang aktif tidak pernah dihapus — termasuk
    bila ia berada di luar N terbaru.
    """
    keep = max(1, keep)
    if not VERSIONS_DIR.exists():
        return []

    candidates: list[tuple[float, str, Path]] = []
    for entry in VERSIONS_DIR.iterdir():
        if not entry.is_dir() or not is_valid_version_slug(entry.name):
            continue
        try:
            candidates.append((entry.stat().st_mtime, entry.name, entry))
        except OSError:
            continue

    # Terbaru di depan; nama unik dalam satu direktori membuat sort stabil.
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    kept = {name for _, name, _ in candidates[:keep]}

    if (
        active_version not in kept
        and len(candidates) > keep
        and any(name == active_version for _, name, _ in candidates)
    ):
        # Versi aktif di luar N terbaru: buang yang paling lama dari kept
        # agar total tetap `keep` dan artefak aktif selamat.
        kept.discard(candidates[keep - 1][1])
        kept.add(active_version)

    removed: list[str] = []
    for _, name, path in candidates:
        if name in kept:
            continue
        try:
            shutil.rmtree(path)
        except OSError:
            logger.warning("Gagal menghapus artefak versi lama %s.", name, exc_info=True)
        else:
            removed.append(name)

    return removed


@dataclass
class ModelLoadStatus:
    ready: bool = False
    safe_error: str | None = "Model artifact is not ready."
    load_seconds: float | None = None
    smoke_prediction_seconds: float | None = None
    artifact_size_bytes: int | None = None
    warnings: list[str] = field(default_factory=list)


class DynamicPricingV4ModelService:
    def __init__(self, model_path: Path | None = None, metadata_path: Path | None = None):
        # Path eksplisit (uji/kerja manual) -> selalu artefak baseline.
        # Tanpa argumen -> ikut pointer versi aktif.
        if model_path is None and metadata_path is None:
            version, resolved_model, resolved_metadata = resolve_active_artifact()
            self.version = version
            self.model_path = resolved_model
            self.metadata_path = resolved_metadata
        else:
            self.version = MODEL_VERSION
            self.model_path = model_path or MODEL_PATH
            self.metadata_path = metadata_path or METADATA_PATH
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
            self.status.smoke_prediction_seconds = self._run_smoke_prediction(self.model)
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

    def _run_smoke_prediction(self, model: Any) -> float:
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
        model_input = build_model_input(request)
        started_at = time.perf_counter()
        prediction = float(model.predict(model_input)[0])
        elapsed = time.perf_counter() - started_at

        if not np.isfinite(prediction):
            raise ValueError("Smoke prediction returned a non-finite value.")

        return elapsed

    def activate(self, version: str) -> dict[str, Any]:
        """Muat artefak versi tertentu lalu jadikan model aktif (swap atomik).

        Semua validasi (metadata kontrak + smoke prediction) dijalankan pada
        objek kandidat SEBELUM atribut diganti, sehingga kegagalan apa pun
        membuat model aktif lama tetap utuh dan pointer tidak ditulis.
        """
        if not is_valid_version_slug(version):
            raise ModelActivationError(f"Nama versi model tidak valid: {version}.")

        if version == MODEL_VERSION:
            # Rollback ke baseline: artefak produksi ada di artifacts/v4_final/.
            model_path = MODEL_PATH
            metadata_path = METADATA_PATH
        else:
            model_path = VERSIONS_DIR / version / ARTIFACT_FILE_NAME
            metadata_path = VERSIONS_DIR / version / METADATA_FILE_NAME
        if not model_path.exists() or not metadata_path.exists():
            raise ModelVersionNotFoundError(
                f"Artefak model versi {version} tidak ditemukan di {model_path.parent}/."
            )

        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            self._validate_metadata(metadata)
            started_at = time.perf_counter()
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                candidate_model = joblib.load(model_path)
            load_seconds = time.perf_counter() - started_at
            smoke_seconds = self._run_smoke_prediction(candidate_model)
            model_warnings = _unique_messages(str(warning.message) for warning in caught)
        except ModelActivationError:
            raise
        except Exception as exc:
            logger.exception("Aktivasi model %s gagal; model aktif tidak diubah.", version)
            raise ModelActivationError(
                "Artefak model baru gagal dimuat atau lolos smoke test; model aktif tidak diubah."
            ) from exc

        _write_current_pointer(version)

        self.model = candidate_model
        self.model_path = model_path
        self.metadata_path = metadata_path
        self.version = version
        self.status = ModelLoadStatus(
            ready=True,
            safe_error=None,
            load_seconds=load_seconds,
            smoke_prediction_seconds=smoke_seconds,
            artifact_size_bytes=model_path.stat().st_size,
            warnings=model_warnings,
        )

        logger.info("Model aktif diganti ke versi %s.", version)

        # Auto-prune best-effort: kegagalan cleanup tidak membatalkan aktivasi
        # yang sudah sukses.
        try:
            pruned = prune_version_artifacts(version)
            if pruned:
                logger.info(
                    "Artefak versi lama dihapus (%d tersisa): %s.",
                    VERSIONS_TO_KEEP,
                    ", ".join(pruned),
                )
        except Exception:
            logger.warning("Prune artefak versi gagal; aktivasi tetap sukses.", exc_info=True)

        return {
            "model_version": version,
            "artifact_path": str(model_path),
        }

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
            return HealthResponse(
                status="ok",
                model_ready=True,
                model_version=self.version,
                target_name=TARGET_NAME,
                feature_contract_version=FEATURE_CONTRACT_VERSION,
            )

        return HealthResponse(status="degraded", model_ready=False, error=self.status.safe_error)

    def _get_preprocessor(self) -> Any:
        if self.model is None:
            raise ModelNotReadyError("Model artifact is not ready.")
        return self.model.named_steps["preprocessor"]

    def _get_rf_model(self) -> Any:
        if self.model is None:
            raise ModelNotReadyError("Model artifact is not ready.")
        return self.model.named_steps["model"]

    def get_preprocessed_feature_names(self) -> list[str]:
        self.ensure_loaded()
        if not self.status.ready:
            raise ModelNotReadyError("Model artifact is not ready.")
        preprocessor = self._get_preprocessor()
        return list(preprocessor.get_feature_names_out())

    def get_model_info(self) -> ModelInfoResponse:
        self.ensure_loaded()
        if not self.status.ready:
            raise ModelNotReadyError("Model artifact is not ready.")

        metadata = self._load_metadata()
        rf = self._get_rf_model()
        best_params = metadata["best_params"]
        test_metrics = metadata["test_adjustment_metrics"]
        preprocessed_features = self.get_preprocessed_feature_names()

        return ModelInfoResponse(
            model_name="Random Forest Regressor",
            model_version=self.version,
            n_estimators=rf.n_estimators,
            parameters=ModelParameters(
                n_estimators=best_params["model__n_estimators"],
                max_depth=best_params["model__max_depth"],
                max_features=best_params["model__max_features"],
                min_samples_split=best_params["model__min_samples_split"],
                min_samples_leaf=best_params["model__min_samples_leaf"],
            ),
            raw_input_features=list(MODEL_FEATURES),
            preprocessed_features=preprocessed_features,
            dataset_rows=int(metadata["rows"]),
            train_rows=int(metadata["train_rows"]),
            test_rows=int(metadata["test_rows"]),
            metrics=ModelMetrics(
                test_mae_percentage_points=float(test_metrics["mae_percentage_points"]),
                test_rmse_percentage_points=float(test_metrics["rmse_percentage_points"]),
                test_r2=float(test_metrics["r2"]),
            ),
        )

    def _compute_node_depths(self, children_left: np.ndarray, children_right: np.ndarray) -> np.ndarray:
        node_count = len(children_left)
        depths = np.zeros(node_count, dtype=np.int64)
        if node_count == 0:
            return depths
        stack = [(0, 0)]
        while stack:
            node_id, depth = stack.pop()
            depths[node_id] = depth
            left = children_left[node_id]
            right = children_right[node_id]
            if left >= 0:
                stack.append((left, depth + 1))
            if right >= 0:
                stack.append((right, depth + 1))
        return depths

    def get_tree_structure(self, tree_index: int) -> TreeStructureResponse:
        self.ensure_loaded()
        if not self.status.ready:
            raise ModelNotReadyError("Model artifact is not ready.")

        rf = self._get_rf_model()
        n_estimators = len(rf.estimators_)
        if tree_index < 0 or tree_index >= n_estimators:
            raise IndexError(
                f"Tree index {tree_index} out of range. Valid range is [0, {n_estimators - 1}]."
            )

        estimator = rf.estimators_[tree_index]
        sk_tree = estimator.tree_
        feature_names = self.get_preprocessed_feature_names()

        children_left = sk_tree.children_left
        children_right = sk_tree.children_right
        feature_idx = sk_tree.feature
        threshold = sk_tree.threshold
        values = sk_tree.value
        node_count = int(sk_tree.node_count)

        depths = self._compute_node_depths(children_left, children_right)

        nodes: list[TreeNode] = []
        leaf_count = 0
        for i in range(node_count):
            is_leaf = bool(children_left[i] == -1 and children_right[i] == -1)
            if is_leaf:
                leaf_count += 1
                prediction = float(np.asarray(values[i][0]).ravel()[0])
                nodes.append(
                    TreeNode(
                        id=i,
                        depth=int(depths[i]),
                        is_leaf=True,
                        prediction=prediction,
                        left=None,
                        right=None,
                    )
                )
            else:
                fidx = int(feature_idx[i])
                nodes.append(
                    TreeNode(
                        id=i,
                        depth=int(depths[i]),
                        is_leaf=False,
                        feature_index=fidx,
                        feature=feature_names[fidx] if 0 <= fidx < len(feature_names) else None,
                        threshold=float(threshold[i]),
                        left=int(children_left[i]) if children_left[i] >= 0 else None,
                        right=int(children_right[i]) if children_right[i] >= 0 else None,
                    )
                )

        statistics = TreeStatistics(
            tree_index=tree_index,
            max_depth=int(estimator.get_depth()),
            node_count=node_count,
            leaf_count=leaf_count,
        )

        return TreeStructureResponse(
            tree_index=tree_index,
            tree_statistics=statistics,
            nodes=nodes,
            feature_names=feature_names,
        )


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
