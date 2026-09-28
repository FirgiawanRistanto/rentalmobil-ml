import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MlModelClientError,
  requestAdminMlModelInfo,
  requestAdminMlModelTree,
  requestMlModelInfo,
} from './mlModelClient';

const validModelInfo = {
  model_name: 'Random Forest Regressor',
  model_version: 'rf_adjustment_v4_final',
  target_name: 'price_adjustment_pct',
  feature_contract_version: 'v4',
  n_estimators: 500,
  parameters: {
    n_estimators: 500,
    max_depth: 15,
    max_features: 'sqrt',
    min_samples_split: 5,
    min_samples_leaf: 1,
  },
  raw_input_features: [
    'vehicle_category',
    'trip_type',
    'duration_days',
    'is_weekend',
    'is_holiday',
    'is_peak_season',
    'utilization_rate',
    'booking_lead_days',
  ],
  preprocessed_features: [
    'categorical__vehicle_category_suv',
    'categorical__trip_type_luar_kota',
    'numerical__duration_days',
  ],
  dataset_rows: 1200,
  train_rows: 960,
  test_rows: 240,
  metrics: {
    test_mae_percentage_points: 1.8,
    test_rmse_percentage_points: 2.4,
    test_r2: 0.94,
  },
};

const validTree = {
  tree_index: 0,
  tree_statistics: {
    tree_index: 0,
    max_depth: 2,
    node_count: 3,
    leaf_count: 2,
  },
  nodes: [
    {
      id: 0,
      depth: 0,
      is_leaf: false,
      feature_index: 0,
      feature: 'numerical__utilization_rate',
      threshold: 0.7,
      left: 1,
      right: 2,
      prediction: null,
    },
    {
      id: 1,
      depth: 1,
      is_leaf: true,
      feature_index: null,
      feature: null,
      threshold: null,
      left: null,
      right: null,
      prediction: 0.05,
    },
    {
      id: 2,
      depth: 1,
      is_leaf: true,
      feature_index: null,
      feature: null,
      threshold: null,
      left: null,
      right: null,
      prediction: 0.2,
    },
  ],
  feature_names: ['numerical__utilization_rate'],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function assertMlModelError(error: unknown, code: string): boolean {
  return error instanceof MlModelClientError && error.code === code;
}

describe('mlModelClient', () => {
  it('requests model info from FastAPI on the server-side client', async () => {
    let receivedUrl = '';

    const info = await requestMlModelInfo({
      baseUrl: 'http://127.0.0.1:8000',
      fetchFn: async (url) => {
        receivedUrl = String(url);
        return jsonResponse(validModelInfo);
      },
    });

    assert.equal(receivedUrl, 'http://127.0.0.1:8000/v1/model/info');
    assert.equal(info.model_name, 'Random Forest Regressor');
  });

  it('requests admin model info through the relative Next.js API proxy', async () => {
    let receivedUrl = '';

    const info = await requestAdminMlModelInfo({
      fetchFn: async (url) => {
        receivedUrl = String(url);
        return jsonResponse(validModelInfo);
      },
    });

    assert.equal(receivedUrl, '/api/admin/ml-model/info');
    assert.equal(info.n_estimators, 500);
  });

  it('requests admin tree structure through the relative Next.js API proxy', async () => {
    let receivedUrl = '';

    const tree = await requestAdminMlModelTree(7, {
      fetchFn: async (url) => {
        receivedUrl = String(url);
        return jsonResponse({ ...validTree, tree_index: 7, tree_statistics: { ...validTree.tree_statistics, tree_index: 7 } });
      },
    });

    assert.equal(receivedUrl, '/api/admin/ml-model/tree/7');
    assert.equal(tree.tree_index, 7);
  });

  it('maps admin proxy errors to model client errors', async () => {
    await assert.rejects(
      () => requestAdminMlModelTree(9999, {
        fetchFn: async () => jsonResponse(
          { error: { code: 'ML_TREE_INDEX_INVALID', message: 'Tree index tidak valid.' } },
          400,
        ),
      }),
      (error) => assertMlModelError(error, 'ML_TREE_INDEX_INVALID'),
    );
  });
});
