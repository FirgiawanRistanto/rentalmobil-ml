import { sql } from 'drizzle-orm';
import { db } from '../db';
import {
  mapCarCategoryToModelCategory,
  mapTripTypeToModelTripType,
} from '../domain/pricing/modelMappings';
import {
  AdminMlContinualError,
  BASELINE_MODEL_VERSION,
  LIVE_ROW_WEIGHT,
  MAX_LIVE_ROWS_PER_RETRAIN,
  ML_RETRAIN_TIMEOUT_MS,
  RECENT_LIVE_SAMPLE_LIMIT,
  buildLiveModelVersionName,
  isRetrainEligible,
  parseManualTargetPercent,
  type AdminMlContinualErrorCode,
} from '../lib/adminMlContinualUi';
import {
  ML_RETRAIN_SETTING_KEYS,
  resolveMlRetrainSettings,
  type MlRetrainSettingKey,
} from '../lib/pricingSettingsUi';
import { requestMlModelInfo } from './mlModelClient';

export type { AdminMlContinualErrorCode };

export interface AdminMlContinualUser {
  id: string;
  role?: string | null;
}

export interface ContinualMetrics {
  maePctPoint: number;
  rmsePctPoint: number | null;
  r2: number;
}

export interface ContinualModelVersion {
  id: string;
  version: string;
  artifactPath: string;
  isActive: boolean;
  isBaseline: boolean;
  trainedAt: string | null;
  createdAt: string;
  metrics: ContinualMetrics | null;
  liveRows: number | null;
}

export interface ContinualLiveSample {
  quoteId: string;
  carCategory: string;
  modelCategory: string | null;
  tripType: string;
  modelTripType: string | null;
  durationDays: number;
  isWeekend: boolean;
  isHoliday: boolean;
  isPeakSeason: boolean;
  utilizationRate: number;
  bookingLeadDays: number;
  predictedAdjustmentFraction: number;
  modelVersion: string;
  status: string;
  createdAt: string;
  manualTargetFraction: number | null;
}

export interface AdminMlContinualStatus {
  totalLiveSamples: number;
  samplesSinceLastRetrain: number;
  minSamplesRequired: number;
  eligible: boolean;
  serviceReachable: boolean;
  loadedVersion: string | null;
  activeVersion: string | null;
  versionsInSync: boolean;
  baselineVersion: string;
  baselineMetrics: ContinualMetrics | null;
  activeMetrics: ContinualMetrics | null;
  lastRetrainAt: string | null;
  versions: ContinualModelVersion[];
  recentSamples: ContinualLiveSample[];
}

export interface RetrainGuardrailResult {
  passed: boolean;
  maxMaeRegressionRatio: number;
  minR2Drop: number;
  reasons: string[];
}

export interface AdminMlRetrainReport {
  versionId: string;
  version: string;
  metrics: ContinualMetrics;
  baselineMetrics: ContinualMetrics;
  guardrail: RetrainGuardrailResult;
  liveRowsUsed: number;
  liveRowsLabeledRule: number;
  liveRowsLabeledManual: number;
  trainRows: number;
  testRows: number;
  durationSeconds: number;
}

export interface MlLiveTrainingRow {
  quote_id: string;
  vehicle_category: string;
  trip_type: string;
  duration_days: number;
  is_weekend: 0 | 1;
  is_holiday: 0 | 1;
  is_peak_season: 0 | 1;
  utilization_rate: number;
  booking_lead_days: number;
  target_price_adjustment_pct?: number;
}

export interface MlRetrainPayload {
  version: string;
  live_rows: MlLiveTrainingRow[];
  live_weight: number;
  guardrail: {
    max_mae_regression_ratio: number;
    min_r2_drop: number;
  };
}

export interface MlRetrainResponse {
  status: 'completed' | 'guardrail_failed';
  version: string;
  artifactPath: string | null;
  durationSeconds: number;
  liveRowsReceived: number;
  liveRowsUsed: number;
  liveRowsSkippedInvalid: number;
  liveRowsLabeledRule: number;
  liveRowsLabeledManual: number;
  baseRows: number;
  trainRows: number;
  testRows: number;
  liveHoldoutRows: number;
  baselineMetrics: ContinualMetrics;
  metrics: ContinualMetrics;
  liveMetrics: ContinualMetrics | null;
  guardrail: RetrainGuardrailResult;
}

