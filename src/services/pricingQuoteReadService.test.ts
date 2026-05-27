import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PricingQuoteReadError,
  readPricingQuoteForBooking,
  type PricingQuoteReadRepository,
} from './pricingQuoteReadService';

const quoteId = '11111111-1111-4111-8111-111111111111';
const user = { id: '22222222-2222-4222-8222-222222222222' };
type QuoteReadRow = NonNullable<Awaited<ReturnType<PricingQuoteReadRepository['findQuoteForBooking']>>>;

function quoteFixture(overrides: Partial<QuoteReadRow> = {}): QuoteReadRow {
  return {
    id: quoteId,
    carId: '33333333-3333-4333-8333-333333333333',
    userId: null,
    pickupDate: new Date('2026-06-15T00:00:00.000Z'),
    returnDate: new Date('2026-06-18T00:00:00.000Z'),
    durationDays: 3,
    tripType: 'LUAR_KOTA' as const,
    basePricePerDay: 1500000,
    availabilityRatio: '1.0000',
    utilizationRate: '0.0000',
    demandLevel: 'sepi' as const,
    isWeekend: false,
    isHoliday: false,
    isPeakSeason: true,
    bookingLeadDays: 20,
    predictedPriceAdjustmentPct: '0.027570',
    dynamicPriceRawPerDay: 1541354,
    dynamicPriceDisplayPerDay: 1541000,
    totalInvoiceDisplay: 4623000,
    pricingReasons: ['Ketersediaan armada pada kategori ini masih tinggi.'],
    modelVersion: 'rf_adjustment_v4_final',
    status: 'ACTIVE' as const,
    expiresAt: new Date('2026-06-10T10:15:00.000Z'),
    carBrand: 'Toyota',
    carModel: 'Fortuner',
    carCategory: 'SUV',
    ...overrides,
  };
}

function repository(row: QuoteReadRow | null): PricingQuoteReadRepository {
  return {
    async findQuoteForBooking() {
      return row;
    },
  };
}

describe('readPricingQuoteForBooking', () => {
  it('returns an ACTIVE public quote for an authenticated user without mutating status or calling ML', async () => {
    const quote = await readPricingQuoteForBooking(
      { quoteId, user },
      {
        repository: repository(quoteFixture()),
        now: () => new Date('2026-06-10T10:00:00.000Z'),
      },
    );

    assert.equal(quote.quoteStatus, 'ACTIVE');
    assert.equal(quote.canSubmit, true);
    assert.equal(quote.car.name, 'Toyota Fortuner');
    assert.equal(quote.pricing.predictedPriceAdjustmentPct, 0.02757);
    assert.ok(Math.abs(quote.pricing.predictedPriceAdjustmentPercentDisplay - 2.757) < 0.000001);
  });

  it('marks an expired ACTIVE quote as not submittable without changing the stored row', async () => {
    const quote = await readPricingQuoteForBooking(
      { quoteId, user },
      {
        repository: repository(quoteFixture()),
        now: () => new Date('2026-06-10T10:16:00.000Z'),
      },
    );

    assert.equal(quote.quoteStatus, 'EXPIRED');
    assert.equal(quote.canSubmit, false);
    assert.equal(quote.unavailableReason, 'QUOTE_EXPIRED');
  });

  it('keeps ACCEPTED quotes visible but not submittable', async () => {
    const quote = await readPricingQuoteForBooking(
      { quoteId, user },
      {
        repository: repository(quoteFixture({ status: 'ACCEPTED' })),
        now: () => new Date('2026-06-10T10:00:00.000Z'),
      },
    );

    assert.equal(quote.quoteStatus, 'ACCEPTED');
    assert.equal(quote.canSubmit, false);
    assert.equal(quote.unavailableReason, 'QUOTE_NOT_ACTIVE');
  });

  it('rejects anonymous users and quotes owned by a different user', async () => {
    await assert.rejects(
      () => readPricingQuoteForBooking({ quoteId, user: null }, { repository: repository(quoteFixture()) }),
      (error) => error instanceof PricingQuoteReadError && error.code === 'AUTHENTICATION_REQUIRED',
    );

    await assert.rejects(
      () =>
        readPricingQuoteForBooking(
          { quoteId, user },
          {
            repository: repository(quoteFixture({ userId: '99999999-9999-4999-8999-999999999999' })),
          },
        ),
      (error) => error instanceof PricingQuoteReadError && error.code === 'QUOTE_NOT_OWNED_BY_USER',
    );
  });
});
