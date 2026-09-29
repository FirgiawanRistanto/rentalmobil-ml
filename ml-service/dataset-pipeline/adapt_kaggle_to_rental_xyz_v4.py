"""Bangun dataset simulasi dynamic-pricing v4 untuk Rental Mobil XYZ.

Perubahan utama v4:
- availability_ratio dibangkitkan sebagai kondisi ketersediaan unit pada periode sewa.
- utilization_rate selalu dihitung dari availability_ratio: utilization_rate = 1 - availability_ratio.
- demand_level diturunkan otomatis dari utilization_rate menggunakan ambang yang sama
  dengan rancangan backend website, bukan ditentukan lebih dahulu.
- Target ML tetap price_adjustment_pct.
- Harga raw dipertahankan sampai rupiah; harga customer dibulatkan ke Rp1.000.
- Komponen pembentuk label dan variasi operasional disimpan untuk audit saja dan
  dilarang menjadi fitur model.

Input  : CarRentalData.csv (dataset sekunder Kaggle)
Output : car_rental_xyz_dynamic_pricing_v4.csv
         car_rental_xyz_vehicle_audit_v4.csv
         car_rental_xyz_label_metadata_v4.json
         praktisi_validation_cases_v4.csv
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

SEED = 42
DISPLAY_PRICE_ROUNDING_UNIT = 1_000
TRANSACTIONS_PER_VEHICLE = 12  # 4 konteks per tingkat utilisasi: rendah, sedang, tinggi

EXCLUDED_LUXURY_OR_EXOTIC_MAKES = {
    "audi", "aston martin", "bentley", "bmw", "ferrari", "jaguar",
    "lamborghini", "land rover", "lexus", "lotus", "maserati", "mclaren",
    "mercedes benz", "porsche", "rolls royce",
}
EXCLUDED_ELECTRIC_MAKES = {"tesla"}
EXCLUDED_NON_PASSENGER_MAKES = {"polaris"}
CATEGORY_MAP = {"car": "passenger_car", "suv": "suv", "minivan": "mpv", "van": "van"}
INDONESIA_BASE_PRICE_RANGES = {
    "passenger_car": (300_000, 800_000),
    "suv": (400_000, 900_000),
    "mpv": (300_000, 750_000),
    "van": (500_000, 1_050_000),
}
DURATION_CHOICES = np.array([1, 2, 3, 5, 7, 10, 14])
DURATION_WEIGHTS = np.array([0.13, 0.17, 0.20, 0.16, 0.15, 0.11, 0.08])
REQUIRED_SOURCE_COLUMNS = {
    "fuelType", "rating", "renterTripsTaken", "reviewCount", "location.country",
    "rate.daily", "vehicle.make", "vehicle.model", "vehicle.type", "vehicle.year",
}
# Ambang ini harus identik dengan backend website.
DEMAND_THRESHOLDS = {
    "sepi_max_utilization": 0.30,
    "ramai_min_utilization": 0.70,
}
# Membuat coverage merata untuk tiap status pasar, tanpa menentukan demand_level sebagai input awal.
UTILIZATION_CONTEXT_BANDS = [
    ("low_utilization", 0.05, 0.30, 4),
    ("medium_utilization", 0.31, 0.69, 4),
    ("high_utilization", 0.70, 0.95, 4),
]


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Adaptasi Kaggle menjadi dataset dynamic pricing simulasi v4.")
    parser.add_argument("--input", type=Path, default=root.parent / "CarRentalData.csv")
    parser.add_argument("--output-dir", type=Path, default=root)
    return parser.parse_args()


def normalize_make(value: Any) -> str:
    text = str(value).strip().lower().replace("-", " ")
    return " ".join(text.split())


def round_display_price(value: float) -> int:
    return int(max(DISPLAY_PRICE_ROUNDING_UNIT, round(value / DISPLAY_PRICE_ROUNDING_UNIT) * DISPLAY_PRICE_ROUNDING_UNIT))


def validate_source(df: pd.DataFrame) -> None:
    missing = sorted(REQUIRED_SOURCE_COLUMNS.difference(df.columns))
    if missing:
        raise ValueError(f"Kolom sumber yang dibutuhkan tidak tersedia: {missing}")
    if df.empty:
        raise ValueError("Dataset sumber kosong.")


def scope_decision(make: str, vehicle_type: str) -> tuple[str, str]:
    if make in EXCLUDED_ELECTRIC_MAKES:
        return "electric_luxury", "excluded_electric_brand"
    if make in EXCLUDED_LUXURY_OR_EXOTIC_MAKES:
        return "luxury", "excluded_luxury_or_exotic_brand"
    if make in EXCLUDED_NON_PASSENGER_MAKES:
        return "non_passenger", "excluded_non_passenger_vehicle"
    if vehicle_type == "truck":
        return "commercial", "excluded_truck_category"
    if vehicle_type not in CATEGORY_MAP:
        return "unmapped", "excluded_unmapped_vehicle_type"
    return "general", ""


def map_relative_price_to_idr(group: pd.DataFrame) -> pd.Series:
    low, high = INDONESIA_BASE_PRICE_RANGES[group.name]
    percentile = group["original_rate_usd_per_day"].rank(method="average", pct=True)
    mapped = low + percentile * (high - low)
    return mapped.map(round_display_price)


def prepare_catalog(raw: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    validate_source(raw)
    catalog = raw.copy().reset_index(drop=False).rename(columns={"index": "source_row_index"})
    catalog["source_vehicle_id"] = catalog["source_row_index"].map(lambda i: f"KG-{i:06d}")
    catalog["vehicle_make_original"] = catalog["vehicle.make"].astype(str).str.strip()
    catalog["vehicle_model_original"] = catalog["vehicle.model"].astype(str).str.strip()
    catalog["vehicle_make_normalized"] = catalog["vehicle_make_original"].map(normalize_make)
    catalog["vehicle_type_original"] = catalog["vehicle.type"].astype(str).str.strip().str.lower()
    catalog["vehicle_year"] = pd.to_numeric(catalog["vehicle.year"], errors="coerce")
    catalog["original_rate_usd_per_day"] = pd.to_numeric(catalog["rate.daily"], errors="coerce")
    catalog["rating_original"] = pd.to_numeric(catalog["rating"], errors="coerce")
    catalog["renter_trips_taken"] = pd.to_numeric(catalog["renterTripsTaken"], errors="coerce").fillna(0).astype(int)
    catalog["review_count"] = pd.to_numeric(catalog["reviewCount"], errors="coerce").fillna(0).astype(int)
    catalog["fuel_type"] = catalog["fuelType"].fillna("unknown").astype(str).str.strip().str.lower()
    catalog["location_country_original"] = catalog["location.country"].astype(str).str.strip()

    scope = catalog.apply(
        lambda row: scope_decision(row["vehicle_make_normalized"], row["vehicle_type_original"]),
        axis=1,
        result_type="expand",
    )
    scope.columns = ["vehicle_segment", "exclusion_reason"]
    catalog = pd.concat([catalog, scope], axis=1)
    invalid = catalog["vehicle_year"].isna() | catalog["original_rate_usd_per_day"].isna()
    catalog.loc[invalid & catalog["exclusion_reason"].eq(""), "exclusion_reason"] = "excluded_missing_year_or_rate"

    excluded = catalog[catalog["exclusion_reason"] != ""].copy()
    included = catalog[catalog["exclusion_reason"] == ""].copy()
    included["vehicle_category"] = included["vehicle_type_original"].map(CATEGORY_MAP)
    included["rating_was_missing"] = included["rating_original"].isna().astype(int)
    category_median = included.groupby("vehicle_category")["rating_original"].transform("median")
    included["rating"] = included["rating_original"].fillna(category_median).fillna(included["rating_original"].median())
    included["base_price_idr_per_day"] = (
        included.groupby("vehicle_category", group_keys=False).apply(map_relative_price_to_idr, include_groups=False)
    )
    included["study_case"] = "Rental Mobil XYZ"
    included["market_context"] = "Indonesia_simulation"

    audit_cols = [
        "source_vehicle_id", "source_row_index", "vehicle_make_original", "vehicle_model_original",
        "vehicle_type_original", "vehicle_segment", "exclusion_reason", "vehicle_year",
        "original_rate_usd_per_day", "location_country_original",
    ]
    data_cols = [
        "source_vehicle_id", "vehicle_make_original", "vehicle_model_original", "vehicle_type_original",
        "vehicle_category", "vehicle_segment", "vehicle_year", "fuel_type", "rating", "rating_was_missing",
        "renter_trips_taken", "review_count", "original_rate_usd_per_day", "base_price_idr_per_day",
        "location_country_original", "study_case", "market_context",
    ]
    audit = pd.concat([included[audit_cols], excluded[audit_cols]], ignore_index=True)
    return included[data_cols].copy(), audit


def demand_level_from_utilization(utilization_rate: float) -> str:
    if utilization_rate <= DEMAND_THRESHOLDS["sepi_max_utilization"]:
        return "sepi"
    if utilization_rate >= DEMAND_THRESHOLDS["ramai_min_utilization"]:
        return "ramai"
    return "normal"


def sample_booking_context(utilization_band: tuple[str, float, float, int], rng: np.random.Generator) -> dict[str, Any]:
    band_name, low, high, _ = utilization_band
    utilization = round(float(rng.uniform(low, high)), 3)
    availability = round(1.0 - utilization, 3)
    demand = demand_level_from_utilization(utilization)
    # Periode ramai cenderung berkorelasi dengan waktu ramai, tetapi demand tetap hasil derivasi utilisasi.
    calendar_prob = {
        "sepi": {"weekend": 0.20, "holiday": 0.03, "peak": 0.10, "outside": 0.28},
        "normal": {"weekend": 0.36, "holiday": 0.08, "peak": 0.25, "outside": 0.36},
        "ramai": {"weekend": 0.62, "holiday": 0.17, "peak": 0.55, "outside": 0.44},
    }[demand]
    duration = int(rng.choice(DURATION_CHOICES, p=DURATION_WEIGHTS))
    lead_days = int(rng.choice([1, 2, 3, 5, 7, 14, 21, 30, 45], p=[.06, .07, .08, .10, .14, .19, .15, .13, .08]))
    return {
        "utilization_sampling_band": band_name,
        "availability_ratio": availability,
        "utilization_rate": utilization,
        "demand_level": demand,
        "duration_days": duration,
        "trip_type": "luar_kota" if rng.random() < calendar_prob["outside"] else "dalam_kota",
        "is_weekend": int(rng.random() < calendar_prob["weekend"]),
        "is_holiday": int(rng.random() < calendar_prob["holiday"]),
        "is_peak_season": int(rng.random() < calendar_prob["peak"]),
        "booking_lead_days": lead_days,
    }


def utilization_effect(rate: float) -> float:
    """Efek kontinu okupansi armada: utilisasi rendah menekan harga, utilisasi tinggi menaikkan harga."""
    return float(np.interp(rate, [0.05, 0.20, 0.30, 0.50, 0.70, 0.85, 0.95], [-0.12, -0.09, -0.055, 0.0, 0.075, 0.15, 0.20]))


def build_adjustment(row: dict[str, Any], rng: np.random.Generator) -> tuple[float, dict[str, float]]:
    duration = int(row["duration_days"])
    utilization = float(row["utilization_rate"])
    duration_value = -0.12 if duration >= 14 else (-0.085 if duration >= 7 else (-0.035 if duration >= 3 else 0.0))
    lead_value = 0.045 if row["booking_lead_days"] <= 2 else (0.020 if row["booking_lead_days"] <= 7 else (-0.025 if row["booking_lead_days"] >= 30 else 0.0))
    component = {
        "component_utilization_pct": utilization_effect(utilization),
        "component_weekend_pct": 0.045 if row["is_weekend"] else 0.0,
        "component_holiday_pct": 0.095 if row["is_holiday"] else 0.0,
        "component_peak_pct": 0.065 if row["is_peak_season"] else 0.0,
        "component_trip_pct": 0.115 if row["trip_type"] == "luar_kota" else 0.0,
        "component_duration_pct": duration_value,
        "component_lead_pct": lead_value,
    }
    interaction = 0.0
    if utilization >= 0.70 and row["trip_type"] == "luar_kota":
        interaction += 0.025
    if utilization >= 0.70 and row["is_holiday"]:
        interaction += 0.030
    if utilization <= 0.30 and duration >= 7:
        interaction -= 0.025
    if row["is_holiday"] and row["is_peak_season"]:
        interaction += 0.025
    if row["vehicle_category"] == "van" and row["trip_type"] == "luar_kota":
        interaction += 0.020
    component["component_interaction_pct"] = interaction
    # Faktor laten tidak tersedia di website/model; hanya audit simulasi.
    operational_variation = float(np.clip(rng.normal(0.0, 0.025), -0.05, 0.05))
    component["operational_variation_pct"] = operational_variation
    adjustment = float(np.clip(sum(component.values()), -0.32, 0.52))
    return adjustment, component


def pricing_reason(row: dict[str, Any]) -> str:
    reasons = [f"utilisasi armada {row['utilization_rate'] * 100:.1f}% ({row['demand_level']})"]
    if row["trip_type"] == "luar_kota":
        reasons.append("perjalanan luar kota")
    if row["duration_days"] >= 7:
        reasons.append("diskon durasi panjang")
    if row["is_holiday"]:
        reasons.append("hari libur")
    elif row["is_weekend"]:
        reasons.append("akhir pekan")
    if row["is_peak_season"]:
        reasons.append("peak season")
    return "; ".join(reasons)


def build_transactions(catalog: pd.DataFrame) -> pd.DataFrame:
    rng = np.random.default_rng(SEED)
    rows: list[dict[str, Any]] = []
    for vehicle in catalog.to_dict(orient="records"):
        case_no = 0
        for band in UTILIZATION_CONTEXT_BANDS:
            for _ in range(band[3]):
                case_no += 1
                context = sample_booking_context(band, rng)
                row = {**vehicle, **context}
                adjustment, components = build_adjustment(row, rng)
                raw_daily = int(round(row["base_price_idr_per_day"] * (1.0 + adjustment)))
                display_daily = round_display_price(raw_daily)
                row.update(components)
                row.update({
                    "simulation_case_id": f"{row['source_vehicle_id']}-C{case_no:02d}",
                    "price_adjustment_pct": round(adjustment, 6),
                    "price_adjustment_percent_display": round(adjustment * 100, 2),
                    "dynamic_price_raw_per_day": raw_daily,
                    "dynamic_price_display_per_day": display_daily,
                    "total_invoice_raw": raw_daily * row["duration_days"],
                    "total_invoice_display": display_daily * row["duration_days"],
                    "pricing_reason": pricing_reason(row),
                })
                rows.append(row)
    transactions = pd.DataFrame(rows)
    expected_utilization = (1 - transactions["availability_ratio"]).round(3)
    if not (transactions["utilization_rate"].round(3) == expected_utilization).all():
        raise AssertionError("utilization_rate tidak konsisten dengan availability_ratio.")
    expected_demand = transactions["utilization_rate"].map(demand_level_from_utilization)
    if not (transactions["demand_level"] == expected_demand).all():
        raise AssertionError("demand_level tidak konsisten dengan utilization_rate.")
    return transactions


def format_rupiah(value: float) -> str:
    return "Rp " + f"{int(value):,}".replace(",", ".")


def create_validation_cases(transactions: pd.DataFrame, output: Path) -> pd.DataFrame:
    samples: list[pd.Series] = []
    for category in sorted(transactions["vehicle_category"].unique()):
        subset = transactions[transactions["vehicle_category"] == category]
        for demand in ["sepi", "normal", "ramai"]:
            demand_subset = subset[subset["demand_level"] == demand]
            quantiles = [0.2, 0.5, 0.8]
            for q in quantiles:
                idx = int(round((len(demand_subset) - 1) * q))
                samples.append(demand_subset.sort_values("price_adjustment_pct").iloc[idx])
    cases = pd.DataFrame(samples).reset_index(drop=True)
    visible = pd.DataFrame({
        "ID Kasus": [f"VAL-{i+1:03d}" for i in range(len(cases))],
        "Kategori Kendaraan": cases["vehicle_category"],
        "Kondisi Permintaan": cases["demand_level"],
        "Ketersediaan Kendaraan": cases["availability_ratio"].map(lambda x: f"{x*100:.1f}%".replace(".", ",")),
        "Utilisasi Armada": cases["utilization_rate"].map(lambda x: f"{x*100:.1f}%".replace(".", ",")),
        "Jenis Perjalanan": cases["trip_type"],
        "Durasi Hari": cases["duration_days"],
        "Weekend": cases["is_weekend"].map({0: "Tidak", 1: "Ya"}),
        "Hari Libur": cases["is_holiday"].map({0: "Tidak", 1: "Ya"}),
        "Peak Season": cases["is_peak_season"].map({0: "Tidak", 1: "Ya"}),
        "Harga Dasar / Hari": cases["base_price_idr_per_day"].map(format_rupiah),
        "Adjustment Simulasi": cases["price_adjustment_pct"].map(lambda x: f"{x*100:+.2f}%".replace(".", ",")),
        "Harga Rekomendasi / Hari": cases["dynamic_price_display_per_day"].map(format_rupiah),
        "Penilaian Praktisi (Sesuai/Terlalu Rendah/Terlalu Tinggi)": "",
        "Koreksi Harga Praktisi / Hari": "",
        "Catatan Praktisi": "",
    })
    visible.to_csv(output, sep=";", index=False, encoding="utf-8-sig")
    return visible


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    raw = pd.read_csv(args.input)
    catalog, audit = prepare_catalog(raw)
    transactions = build_transactions(catalog)

    dataset_path = args.output_dir / "car_rental_xyz_dynamic_pricing_v4.csv"
    audit_path = args.output_dir / "car_rental_xyz_vehicle_audit_v4.csv"
    metadata_path = args.output_dir / "car_rental_xyz_label_metadata_v4.json"
    validation_path = args.output_dir / "praktisi_validation_cases_v4.csv"
    transactions.to_csv(dataset_path, index=False)
    audit.to_csv(audit_path, index=False)
    validation_cases = create_validation_cases(transactions, validation_path)

    metadata = {
        "study_case": "Rental Mobil XYZ (objek simulasi)",
        "data_version": "v4_demand_derived_from_utilization_round_display_1000",
        "source_rows": int(len(raw)),
        "included_vehicle_listings": int(catalog["source_vehicle_id"].nunique()),
        "excluded_vehicle_listings": int((audit["exclusion_reason"] != "").sum()),
        "transactions_per_vehicle": TRANSACTIONS_PER_VEHICLE,
        "expanded_transaction_rows": int(len(transactions)),
        "target_for_model": "price_adjustment_pct",
        "demand_derivation_rule": {
            "formula": "utilization_rate = 1 - availability_ratio",
            "sepi": "utilization_rate <= 0.30",
            "normal": "0.30 < utilization_rate < 0.70",
            "ramai": "utilization_rate >= 0.70",
            "implementation_note": "Aturan ini wajib digunakan backend website ketika customer mengecek harga.",
        },
        "feature_contract_recommendation": "Gunakan utilization_rate sebagai fitur numerik model; demand_level dipertahankan untuk status bisnis/UI dan audit, tidak wajib menjadi fitur RF karena merupakan turunan deterministik utilization_rate.",
        "post_prediction_formula": "dynamic_price_raw_per_day = round_to_1_idr(base_price_idr_per_day * (1 + predicted_price_adjustment_pct))",
        "display_rounding_policy": "Harga invoice ditampilkan dalam pembulatan Rp1.000 terdekat; harga raw dipertahankan untuk evaluasi.",
        "display_price_rounding_unit_idr": DISPLAY_PRICE_ROUNDING_UNIT,
        "demand_counts": transactions["demand_level"].value_counts().sort_index().to_dict(),
        "target_summary_pct": {
            "min": round(float(transactions["price_adjustment_pct"].min() * 100), 2),
            "median": round(float(transactions["price_adjustment_pct"].median() * 100), 2),
            "max": round(float(transactions["price_adjustment_pct"].max() * 100), 2),
            "mean": round(float(transactions["price_adjustment_pct"].mean() * 100), 2),
        },
        "label_components_for_audit_only": [c for c in transactions.columns if c.startswith("component_")] + ["operational_variation_pct"],
        "features_not_permitted_for_training": [
            "availability_ratio (jika utilization_rate digunakan; keduanya redundan)", "demand_level (status UI turunan utilization_rate)",
            "operational_variation_pct", "component_*", "price_adjustment_percent_display",
            "dynamic_price_raw_per_day", "dynamic_price_display_per_day", "total_invoice_raw", "total_invoice_display", "pricing_reason",
        ],
        "practitioner_validation_cases": int(len(validation_cases)),
        "practitioner_validation_status": "belum_divalidasi",
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=" * 88)
    print("ADAPTASI DATASET DYNAMIC PRICING V4 - DEMAND BERBASIS UTILIZATION")
    print("=" * 88)
    print(f"Dataset sumber                    : {args.input.name} ({len(raw):,} baris)")
    print(f"Kendaraan digunakan               : {catalog['source_vehicle_id'].nunique():,}")
    print(f"Total transaksi simulasi          : {len(transactions):,}")
    print("Aturan demand                     : utilization = 1 - availability; <=30% sepi, >=70% ramai")
    print(f"Demand sepi/normal/ramai          : {transactions['demand_level'].value_counts().to_dict()}")
    print(f"Rentang target adjustment         : {transactions['price_adjustment_pct'].min()*100:.2f}% s.d. {transactions['price_adjustment_pct'].max()*100:.2f}%")
    print(f"Kasus validasi praktisi           : {len(validation_cases)}")
    print("-" * 88)
    print(f"Dataset v4                        : {dataset_path}")
    print(f"Audit kendaraan                   : {audit_path}")
    print(f"Metadata label                    : {metadata_path}")
    print(f"Form validasi praktisi            : {validation_path}")
    print("=" * 88)


if __name__ == "__main__":
    main()