export interface AdminMlContinualTransport {
  retrain(payload: MlRetrainPayload): Promise<MlRetrainResponse>;
  activate(version: string): Promise<{ modelVersion: string; artifactPath: string }>;
  readLoadedVersion(): Promise<string | null>;
}

export interface RawLiveSample {
  id: string;
  category: string;
  tripType: string;
  durationDays: number | string;
  isWeekend: boolean;
  isHoliday: boolean;
  isPeakSeason: boolean;
  utilizationRate: number | string;
  bookingLeadDays: number | string;
  predictedPriceAdjustmentPct: number | string;
  modelVersion: string;
  status: string;
  createdAt: Date | string;
}

export interface RawModelVersion {
  id: string;
  version: string;
  artifactPath: string;
  metadata: unknown;
  trainedAt: Date | string | null;
  isActive: boolean;
  createdAt: Date | string;
}

export interface AdminMlContinualRepository {
  countLiveSamples(): Promise<number>;
  countLiveSamplesSince(since: Date): Promise<number>;
  readLiveSamples(limit?: number): Promise<RawLiveSample[]>;
  readOverrides(): Promise<Array<{ quoteId: string; target: number }>>;
  readVersions(): Promise<RawModelVersion[]>;
  /** Ambang guardrail & kelayakan retrain dari `pricing_settings` (bisa absen). */
  readMlRetrainSettings(): Promise<Partial<Record<MlRetrainSettingKey, number | null>>>;
  insertVersion(input: {
    version: string;
    artifactPath: string;
    metadata: unknown;
    trainedAt: Date;
  }): Promise<RawModelVersion>;
  activateVersionById(id: string): Promise<void>;
  upsertOverride(input: { quoteId: string; target: number; updatedByUserId: string }): Promise<boolean>;
  deleteOverride(quoteId: string): Promise<boolean>;
}

export interface AdminMlContinualDependencies {
  repository?: AdminMlContinualRepository;
  transport?: AdminMlContinualTransport;
  now?: () => Date;
}

function mapRows<T>(result: { rows?: unknown[] } | unknown[]): T[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as T[];
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function adminMlContinualErrorStatus(error: AdminMlContinualError): number {
  switch (error.code) {
    case 'AUTHENTICATION_REQUIRED':
      return 401;
    case 'ADMIN_AUTHORIZATION_REQUIRED':
      return 403;
    case 'LABEL_QUOTE_NOT_FOUND':
    case 'MODEL_VERSION_NOT_FOUND':
      return 404;
    case 'ML_RETRAIN_GUARDRAIL_FAILED':
      return 422;
    case 'INVALID_LABEL_VALUE':
    case 'ML_DATASET_MISSING':
    case 'ML_RETRAIN_NOT_ELIGIBLE':
    case 'ML_RETRAIN_REJECTED':
      return 400;
    case 'ML_MODEL_NOT_READY':
    case 'ML_SERVICE_UNAVAILABLE':
    case 'MODEL_ACTIVATION_FAILED':
    case 'ML_RETRAIN_FAILED':
      return 503;
    default:
      return 500;
  }
}

function assertAdminUser(user: AdminMlContinualUser | null | undefined): AdminMlContinualUser {
  if (!user?.id) {
    throw new AdminMlContinualError('AUTHENTICATION_REQUIRED');
  }

  if (user.role !== 'ADMIN') {
    throw new AdminMlContinualError('ADMIN_AUTHORIZATION_REQUIRED');
  }

  return user;
}

function parseVersionMetrics(metadata: unknown): ContinualMetrics | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const record = metadata as Record<string, unknown>;

  const liveMetrics = record.test_adjustment_metrics;
  if (liveMetrics && typeof liveMetrics === 'object') {
    const metrics = liveMetrics as Record<string, unknown>;
    const mae = toFiniteNumber(metrics.mae_percentage_points);
    const r2 = toFiniteNumber(metrics.r2);
    if (mae !== null && r2 !== null) {
      return { maePctPoint: mae, rmsePctPoint: toFiniteNumber(metrics.rmse_percentage_points), r2 };
    }
  }

  const evaluation = record.evaluation;
  if (evaluation && typeof evaluation === 'object') {
    const metrics = evaluation as Record<string, unknown>;
    const mae = toFiniteNumber(metrics.mae_adjustment_percentage_points);
    const r2 = toFiniteNumber(metrics.r2_adjustment);
    if (mae !== null && r2 !== null) {
      return { maePctPoint: mae, rmsePctPoint: toFiniteNumber(metrics.rmse_adjustment_percentage_points), r2 };
    }
  }

  return null;
}

