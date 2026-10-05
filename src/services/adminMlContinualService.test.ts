import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdminMlContinualError, MIN_LIVE_SAMPLES_FOR_RETRAIN } from '../lib/adminMlContinualUi';
import {
  activateAdminMlModelVersion,
  adminMlContinualErrorStatus,
  clearLiveSampleLabel,
  parseMlRetrainResponse,
  readAdminMlContinualStatus,
  retrainAdminMlModel,
  setLiveSampleLabel,
  type AdminMlContinualRepository,
  type AdminMlContinualTransport,
  type MlRetrainPayload,
  type MlRetrainResponse,
  type RawLiveSample,
  type RawModelVersion,
} from './adminMlContinualService';

const ADMIN_USER = { id: 'admin-1', role: 'ADMIN' };
const FIXED_NOW = () => new Date('2026-10-04T12:34:56.000Z');
const EXPECTED_LIVE_VERSION = 'rf_adjustment_v4_live_20261004123456';

function sampleRow(overrides: Partial<RawLiveSample> = {}): RawLiveSample {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    category: 'SUV',
    tripType: 'LUAR_KOTA',
    durationDays: 3,
    isWeekend: true,
    isHoliday: false,
    isPeakSeason: true,
    utilizationRate: '0.8000',
    bookingLeadDays: 7,
    predictedPriceAdjustmentPct: '0.218500',
    modelVersion: 'rf_adjustment_v4_final',
    status: 'ACCEPTED',
    createdAt: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

function versionRow(overrides: Partial<RawModelVersion> = {}): RawModelVersion {
  return {
    id: 'version-baseline',
    version: 'rf_adjustment_v4_final',
    artifactPath: 'ml-service/artifacts/v4_final/dynamic_pricing_adjustment_rf_pipeline_v4.pkl',
    metadata: {
      evaluation: {
        mae_adjustment_percentage_points: 2.104,
        rmse_adjustment_percentage_points: 2.598,
        r2_adjustment: 0.9764,
      },
    },
    trainedAt: new Date('2025-06-01T00:00:00Z'),
    isActive: true,
    createdAt: new Date('2025-06-01T00:00:00Z'),
    ...overrides,
  };
}

function successRetrainResponse(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    status: 'completed',
    version: EXPECTED_LIVE_VERSION,
    artifact_path: `ml-service/artifacts/versions/${EXPECTED_LIVE_VERSION}/dynamic_pricing_adjustment_rf_pipeline_v4.pkl`,
    duration_seconds: 12.5,
    live_rows_received: 60,
    live_rows_used: 55,
    live_rows_skipped_invalid: 2,
    live_rows_labeled_rule: 50,
    live_rows_labeled_manual: 5,
    base_rows: 41088,
    train_rows: 33000,
    test_rows: 8200,
    live_holdout_rows: 11,
    baseline_metrics: { mae_percentage_points: 2.104, rmse_percentage_points: 2.598, r2: 0.9764 },
    metrics: { mae_percentage_points: 2.05, rmse_percentage_points: 2.5, r2: 0.978 },
    live_metrics: { mae_percentage_points: 1.9, rmse_percentage_points: 2.4, r2: 0.97 },
    guardrail: {
      passed: true,
      max_mae_regression_ratio: 0.1,
      min_r2_drop: 0.02,
      reasons: [],
    },
    ...overrides,
  };
}

interface FakeState {
  sampleCount: number;
  samplesSince: number;
  samples: RawLiveSample[];
  overrides: Array<{ quoteId: string; target: number }>;
  versions: RawModelVersion[];
  mlSettings: Partial<Record<'maxMaeRegressionPct' | 'minR2DropPp' | 'minLiveSamples', number | null>>;
  calls: string[];
  inserted: Array<{ version: string; artifactPath: string; metadata: unknown }>;
  activatedVersionId: string | null;
  upsertResult: boolean;
  deleteResult: boolean;
  retrainPayloads: MlRetrainPayload[];
  activatedVersions: string[];
  loadedVersion: string | null;
  retrainResponse: unknown;
  activateError: AdminMlContinualError | null;
}

function createState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    sampleCount: 60,
    samplesSince: 60,
    samples: [sampleRow()],
    overrides: [],
    versions: [versionRow()],
    mlSettings: {},
    calls: [],
    inserted: [],
    activatedVersionId: null,
    upsertResult: true,
    deleteResult: true,
    retrainPayloads: [],
    activatedVersions: [],
    loadedVersion: 'rf_adjustment_v4_final',
    retrainResponse: successRetrainResponse(),
    activateError: null,
    ...overrides,
  };
}

