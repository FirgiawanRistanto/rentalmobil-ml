import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMlPricingRequestBody,
  MlPricingClientError,
  requestMlPricePrediction,
  type MlPricingPredictionInput,
} from './mlPricingClient';

const modelPayload: MlPricingPredictionInput['modelPayload'] = {
  vehicle_category: 'suv',
  trip_type: 'luar_kota',
  duration_days: 3,
  is_weekend: true,
  is_holiday: false,
  is_peak_season: true,
  utilization_rate: 0.8,
  booking_lead_days: 7,
};

const input: MlPricingPredictionInput = {
  modelPayload,
  basePricePerDay: 800000,
};

const validMlResponse = {
  model_version: 'rf_adjustment_v4_final',
  target_name: 'price_adjustment_pct',
  feature_contract_version: 'v4',
  predicted_price_adjustment_pct: 0.34597855347030254,
  predicted_price_adjustment_percent_display: 34.6,
  base_price_idr_per_day: 800000,
  dynamic_price_raw_per_day: 1076783,
  dynamic_price_display_per_day: 1077000,
  duration_days: 3,
  total_invoice_display: 3231000,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function assertMlError(error: unknown, code: string): boolean {
  return error instanceof MlPricingClientError && error.code === code;
}

describe('mlPricingClient', () => {
  it('builds the FastAPI request body using only Dynamic Pricing v4 contract fields', () => {
    const body = buildMlPricingRequestBody(input);

    assert.deepEqual(body, {
      vehicle_category: 'suv',
      trip_type: 'luar_kota',
      duration_days: 3,
      is_weekend: 1,
      is_holiday: 0,
      is_peak_season: 1,
      utilization_rate: 0.8,
      booking_lead_days: 7,
      base_price_idr_per_day: 800000,
    });
    assert.equal('availabilityRatio' in body, false);
    assert.equal('availability_ratio' in body, false);
    assert.equal('demandLevel' in body, false);
    assert.equal('demand_level' in body, false);
  });

  it('returns a validated prediction from FastAPI', async () => {
    let receivedBody: unknown;

    const prediction = await requestMlPricePrediction(input, {
      baseUrl: 'http://127.0.0.1:8000',
      fetchFn: async (_url, init) => {
        receivedBody = JSON.parse(String(init?.body));
        return jsonResponse(validMlResponse);
      },
    });

    assert.equal(prediction.modelVersion, 'rf_adjustment_v4_final');
    assert.equal(prediction.targetName, 'price_adjustment_pct');
    assert.equal(prediction.featureContractVersion, 'v4');
    assert.equal(prediction.dynamicPriceDisplayPerDay, 1077000);
    assert.deepEqual(receivedBody, buildMlPricingRequestBody(input));
  });

  it('rejects mismatched model version, target, and feature contract', async () => {
    await assert.rejects(
      () => requestMlPricePrediction(input, {
        baseUrl: 'http://ml.local',
        fetchFn: async () => jsonResponse({ ...validMlResponse, model_version: 'old_model' }),
      }),
      (error) => assertMlError(error, 'ML_CONTRACT_MISMATCH'),
    );

    await assert.rejects(
      () => requestMlPricePrediction(input, {
        baseUrl: 'http://ml.local',
        fetchFn: async () => jsonResponse({ ...validMlResponse, target_name: 'estimated_price' }),
      }),
      (error) => assertMlError(error, 'ML_CONTRACT_MISMATCH'),
    );

    await assert.rejects(
      () => requestMlPricePrediction(input, {
        baseUrl: 'http://ml.local',
        fetchFn: async () => jsonResponse({ ...validMlResponse, feature_contract_version: 'v3' }),
      }),
      (error) => assertMlError(error, 'ML_CONTRACT_MISMATCH'),
    );
  });

  it('handles timeout or unavailable FastAPI as ML_SERVICE_UNAVAILABLE', async () => {
    await assert.rejects(
      () => requestMlPricePrediction(input, {
        baseUrl: 'http://ml.local',
        timeoutMs: 1,
        fetchFn: (_url, init) => new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
      }),
      (error) => assertMlError(error, 'ML_SERVICE_UNAVAILABLE'),
    );
  });

  it('does not synthesize a fallback price when FastAPI is unavailable', async () => {
    await assert.rejects(
      () => requestMlPricePrediction(input, {
        baseUrl: 'http://ml.local',
        fetchFn: async () => {
          throw new Error('connection refused');
        },
      }),
      (error) => assertMlError(error, 'ML_SERVICE_UNAVAILABLE'),
    );
  });

  it('maps FastAPI 503 to ML_MODEL_NOT_READY', async () => {
    await assert.rejects(
      () => requestMlPricePrediction(input, {
        baseUrl: 'http://ml.local',
        fetchFn: async () => jsonResponse({ detail: 'Model artifact is not ready.' }, 503),
      }),
      (error) => assertMlError(error, 'ML_MODEL_NOT_READY'),
    );
  });

  it('rejects invalid FastAPI responses', async () => {
    await assert.rejects(
      () => requestMlPricePrediction(input, {
        baseUrl: 'http://ml.local',
        fetchFn: async () => jsonResponse({ ...validMlResponse, dynamic_price_display_per_day: '1077000' }),
      }),
      (error) => assertMlError(error, 'ML_CONTRACT_MISMATCH'),
    );
  });
});