function mapVersionRow(row: RawModelVersion): ContinualModelVersion {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;

  return {
    id: row.id,
    version: row.version,
    artifactPath: row.artifactPath,
    isActive: row.isActive === true,
    isBaseline: row.version === BASELINE_MODEL_VERSION,
    trainedAt: toIso(row.trainedAt),
    createdAt: toIso(row.createdAt) ?? '',
    metrics: parseVersionMetrics(metadata),
    liveRows: toFiniteNumber(metadata.live_rows_used),
  };
}

function mapLiveSample(row: RawLiveSample, overrides: Map<string, number>): ContinualLiveSample {
  let modelCategory: string | null = null;
  let modelTripType: string | null = null;
  try {
    modelCategory = mapCarCategoryToModelCategory(row.category);
  } catch {
    modelCategory = null;
  }
  try {
    modelTripType = mapTripTypeToModelTripType(row.tripType);
  } catch {
    modelTripType = null;
  }

  return {
    quoteId: row.id,
    carCategory: row.category,
    modelCategory,
    tripType: row.tripType,
    modelTripType,
    durationDays: Number(row.durationDays),
    isWeekend: row.isWeekend === true,
    isHoliday: row.isHoliday === true,
    isPeakSeason: row.isPeakSeason === true,
    utilizationRate: Number(row.utilizationRate),
    bookingLeadDays: Number(row.bookingLeadDays),
    predictedAdjustmentFraction: Number(row.predictedPriceAdjustmentPct),
    modelVersion: row.modelVersion,
    status: row.status,
    createdAt: toIso(row.createdAt) ?? '',
    manualTargetFraction: overrides.get(row.id) ?? null,
  };
}

