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