function fakeRepository(state: FakeState): AdminMlContinualRepository {
  return {
    async countLiveSamples() {
      state.calls.push('countLiveSamples');
      return state.sampleCount;
    },
    async countLiveSamplesSince() {
      state.calls.push('countLiveSamplesSince');
      return state.samplesSince;
    },
    async readLiveSamples() {
      state.calls.push('readLiveSamples');
      return state.samples;
    },
    async readOverrides() {
      state.calls.push('readOverrides');
      return state.overrides;
    },
    async readVersions() {
      state.calls.push('readVersions');
      return state.versions;
    },
    async readMlRetrainSettings() {
      state.calls.push('readMlRetrainSettings');
      return state.mlSettings;
    },
    async insertVersion({ version, artifactPath, metadata }) {
      state.calls.push('insertVersion');
      state.inserted.push({ version, artifactPath, metadata });
      return versionRow({ id: 'version-live', version, artifactPath, metadata, isActive: false });
    },
    async activateVersionById(id) {
      state.calls.push('activateVersionById');
      state.activatedVersionId = id;
    },
    async upsertOverride() {
      state.calls.push('upsertOverride');
      return state.upsertResult;
    },
    async deleteOverride() {
      state.calls.push('deleteOverride');
      return state.deleteResult;
    },
  };
}

interface FakeTransportState {
  retrainPayloads: MlRetrainPayload[];
  activatedVersions: string[];
  loadedVersion: string | null;
  retrainResponse: unknown;
  activateError: AdminMlContinualError | null;
}

function fakeTransport(state: FakeTransportState): AdminMlContinualTransport {
  return {
    async retrain(payload) {
      state.retrainPayloads.push(payload);
      return parseMlRetrainResponse(state.retrainResponse);
    },
    async activate(version) {
      if (state.activateError) throw state.activateError;
      state.activatedVersions.push(version);
      return {
        modelVersion: version,
        artifactPath: `ml-service/artifacts/versions/${version}/model.pkl`,
      };
    },
    async readLoadedVersion() {
      return state.loadedVersion;
    },
  };
}

function fakeDeps(state: FakeState, overrides: Partial<FakeState> = {}) {
  Object.assign(state, overrides);
  return {
    repository: fakeRepository(state),
    transport: fakeTransport(state),
    now: FIXED_NOW,
  };
}

describe('adminMlContinualService status', () => {
  it('assembles samples, metrics, eligibility, and sync state', async () => {
    const state = createState({ overrides: [{ quoteId: '11111111-2222-3333-4444-555555555555', target: 0.125 }] });

    const status = await readAdminMlContinualStatus(ADMIN_USER, fakeDeps(state));

    assert.equal(status.totalLiveSamples, 60);
    assert.equal(status.samplesSinceLastRetrain, 60);
    assert.equal(status.minSamplesRequired, MIN_LIVE_SAMPLES_FOR_RETRAIN);
    assert.equal(status.eligible, true);
    assert.equal(status.serviceReachable, true);
    assert.equal(status.loadedVersion, 'rf_adjustment_v4_final');
    assert.equal(status.activeVersion, 'rf_adjustment_v4_final');
    assert.equal(status.versionsInSync, true);
    assert.equal(status.baselineVersion, 'rf_adjustment_v4_final');
    assert.deepEqual(status.baselineMetrics, { maePctPoint: 2.104, rmsePctPoint: 2.598, r2: 0.9764 });
    assert.equal(status.versions.length, 1);
    assert.equal(status.versions[0].isBaseline, true);

    const [sample] = status.recentSamples;
    assert.equal(sample.modelCategory, 'suv');
    assert.equal(sample.modelTripType, 'luar_kota');
    assert.equal(sample.manualTargetFraction, 0.125);
    assert.equal(sample.predictedAdjustmentFraction, 0.2185);
  });

  it('is not eligible below the sample threshold or when ml-service is unreachable', async () => {
    const tooFew = createState({ sampleCount: 10, samplesSince: 10 });
    const below = await readAdminMlContinualStatus(ADMIN_USER, fakeDeps(tooFew));
    assert.equal(below.eligible, false);

    const unreachable = createState();
    const offline = await readAdminMlContinualStatus(
      ADMIN_USER,
      fakeDeps(unreachable, { loadedVersion: null }),
    );
    assert.equal(offline.serviceReachable, false);
    assert.equal(offline.eligible, false);
    assert.equal(offline.versionsInSync, false);
  });

  it('measures new samples since the last live retrain, not from the beginning', async () => {
    const state = createState({
      samplesSince: 5,
      versions: [
        versionRow({ isActive: false }),
        versionRow({
          id: 'version-live',
          version: 'rf_adjustment_v4_live_20261001000000',
          isActive: true,
          metadata: { live_rows_used: 40 },
          trainedAt: new Date('2026-10-02T00:00:00Z'),
        }),
      ],
    });

    const status = await readAdminMlContinualStatus(ADMIN_USER, fakeDeps(state));

    assert.equal(status.lastRetrainAt, '2026-10-02T00:00:00.000Z');
    assert.equal(status.samplesSinceLastRetrain, 5);
    assert.equal(status.eligible, false);
    assert.equal(status.activeVersion, 'rf_adjustment_v4_live_20261001000000');
    assert.equal(status.versions.find((version) => version.isActive)?.liveRows, 40);
  });

  it('requires an admin session', async () => {
    const state = createState();
    await assert.rejects(
      () => readAdminMlContinualStatus(null, fakeDeps(state)),
      (error: unknown) => error instanceof AdminMlContinualError && error.code === 'AUTHENTICATION_REQUIRED',
    );
    await assert.rejects(
      () => readAdminMlContinualStatus({ id: 'customer-1', role: 'CUSTOMER' }, fakeDeps(state)),
      (error: unknown) =>
        error instanceof AdminMlContinualError && error.code === 'ADMIN_AUTHORIZATION_REQUIRED',
    );
  });
});