const defaultRepository: AdminMlContinualRepository = {
  async countLiveSamples() {
    const result = await db.execute(sql`
      select count(*)::int as n from pricing_quotes
    `);
    const [row] = mapRows<{ n: number }>(result);
    return Number(row?.n ?? 0);
  },

  async countLiveSamplesSince(since) {
    const result = await db.execute(sql`
      select count(*)::int as n from pricing_quotes
      where "createdAt" >= ${since}
    `);
    const [row] = mapRows<{ n: number }>(result);
    return Number(row?.n ?? 0);
  },

  async readLiveSamples(limit) {
    const result = await db.execute(sql`
      select
        pq.id,
        c.category,
        pq."tripType",
        pq."durationDays",
        pq."isWeekend",
        pq."isHoliday",
        pq."isPeakSeason",
        pq."utilizationRate",
        pq."bookingLeadDays",
        pq."predictedPriceAdjustmentPct",
        pq."modelVersion",
        pq."status",
        pq."createdAt"
      from pricing_quotes pq
      join cars c on c.id = pq."carId"
      order by pq."createdAt" desc
      ${limit ? sql`limit ${limit}` : sql``}
    `);
    return mapRows<RawLiveSample>(result);
  },

  async readOverrides() {
    const result = await db.execute(sql`
      select "quoteId", "targetAdjustmentPct" from ml_sample_overrides
    `);
    return mapRows<{ quoteId: string; targetAdjustmentPct: number | string }>(result).map((row) => ({
      quoteId: row.quoteId,
      target: Number(row.targetAdjustmentPct),
    }));
  },

  async readVersions() {
    const result = await db.execute(sql`
      select id, version, "artifactPath", metadata, "trainedAt", "isActive", "createdAt"
      from pricing_model_versions
      order by "createdAt" desc
    `);
    return mapRows<RawModelVersion>(result);
  },

  async readMlRetrainSettings() {
    const keys = ML_RETRAIN_SETTING_KEYS;
    const result = await db.execute(sql`
      select "key", "value" from pricing_settings
      where "key" in (${keys.maxMaeRegressionPct}, ${keys.minR2DropPp}, ${keys.minLiveSamples})
    `);
    const byKey = new Map(
      mapRows<{ key: string; value: unknown }>(result).map((row) => [row.key, toFiniteNumber(row.value)]),
    );
    return {
      maxMaeRegressionPct: byKey.get(keys.maxMaeRegressionPct) ?? null,
      minR2DropPp: byKey.get(keys.minR2DropPp) ?? null,
      minLiveSamples: byKey.get(keys.minLiveSamples) ?? null,
    };
  },

  async insertVersion({ version, artifactPath, metadata, trainedAt }) {
    const result = await db.execute(sql`
      insert into pricing_model_versions
        (version, "targetName", "artifactPath", metadata, "trainedAt", "isActive")
      values (
        ${version},
        'price_adjustment_pct',
        ${artifactPath},
        ${JSON.stringify(metadata ?? {})}::jsonb,
        ${trainedAt},
        false
      )
      on conflict (version) do update set
        "artifactPath" = excluded."artifactPath",
        metadata = excluded.metadata,
        "trainedAt" = excluded."trainedAt",
        "updatedAt" = now()
      returning id, version, "artifactPath", metadata, "trainedAt", "isActive", "createdAt"
    `);
    const [row] = mapRows<RawModelVersion>(result);
    if (!row) {
      throw new AdminMlContinualError('ML_RETRAIN_FAILED', 'Versi model hasil retrain gagal disimpan.');
    }
    return row;
  },

  async activateVersionById(id) {
    // Satu statement atomik: versi lain dinonaktifkan, versi target diaktifkan.
    // Bila id tidak ada, tidak ada baris yang berubah.
    await db.execute(sql`
      update pricing_model_versions
      set "isActive" = (id = ${id}::uuid), "updatedAt" = now()
      where ("isActive" = true or id = ${id}::uuid)
        and exists (select 1 from pricing_model_versions v where v.id = ${id}::uuid)
    `);
  },

  async upsertOverride({ quoteId, target, updatedByUserId }) {
    try {
      const inserted = await db.execute(sql`
        insert into ml_sample_overrides ("quoteId", "targetAdjustmentPct", "updatedByUserId", "createdAt", "updatedAt")
        values (${quoteId}::uuid, ${target}, ${updatedByUserId}::uuid, now(), now())
        on conflict ("quoteId") do update set
          "targetAdjustmentPct" = excluded."targetAdjustmentPct",
          "updatedByUserId" = excluded."updatedByUserId",
          "updatedAt" = now()
        returning "quoteId"
      `);
      return mapRows(inserted).length > 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('ml_sample_overrides_quoteId') || message.includes('violates foreign key')) {
        return false;
      }
      if (message.includes('invalid input syntax for type uuid')) {
        return false;
      }
      throw error;
    }
  },

  async deleteOverride(quoteId) {
    try {
      const deleted = await db.execute(sql`
        delete from ml_sample_overrides where "quoteId" = ${quoteId}::uuid
        returning "quoteId"
      `);
      return mapRows(deleted).length > 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('invalid input syntax for type uuid')) {
        return false;
      }
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Transport ke FastAPI ml-service (timeout retrain sengaja panjang)
// ---------------------------------------------------------------------------

function mlServiceBaseUrl(): string {
  const baseUrl = process.env.ML_SERVICE_BASE_URL;
  if (!baseUrl) {
    throw new AdminMlContinualError(
      'ML_SERVICE_UNAVAILABLE',
      'ML_SERVICE_BASE_URL belum dikonfigurasi pada server.',
    );
  }
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function retrainErrorForStatus(status: number, detail: string): AdminMlContinualError {
  if (status === 404) return new AdminMlContinualError('MODEL_VERSION_NOT_FOUND', detail);
  if (status === 409) return new AdminMlContinualError('ML_DATASET_MISSING', detail);
  if (status === 400 || status === 422) return new AdminMlContinualError('ML_RETRAIN_REJECTED', detail);
  return new AdminMlContinualError('ML_SERVICE_UNAVAILABLE', detail);
}

async function postToMlService<T>(
  pathname: string,
  payload: unknown,
  parse: (value: unknown) => T,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(new URL(pathname, mlServiceBaseUrl()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    if (!response.ok) {
      const detail = typeof body?.detail === 'string' ? body.detail : '';
      throw retrainErrorForStatus(
        response.status,
        detail || `ML service menolak permintaan (HTTP ${response.status}).`,
      );
    }

    return parse(body);
  } catch (error) {
    if (error instanceof AdminMlContinualError) throw error;
    throw new AdminMlContinualError(
      'ML_SERVICE_UNAVAILABLE',
      'ML service tidak tersedia atau timeout saat memproses permintaan.',
    );
  } finally {
    clearTimeout(timer);
  }
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = toFiniteNumber(record[key]);
  if (value === null) {
    throw new AdminMlContinualError('ML_RETRAIN_REJECTED', `Response ML tidak memiliki field ${key} yang valid.`);
  }
  return value;
}

function requiredInteger(record: Record<string, unknown>, key: string): number {
  const value = requiredNumber(record, key);
  if (!Number.isInteger(value)) {
    throw new AdminMlContinualError('ML_RETRAIN_REJECTED', `Response ML field ${key} harus integer.`);
  }
  return value;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AdminMlContinualError('ML_RETRAIN_REJECTED', `Response ML tidak memiliki field ${key} yang valid.`);
  }
  return value;
}

function parseMetrics(value: unknown, field: string): ContinualMetrics {
  if (!value || typeof value !== 'object') {
    throw new AdminMlContinualError('ML_RETRAIN_REJECTED', `Response ML field ${field} tidak valid.`);
  }
  const record = value as Record<string, unknown>;
  const rmse = toFiniteNumber(record.rmse_percentage_points);
  return {
    maePctPoint: requiredNumber(record, 'mae_percentage_points'),
    rmsePctPoint: rmse,
    r2: requiredNumber(record, 'r2'),
  };
}

export function parseMlRetrainResponse(value: unknown): MlRetrainResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AdminMlContinualError('ML_RETRAIN_REJECTED', 'Response retrain harus berupa object JSON.');
  }
  const record = value as Record<string, unknown>;
  const status = record.status;
  if (status !== 'completed' && status !== 'guardrail_failed') {
    throw new AdminMlContinualError('ML_RETRAIN_REJECTED', 'Response retrain memiliki status tidak dikenal.');
  }

  const guardrailRaw = record.guardrail;
  if (!guardrailRaw || typeof guardrailRaw !== 'object') {
    throw new AdminMlContinualError('ML_RETRAIN_REJECTED', 'Response retrain tidak memuat guardrail.');
  }
  const guardrailRecord = guardrailRaw as Record<string, unknown>;
  const reasons = guardrailRecord.reasons;
  if (!Array.isArray(reasons) || !reasons.every((reason) => typeof reason === 'string')) {
    throw new AdminMlContinualError('ML_RETRAIN_REJECTED', 'Response guardrail reasons harus array string.');
  }

  const liveMetrics = record.live_metrics == null ? null : parseMetrics(record.live_metrics, 'live_metrics');

  return {
    status,
    version: requiredString(record, 'version'),
    artifactPath: typeof record.artifact_path === 'string' ? record.artifact_path : null,
    durationSeconds: requiredNumber(record, 'duration_seconds'),
    liveRowsReceived: requiredInteger(record, 'live_rows_received'),
    liveRowsUsed: requiredInteger(record, 'live_rows_used'),
    liveRowsSkippedInvalid: requiredInteger(record, 'live_rows_skipped_invalid'),
    liveRowsLabeledRule: requiredInteger(record, 'live_rows_labeled_rule'),
    liveRowsLabeledManual: requiredInteger(record, 'live_rows_labeled_manual'),
    baseRows: requiredInteger(record, 'base_rows'),
    trainRows: requiredInteger(record, 'train_rows'),
    testRows: requiredInteger(record, 'test_rows'),
    liveHoldoutRows: requiredInteger(record, 'live_holdout_rows'),
    baselineMetrics: parseMetrics(record.baseline_metrics, 'baseline_metrics'),
    metrics: parseMetrics(record.metrics, 'metrics'),
    liveMetrics,
    guardrail: {
      passed: guardrailRecord.passed === true,
      maxMaeRegressionRatio: requiredNumber(guardrailRecord, 'max_mae_regression_ratio'),
      minR2Drop: requiredNumber(guardrailRecord, 'min_r2_drop'),
      reasons: reasons as string[],
    },
  };
}

