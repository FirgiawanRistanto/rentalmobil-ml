from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, HTTPException, Path, status

import app._init_patches  # noqa: F401  - apply sklearn pickle support before model imports
from app.constants import FEATURE_CONTRACT_VERSION, MODEL_VERSION, TARGET_NAME
from app.model_loader import (
    DynamicPricingV4ModelService,
    ModelActivationError,
    ModelNotReadyError,
    ModelPredictionError,
    ModelVersionNotFoundError,
    default_model_service,
)
from app.pricing import build_price_response
from app.retrain import DatasetMissingError, RetrainError, run_retrain
from app.schemas import (
    ActivateModelRequest,
    ActivateModelResponse,
    HealthResponse,
    ModelInfoResponse,
    PredictPriceRequest,
    PredictPriceResponse,
    RetrainRequest,
    RetrainResponse,
    TreeStructureResponse,
)

logger = logging.getLogger(__name__)


def create_app(model_service: DynamicPricingV4ModelService = default_model_service) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        model_service.ensure_loaded()
        yield

    app = FastAPI(title="Rental Mobil XYZ ML Service", version=FEATURE_CONTRACT_VERSION, lifespan=lifespan)

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return model_service.health()

    @app.post("/v1/predict-price", response_model=PredictPriceResponse)
    def predict_price_v4(request: PredictPriceRequest) -> PredictPriceResponse:
        try:
            predicted_adjustment = model_service.predict_adjustment(request)
            return build_price_response(request, predicted_adjustment, model_service.version)
        except ModelNotReadyError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Model artifact is not ready.",
            ) from exc
        except ModelPredictionError as exc:
            logger.exception("Dynamic Pricing v4 runtime prediction failure.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Prediction failed.",
            ) from exc

    @app.get("/v1/model/info", response_model=ModelInfoResponse)
    def get_model_info() -> ModelInfoResponse:
        try:
            return model_service.get_model_info()
        except ModelNotReadyError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Model artifact is not ready.",
            ) from exc

    @app.get("/v1/model/tree/{tree_index}", response_model=TreeStructureResponse)
    def get_model_tree(
        tree_index: int = Path(..., ge=0, description="Zero-based estimator index inside the Random Forest."),
    ) -> TreeStructureResponse:
        try:
            return model_service.get_tree_structure(tree_index)
        except ModelNotReadyError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Model artifact is not ready.",
            ) from exc
        except IndexError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    @app.post("/v1/model/retrain", response_model=RetrainResponse)
    def retrain_v4(request: RetrainRequest) -> RetrainResponse:
        """Retrain offline dari dataset dasar + baris live (guarded, staging)."""
        try:
            report = run_retrain(
                version=request.version,
                live_rows=[row.model_dump() for row in request.live_rows],
                live_weight=request.live_weight,
                guardrail=request.guardrail.model_dump(),
            )
        except DatasetMissingError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except RetrainError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        except Exception as exc:
            logger.exception("Dynamic Pricing v4 retrain failure.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Retrain failed.",
            ) from exc

        logger.info(
            "Retrain %s selesai (%s, %s baris live, %.1fdetik).",
            report["version"],
            report["status"],
            report["live_rows_used"],
            report["duration_seconds"],
        )
        return RetrainResponse(**report)

    @app.post("/v1/model/activate", response_model=ActivateModelResponse)
    def activate_model_v4(request: ActivateModelRequest) -> ActivateModelResponse:
        """Jadikan artefak versi tertentu sebagai model aktif (swap atomik)."""
        try:
            result = model_service.activate(request.version)
        except ModelVersionNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except ModelActivationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        except Exception as exc:
            logger.exception("Dynamic Pricing v4 model activation failure.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Model activation failed.",
            ) from exc

        return ActivateModelResponse(
            model_version=str(result["model_version"]),
            artifact_path=str(result["artifact_path"]),
        )

    @app.post("/predict_price")
    def predict_price_legacy_deprecated():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Legacy pricing endpoint is deprecated. Migrate client to POST /v1/predict-price.",
        )

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
