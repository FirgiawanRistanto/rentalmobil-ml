import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { requestPricingQuote } from './pricingQuoteClient';
import { LEGACY_PRICING_ESTIMATE_ENDPOINT, PRICING_QUOTE_ENDPOINT } from '../lib/pricingQuoteUi';

const quoteResponse = {
  quoteId: 'quote-1',
  quoteStatus: 'ACTIVE',
  expiresAt: '2026-06-10T10:15:00.000Z',
  car: {
    id: 'car-1',
    category: 'SUV',
    basePricePerDay: 1500000,
  },
  rental: {
    pickupDate: '2026-06-15',
    returnDate: '2026-06-18',
    durationDays: 3,
    tripType: 'LUAR_KOTA',
  },
  pricingContext: {
    availabilityRatio: 1,
    utilizationRate: 0,
    demandLevel: 'sepi',
    isWeekend: 0,
    isHoliday: 0,
    isPeakSeason: 1,
    bookingLeadDays: 20,
  },
  pricing: {
    modelVersion: 'rf_adjustment_v4_final',
    predictedPriceAdjustmentPct: 0.02757,
    predictedPriceAdjustmentPercentDisplay: 2.76,
    dynamicPriceRawPerDay: 1541354,
    dynamicPriceDisplayPerDay: 1541000,
    totalInvoiceDisplay: 4623000,
  },
  pricingReasons: [
    'Ketersediaan armada pada kategori ini masih tinggi.',
    'Perjalanan luar kota termasuk dalam faktor perhitungan harga.',
    'Periode sewa termasuk musim ramai.',
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('pricing quote browser client', () => {
  it('posts customer input to /api/pricing/quotes and never to the legacy endpoint', async () => {
    let requestedUrl = '';
    let requestedBody: unknown;

    const quote = await requestPricingQuote(
      {
        carId: 'car-1',
        pickupDate: '2026-06-15',
        durationDays: 3,
        tripType: 'LUAR_KOTA',
      },
      {
        fetchFn: async (input, init) => {
          requestedUrl = String(input);
          requestedBody = JSON.parse(String(init?.body));
          return jsonResponse(quoteResponse);
        },
      },
    );

    assert.equal(requestedUrl, PRICING_QUOTE_ENDPOINT);
    assert.notEqual(requestedUrl, LEGACY_PRICING_ESTIMATE_ENDPOINT);
    assert.deepEqual(requestedBody, {
      carId: 'car-1',
      pickupDate: '2026-06-15',
      durationDays: 3,
      tripType: 'LUAR_KOTA',
    });
    assert.equal(quote.pricing.dynamicPriceDisplayPerDay, 1541000);
    assert.equal(quote.pricing.totalInvoiceDisplay, 4623000);
  });

  it('maps selected car unavailable and ML unavailable errors to safe UI messages', async () => {
    await assert.rejects(
      () =>
        requestPricingQuote(
          {
            carId: 'car-1',
            pickupDate: '2026-06-15',
            durationDays: 3,
            tripType: 'LUAR_KOTA',
          },
          {
            fetchFn: async () =>
              jsonResponse(
                {
                  error: {
                    code: 'SELECTED_CAR_UNAVAILABLE',
                    message: 'internal message',
                  },
                },
                409,
              ),
          },
        ),
      /Mobil ini tidak tersedia pada periode yang dipilih/,
    );

    await assert.rejects(
      () =>
        requestPricingQuote(
          {
            carId: 'car-1',
            pickupDate: '2026-06-15',
            durationDays: 3,
            tripType: 'LUAR_KOTA',
          },
          {
            fetchFn: async () =>
              jsonResponse(
                {
                  error: {
                    code: 'ML_SERVICE_UNAVAILABLE',
                    message: 'internal message',
                  },
                },
                503,
              ),
          },
        ),
      /Sistem rekomendasi harga sedang tidak tersedia/,
    );
  });

  it('rejects invalid response contracts instead of calculating a frontend fallback price', async () => {
    await assert.rejects(
      () =>
        requestPricingQuote(
          {
            carId: 'car-1',
            pickupDate: '2026-06-15',
            durationDays: 3,
            tripType: 'LUAR_KOTA',
          },
          {
            fetchFn: async () =>
              jsonResponse({
                quoteId: 'quote-1',
                pricing: {
                  dynamicPriceDisplayPerDay: 1541000,
                },
              }),
          },
        ),
      /Terjadi kendala saat menghitung harga/,
    );
  });
});