describe('adminMlContinualService retrain', () => {
  it('registers a staged version only after the guardrail passes', async () => {
    const state = createState();
    const deps = fakeDeps(state);

    const report = await retrainAdminMlModel(ADMIN_USER, deps);

    assert.equal(report.version, EXPECTED_LIVE_VERSION);
    assert.equal(report.versionId, 'version-live');
    assert.equal(report.guardrail.passed, true);
    assert.equal(report.liveRowsUsed, 55);
    assert.equal(state.inserted.length, 1);
    assert.equal(state.inserted[0].version, EXPECTED_LIVE_VERSION);
    assert.equal(
      state.inserted[0].artifactPath,
      `ml-service/artifacts/versions/${EXPECTED_LIVE_VERSION}/dynamic_pricing_adjustment_rf_pipeline_v4.pkl`,
    );

    const metadata = state.inserted[0].metadata as Record<string, unknown>;
    assert.equal(metadata.source, 'continuous_learning');
    assert.equal(metadata.live_rows_used, 55);

    const payload = state.retrainPayloads[0];
    assert.equal(payload.version, EXPECTED_LIVE_VERSION);
    assert.equal(payload.live_weight, 5);
    assert.equal(payload.guardrail.max_mae_regression_ratio, 0.1);
    assert.equal(payload.guardrail.min_r2_drop, 0.02);
    assert.equal(payload.live_rows.length, 1);
    assert.equal(payload.live_rows[0].vehicle_category, 'suv');
    assert.equal(payload.live_rows[0].trip_type, 'luar_kota');
    assert.equal(payload.live_rows[0].is_weekend, 1);
    assert.equal(payload.live_rows[0].utilization_rate, 0.8);
    assert.equal('target_price_adjustment_pct' in payload.live_rows[0], false);
  });

  it('refuses to retrain below the eligibility threshold without calling ml-service', async () => {
    const state = createState();
    const deps = fakeDeps(state, { sampleCount: 10, samplesSince: 10 });

    await assert.rejects(
      () => retrainAdminMlModel(ADMIN_USER, deps),
      (error: unknown) => error instanceof AdminMlContinualError && error.code === 'ML_RETRAIN_NOT_ELIGIBLE',
    );
    assert.equal(state.retrainPayloads.length, 0);
    assert.equal(state.inserted.length, 0);
  });

  it('uses the configured pricing_settings thresholds for eligibility and guardrail', async () => {
    const state = createState({
      samplesSince: 60,
      mlSettings: { maxMaeRegressionPct: 25, minR2DropPp: 5, minLiveSamples: 100 },
    });

    const status = await readAdminMlContinualStatus(ADMIN_USER, fakeDeps(state));
    assert.equal(status.minSamplesRequired, 100);
    assert.equal(status.eligible, false, '60 sampel < ambang 100 dari pricing_settings');

    const ready = createState({
      sampleCount: 120,
      samplesSince: 120,
      mlSettings: { maxMaeRegressionPct: 25, minR2DropPp: 5, minLiveSamples: 100 },
    });
    const readyStatus = await readAdminMlContinualStatus(ADMIN_USER, fakeDeps(ready));
    assert.equal(readyStatus.eligible, true);

    const retrainState = createState({
      sampleCount: 120,
      samplesSince: 120,
      mlSettings: { maxMaeRegressionPct: 25, minR2DropPp: 5, minLiveSamples: 100 },
    });
    await retrainAdminMlModel(ADMIN_USER, fakeDeps(retrainState));

    const guardrail = retrainState.retrainPayloads[0].guardrail;
    assert.equal(guardrail.max_mae_regression_ratio, 0.25);
    assert.equal(guardrail.min_r2_drop, 0.05);
  });

  it('falls back to the constant thresholds when the settings rows are missing', async () => {
    const state = createState({
      mlSettings: { maxMaeRegressionPct: null, minR2DropPp: null, minLiveSamples: null },
    });

    const status = await readAdminMlContinualStatus(ADMIN_USER, fakeDeps(state));
    assert.equal(status.minSamplesRequired, MIN_LIVE_SAMPLES_FOR_RETRAIN);
    assert.equal(status.eligible, true);

    await retrainAdminMlModel(ADMIN_USER, fakeDeps(state));
    assert.equal(state.retrainPayloads[0].guardrail.max_mae_regression_ratio, 0.1);
    assert.equal(state.retrainPayloads[0].guardrail.min_r2_drop, 0.02);
  });

  it('does not register a version when the guardrail fails', async () => {
    const state = createState();
    const deps = fakeDeps(state, {
      retrainResponse: successRetrainResponse({
        status: 'guardrail_failed',
        artifact_path: null,
        guardrail: {
          passed: false,
          max_mae_regression_ratio: 0.1,
          min_r2_drop: 0.02,
          reasons: ['MAE 2.400 poin melewati batas 2.314.'],
        },
      }),
    });

    await assert.rejects(
      () => retrainAdminMlModel(ADMIN_USER, deps),
      (error: unknown) =>
        error instanceof AdminMlContinualError &&
        error.code === 'ML_RETRAIN_GUARDRAIL_FAILED' &&
        error.message.includes('baseline'),
    );
    assert.equal(state.inserted.length, 0);
  });

  it('sends manual admin labels and skips unsupported categories', async () => {
    const state = createState({
      samples: [
        sampleRow({ id: 'quote-with-override' }),
        sampleRow({ id: 'quote-truck', category: 'TRUCK' }),
      ],
      overrides: [{ quoteId: 'quote-with-override', target: -0.05 }],
    });
    const deps = fakeDeps(state);

    await retrainAdminMlModel(ADMIN_USER, deps);

    const rows = state.retrainPayloads[0].live_rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].quote_id, 'quote-with-override');
    assert.equal(rows[0].target_price_adjustment_pct, -0.05);
  });
});