const defaultTransport: AdminMlContinualTransport = {
  async retrain(payload) {
    return parseMlRetrainResponse(
      await postToMlService('/v1/model/retrain', payload, (body) => body, ML_RETRAIN_TIMEOUT_MS),
    );
  },

  async activate(version) {
    const body = await postToMlService(
      '/v1/model/activate',
      { version },
      (value) => value,
      120_000,
    );
    if (!body || typeof body !== 'object') {
      throw new AdminMlContinualError('MODEL_ACTIVATION_FAILED', 'Response aktivasi model tidak valid.');
    }
    const record = body as Record<string, unknown>;
    const modelVersion = requiredString(record, 'model_version');
    return { modelVersion, artifactPath: requiredString(record, 'artifact_path') };
  },

  async readLoadedVersion() {
    try {
      const info = await requestMlModelInfo({ timeoutMs: 5_000 });
      return info.model_version;
    } catch {
      return null;
    }
  },
};

// ---------------------------------------------------------------------------
// Alur admin: status -> retrain -> aktivasi -> label manual
// ---------------------------------------------------------------------------

function buildLiveTrainingRows(
  rows: RawLiveSample[],
  overrides: Map<string, number>,
): MlLiveTrainingRow[] {
  const trainingRows: MlLiveTrainingRow[] = [];

  for (const row of rows) {
    let vehicleCategory: string;
    let tripType: string;
    try {
      vehicleCategory = mapCarCategoryToModelCategory(row.category);
      tripType = mapTripTypeToModelTripType(row.tripType);
    } catch {
      continue;
    }

    const utilizationRate = Number(row.utilizationRate);
    if (!Number.isFinite(utilizationRate)) continue;

    const target = overrides.get(row.id);
    trainingRows.push({
      quote_id: row.id,
      vehicle_category: vehicleCategory,
      trip_type: tripType,
      duration_days: Number(row.durationDays),
      is_weekend: row.isWeekend ? 1 : 0,
      is_holiday: row.isHoliday ? 1 : 0,
      is_peak_season: row.isPeakSeason ? 1 : 0,
      utilization_rate: Math.round(utilizationRate * 10_000) / 10_000,
      booking_lead_days: Number(row.bookingLeadDays),
      ...(target === undefined ? {} : { target_price_adjustment_pct: target }),
    });
  }

  return trainingRows;
}

