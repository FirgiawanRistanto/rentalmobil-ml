import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PricingContext } from '../domain/pricing';
import {
  BookingFromQuoteError,
  createBookingFromQuote,
  doBookingPeriodsOverlapForAllocation,
  isBlockingBookingStatusForAllocation,
  type BookingFromQuoteRepository,
  type BookingFromQuoteTransactionRepository,
  type PricingQuoteForBooking,
} from './bookingFromQuoteService';

const now = new Date('2026-06-10T10:00:00.000Z');

function quoteFixture(overrides: Partial<PricingQuoteForBooking> = {}): PricingQuoteForBooking {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    carId: '22222222-2222-4222-8222-222222222222',
    userId: null,
    pickupDate: new Date(2026, 5, 15),
    returnDate: new Date(2026, 5, 18),
    durationDays: 3,
    tripType: 'LUAR_KOTA',
    basePricePerDay: 1500000,
    categoryActiveUnits: 6,
    categoryAvailableUnits: 6,
    availabilityRatio: '1.0000',
    utilizationRate: '0.0000',
    demandLevel: 'sepi',
    isWeekend: false,
    isHoliday: false,
    isPeakSeason: true,
    bookingLeadDays: 5,
    predictedPriceAdjustmentPct: '0.027570',
    dynamicPriceRawPerDay: 1541354,
    dynamicPriceDisplayPerDay: 1541000,
    totalInvoiceDisplay: 4623000,
    pricingReasons: [
      'Ketersediaan armada pada kategori ini masih tinggi.',
      'Perjalanan luar kota termasuk dalam faktor perhitungan harga.',
      'Periode sewa termasuk musim ramai.',
    ],
    modelVersion: 'rf_adjustment_v4_final',
    status: 'ACTIVE',
    expiresAt: new Date('2026-06-10T10:15:00.000Z'),
    ...overrides,
  };
}

function contextFixture(overrides: Partial<PricingContext> = {}): PricingContext {
  const quote = quoteFixture();
  return {
    carId: quote.carId,
    vehicleCategory: 'SUV',
    modelVehicleCategory: 'suv',
    basePricePerDay: quote.basePricePerDay,
    pickupDate: quote.pickupDate,
    returnDate: quote.returnDate,
    durationDays: quote.durationDays,
    tripType: quote.tripType,
    selectedCarActiveUnits: 2,
    selectedCarAvailableUnits: 2,
    isSelectedCarAvailable: true,
    categoryActiveUnits: quote.categoryActiveUnits,
    categoryAvailableUnits: quote.categoryAvailableUnits,
    availabilityRatio: 1,
    utilizationRate: 0,
    demandLevel: 'sepi',
    isWeekend: false,
    isHoliday: false,
    isPeakSeason: true,
    bookingLeadDays: quote.bookingLeadDays,
    modelPayload: {
      vehicle_category: 'suv',
      trip_type: 'luar_kota',
      duration_days: 3,
      is_weekend: false,
      is_holiday: false,
      is_peak_season: true,
      utilization_rate: 0,
      booking_lead_days: quote.bookingLeadDays,
    },
    modelFeatures: {
      vehicle_category: 'suv',
      trip_type: 'luar_kota',
      duration_days: 3,
      is_weekend: false,
      is_holiday: false,
      is_peak_season: true,
      utilization_rate: 0,
      booking_lead_days: quote.bookingLeadDays,
    },
    ...overrides,
  };
}

function assertBookingError(error: unknown, code: string): boolean {
  return error instanceof BookingFromQuoteError && error.code === code;
}

