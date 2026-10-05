import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AdminMlContinualClientError,
  activateContinualClient,
  clearLabelContinualClient,
  parseContinualStatus,
  parseRetrainReport,
  readContinualStatusClient,
  retrainContinualClient,
  setLabelContinualClient,
} from './adminMlContinualClient';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function withFetch(
  stub: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  run: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = stub as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

const VERSION_FIXTURE = {
  id: 'version-baseline',
  version: 'rf_adjustment_v4_final',
  artifactPath: 'ml-service/artifacts/v4_final/dynamic_pricing_adjustment_rf_pipeline_v4.pkl',
  isActive: true,
  isBaseline: true,
  trainedAt: '2025-06-01T00:00:00.000Z',
  createdAt: '2025-06-01T00:00:00.000Z',
  metrics: { maePctPoint: 2.104, rmsePctPoint: 2.598, r2: 0.9764 },
  liveRows: null,
};

const SAMPLE_FIXTURE = {
  quoteId: '11111111-2222-3333-4444-555555555555',
  carCategory: 'SUV',
  modelCategory: 'suv',
  tripType: 'LUAR_KOTA',
  modelTripType: 'luar_kota',
  durationDays: 3,
  isWeekend: true,
  isHoliday: false,
  isPeakSeason: true,
  utilizationRate: 0.8,
  bookingLeadDays: 7,
  predictedAdjustmentFraction: 0.2185,
  modelVersion: 'rf_adjustment_v4_final',
  status: 'ACCEPTED',
  createdAt: '2026-10-01T00:00:00.000Z',
  manualTargetFraction: null,
};

const STATUS_FIXTURE = {
  status: {
    totalLiveSamples: 60,
    samplesSinceLastRetrain: 60,
    minSamplesRequired: 50,
    eligible: true,
    serviceReachable: true,
    loadedVersion: 'rf_adjustment_v4_final',
    activeVersion: 'rf_adjustment_v4_final',
    versionsInSync: true,
    baselineVersion: 'rf_adjustment_v4_final',
    baselineMetrics: { maePctPoint: 2.104, rmsePctPoint: 2.598, r2: 0.9764 },
    activeMetrics: null,
    lastRetrainAt: null,
    versions: [VERSION_FIXTURE],
    recentSamples: [SAMPLE_FIXTURE],
  },
};

const REPORT_FIXTURE = {
  report: {
    versionId: 'version-live',
    version: 'rf_adjustment_v4_live_20261004123456',
    metrics: { maePctPoint: 2.05, rmsePctPoint: 2.5, r2: 0.978 },
    baselineMetrics: { maePctPoint: 2.104, rmsePctPoint: 2.598, r2: 0.9764 },
    guardrail: {
      passed: true,
      maxMaeRegressionRatio: 0.1,
      minR2Drop: 0.02,
      reasons: [],
    },
    liveRowsUsed: 55,
    liveRowsLabeledRule: 50,
    liveRowsLabeledManual: 5,
    trainRows: 33000,
    testRows: 8200,
    durationSeconds: 12.5,
  },
};

describe('adminMlContinualClient', () => {
  it('reads and parses the status payload', async () => {
    let receivedUrl = '';
    await withFetch(
      async (input) => {
        receivedUrl = String(input);
        return jsonResponse(STATUS_FIXTURE);
      },
      async () => {
        const status = await readContinualStatusClient();
        assert.equal(receivedUrl, '/api/admin/ml-model/continual');
        assert.equal(status.eligible, true);
        assert.equal(status.totalLiveSamples, 60);
        assert.equal(status.versions.length, 1);
        assert.equal(status.versions[0].metrics?.maePctPoint, 2.104);
        assert.equal(status.recentSamples[0].modelCategory, 'suv');
        assert.equal(status.recentSamples[0].manualTargetFraction, null);
      },
    );
  });

  it('posts the retrain action and parses the report', async () => {
    let receivedInit: RequestInit | undefined;
    await withFetch(
      async (_input, init) => {
        receivedInit = init;
        return jsonResponse(REPORT_FIXTURE);
      },
      async () => {
        const report = await retrainContinualClient();
        assert.equal(report.versionId, 'version-live');
        assert.equal(report.metrics.maePctPoint, 2.05);
        assert.equal(report.guardrail.passed, true);
        assert.equal(receivedInit?.method, 'POST');
        assert.deepEqual(JSON.parse(String(receivedInit?.body)), { action: 'retrain' });
      },
    );
  });

  it('activates versions and manages labels through POST actions', async () => {
    const payloads: unknown[] = [];
    await withFetch(
      async (_input, init) => {
        payloads.push(JSON.parse(String(init?.body)));
        const body = payloads[payloads.length - 1] as { action?: string };
        if (body.action === 'activate') {
          return jsonResponse({ versionId: 'version-live', version: 'rf_adjustment_v4_live_20261004123456' });
        }
        if (body.action === 'label' && (body as { targetPercent?: unknown }).targetPercent === null) {
          return jsonResponse({ quoteId: 'quote-1' });
        }
        return jsonResponse({ quoteId: 'quote-1', target: 0.125 });
      },
      async () => {
        const activated = await activateContinualClient('version-live');
        assert.deepEqual(activated, {
          versionId: 'version-live',
          version: 'rf_adjustment_v4_live_20261004123456',
        });

        const labeled = await setLabelContinualClient('quote-1', 12.5);
        assert.deepEqual(labeled, { quoteId: 'quote-1', target: 0.125 });

        const cleared = await clearLabelContinualClient('quote-1');
        assert.deepEqual(cleared, { quoteId: 'quote-1' });
      },
    );

    assert.deepEqual(payloads, [
      { action: 'activate', versionId: 'version-live' },
      { action: 'label', quoteId: 'quote-1', targetPercent: 12.5 },
      { action: 'label', quoteId: 'quote-1', targetPercent: null },
    ]);
  });

  it('surfaces API error codes with friendly messages', async () => {
    await withFetch(
      async () =>
        jsonResponse(
          { error: { code: 'ML_RETRAIN_GUARDRAIL_FAILED', message: 'MAE memburuk 5%' } },
          422,
        ),
      async () => {
        await assert.rejects(
          () => retrainContinualClient(),
          (error: unknown) =>
            error instanceof AdminMlContinualClientError &&
            error.code === 'ML_RETRAIN_GUARDRAIL_FAILED' &&
            error.message === 'MAE memburuk 5%',
        );
      },
    );

    await withFetch(
      async () => jsonResponse({ error: { code: 'ML_RETRAIN_NOT_ELIGIBLE' } }, 400),
      async () => {
        await assert.rejects(
          () => retrainContinualClient(),
          (error: unknown) =>
            error instanceof AdminMlContinualClientError &&
            error.code === 'ML_RETRAIN_NOT_ELIGIBLE' &&
            /50/.test(error.message),
        );
      },
    );

    await withFetch(
      async () => new Response('bukan-json', { status: 500 }),
      async () => {
        await assert.rejects(
          () => readContinualStatusClient(),
          (error: unknown) =>
            error instanceof AdminMlContinualClientError && error.code === 'UNKNOWN_ERROR',
        );
      },
    );
  });

  it('rejects malformed payloads', () => {
    assert.throws(() => parseContinualStatus({ totalLiveSamples: 'banyak' }));
    assert.throws(() => parseContinualStatus(null));
    assert.throws(() => parseRetrainReport({ versionId: 'x' }));
    assert.throws(() => parseRetrainReport([]));
  });
});
