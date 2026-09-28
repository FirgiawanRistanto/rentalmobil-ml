import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

import app._init_patches  # noqa: F401
from fastapi.testclient import TestClient
from main import create_app
from app.model_loader import default_model_service

default_model_service.ensure_loaded()
client = TestClient(create_app(default_model_service))

print("=== Test 1: GET /v1/model/info ===")
resp = client.get("/v1/model/info")
print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    print(f"model_name: {data['model_name']}")
    print(f"model_version: {data['model_version']}")
    print(f"n_estimators: {data['n_estimators']}")
    print(f"parameters: {data['parameters']}")
    print(f"raw_input_features count: {len(data['raw_input_features'])} -> {data['raw_input_features']}")
    print(f"preprocessed_features count: {len(data['preprocessed_features'])} -> {data['preprocessed_features']}")
    print(f"dataset_rows: {data['dataset_rows']}")
    print(f"train_rows: {data['train_rows']}")
    print(f"test_rows: {data['test_rows']}")
    print(f"metrics: {data['metrics']}")
else:
    print(resp.text)

print("\n=== Test 2: GET /v1/model/tree/0 (valid index) ===")
resp = client.get("/v1/model/tree/0")
print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    stats = data["tree_statistics"]
    print(f"tree_index: {stats['tree_index']}")
    print(f"max_depth: {stats['max_depth']}")
    print(f"node_count: {stats['node_count']}")
    print(f"leaf_count: {stats['leaf_count']}")
    print(f"feature_names count: {len(data['feature_names'])}")
    print(f"Total nodes: {len(data['nodes'])}")
    print(f"\nFirst 5 nodes:")
    for node in data["nodes"][:5]:
        if node["is_leaf"]:
            print(f"  Node {node['id']} (depth {node['depth']}) LEAF -> prediction={node['prediction']:.6f}")
        else:
            print(f"  Node {node['id']} (depth {node['depth']}) -> {node['feature']} <= {node['threshold']:.4f}  (left:{node['left']}, right:{node['right']})")
else:
    print(resp.text)

print("\n=== Test 3: GET /v1/model/tree/9999 (invalid index, out of range) ===")
resp = client.get("/v1/model/tree/9999")
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text[:300]}")

print("\n=== Test 4: GET /v1/model/tree/-1 (invalid negative via path) ===")
resp = client.get("/v1/model/tree/-1")
print(f"Status: {resp.status_code} (expected 422 due to Path ge=0)")
print(f"Response: {resp.text[:300]}")

print("\n=== Test 5: POST /v1/predict-price (existing still works) ===")
resp = client.post("/v1/predict-price", json={
    "vehicle_category": "suv",
    "trip_type": "luar_kota",
    "duration_days": 3,
    "is_weekend": 1,
    "is_holiday": 0,
    "is_peak_season": 1,
    "utilization_rate": 0.8,
    "booking_lead_days": 7,
    "base_price_idr_per_day": 800000,
})
print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    print(f"predicted_price_adjustment_pct: {data['predicted_price_adjustment_pct']:.6f}")
    print(f"dynamic_price_display_per_day: {data['dynamic_price_display_per_day']}")
