import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { POST as legacyEstimatePost } from '../app/api/pricing/estimate/route';
import { createPostPricingQuoteHandler } from '../app/api/pricing/quotes/routeHandler';
import { MlPricingClientError } from './mlPricingClient';
import { PricingQuoteError, type CreatePricingQuoteInput, type PricingQuoteResult } from './pricingQuoteService';

const requestPayload = {
  carId: 'car-suv-1',
  pickupDate: '2026-06-15',
  durationDays: 3,
  tripType: 'LUAR_KOTA',
};

const quoteResult: PricingQuoteResult = {
  quoteId: 'quote-1',
  quoteStatus: 'ACTIVE',
  expiresAt: '2026-06-10T10:15:00.000Z',
  car: {
    id: 'car-suv-1',
    category: 'SUV',
    basePricePerDay: 800000,
  },
  rental: {
    pickupDate: '2026-06-15',
    returnDate: '2026-06-18',
    durationDays: 3,
    tripType: 'LUAR_KOTA',
  },
  pricingContext: {
    availabilityRatio: 0.2,
    utilizationRate: 0.8,
    demandLevel: 'ramai',
    isWeekend: 0,
    isHoliday: 0,
    isPeakSeason: 1,
    bookingLeadDays: 5,
  },
  pricing: {
    modelVersion: 'rf_adjustment_v4_final',
    predictedPriceAdjustmentPct: 0.34597855347030254,
    predictedPriceAdjustmentPercentDisplay: 34.6,
    dynamicPriceRawPerDay: 1076783,
    dynamicPriceDisplayPerDay: 1077000,
    totalInvoiceDisplay: 3231000,
  },
  pricingReasons: [
    'Tingkat penggunaan armada pada kategori ini sedang tinggi.',
    'Perjalanan luar kota termasuk dalam faktor perhitungan harga.',
    'Periode sewa termasuk musim ramai.',
  ],
};

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/pricing/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('pricing quote route handler', () => {
  it('returns invoice preview from a valid request', async () => {
    let receivedInput: CreatePricingQuoteInput | undefined;
    const handler = createPostPricingQuoteHandler({
      async createPricingQuote(input) {
        receivedInput = input;
        return quoteResult;
      },
    });

    const response = await handler(jsonRequest(requestPayload));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, quoteResult);
    assert.deepEqual(Object.keys(body), [
      'quoteId',
      'quoteStatus',
      'expiresAt',
      'car',
      'rental',
      'pricingContext',
      'pricing',
      'pricingReasons',
    ]);
    assert.equal(body.pricing.dynamicPriceDisplayPerDay % 1000, 0);
    assert.equal(receivedInput?.userId, null);
  });

  it('rejects invalid request JSON through the quote service validator', async () => {
    const handler = createPostPricingQuoteHandler({
      async createPricingQuote() {
        throw new PricingQuoteError('INVALID_PRICING_QUOTE_REQUEST', 'carId wajib diisi.');
      },
    });

    const response = await handler(jsonRequest({}));
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_PRICING_QUOTE_REQUEST');
  });

  it('maps selected car unavailable to HTTP 409', async () => {
    const handler = createPostPricingQuoteHandler({
      async createPricingQuote() {
        throw new PricingQuoteError(
          'SELECTED_CAR_UNAVAILABLE',
          'Mobil yang dipilih tidak tersedia pada periode sewa tersebut.',
        );
      },
    });

    const response = await handler(jsonRequest(requestPayload));
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.error.code, 'SELECTED_CAR_UNAVAILABLE');
  });

  it('maps ML unavailable to HTTP 503', async () => {
    const handler = createPostPricingQuoteHandler({
      async createPricingQuote() {
        throw new MlPricingClientError('ML_SERVICE_UNAVAILABLE', 'ML service tidak tersedia.');
      },
    });

    const response = await handler(jsonRequest(requestPayload));
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'ML_SERVICE_UNAVAILABLE');
  });

  it('returns a controlled deprecation response from legacy /api/pricing/estimate', async () => {
    const response = await legacyEstimatePost(jsonRequest({}));
    const body = await response.json();

    assert.equal(response.status, 410);
    assert.equal(body.error.code, 'LEGACY_PRICING_ESTIMATE_DEPRECATED');
  });
});