function formatMetricsBrief(metrics: ContinualMetrics): string {
  const r2 = metrics.r2.toFixed(4);
  return `MAE ${metrics.maePctPoint.toFixed(3)} poin persentase, R² ${r2}`;
}

export async function readAdminMlContinualStatus(
  user: AdminMlContinualUser | null | undefined,
  dependencies: AdminMlContinualDependencies = {},
): Promise<AdminMlContinualStatus> {
  assertAdminUser(user);
  const repository = dependencies.repository ?? defaultRepository;
  const transport = dependencies.transport ?? defaultTransport;

  const [totalLiveSamples, rawVersions, rawOverrides, rawSamples, loadedVersion, rawMlSettings] =
    await Promise.all([
      repository.countLiveSamples(),
      repository.readVersions(),
      repository.readOverrides(),
      repository.readLiveSamples(RECENT_LIVE_SAMPLE_LIMIT),
      transport.readLoadedVersion().catch(() => null),
      repository.readMlRetrainSettings(),
    ]);

  const mlSettings = resolveMlRetrainSettings(rawMlSettings);
  const overrides = new Map(rawOverrides.map((row) => [row.quoteId, row.target]));
  const versions = rawVersions.map(mapVersionRow);
  const active = versions.find((version) => version.isActive) ?? null;
  const lastRetrained = versions.find((version) => !version.isBaseline && version.trainedAt) ?? null;
  const lastRetrainAt = lastRetrained?.trainedAt ?? null;
  const samplesSinceLastRetrain = lastRetrainAt
    ? await repository.countLiveSamplesSince(new Date(lastRetrainAt))
    : totalLiveSamples;
  const serviceReachable = loadedVersion !== null;

  return {
    totalLiveSamples,
    samplesSinceLastRetrain,
    minSamplesRequired: mlSettings.minLiveSamples,
    eligible: isRetrainEligible(samplesSinceLastRetrain, serviceReachable, mlSettings.minLiveSamples),
    serviceReachable,
    loadedVersion,
    activeVersion: active?.version ?? null,
    versionsInSync: active !== null && active.version === loadedVersion,
    baselineVersion: BASELINE_MODEL_VERSION,
    baselineMetrics: versions.find((version) => version.isBaseline)?.metrics ?? null,
    activeMetrics: active?.metrics ?? null,
    lastRetrainAt,
    versions,
    recentSamples: rawSamples.map((row) => mapLiveSample(row, overrides)),
  };
}

