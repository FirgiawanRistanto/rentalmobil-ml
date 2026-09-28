import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  readAdminMlModelInfo,
  readAdminMlModelTree,
} from './adminMlModelService';
import { PaymentServiceError } from './paymentService';

const admin = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'ADMIN',
};

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
  raw_input_features: ['vehicle_category', 'trip_type'],
  preprocessed_features: ['categorical__vehicle_category_suv', 'categorical__trip_type_luar_kota'],
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
  tree_index: 4,
  tree_statistics: {
    tree_index: 4,
    max_depth: 1,
    node_count: 1,
    leaf_count: 1,
  },
  nodes: [
    {
      id: 0,
      depth: 0,
      is_leaf: true,
      feature_index: null,
      feature: null,
      threshold: null,
      left: null,
      right: null,
      prediction: 0.12,
    },
  ],
  feature_names: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function assertPaymentError(error: unknown, code: string): boolean {
  return error instanceof PaymentServiceError && error.code === code;
}

describe('admin ML model service', () => {
  it('requires an authenticated admin user', async () => {
    await assert.rejects(
      () => readAdminMlModelInfo(null),
      (error) => assertPaymentError(error, 'AUTHENTICATION_REQUIRED'),
    );

    await assert.rejects(
      () => readAdminMlModelInfo({ id: 'customer-1', role: 'CUSTOMER' }),
      (error) => assertPaymentError(error, 'ADMIN_AUTHORIZATION_REQUIRED'),
    );
  });

  it('proxies model info to the server-side ML client for admins', async () => {
    let receivedUrl = '';

    const info = await readAdminMlModelInfo(admin, {
      baseUrl: 'http://ml.local',
      fetchFn: async (url) => {
        receivedUrl = String(url);
        return jsonResponse(validModelInfo);
      },
    });

    assert.equal(receivedUrl, 'http://ml.local/v1/model/info');
    assert.equal(info.model_version, 'rf_adjustment_v4_final');
  });

  it('proxies tree structure to the server-side ML client for admins', async () => {
    let receivedUrl = '';

    const tree = await readAdminMlModelTree(4, admin, {
      baseUrl: 'http://ml.local',
      fetchFn: async (url) => {
        receivedUrl = String(url);
        return jsonResponse(validTree);
      },
    });

    assert.equal(receivedUrl, 'http://ml.local/v1/model/tree/4');
    assert.equal(tree.tree_statistics.tree_index, 4);
  });
});
