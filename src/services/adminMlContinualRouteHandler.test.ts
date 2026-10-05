import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAdminMlContinualHandler } from '../app/api/admin/ml-model/continual/routeHandler';
import { AdminMlContinualError } from '../lib/adminMlContinualUi';

interface RecordedCall {
  name: string;
  user: unknown;
  args: unknown[];
}

function createHarness(failure?: unknown) {
  const calls: RecordedCall[] = [];
  const run = async (name: string, user: unknown, args: unknown[]) => {
    calls.push({ name, user, args });
    if (failure) throw failure;
    return { name, args };
  };

  const handler = createAdminMlContinualHandler({
    getCurrentUser: async () => ({ id: 'admin-1', role: 'ADMIN' }),
    service: {
      readStatus: (user) => run('readStatus', user, []),
      retrain: (user) => run('retrain', user, []),
      activate: (user, versionId) => run('activate', user, [versionId]),
      setLabel: (user, quoteId, targetPercent) => run('setLabel', user, [quoteId, targetPercent]),
      clearLabel: (user, quoteId) => run('clearLabel', user, [quoteId]),
    },
  });

  return { calls, handler };
}

function getRequest(handler: ReturnType<typeof createHarness>['handler']) {
  return handler(new Request('http://localhost/api/admin/ml-model/continual', { method: 'GET' }));
}

function postRequest(
  handler: ReturnType<typeof createHarness>['handler'],
  body: unknown,
) {
  return handler(
    new Request('http://localhost/api/admin/ml-model/continual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('admin ml continual route handler', () => {
  it('returns status for admin GET requests', async () => {
    const { calls, handler } = createHarness();

    const response = await getRequest(handler);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: { name: 'readStatus', args: [] } });
    assert.deepEqual(calls.map((call) => call.name), ['readStatus']);
    assert.deepEqual(calls[0].user, { id: 'admin-1', role: 'ADMIN' });
  });

  it('dispatches retrain, activate, and label actions', async () => {
    const { calls, handler } = createHarness();

    const retrain = await postRequest(handler, { action: 'retrain' });
    assert.deepEqual(await retrain.json(), { report: { name: 'retrain', args: [] } });

    const activate = await postRequest(handler, { action: 'activate', versionId: 'version-2' });
    assert.deepEqual(await activate.json(), {
      name: 'activate',
      args: ['version-2'],
    });

    const label = await postRequest(handler, {
      action: 'label',
      quoteId: 'quote-1',
      targetPercent: 12.5,
    });
    assert.deepEqual(await label.json(), { name: 'setLabel', args: ['quote-1', 12.5] });

    const clearLabel = await postRequest(handler, { action: 'label', quoteId: 'quote-1' });
    assert.deepEqual(await clearLabel.json(), { name: 'clearLabel', args: ['quote-1'] });

    assert.deepEqual(
      calls.map((call) => call.name),
      ['retrain', 'activate', 'setLabel', 'clearLabel'],
    );
  });

  it('rejects unknown actions and malformed JSON', async () => {
    const { handler } = createHarness();

    const unknown = await postRequest(handler, { action: 'destroy-model' });
    assert.equal(unknown.status, 400);
    assert.equal((await unknown.json()).error.code, 'UNKNOWN_ACTION');

    const malformed = await handler(
      new Request('http://localhost/api/admin/ml-model/continual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'bukan-json',
      }),
    );
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error.code, 'UNKNOWN_ACTION');
  });

  it('maps service errors to their HTTP status and code', async () => {
    const cases: Array<[AdminMlContinualError, number]> = [
      [new AdminMlContinualError('AUTHENTICATION_REQUIRED'), 401],
      [new AdminMlContinualError('ADMIN_AUTHORIZATION_REQUIRED'), 403],
      [new AdminMlContinualError('ML_RETRAIN_NOT_ELIGIBLE'), 400],
      [new AdminMlContinualError('ML_RETRAIN_GUARDRAIL_FAILED', 'MAE memburuk'), 422],
      [new AdminMlContinualError('MODEL_VERSION_NOT_FOUND'), 404],
      [new AdminMlContinualError('ML_SERVICE_UNAVAILABLE'), 503],
    ];

    for (const [error, status] of cases) {
      const { handler } = createHarness(error);
      const response = await postRequest(handler, { action: 'retrain' });
      const body = await response.json();

      assert.equal(response.status, status, error.code);
      assert.equal(body.error.code, error.code);
      assert.equal(body.error.message, error.message);
    }
  });

  it('falls back to a generic 500 for unexpected failures', async () => {
    const { handler } = createHarness(new Error('database exploded'));

    const response = await postRequest(handler, { action: 'retrain' });
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.error.code, 'ML_RETRAIN_FAILED');
    assert.equal(body.error.message, 'Permintaan machine learning belum dapat diproses.');
  });
});