function createMockRepository(initialQuote = quoteFixture(), options: {
  allocatedUnitId?: string | null;
  failSnapshot?: boolean;
} = {}) {
  const state = {
    quote: { ...initialQuote },
    bookings: [] as unknown[],
    snapshots: [] as unknown[],
    allocatedUnits: [] as string[],
    acceptedQuoteIds: [] as string[],
    invalidatedQuoteIds: [] as string[],
    expiredQuoteIds: [] as string[],
  };
  let bookingSequence = 0;
  const allocatedUnitId = options.allocatedUnitId === undefined
    ? '33333333-3333-4333-8333-333333333333'
    : options.allocatedUnitId;

  const tx: BookingFromQuoteTransactionRepository = {
    async lockQuote(quoteId) {
      return state.quote.id === quoteId ? { ...state.quote } : null;
    },
    async markQuoteExpired(quoteId) {
      state.quote.status = 'EXPIRED';
      state.expiredQuoteIds.push(quoteId);
    },
    async markQuoteInvalidated(quoteId) {
      state.quote.status = 'INVALIDATED';
      state.invalidatedQuoteIds.push(quoteId);
    },
    async acceptQuote(quoteId, userId) {
      state.quote.status = 'ACCEPTED';
      state.quote.userId = userId;
      state.acceptedQuoteIds.push(quoteId);
    },
    async allocateAvailableCarUnit() {
      if (!allocatedUnitId) {
        return null;
      }
      state.allocatedUnits.push(allocatedUnitId);
      return allocatedUnitId;
    },
    async insertBooking(input) {
      bookingSequence += 1;
      const booking = {
        id: `booking-${bookingSequence}`,
        status: 'PENDING' as const,
        ...input,
      };
      state.bookings.push(booking);
      return { id: booking.id, status: booking.status };
    },
    async insertSnapshot(input) {
      if (options.failSnapshot) {
        throw new Error('snapshot failed');
      }
      state.snapshots.push(input);
    },
    createPricingContextRepository() {
      throw new Error('context repository should be injected in unit tests');
    },
  };

  const repository: BookingFromQuoteRepository = {
    async transaction(callback) {
      return callback(tx);
    },
  };

  return { repository, state };
}

