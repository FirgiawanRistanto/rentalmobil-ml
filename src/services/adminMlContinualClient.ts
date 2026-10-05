import { getAdminMlContinualErrorMessage } from '../lib/adminMlContinualUi';
import type {
  AdminMlContinualStatus,
  AdminMlRetrainReport,
  ContinualLiveSample,
  ContinualMetrics,
  ContinualModelVersion,
  RetrainGuardrailResult,
} from './adminMlContinualService';

export const CONTINUAL_API_PATH = '/api/admin/ml-model/continual';

export class AdminMlContinualClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AdminMlContinualClientError';
  }
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AdminMlContinualClientError('UNKNOWN_ERROR', `${label} tidak berupa object JSON.`);
  }
  return value as Record<string, unknown>;
}

function requiredNumber(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AdminMlContinualClientError('UNKNOWN_ERROR', `${label} field ${key} harus number.`);
  }
  return value;
}

function requiredString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new AdminMlContinualClientError('UNKNOWN_ERROR', `${label} field ${key} harus string.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function requiredBoolean(record: Record<string, unknown>, key: string, label: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new AdminMlContinualClientError('UNKNOWN_ERROR', `${label} field ${key} harus boolean.`);
  }
  return value;
}

function requiredArray(record: Record<string, unknown>, key: string, label: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new AdminMlContinualClientError('UNKNOWN_ERROR', `${label} field ${key} harus array.`);
  }
  return value;
}

function parseMetrics(value: unknown, label: string): ContinualMetrics {
  const record = assertRecord(value, label);
  const rmse = record.rmsePctPoint;
  return {
    maePctPoint: requiredNumber(record, 'maePctPoint', label),
    rmsePctPoint: typeof rmse === 'number' && Number.isFinite(rmse) ? rmse : null,
    r2: requiredNumber(record, 'r2', label),
  };
}

function parseOptionalMetrics(value: unknown, label: string): ContinualMetrics | null {
  return value === null || value === undefined ? null : parseMetrics(value, label);
}

function parseGuardrail(value: unknown, label: string): RetrainGuardrailResult {
  const record = assertRecord(value, label);
  const reasons = requiredArray(record, 'reasons', label);
  if (!reasons.every((reason) => typeof reason === 'string')) {
    throw new AdminMlContinualClientError('UNKNOWN_ERROR', `${label} field reasons harus array string.`);
  }
  return {
    passed: requiredBoolean(record, 'passed', label),
    maxMaeRegressionRatio: requiredNumber(record, 'maxMaeRegressionRatio', label),
    minR2Drop: requiredNumber(record, 'minR2Drop', label),
    reasons: reasons as string[],
  };
}

function parseVersion(value: unknown): ContinualModelVersion {
  const record = assertRecord(value, 'Versi model');
  const trainedAt = optionalString(record, 'trainedAt');
  return {
    id: requiredString(record, 'id', 'Versi model'),
    version: requiredString(record, 'version', 'Versi model'),
    artifactPath: requiredString(record, 'artifactPath', 'Versi model'),
    isActive: requiredBoolean(record, 'isActive', 'Versi model'),
    isBaseline: requiredBoolean(record, 'isBaseline', 'Versi model'),
    trainedAt,
    createdAt: requiredString(record, 'createdAt', 'Versi model'),
    metrics: parseOptionalMetrics(record.metrics, 'Metrik versi'),
    liveRows: typeof record.liveRows === 'number' && Number.isFinite(record.liveRows) ? record.liveRows : null,
  };
}

function parseSample(value: unknown): ContinualLiveSample {
  const record = assertRecord(value, 'Sampel live');
  const manualTarget = record.manualTargetFraction;
  return {
    quoteId: requiredString(record, 'quoteId', 'Sampel live'),
    carCategory: requiredString(record, 'carCategory', 'Sampel live'),
    modelCategory: optionalString(record, 'modelCategory'),
    tripType: requiredString(record, 'tripType', 'Sampel live'),
    modelTripType: optionalString(record, 'modelTripType'),
    durationDays: requiredNumber(record, 'durationDays', 'Sampel live'),
    isWeekend: requiredBoolean(record, 'isWeekend', 'Sampel live'),
    isHoliday: requiredBoolean(record, 'isHoliday', 'Sampel live'),
    isPeakSeason: requiredBoolean(record, 'isPeakSeason', 'Sampel live'),
    utilizationRate: requiredNumber(record, 'utilizationRate', 'Sampel live'),
    bookingLeadDays: requiredNumber(record, 'bookingLeadDays', 'Sampel live'),
    predictedAdjustmentFraction: requiredNumber(record, 'predictedAdjustmentFraction', 'Sampel live'),
    modelVersion: requiredString(record, 'modelVersion', 'Sampel live'),
    status: requiredString(record, 'status', 'Sampel live'),
    createdAt: requiredString(record, 'createdAt', 'Sampel live'),
    manualTargetFraction:
      typeof manualTarget === 'number' && Number.isFinite(manualTarget) ? manualTarget : null,
  };
}

export function parseContinualStatus(value: unknown): AdminMlContinualStatus {
  const record = assertRecord(value, 'Status continual learning');

  return {
    totalLiveSamples: requiredNumber(record, 'totalLiveSamples', 'Status continual learning'),
    samplesSinceLastRetrain: requiredNumber(record, 'samplesSinceLastRetrain', 'Status continual learning'),
    minSamplesRequired: requiredNumber(record, 'minSamplesRequired', 'Status continual learning'),
    eligible: requiredBoolean(record, 'eligible', 'Status continual learning'),
    serviceReachable: requiredBoolean(record, 'serviceReachable', 'Status continual learning'),
    loadedVersion: optionalString(record, 'loadedVersion'),
    activeVersion: optionalString(record, 'activeVersion'),
    versionsInSync: requiredBoolean(record, 'versionsInSync', 'Status continual learning'),
    baselineVersion: requiredString(record, 'baselineVersion', 'Status continual learning'),
    baselineMetrics: parseOptionalMetrics(record.baselineMetrics, 'Metrik baseline'),
    activeMetrics: parseOptionalMetrics(record.activeMetrics, 'Metrik aktif'),
    lastRetrainAt: optionalString(record, 'lastRetrainAt'),
    versions: requiredArray(record, 'versions', 'Status continual learning').map(parseVersion),
    recentSamples: requiredArray(record, 'recentSamples', 'Status continual learning').map(parseSample),
  };
}

export function parseRetrainReport(value: unknown): AdminMlRetrainReport {
  const record = assertRecord(value, 'Laporan retrain');

  return {
    versionId: requiredString(record, 'versionId', 'Laporan retrain'),
    version: requiredString(record, 'version', 'Laporan retrain'),
    metrics: parseMetrics(record.metrics, 'Metrik retrain'),
    baselineMetrics: parseMetrics(record.baselineMetrics, 'Metrik baseline'),
    guardrail: parseGuardrail(record.guardrail, 'Guardrail retrain'),
    liveRowsUsed: requiredNumber(record, 'liveRowsUsed', 'Laporan retrain'),
    liveRowsLabeledRule: requiredNumber(record, 'liveRowsLabeledRule', 'Laporan retrain'),
    liveRowsLabeledManual: requiredNumber(record, 'liveRowsLabeledManual', 'Laporan retrain'),
    trainRows: requiredNumber(record, 'trainRows', 'Laporan retrain'),
    testRows: requiredNumber(record, 'testRows', 'Laporan retrain'),
    durationSeconds: requiredNumber(record, 'durationSeconds', 'Laporan retrain'),
  };
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);

  if (!response.ok) {
    let code: string = 'UNKNOWN_ERROR';
    let message = getAdminMlContinualErrorMessage(code);
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code || code;
      message = body.error?.message || getAdminMlContinualErrorMessage(code);
    } catch {
      // Pertahankan pesan default.
    }
    throw new AdminMlContinualClientError(code, message);
  }

  return response.json();
}

async function postAction(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const body = await requestJson(CONTINUAL_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return assertRecord(body, 'Response API continual learning');
}

export async function readContinualStatusClient(): Promise<AdminMlContinualStatus> {
  const body = await requestJson(CONTINUAL_API_PATH);
  const record = assertRecord(body, 'Response API continual learning');
  return parseContinualStatus(record.status);
}

export async function retrainContinualClient(): Promise<AdminMlRetrainReport> {
  const body = await postAction({ action: 'retrain' });
  return parseRetrainReport(body.report);
}

export async function activateContinualClient(versionId: string): Promise<{ versionId: string; version: string }> {
  const body = await postAction({ action: 'activate', versionId });
  return {
    versionId: requiredString(body, 'versionId', 'Response aktivasi'),
    version: requiredString(body, 'version', 'Response aktivasi'),
  };
}

export async function setLabelContinualClient(
  quoteId: string,
  targetPercent: number,
): Promise<{ quoteId: string; target: number }> {
  const body = await postAction({ action: 'label', quoteId, targetPercent });
  return {
    quoteId: requiredString(body, 'quoteId', 'Response label'),
    target: requiredNumber(body, 'target', 'Response label'),
  };
}

export async function clearLabelContinualClient(quoteId: string): Promise<{ quoteId: string }> {
  const body = await postAction({ action: 'label', quoteId, targetPercent: null });
  return { quoteId: requiredString(body, 'quoteId', 'Response label') };
}
