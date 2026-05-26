import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PricingDomainError, type PricingContext } from '../domain/pricing';
import { MlPricingClientError, type MlPricingPrediction } from './mlPricingClient';
import {
  createPricingQuote,
  PRICING_QUOTE_EXPIRY_MINUTES,
  PricingQuoteError,
  type PricingQuoteInsertRecord,
  type PricingQuoteRepository,
} from './pricingQuoteService';

const createdAt = new Date('2026-06-10T10:00:00.000Z');

const context: PricingContext = {
  carId: 'car-suv-1',
  vehicleCategory: 'SUV',
  modelVehicleCategory: 'suv',
  basePricePerDay: 800000,
  pickupDate: new Date(2026, 5, 15),
  returnDate: new Date(2026, 5, 18),
  durationDays: 3,
  tripType: 'LUAR_KOTA',
  selectedCarActiveUnits: 2,
  selectedCarAvailableUnits: 1,
  isSelectedCarAvailable: true,
  categoryActiveUnits: 5,
  categoryAvailableUnits: 1,
  availabilityRatio: 0.2,
  utilizationRate: 0.8,
  demandLevel: 'ramai',
  isWeekend: false,
  isHoliday: false,
  isPeakSeason: true,
  bookingLeadDays: 5,
  modelPayload: {
    vehicle_category: 'suv',
    trip_type: 'luar_kota',
    duration_days: 3,
    is_weekend: false,
    is_holiday: false,
    is_peak_season: true,
    utilization_rate: 0.8,
    booking_lead_days: 5,
  },
  modelFeatures: {
    vehicle_category: 'suv',
    trip_type: 'luar_kota',
    duration_days: 3,
    is_weekend: false,
    is_holiday: false,
    is_peak_season: true,
    utilization_rate: 0.8,
    booking_lead_days: 5,
  },
};

const prediction: MlPricingPrediction = {
  modelVersion: 'rf_adjustment_v4_final',
  targetName: 'price_adjustment_pct',
  featureContractVersion: 'v4',
  predictedPriceAdjustmentPct: 0.34597855347030254,
  predictedPriceAdjustmentPercentDisplay: 34.6,
  basePriceIdrPerDay: 800000,
  dynamicPriceRawPerDay: 1076783,
  dynamicPriceDisplayPerDay: 1077000,
  durationDays: 3,
  totalInvoiceDisplay: 3231000,
};

function createRepository() {
  const inserted: PricingQuoteInsertRecord[] = [];
  const repository: PricingQuoteRepository = {
    async insertQuote(record) {
      inserted.push(record);
      return {
        id: 'quote-1',
        status: record.status,
        expiresAt: record.expiresAt,
        createdAt: record.createdAt,
      };
    },
  };

  return { repository, inserted };
}

function assertQuoteError(error: unknown, code: string): boolean {
  return error instanceof PricingQuoteError && error.code === code;
}

