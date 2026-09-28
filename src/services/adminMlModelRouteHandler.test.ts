import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createGetAdminMlModelInfoHandler,
  createGetAdminMlModelTreeHandler,
} from '../app/api/admin/ml-model/routeHandler';
import { MlModelClientError } from './mlModelClient';
import { PaymentServiceError } from './paymentService';

const admin = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'ADMIN',
};

const modelInfo = {
  model_name: 'Random Forest Regressor',
  n_estimators: 500,
};

const treeStructure = {
  tree_index: 2,
  nodes: [],
};

describe('admin ML model route handler', () => {
  it('returns model info for admin session users', async () => {
    let receivedUserId = '';
    const handler = createGetAdminMlModelInfoHandler({
      getCurrentUser: async () => admin,
      service: {
        async readAdminMlModelInfo(user) {
          receivedUserId = user?.id ?? '';
          return modelInfo;
        },
        async readAdminMlModelTree() {
          return treeStructure;
        },
      },
    });

    const response = await handler();
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(receivedUserId, admin.id);
    assert.deepEqual(body, modelInfo);
  });

  it('returns tree structure for valid tree indexes', async () => {
    let receivedTreeIndex = -1;
    const handler = createGetAdminMlModelTreeHandler({
      getCurrentUser: async () => admin,
      service: {
        async readAdminMlModelInfo() {
          return modelInfo;
        },
        async readAdminMlModelTree(treeIndex) {
          receivedTreeIndex = treeIndex;
          return { ...treeStructure, tree_index: treeIndex };
        },
      },
    });

    const response = await handler(new Request('http://localhost/api/admin/ml-model/tree/2'), {
      params: Promise.resolve({ treeIndex: '2' }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(receivedTreeIndex, 2);
    assert.equal(body.tree_index, 2);
  });

  it('maps invalid tree indexes to HTTP 400', async () => {
    const handler = createGetAdminMlModelTreeHandler({
      getCurrentUser: async () => admin,
      service: {
        async readAdminMlModelInfo() {
          return modelInfo;
        },
        async readAdminMlModelTree() {
          return treeStructure;
        },
      },
    });

    const response = await handler(new Request('http://localhost/api/admin/ml-model/tree/abc'), {
      params: Promise.resolve({ treeIndex: 'abc' }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'ML_TREE_INDEX_INVALID');
  });

  it('maps auth and ML service errors to controlled responses', async () => {
    const unauthorizedHandler = createGetAdminMlModelInfoHandler({
      getCurrentUser: async () => null,
      service: {
        async readAdminMlModelInfo() {
          throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'Login diperlukan.');
        },
        async readAdminMlModelTree() {
          return treeStructure;
        },
      },
    });

    const unavailableHandler = createGetAdminMlModelInfoHandler({
      getCurrentUser: async () => admin,
      service: {
        async readAdminMlModelInfo() {
          throw new MlModelClientError('ML_SERVICE_UNAVAILABLE', 'ML service tidak tersedia.');
        },
        async readAdminMlModelTree() {
          return treeStructure;
        },
      },
    });

    const unauthorizedResponse = await unauthorizedHandler();
    const unavailableResponse = await unavailableHandler();
    const unauthorizedBody = await unauthorizedResponse.json();
    const unavailableBody = await unavailableResponse.json();

    assert.equal(unauthorizedResponse.status, 401);
    assert.equal(unauthorizedBody.error.code, 'AUTHENTICATION_REQUIRED');
    assert.equal(unavailableResponse.status, 503);
    assert.equal(unavailableBody.error.code, 'ML_SERVICE_UNAVAILABLE');
  });
});
