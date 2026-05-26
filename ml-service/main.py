from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, HTTPException, status

from app.constants import FEATURE_CONTRACT_VERSION, MODEL_VERSION, TARGET_NAME
from app.model_loader import (
    DynamicPricingV4ModelService,
    ModelNotReadyError,
    ModelPredictionError,
    default_model_service,
)
from app.pricing import build_price_response
from app.schemas import HealthResponse, PredictPriceRequest, PredictPriceResponse

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
            return build_price_response(request, predicted_adjustment)
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