describe('pricingQuoteService', () => {
  it('creates an ACTIVE quote with 15 minute expiry from valid context and ML response', async () => {
    const { repository, inserted } = createRepository();
    let mlCalls = 0;

    const quote = await createPricingQuote(
      {
        carId: 'car-suv-1',
        pickupDate: '2026-06-15',
        durationDays: 3,
        tripType: 'LUAR_KOTA',
        referenceDate: createdAt,
      },
      {
        buildContext: async () => context,
        requestPrediction: async () => {
          mlCalls += 1;
          return prediction;
        },
        repository,
        now: () => createdAt,
      },
    );

    assert.equal(mlCalls, 1);
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].status, 'ACTIVE');
    assert.equal(inserted[0].userId, null);
    assert.equal(inserted[0].expiresAt.toISOString(), '2026-06-10T10:15:00.000Z');
    assert.equal(
      inserted[0].expiresAt.getTime() - inserted[0].createdAt.getTime(),
      PRICING_QUOTE_EXPIRY_MINUTES * 60 * 1000,
    );
    assert.equal(inserted[0].predictedPriceAdjustmentPct, '0.345979');
    assert.equal(inserted[0].availabilityRatio, '0.2000');
    assert.equal(inserted[0].utilizationRate, '0.8000');
    assert.equal(inserted[0].carId, 'car-suv-1');
    assert.equal(inserted[0].pickupDate, context.pickupDate);
    assert.equal(inserted[0].returnDate, context.returnDate);
    assert.equal(inserted[0].durationDays, 3);
    assert.equal(inserted[0].tripType, 'LUAR_KOTA');
    assert.equal(inserted[0].basePricePerDay, 800000);
    assert.equal(inserted[0].categoryActiveUnits, 5);
    assert.equal(inserted[0].categoryAvailableUnits, 1);
    assert.equal(inserted[0].demandLevel, 'ramai');
    assert.equal(inserted[0].isWeekend, false);
    assert.equal(inserted[0].isHoliday, false);
    assert.equal(inserted[0].isPeakSeason, true);
    assert.equal(inserted[0].bookingLeadDays, 5);
    assert.equal(inserted[0].dynamicPriceRawPerDay, 1076783);
    assert.equal(inserted[0].dynamicPriceDisplayPerDay, 1077000);
    assert.equal(inserted[0].totalInvoiceDisplay, 3231000);
    assert.equal(inserted[0].modelVersion, 'rf_adjustment_v4_final');
    assert.equal(quote.quoteId, 'quote-1');
    assert.equal(quote.quoteStatus, 'ACTIVE');
    assert.equal(quote.expiresAt, '2026-06-10T10:15:00.000Z');
    assert.deepEqual(quote.car, {
      id: 'car-suv-1',
      category: 'SUV',
      basePricePerDay: 800000,
    });
    assert.deepEqual(quote.rental, {
      pickupDate: '2026-06-15',
      returnDate: '2026-06-18',
      durationDays: 3,
      tripType: 'LUAR_KOTA',
    });
    assert.deepEqual(quote.pricingContext, {
      availabilityRatio: 0.2,
      utilizationRate: 0.8,
      demandLevel: 'ramai',
      isWeekend: 0,
      isHoliday: 0,
      isPeakSeason: 1,
      bookingLeadDays: 5,
    });
    assert.equal(quote.pricing.modelVersion, 'rf_adjustment_v4_final');
    assert.equal(quote.pricing.predictedPriceAdjustmentPct, 0.34597855347030254);
    assert.equal(quote.pricing.predictedPriceAdjustmentPercentDisplay, 34.6);
    assert.equal(quote.pricing.dynamicPriceRawPerDay, 1076783);
    assert.equal(quote.pricing.dynamicPriceDisplayPerDay, 1077000);
    assert.equal(quote.pricing.totalInvoiceDisplay, 3231000);
  });

  it('does not call ML or persist a quote when the selected car is unavailable', async () => {
    const { repository, inserted } = createRepository();
    let mlCalls = 0;

    await assert.rejects(
      () => createPricingQuote(
        {
          carId: 'car-suv-1',
          pickupDate: '2026-06-15',
          durationDays: 3,
          tripType: 'LUAR_KOTA',
        },
        {
          buildContext: async () => ({
            ...context,
            selectedCarAvailableUnits: 0,
            isSelectedCarAvailable: false,
          }),
          requestPrediction: async () => {
            mlCalls += 1;
            return prediction;
          },
          repository,
          now: () => createdAt,
        },
      ),
      (error) => assertQuoteError(error, 'SELECTED_CAR_UNAVAILABLE'),
    );

    assert.equal(mlCalls, 0);
    assert.equal(inserted.length, 0);
  });

  it('propagates context domain errors without creating a quote', async () => {
    const { repository, inserted } = createRepository();

    await assert.rejects(
      () => createPricingQuote(
        {
          carId: 'car-suv-1',
          pickupDate: '2026-06-15',
          durationDays: 3,
          tripType: 'LUAR_KOTA',
        },
        {
          buildContext: async () => {
            throw new PricingDomainError(
              'UNALLOCATED_BLOCKING_BOOKING_FOUND',
              'Booking aktif belum dialokasikan ke unit kendaraan.',
            );
          },
          requestPrediction: async () => prediction,
          repository,
          now: () => createdAt,
        },
      ),
      (error) => assertQuoteError(error, 'UNALLOCATED_BLOCKING_BOOKING_FOUND'),
    );

    assert.equal(inserted.length, 0);
  });

  it('does not persist a quote when ML is unavailable', async () => {
    const { repository, inserted } = createRepository();

    await assert.rejects(
      () => createPricingQuote(
        {
          carId: 'car-suv-1',
          pickupDate: '2026-06-15',
          durationDays: 3,
          tripType: 'LUAR_KOTA',
        },
        {
          buildContext: async () => context,
          requestPrediction: async () => {
            throw new MlPricingClientError('ML_SERVICE_UNAVAILABLE', 'ML service tidak tersedia.');
          },
          repository,
          now: () => createdAt,
        },
      ),
      (error) => error instanceof MlPricingClientError && error.code === 'ML_SERVICE_UNAVAILABLE',
    );

    assert.equal(inserted.length, 0);
  });

  it('builds pricing reasons from real context rather than model attribution claims', async () => {
    const { repository, inserted } = createRepository();

    const quote = await createPricingQuote(
      {
        carId: 'car-suv-1',
        pickupDate: '2026-06-15',
        durationDays: 7,
        tripType: 'LUAR_KOTA',
      },
      {
        buildContext: async () => ({
          ...context,
          durationDays: 7,
          isWeekend: true,
          isHoliday: true,
        }),
        requestPrediction: async () => ({
          ...prediction,
          durationDays: 7,
          totalInvoiceDisplay: 7539000,
        }),
        repository,
        now: () => createdAt,
      },
    );

    assert.deepEqual(quote.pricingReasons, [
      'Tingkat penggunaan armada pada kategori ini sedang tinggi.',
      'Perjalanan luar kota termasuk dalam faktor perhitungan harga.',
      'Tanggal mulai sewa berada pada akhir pekan.',
      'Tanggal mulai sewa berada pada hari libur.',
      'Periode sewa termasuk musim ramai.',
      'Durasi sewa panjang turut dipertimbangkan dalam rekomendasi harga.',
    ]);
    assert.deepEqual(inserted[0].pricingReasons, quote.pricingReasons);
  });

  it('keeps sepi demand reason even when the model adjustment is positive from other factors', async () => {
    const { repository } = createRepository();

    const quote = await createPricingQuote(
      {
        carId: 'car-suv-1',
        pickupDate: '2026-06-15',
        durationDays: 3,
        tripType: 'LUAR_KOTA',
      },
      {
        buildContext: async () => ({
          ...context,
          categoryAvailableUnits: 5,
          availabilityRatio: 1,
          utilizationRate: 0,
          demandLevel: 'sepi',
        }),
        requestPrediction: async () => ({
          ...prediction,
          predictedPriceAdjustmentPct: 0.02756952077524387,
          predictedPriceAdjustmentPercentDisplay: 2.76,
        }),
        repository,
        now: () => createdAt,
      },
    );

    assert.equal(quote.pricing.predictedPriceAdjustmentPct > 0, true);
    assert.equal(quote.pricingReasons.includes('Ketersediaan armada pada kategori ini masih tinggi.'), true);
    assert.equal(
      quote.pricingReasons.includes('Tingkat penggunaan armada pada kategori ini sedang tinggi.'),
      false,
    );
  });

  it('uses neutral wording when demand is normal', async () => {
    const { repository } = createRepository();

    const quote = await createPricingQuote(
      {
        carId: 'car-suv-1',
        pickupDate: '2026-06-15',
        durationDays: 3,
        tripType: 'DALAM_KOTA',
      },
      {
        buildContext: async () => ({
          ...context,
          tripType: 'DALAM_KOTA',
          availabilityRatio: 0.5,
          utilizationRate: 0.5,
          demandLevel: 'normal',
          isPeakSeason: false,
        }),
        requestPrediction: async () => prediction,
        repository,
        now: () => createdAt,
      },
    );

    assert.deepEqual(quote.pricingReasons, [
      'Tingkat ketersediaan armada pada kategori ini berada pada kondisi normal.',
    ]);
  });

  it('does not make a quote block availability for another quote on the same car and period', async () => {
    const { repository, inserted } = createRepository();
    let contextCalls = 0;

    const dependencies = {
      buildContext: async () => {
        contextCalls += 1;
        return context;
      },
      requestPrediction: async () => prediction,
      repository,
      now: () => createdAt,
    };
    const input = {
      carId: 'car-suv-1',
      pickupDate: '2026-06-15',
      durationDays: 3,
      tripType: 'LUAR_KOTA' as const,
    };

    const firstQuote = await createPricingQuote(input, dependencies);
    const secondQuote = await createPricingQuote(input, dependencies);

    assert.equal(contextCalls, 2);
    assert.equal(inserted.length, 2);
    assert.deepEqual(secondQuote.pricingContext, firstQuote.pricingContext);
    assert.equal(secondQuote.pricingContext.availabilityRatio, 0.2);
    assert.equal(secondQuote.pricingContext.utilizationRate, 0.8);
  });

  it('rejects customer-supplied derived pricing fields', async () => {
    const { repository } = createRepository();

    await assert.rejects(
      () => createPricingQuote(
        {
          carId: 'car-suv-1',
          pickupDate: '2026-06-15',
          durationDays: 3,
          tripType: 'LUAR_KOTA',
          availabilityRatio: 0.1,
        } as never,
        {
          buildContext: async () => context,
          requestPrediction: async () => prediction,
          repository,
          now: () => createdAt,
        },
      ),
      (error) => assertQuoteError(error, 'INVALID_PRICING_QUOTE_REQUEST'),
    );
  });
});