export async function retrainAdminMlModel(
  user: AdminMlContinualUser | null | undefined,
  dependencies: AdminMlContinualDependencies = {},
): Promise<AdminMlRetrainReport> {
  assertAdminUser(user);
  const repository = dependencies.repository ?? defaultRepository;
  const transport = dependencies.transport ?? defaultTransport;
  const now = dependencies.now ? dependencies.now() : new Date();

  const status = await readAdminMlContinualStatus(user, dependencies);
  if (!status.eligible) {
    throw new AdminMlContinualError(
      'ML_RETRAIN_NOT_ELIGIBLE',
      status.serviceReachable
        ? `Sampel live baru sejak retrain terakhir: ${status.samplesSinceLastRetrain} (minimal ${status.minSamplesRequired}).`
        : 'ML service tidak terjangkau, retrain live tidak dapat dijalankan.',
    );
  }

  const rawSamples = await repository.readLiveSamples();
  const rawOverrides = await repository.readOverrides();
  const overrides = new Map(rawOverrides.map((row) => [row.quoteId, row.target]));
  // Baris paling baru di depan (order by createdAt desc) — batasi sesuai
  // kontrak FastAPI agar payload tetap aman.
  const liveRows = buildLiveTrainingRows(rawSamples.slice(0, MAX_LIVE_ROWS_PER_RETRAIN), overrides);

  if (liveRows.length === 0) {
    throw new AdminMlContinualError(
      'ML_RETRAIN_NOT_ELIGIBLE',
      'Belum ada baris live yang layak dilatih (semua kategori mobil belum didukung model v4).',
    );
  }

  const version = buildLiveModelVersionName(now);
  const mlSettings = resolveMlRetrainSettings(await repository.readMlRetrainSettings());
  const response = await transport.retrain({
    version,
    live_rows: liveRows,
    live_weight: LIVE_ROW_WEIGHT,
    guardrail: {
      max_mae_regression_ratio: mlSettings.maxMaeRegressionPct / 100,
      min_r2_drop: mlSettings.minR2DropPp / 100,
    },
  });

  if (response.status !== 'completed' || !response.guardrail.passed) {
    throw new AdminMlContinualError(
      'ML_RETRAIN_GUARDRAIL_FAILED',
      `Guardrail gagal: baru ${formatMetricsBrief(response.metrics)} vs baseline ${formatMetricsBrief(
        response.baselineMetrics,
      )}. ${response.guardrail.reasons.join(' ')}`.trim(),
    );
  }

  const artifactPath = `ml-service/artifacts/versions/${version}/dynamic_pricing_adjustment_rf_pipeline_v4.pkl`;
  const stored = await repository.insertVersion({
    version,
    artifactPath,
    trainedAt: now,
    metadata: {
      source: 'continuous_learning',
      target: 'price_adjustment_pct',
      feature_contract_version: 'v4',
      version,
      test_adjustment_metrics: {
        mae_percentage_points: response.metrics.maePctPoint,
        rmse_percentage_points: response.metrics.rmsePctPoint,
        r2: response.metrics.r2,
      },
      baseline_metrics: response.baselineMetrics,
      guardrail: response.guardrail,
      live_rows_used: response.liveRowsUsed,
      live_rows_labeled_rule: response.liveRowsLabeledRule,
      live_rows_labeled_manual: response.liveRowsLabeledManual,
      base_rows: response.baseRows,
      train_rows: response.trainRows,
      test_rows: response.testRows,
      live_holdout_rows: response.liveHoldoutRows,
      live_metrics: response.liveMetrics,
      live_weight: LIVE_ROW_WEIGHT,
      duration_seconds: response.durationSeconds,
      retrained_at: now.toISOString(),
    },
  });

  return {
    versionId: stored.id,
    version,
    metrics: response.metrics,
    baselineMetrics: response.baselineMetrics,
    guardrail: response.guardrail,
    liveRowsUsed: response.liveRowsUsed,
    liveRowsLabeledRule: response.liveRowsLabeledRule,
    liveRowsLabeledManual: response.liveRowsLabeledManual,
    trainRows: response.trainRows,
    testRows: response.testRows,
    durationSeconds: response.durationSeconds,
  };
}