describe('createBookingFromQuote', () => {
  it('rejects anonymous requests', async () => {
    const { repository } = createMockRepository();

    await assert.rejects(
      () => createBookingFromQuote({ quoteId: quoteFixture().id }, null, { repository, now: () => now }),
      (error) => assertBookingError(error, 'AUTHENTICATION_REQUIRED'),
    );
  });

  it('accepts a public ACTIVE quote and creates booking, snapshot, and accepted quote', async () => {
    const { repository, state } = createMockRepository();
    let contextCalls = 0;

    const result = await createBookingFromQuote(
      {
        quoteId: quoteFixture().id,
        phoneNumber: '081234567890',
        pickupAddress: 'Bandar Lampung',
        notes: 'Jemput di lobby',
      },
      { id: '44444444-4444-4444-8444-444444444444' },
      {
        repository,
        now: () => now,
        buildContext: async () => {
          contextCalls += 1;
          return contextFixture();
        },
      },
    );

    assert.equal(contextCalls, 1);
    assert.equal(result.status, 'PENDING');
    assert.equal(result.quoteStatus, 'ACCEPTED');
    assert.equal(result.carUnitAllocated, true);
    assert.equal(result.nextStep, 'PAYMENT_PENDING');
    assert.equal(result.pricing.modelVersion, 'rf_adjustment_v4_final');
    assert.equal(result.pricing.predictedPriceAdjustmentPct, 0.02757);
    assert.equal(result.pricing.dynamicPriceDisplayPerDay, 1541000);
    assert.equal(result.pricing.totalInvoiceDisplay, 4623000);
    assert.equal(state.bookings.length, 1);
    assert.equal((state.bookings[0] as { userId: string }).userId, '44444444-4444-4444-8444-444444444444');
    assert.equal((state.bookings[0] as { carUnitId: string }).carUnitId, '33333333-3333-4333-8333-333333333333');
    assert.equal((state.bookings[0] as { pricingQuoteId: string }).pricingQuoteId, quoteFixture().id);
    assert.equal(state.snapshots.length, 1);
    assert.equal(state.quote.status, 'ACCEPTED');
    assert.equal(state.quote.userId, '44444444-4444-4444-8444-444444444444');
  });

  it('rejects a quote owned by another user', async () => {
    const { repository, state } = createMockRepository(quoteFixture({
      userId: '55555555-5555-4555-8555-555555555555',
    }));

    await assert.rejects(
      () =>
        createBookingFromQuote(
          { quoteId: quoteFixture().id },
          { id: '44444444-4444-4444-8444-444444444444' },
          { repository, now: () => now, buildContext: async () => contextFixture() },
        ),
      (error) => assertBookingError(error, 'QUOTE_NOT_OWNED_BY_USER'),
    );

    assert.equal(state.bookings.length, 0);
    assert.equal(state.snapshots.length, 0);
  });

  it('expires an expired quote without creating booking or snapshot', async () => {
    const { repository, state } = createMockRepository(quoteFixture({
      expiresAt: new Date('2026-06-10T09:59:00.000Z'),
    }));

    await assert.rejects(
      () =>
        createBookingFromQuote(
          { quoteId: quoteFixture().id },
          { id: '44444444-4444-4444-8444-444444444444' },
          { repository, now: () => now, buildContext: async () => contextFixture() },
        ),
      (error) => assertBookingError(error, 'QUOTE_EXPIRED'),
    );

    assert.equal(state.quote.status, 'EXPIRED');
    assert.equal(state.bookings.length, 0);
    assert.equal(state.snapshots.length, 0);
  });

  it('rejects ACCEPTED quotes and double-submit attempts', async () => {
    const { repository, state } = createMockRepository();
    const user = { id: '44444444-4444-4444-8444-444444444444' };

    await createBookingFromQuote(
      { quoteId: quoteFixture().id },
      user,
      { repository, now: () => now, buildContext: async () => contextFixture() },
    );

    await assert.rejects(
      () =>
        createBookingFromQuote(
          { quoteId: quoteFixture().id },
          user,
          { repository, now: () => now, buildContext: async () => contextFixture() },
        ),
      (error) => assertBookingError(error, 'QUOTE_NOT_ACTIVE'),
    );

    assert.equal(state.bookings.length, 1);
    assert.equal(state.snapshots.length, 1);
  });

  it('invalidates quote when selected car is no longer available', async () => {
    const { repository, state } = createMockRepository();

    await assert.rejects(
      () =>
        createBookingFromQuote(
          { quoteId: quoteFixture().id },
          { id: '44444444-4444-4444-8444-444444444444' },
          {
            repository,
            now: () => now,
            buildContext: async () => contextFixture({
              selectedCarAvailableUnits: 0,
              isSelectedCarAvailable: false,
            }),
          },
        ),
      (error) => assertBookingError(error, 'SELECTED_CAR_UNAVAILABLE'),
    );

    assert.equal(state.quote.status, 'INVALIDATED');
    assert.equal(state.bookings.length, 0);
    assert.equal(state.snapshots.length, 0);
  });

  it('requires a new quote when context values change and never recalculates ML price', async () => {
    const { repository, state } = createMockRepository();
    let contextCalls = 0;

    await assert.rejects(
      () =>
        createBookingFromQuote(
          { quoteId: quoteFixture().id },
          { id: '44444444-4444-4444-8444-444444444444' },
          {
            repository,
            now: () => now,
            buildContext: async () => {
              contextCalls += 1;
              return contextFixture({
                categoryAvailableUnits: 5,
                availabilityRatio: 0.8333,
                utilizationRate: 0.1667,
              });
            },
          },
        ),
      (error) => assertBookingError(error, 'QUOTE_REPRICE_REQUIRED'),
    );

    assert.equal(contextCalls, 1);
    assert.equal(state.quote.status, 'INVALIDATED');
    assert.equal(state.allocatedUnits.length, 0);
    assert.equal(state.bookings.length, 0);
    assert.equal(state.snapshots.length, 0);
  });

  it('requires a new quote when base price or calendar context changes', async () => {
    for (const changedContext of [
      contextFixture({ basePricePerDay: 1600000 }),
      contextFixture({ isHoliday: true }),
      contextFixture({ bookingLeadDays: 4 }),
    ]) {
      const { repository } = createMockRepository();

      await assert.rejects(
        () =>
          createBookingFromQuote(
            { quoteId: quoteFixture().id },
            { id: '44444444-4444-4444-8444-444444444444' },
            { repository, now: () => now, buildContext: async () => changedContext },
          ),
        (error) => assertBookingError(error, 'QUOTE_REPRICE_REQUIRED'),
      );
    }
  });

  it('rejects when no active unit can be allocated', async () => {
    const { repository, state } = createMockRepository(quoteFixture(), { allocatedUnitId: null });

    await assert.rejects(
      () =>
        createBookingFromQuote(
          { quoteId: quoteFixture().id },
          { id: '44444444-4444-4444-8444-444444444444' },
          { repository, now: () => now, buildContext: async () => contextFixture() },
        ),
      (error) => assertBookingError(error, 'CAR_UNIT_ALLOCATION_FAILED'),
    );

    assert.equal(state.quote.status, 'INVALIDATED');
    assert.equal(state.bookings.length, 0);
    assert.equal(state.snapshots.length, 0);
  });

  it('does not leave accepted quote when snapshot creation fails', async () => {
    const { repository, state } = createMockRepository(quoteFixture(), { failSnapshot: true });

    await assert.rejects(
      () =>
        createBookingFromQuote(
          { quoteId: quoteFixture().id },
          { id: '44444444-4444-4444-8444-444444444444' },
          { repository, now: () => now, buildContext: async () => contextFixture() },
        ),
      (error) => assertBookingError(error, 'BOOKING_CREATION_FAILED'),
    );

    assert.equal(state.acceptedQuoteIds.length, 0);
    assert.equal(state.snapshots.length, 0);
  });

  it('rejects client-supplied carId, price, carUnitId, status, or userId', async () => {
    const { repository } = createMockRepository();

    for (const field of ['carId', 'totalInvoiceDisplay', 'carUnitId', 'status', 'userId']) {
      await assert.rejects(
        () =>
          createBookingFromQuote(
            { quoteId: quoteFixture().id, [field]: 'forbidden' },
            { id: '44444444-4444-4444-8444-444444444444' },
            { repository, now: () => now, buildContext: async () => contextFixture() },
          ),
        (error) => assertBookingError(error, 'INVALID_BOOKING_REQUEST'),
      );
    }
  });
});

describe('booking unit allocation rules', () => {
  it('treats only PENDING and CONFIRMED bookings as blocking allocation statuses', () => {
    assert.equal(isBlockingBookingStatusForAllocation('PENDING'), true);
    assert.equal(isBlockingBookingStatusForAllocation('CONFIRMED'), true);
    assert.equal(isBlockingBookingStatusForAllocation('CANCELLED'), false);
    assert.equal(isBlockingBookingStatusForAllocation('COMPLETED'), false);
  });

  it('uses [pickupDate, returnDate) overlap semantics for allocation recheck', () => {
    const june1 = new Date(2026, 5, 1);
    const june3 = new Date(2026, 5, 3);
    const june4 = new Date(2026, 5, 4);
    const june5 = new Date(2026, 5, 5);
    const june10 = new Date(2026, 5, 10);
    const june12 = new Date(2026, 5, 12);

    assert.equal(doBookingPeriodsOverlapForAllocation(june1, june4, june3, june5), true);
    assert.equal(doBookingPeriodsOverlapForAllocation(june1, june4, june4, june5), false);
    assert.equal(doBookingPeriodsOverlapForAllocation(june10, june12, june4, june10), false);
  });
});