describe('adminMlContinualService activation and labels', () => {
  it('activates the ml-service before flipping the database flag', async () => {
    const state = createState({
      versions: [versionRow({ id: 'version-live', version: 'rf_adjustment_v4_live_20261001000000', isActive: false })],
    });
    const deps = fakeDeps(state);

    const result = await activateAdminMlModelVersion(ADMIN_USER, 'version-live', deps);

    assert.deepEqual(result, { versionId: 'version-live', version: 'rf_adjustment_v4_live_20261001000000' });
    assert.deepEqual(state.activatedVersions, ['rf_adjustment_v4_live_20261001000000']);
    assert.deepEqual(state.calls, ['readVersions', 'activateVersionById']);
    assert.equal(state.activatedVersionId, 'version-live');
  });

  it('rejects unknown versions without touching ml-service', async () => {
    const state = createState();
    const deps = fakeDeps(state);

    await assert.rejects(
      () => activateAdminMlModelVersion(ADMIN_USER, 'missing-id', deps),
      (error: unknown) => error instanceof AdminMlContinualError && error.code === 'MODEL_VERSION_NOT_FOUND',
    );
    assert.equal(state.activatedVersions.length, 0);
    assert.equal(state.activatedVersionId, null);
  });

  it('keeps the database untouched when ml-service refuses activation', async () => {
    const state = createState({
      versions: [versionRow({ id: 'version-live', version: 'rf_adjustment_v4_live_20261001000000', isActive: false })],
    });
    const deps = fakeDeps(state, {
      activateError: new AdminMlContinualError('MODEL_ACTIVATION_FAILED'),
    });

    await assert.rejects(
      () => activateAdminMlModelVersion(ADMIN_USER, 'version-live', deps),
      (error: unknown) =>
        error instanceof AdminMlContinualError && error.code === 'MODEL_ACTIVATION_FAILED',
    );
    assert.equal(state.activatedVersionId, null);
  });

  it('stores and clears manual labels within the allowed range', async () => {
    const state = createState();

    const stored = await setLiveSampleLabel(ADMIN_USER, 'quote-1', '12.5', fakeDeps(state));
    assert.deepEqual(stored, { quoteId: 'quote-1', target: 0.125 });

    const cleared = await clearLiveSampleLabel(ADMIN_USER, 'quote-1', fakeDeps(state));
    assert.deepEqual(cleared, { quoteId: 'quote-1' });

    await assert.rejects(
      () => setLiveSampleLabel(ADMIN_USER, 'quote-1', '999', fakeDeps(state)),
      (error: unknown) => error instanceof AdminMlContinualError && error.code === 'INVALID_LABEL_VALUE',
    );

    const missing = createState({ upsertResult: false, deleteResult: false });
    await assert.rejects(
      () => setLiveSampleLabel(ADMIN_USER, 'unknown-quote', 1, fakeDeps(missing)),
      (error: unknown) => error instanceof AdminMlContinualError && error.code === 'LABEL_QUOTE_NOT_FOUND',
    );
    await assert.rejects(
      () => clearLiveSampleLabel(ADMIN_USER, 'unknown-quote', fakeDeps(missing)),
      (error: unknown) => error instanceof AdminMlContinualError && error.code === 'LABEL_QUOTE_NOT_FOUND',
    );
  });
});