export async function activateAdminMlModelVersion(
  user: AdminMlContinualUser | null | undefined,
  rawVersionId: unknown,
  dependencies: AdminMlContinualDependencies = {},
): Promise<{ versionId: string; version: string }> {
  assertAdminUser(user);
  const repository = dependencies.repository ?? defaultRepository;
  const transport = dependencies.transport ?? defaultTransport;

  const versionId = typeof rawVersionId === 'string' ? rawVersionId.trim() : '';
  if (!versionId) {
    throw new AdminMlContinualError('MODEL_VERSION_NOT_FOUND', 'Versi model tidak diberikan.');
  }

  const versions = await repository.readVersions();
  const target = versions.find((row) => row.id === versionId);
  if (!target) {
    throw new AdminMlContinualError('MODEL_VERSION_NOT_FOUND', 'Versi model tidak ditemukan di registry.');
  }

  // Swap di ml-service dulu (gagal = model lama tetap), baru tandai di database.
  await transport.activate(target.version);
  await repository.activateVersionById(target.id);

  return { versionId: target.id, version: target.version };
}

export async function setLiveSampleLabel(
  user: AdminMlContinualUser | null | undefined,
  rawQuoteId: unknown,
  rawTargetPercent: unknown,
  dependencies: AdminMlContinualDependencies = {},
): Promise<{ quoteId: string; target: number }> {
  const actor = assertAdminUser(user);
  const repository = dependencies.repository ?? defaultRepository;

  const quoteId = typeof rawQuoteId === 'string' ? rawQuoteId.trim() : '';
  if (!quoteId) {
    throw new AdminMlContinualError('LABEL_QUOTE_NOT_FOUND', 'ID pricing quote tidak diberikan.');
  }

  const target = parseManualTargetPercent(rawTargetPercent);
  const stored = await repository.upsertOverride({ quoteId, target, updatedByUserId: actor.id });
  if (!stored) {
    throw new AdminMlContinualError('LABEL_QUOTE_NOT_FOUND');
  }

  return { quoteId, target };
}

export async function clearLiveSampleLabel(
  user: AdminMlContinualUser | null | undefined,
  rawQuoteId: unknown,
  dependencies: AdminMlContinualDependencies = {},
): Promise<{ quoteId: string }> {
  assertAdminUser(user);
  const repository = dependencies.repository ?? defaultRepository;

  const quoteId = typeof rawQuoteId === 'string' ? rawQuoteId.trim() : '';
  if (!quoteId) {
    throw new AdminMlContinualError('LABEL_QUOTE_NOT_FOUND', 'ID pricing quote tidak diberikan.');
  }

  const cleared = await repository.deleteOverride(quoteId);
  if (!cleared) {
    throw new AdminMlContinualError('LABEL_QUOTE_NOT_FOUND');
  }

  return { quoteId };
}
