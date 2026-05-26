import json
import platform
from datetime import datetime, timezone
from pathlib import Path

import importlib.metadata as metadata

from .constants import INFERENCE_ENVIRONMENT_PATH, MODEL_VERSION
from .model_loader import DynamicPricingV4ModelService


def package_version(package_name: str) -> str:
    return metadata.version(package_name)


def build_inference_environment_report(service: DynamicPricingV4ModelService) -> dict[str, object]:
    service.ensure_loaded()
    if not service.status.ready:
        raise RuntimeError("Cannot generate inference environment report because model is not ready.")

    compatibility_shim_used = any(
        "compatibility shim" in warning or "SimpleImputer._fill_dtype" in warning
        for warning in service.status.warnings
    )
    note = (
        "Generated after successful local load and smoke prediction with temporary compatibility shim; "
        "this is not the final inference environment and not the original Google Colab training environment."
        if compatibility_shim_used
        else "Local inference environment verified by loading and predicting with the final model artifact without compatibility shim. This is not the original Google Colab training environment."
    )

    return {
        "environment_type": "local_inference_environment",
        "model_version": MODEL_VERSION,
        "note": note,
        "python": platform.python_version(),
        "scikit_learn": package_version("scikit-learn"),
        "pandas": package_version("pandas"),
        "numpy": package_version("numpy"),
        "scipy": package_version("scipy"),
        "joblib": package_version("joblib"),
        "fastapi": package_version("fastapi"),
        "pydantic": package_version("pydantic"),
        "compatibility_shim_used": compatibility_shim_used,
        "artifact_load_success": True,
        "smoke_prediction_success": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "artifact_size_bytes": service.status.artifact_size_bytes,
        "model_load_seconds": service.status.load_seconds,
        "smoke_prediction_seconds": service.status.smoke_prediction_seconds,
        "compatibility_warnings": service.status.warnings,
    }


def write_inference_environment_report(
    service: DynamicPricingV4ModelService,
    output_path: Path = INFERENCE_ENVIRONMENT_PATH,
) -> dict[str, object]:
    report = build_inference_environment_report(service)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report
