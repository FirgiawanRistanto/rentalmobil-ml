import type { DynamicPricingV4ModelPayload } from '../domain/pricing';

export const ML_MODEL_VERSION = 'rf_adjustment_v4_final';
export const ML_TARGET_NAME = 'price_adjustment_pct';
export const ML_FEATURE_CONTRACT_VERSION = 'v4';
export const DEFAULT_ML_TIMEOUT_MS = 10_000;

export type MlPricingClientErrorCode =
  | 'ML_SERVICE_UNAVAILABLE'
  | 'ML_MODEL_NOT_READY'
  | 'ML_CONTRACT_MISMATCH';

export class MlPricingClientError extends Error {
  constructor(
    public readonly code: MlPricingClientErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MlPricingClientError';
  }
}

export interface MlPricingPredictionInput {
  modelPayload: DynamicPricingV4ModelPayload;
  basePricePerDay: number;
}

export interface MlPricingRequestBody {
  vehicle_category: DynamicPricingV4ModelPayload['vehicle_category'];
  trip_type: DynamicPricingV4ModelPayload['trip_type'];
  duration_days: number;
  is_weekend: 0 | 1;
  is_holiday: 0 | 1;
  is_peak_season: 0 | 1;
  utilization_rate: number;
  booking_lead_days: number;
  base_price_idr_per_day: number;
}

export interface MlPricingPrediction {
  modelVersion: string;
  targetName: string;
  featureContractVersion: string;
  predictedPriceAdjustmentPct: number;
  predictedPriceAdjustmentPercentDisplay: number;
  basePriceIdrPerDay: number;
  dynamicPriceRawPerDay: number;
  dynamicPriceDisplayPerDay: number;
  durationDays: number;
  totalInvoiceDisplay: number;
}

export interface MlPricingClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

function toBinaryFlag(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

export function buildMlPricingRequestBody(input: MlPricingPredictionInput): MlPricingRequestBody {
  return {
    vehicle_category: input.modelPayload.vehicle_category,
    trip_type: input.modelPayload.trip_type,
    duration_days: input.modelPayload.duration_days,
    is_weekend: toBinaryFlag(input.modelPayload.is_weekend),
    is_holiday: toBinaryFlag(input.modelPayload.is_holiday),
    is_peak_season: toBinaryFlag(input.modelPayload.is_peak_season),
    utilization_rate: input.modelPayload.utilization_rate,
    booking_lead_days: input.modelPayload.booking_lead_days,
    base_price_idr_per_day: input.basePricePerDay,
  };
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new MlPricingClientError('ML_CONTRACT_MISMATCH', `Response ML tidak memiliki field ${key} yang valid.`);
  }

  return value;
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MlPricingClientError('ML_CONTRACT_MISMATCH', `Response ML tidak memiliki field ${key} yang valid.`);
  }

  return value;
}

function requiredInteger(record: Record<string, unknown>, key: string): number {
  const value = requiredNumber(record, key);

  if (!Number.isInteger(value)) {
    throw new MlPricingClientError('ML_CONTRACT_MISMATCH', `Response ML field ${key} harus integer.`);
  }

  return value;
}

function assertContract(value: string, expected: string, key: string): void {
  if (value !== expected) {
    throw new MlPricingClientError(
      'ML_CONTRACT_MISMATCH',
      `Kontrak ML tidak sesuai: ${key} harus ${expected}.`,
    );
  }
}

function assertSafeResponseObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MlPricingClientError('ML_CONTRACT_MISMATCH', 'Response ML harus berupa object JSON.');
  }
}

export function parseMlPricingResponse(value: unknown): MlPricingPrediction {
  assertSafeResponseObject(value);

  const modelVersion = requiredString(value, 'model_version');
  const targetName = requiredString(value, 'target_name');
  const featureContractVersion = requiredString(value, 'feature_contract_version');

  assertContract(modelVersion, ML_MODEL_VERSION, 'model_version');
  assertContract(targetName, ML_TARGET_NAME, 'target_name');
  assertContract(featureContractVersion, ML_FEATURE_CONTRACT_VERSION, 'feature_contract_version');

  return {
    modelVersion,
    targetName,
    featureContractVersion,
    predictedPriceAdjustmentPct: requiredNumber(value, 'predicted_price_adjustment_pct'),
    predictedPriceAdjustmentPercentDisplay: requiredNumber(value, 'predicted_price_adjustment_percent_display'),
    basePriceIdrPerDay: requiredInteger(value, 'base_price_idr_per_day'),
    dynamicPriceRawPerDay: requiredInteger(value, 'dynamic_price_raw_per_day'),
    dynamicPriceDisplayPerDay: requiredInteger(value, 'dynamic_price_display_per_day'),
    durationDays: requiredInteger(value, 'duration_days'),
    totalInvoiceDisplay: requiredInteger(value, 'total_invoice_display'),
  };
}

function buildPredictionUrl(baseUrl: string): URL {
  return new URL('/v1/predict-price', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
}

async function parseErrorBody(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body === 'object' && 'detail' in body) {
      return String((body as { detail: unknown }).detail);
    }
  } catch {
    // Keep client-facing errors generic; FastAPI details are not required here.
  }

  return response.statusText || `HTTP ${response.status}`;
}

export async function requestMlPricePrediction(
  input: MlPricingPredictionInput,
  options: MlPricingClientOptions = {},
): Promise<MlPricingPrediction> {
  const baseUrl = options.baseUrl ?? process.env.ML_SERVICE_BASE_URL;

  if (!baseUrl) {
    throw new MlPricingClientError(
      'ML_SERVICE_UNAVAILABLE',
      'ML_SERVICE_BASE_URL belum dikonfigurasi pada server.',
    );
  }

  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_ML_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestBody = buildMlPricingRequestBody(input);
    const response = await fetchFn(buildPredictionUrl(baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (response.status === 503) {
      throw new MlPricingClientError('ML_MODEL_NOT_READY', 'Model ML v4 belum siap digunakan.');
    }

    if (response.status === 422) {
      throw new MlPricingClientError(
        'ML_CONTRACT_MISMATCH',
        `FastAPI menolak payload pricing v4: ${await parseErrorBody(response)}`,
      );
    }

    if (!response.ok) {
      throw new MlPricingClientError('ML_SERVICE_UNAVAILABLE', 'ML service gagal memproses request pricing.');
    }

    const prediction = parseMlPricingResponse(await response.json());

    if (
      prediction.basePriceIdrPerDay !== input.basePricePerDay ||
      prediction.durationDays !== input.modelPayload.duration_days
    ) {
      throw new MlPricingClientError('ML_CONTRACT_MISMATCH', 'Response ML tidak sesuai dengan request pricing.');
    }

    return prediction;
  } catch (error) {
    if (error instanceof MlPricingClientError) {
      throw error;
    }

    throw new MlPricingClientError('ML_SERVICE_UNAVAILABLE', 'ML service tidak tersedia atau timeout.');
  } finally {
    clearTimeout(timeout);
  }
}
