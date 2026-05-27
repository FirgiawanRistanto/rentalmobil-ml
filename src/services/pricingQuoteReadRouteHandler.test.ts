import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGetPricingQuoteForBookingHandler } from '../app/api/pricing/quotes/[quoteId]/routeHandler';
import { PricingQuoteReadError } from './pricingQuoteReadService';

const quoteId = '11111111-1111-4111-8111-111111111111';
const user = { id: '22222222-2222-4222-8222-222222222222' };

function request() {
  return new Request(`http://localhost/api/pricing/quotes/${quoteId}`);
}

describe('pricing quote read route handler', () => {
  it('returns a quote for authenticated confirmation without touching ML or quote status', async () => {
    let receivedUserId: string | undefined;
    let receivedQuoteId: string | undefined;
    const handler = createGetPricingQuoteForBookingHandler({
      getCurrentUser: async () => user,
      service: {
        async readPricingQuoteForBooking(input) {
          receivedUserId = input.user?.id;
          receivedQuoteId = input.quoteId;
          return {
            quoteId: input.quoteId,
            quoteStatus: 'ACTIVE',
            canSubmit: true,
            expiresAt: '2026-06-10T10:15:00.000Z',
            car: {
              id: 'car-1',
              name: 'Toyota Fortuner',
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
            pricingReasons: ['Ketersediaan armada pada kategori ini masih tinggi.'],
          };
        },
      },
    });

    const response = await handler(request(), { params: { quoteId } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.quoteStatus, 'ACTIVE');
    assert.equal(receivedQuoteId, quoteId);
    assert.equal(receivedUserId, user.id);
  });

  it('maps anonymous, ownership, and missing quote errors safely', async () => {
    const cases = [
      {
        error: new PricingQuoteReadError('AUTHENTICATION_REQUIRED', 'login'),
        status: 401,
      },
      {
        error: new PricingQuoteReadError('QUOTE_NOT_OWNED_BY_USER', 'forbidden'),
        status: 403,
      },
      {
        error: new PricingQuoteReadError('QUOTE_NOT_FOUND', 'missing'),
        status: 404,
      },
    ];

    for (const item of cases) {
      const handler = createGetPricingQuoteForBookingHandler({
        getCurrentUser: async () => user,
        service: {
          async readPricingQuoteForBooking() {
            throw item.error;
          },
        },
      });

      const response = await handler(request(), { params: { quoteId } });
      const body = await response.json();

      assert.equal(response.status, item.status);
      assert.equal(body.error.code, item.error.code);
    }
  });
});
