import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

import app._init_patches  # noqa: F401  - apply sklearn pickle support before unpickling

import joblib
import numpy as np

from app.constants import MODEL_PATH, METADATA_PATH
import json

print("=== Inspecting Pipeline Structure ===")
print(f"MODEL_PATH: {MODEL_PATH}")
print(f"Exists: {MODEL_PATH.exists()}")

pipeline = joblib.load(MODEL_PATH)
print(f"\nPipeline type: {type(pipeline)}")
print(f"Pipeline named_steps: {list(pipeline.named_steps.keys())}")

for name, step in pipeline.named_steps.items():
    print(f"\n--- Step: {name} ---")
    print(f"  Type: {type(step)}")
    if hasattr(step, 'get_feature_names_out'):
        try:
            fnames = step.get_feature_names_out()
            print(f"  get_feature_names_out: {list(fnames)}")
            print(f"  len: {len(fnames)}")
        except Exception as e:
            print(f"  get_feature_names_out error: {e}")
    if hasattr(step, 'feature_names_in_'):
        print(f"  feature_names_in_: {list(step.feature_names_in_)}")
        print(f"  len: {len(step.feature_names_in_)}")

model_step_name = None
rf_model = None
for name, step in pipeline.named_steps.items():
    if 'RandomForest' in type(step).__name__ or hasattr(step, 'estimators_'):
        model_step_name = name
        rf_model = step
        break

print(f"\n=== Random Forest Step: {model_step_name} ===")
print(f"Model type: {type(rf_model)}")
print(f"n_estimators: {rf_model.n_estimators}")
print(f"max_depth: {rf_model.max_depth}")
print(f"max_features: {rf_model.max_features}")
print(f"min_samples_split: {rf_model.min_samples_split}")
print(f"min_samples_leaf: {rf_model.min_samples_leaf}")
if hasattr(rf_model, 'n_features_in_'):
    print(f"n_features_in_: {rf_model.n_features_in_}")
if hasattr(rf_model, 'feature_names_in_'):
    print(f"feature_names_in_: {list(rf_model.feature_names_in_)}")

print("\n=== Getting feature names for tree (using get_feature_names_out on preprocessing) ===")
preprocessor = pipeline.named_steps.get('preprocessor') or pipeline.named_steps.get('preprocessing') or pipeline.named_steps.get('columntransformer')
if preprocessor:
    try:
        feature_names = list(preprocessor.get_feature_names_out())
        print(f"Preprocessing output features: {feature_names}")
        print(f"Count: {len(feature_names)}")
    except Exception as e:
        print(f"Error getting preprocessor feature names: {e}")
else:
    print("No explicit preprocessor step found, checking pipeline overall")
    try:
        feature_names = list(pipeline[:-1].get_feature_names_out())
        print(f"Pipeline[:-1] features: {feature_names}")
    except Exception as e:
        print(f"Error: {e}")

print("\n=== Sample tree (estimator 0) structure ===")
tree_0 = rf_model.estimators_[0]
print(f"Tree 0 type: {type(tree_0)}")
print(f"Tree 0 max_depth (actual): {tree_0.get_depth()}")
print(f"Tree 0 n_leaves (actual): {tree_0.get_n_leaves()}")
print(f"Tree 0 tree_.node_count: {tree_0.tree_.node_count}")

print("\n=== First 10 nodes of tree 0 ===")
for i in range(min(10, tree_0.tree_.node_count)):
    fid = tree_0.tree_.feature[i]
    is_leaf = fid == -2  # TREE_UNDEFINED
    thresh = tree_0.tree_.threshold[i]
    left = tree_0.tree_.children_left[i]
    right = tree_0.tree_.children_right[i]
    value = tree_0.tree_.value[i][0][0]
    print(f"  Node {i}: feature_idx={fid}, threshold={thresh:.4f}, left={left}, right={right}, is_leaf={is_leaf}, value={value:.6f}")

print("\n=== Metadata ===")
metadata = json.loads(METADATA_PATH.read_text())
for k, v in metadata.items():
    if not isinstance(v, (dict, list)) or len(str(v)) < 300:
        print(f"  {k}: {v}")