describe('adminMlContinualService helpers', () => {
  it('maps error codes to HTTP statuses', () => {
    assert.equal(adminMlContinualErrorStatus(new AdminMlContinualError('AUTHENTICATION_REQUIRED')), 401);
    assert.equal(adminMlContinualErrorStatus(new AdminMlContinualError('ADMIN_AUTHORIZATION_REQUIRED')), 403);
    assert.equal(adminMlContinualErrorStatus(new AdminMlContinualError('MODEL_VERSION_NOT_FOUND')), 404);
    assert.equal(adminMlContinualErrorStatus(new AdminMlContinualError('ML_RETRAIN_GUARDRAIL_FAILED')), 422);
    assert.equal(adminMlContinualErrorStatus(new AdminMlContinualError('ML_RETRAIN_NOT_ELIGIBLE')), 400);
    assert.equal(adminMlContinualErrorStatus(new AdminMlContinualError('ML_SERVICE_UNAVAILABLE')), 503);
  });

  it('parses the FastAPI retrain response strictly', () => {
    const parsed = parseMlRetrainResponse(successRetrainResponse());
    assert.equal(parsed.status, 'completed');
    assert.equal(parsed.metrics.maePctPoint, 2.05);
    assert.equal(parsed.baselineMetrics.r2, 0.9764);
    assert.equal(parsed.liveMetrics?.r2, 0.97);
    assert.equal(parsed.guardrail.passed, true);

    assert.throws(
      () => parseMlRetrainResponse({ status: 'nope' }),
      (error: unknown) => error instanceof AdminMlContinualError && error.code === 'ML_RETRAIN_REJECTED',
    );
    assert.throws(
      () => parseMlRetrainResponse(null),
      (error: unknown) => error instanceof AdminMlContinualError && error.code === 'ML_RETRAIN_REJECTED',
    );
  });

  it('round-trips a realistic MlRetrainResponse payload', () => {
    const response: MlRetrainResponse = parseMlRetrainResponse(successRetrainResponse());
    assert.equal(response.liveRowsSkippedInvalid, 2);
    assert.equal(response.baseRows, 41088);
    assert.equal(response.durationSeconds, 12.5);
  });
});
