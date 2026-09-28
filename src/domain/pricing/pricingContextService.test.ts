import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { doRentalPeriodsOverlap, toDateOnlyString } from './dateHelpers';
import { PricingDomainError } from './errors';
import {
  BLOCKING_BOOKING_STATUSES,
  buildPricingContext,
  type BlockingBookingStatus,
  type PricingCarRecord,
  type PricingContextRepository,
} from './pricingContextService';

type UnitStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
type BookingStatus = BlockingBookingStatus | 'CANCELLED' | 'COMPLETED';

interface FakeUnit {
  id: string;
  carId: string;
  status: UnitStatus;
}

interface FakeBooking {
  carId: string;
  carUnitId: string | null;
  status: BookingStatus;
  startDate: Date | string;
  endDate: Date | string;
  reservationExpiresAt?: Date | string | null;
}

interface FakeRepositoryInput {
  cars?: PricingCarRecord[];
  units?: FakeUnit[];
  bookings?: FakeBooking[];
  holidays?: string[];
  onStatuses?: (statuses: readonly BlockingBookingStatus[]) => void;
}

const defaultCars: PricingCarRecord[] = [
  { id: 'suv-a', category: 'SUV', basePricePerDay: 350000 },
  { id: 'suv-b', category: 'SUV', basePricePerDay: 325000 },
];

const defaultUnits: FakeUnit[] = [
  { id: 'unit-a-1', carId: 'suv-a', status: 'ACTIVE' },
  { id: 'unit-a-2', carId: 'suv-a', status: 'ACTIVE' },
  { id: 'unit-b-1', carId: 'suv-b', status: 'ACTIVE' },
  { id: 'unit-b-2', carId: 'suv-b', status: 'ACTIVE' },
  { id: 'unit-b-3', carId: 'suv-b', status: 'ACTIVE' },
];

function createRepository(input: FakeRepositoryInput = {}): PricingContextRepository {
  const cars = input.cars ?? defaultCars;
  const units = input.units ?? defaultUnits;
  const bookings = input.bookings ?? [];
  const holidaySet = new Set(input.holidays ?? []);

  function findCar(carId: string) {
    return cars.find((car) => car.id === carId);
  }

  function findUnit(unitId: string | null) {
    if (!unitId) return undefined;
    return units.find((unit) => unit.id === unitId);
  }

  function isBlockingOverlap(
    booking: FakeBooking,
    pickupDate: Date,
    returnDate: Date,
    statuses: readonly BlockingBookingStatus[],
    referenceDate: Date,
  ) {
    input.onStatuses?.(statuses);
    const pendingReservationActive = booking.status === 'PENDING' && (
      booking.reservationExpiresAt === undefined ||
      booking.reservationExpiresAt === null ||
      new Date(booking.reservationExpiresAt).getTime() > referenceDate.getTime()
    );
    const statusBlocks = (
      (booking.status === 'CONFIRMED' && statuses.includes('CONFIRMED')) ||
      (pendingReservationActive && statuses.includes('PENDING'))
    );

    return (
      statusBlocks &&
      doRentalPeriodsOverlap(booking.startDate, booking.endDate, pickupDate, returnDate)
    );
  }

  return {
    async findCarForPricing(carId) {
      return findCar(carId) ?? null;
    },

    async countActiveUnitsByCategory(category) {
      return units.filter((unit) => findCar(unit.carId)?.category === category && unit.status === 'ACTIVE').length;
    },

    async countActiveUnitsByCarId(carId) {
      return units.filter((unit) => unit.carId === carId && unit.status === 'ACTIVE').length;
    },

    async countBlockedActiveUnitsByCategory(category, pickupDate, returnDate, statuses, referenceDate) {
      const blockedUnitIds = new Set<string>();

      for (const booking of bookings) {
        const unit = findUnit(booking.carUnitId);
        if (
          unit?.status === 'ACTIVE' &&
          findCar(booking.carId)?.category === category &&
          isBlockingOverlap(booking, pickupDate, returnDate, statuses, referenceDate)
        ) {
          blockedUnitIds.add(unit.id);
        }
      }

      return blockedUnitIds.size;
    },

    async countBlockedActiveUnitsByCarId(carId, pickupDate, returnDate, statuses, referenceDate) {
      const blockedUnitIds = new Set<string>();

      for (const booking of bookings) {
        const unit = findUnit(booking.carUnitId);
        if (
          unit?.status === 'ACTIVE' &&
          booking.carId === carId &&
          isBlockingOverlap(booking, pickupDate, returnDate, statuses, referenceDate)
        ) {
          blockedUnitIds.add(unit.id);
        }
      }

      return blockedUnitIds.size;
    },

    async countUnallocatedBlockingBookingsByCategory(category, pickupDate, returnDate, statuses, referenceDate) {
      return bookings.filter((booking) => (
        booking.carUnitId === null &&
        findCar(booking.carId)?.category === category &&
        isBlockingOverlap(booking, pickupDate, returnDate, statuses, referenceDate)
      )).length;
    },

    async isActiveHoliday(pickupDate) {
      return holidaySet.has(toDateOnlyString(pickupDate));
    },
  };
}

describe('buildPricingContext', () => {
  it('builds model payload with mapped vehicle category and trip type', async () => {
    const context = await buildPricingContext(
      {
        carId: 'suv-a',
        pickupDate: '2026-06-13',
        durationDays: 3,
        tripType: 'LUAR_KOTA',
        referenceDate: '2026-06-01',
      },
      createRepository({ holidays: ['2026-06-13'] }),
    );

    assert.equal(context.vehicleCategory, 'SUV');
    assert.equal(context.modelVehicleCategory, 'suv');
    assert.equal(toDateOnlyString(context.returnDate), '2026-06-16');
    assert.equal(context.selectedCarActiveUnits, 2);
    assert.equal(context.selectedCarAvailableUnits, 2);
    assert.equal(context.isSelectedCarAvailable, true);
    assert.equal(context.categoryActiveUnits, 5);
    assert.equal(context.categoryAvailableUnits, 5);
    assert.equal(context.availabilityRatio, 1);
    assert.equal(context.utilizationRate, 0);
    assert.equal(context.demandLevel, 'sepi');
    assert.equal(context.isWeekend, true);
    assert.equal(context.isHoliday, true);
    assert.equal(context.isPeakSeason, true);
    assert.equal(context.bookingLeadDays, 12);
    assert.deepEqual(context.modelPayload, {
      vehicle_category: 'suv',
      trip_type: 'luar_kota',
      duration_days: 3,
      is_weekend: true,
      is_holiday: true,
      is_peak_season: true,
      utilization_rate: 0,
      booking_lead_days: 12,
    });
  });

  it('uses PENDING and CONFIRMED as blocking statuses', async () => {
    let receivedStatuses: readonly BlockingBookingStatus[] = [];

    await buildPricingContext(
      {
        carId: 'suv-a',
        pickupDate: '2026-06-08',
        durationDays: 1,
        tripType: 'DALAM_KOTA',
        referenceDate: '2026-06-01',
      },
      createRepository({
        bookings: [
          { carId: 'suv-a', carUnitId: 'unit-a-1', status: 'PENDING', startDate: '2026-05-01', endDate: '2026-05-02' },
        ],
        onStatuses: (statuses) => { receivedStatuses = statuses; },
      }),
    );

    assert.deepEqual(receivedStatuses, BLOCKING_BOOKING_STATUSES);
  });

  it('returns low utilization when there are no overlapping bookings', async () => {
    const context = await buildPricingContext(
      {
        carId: 'suv-a',
        pickupDate: '2026-06-08',
        durationDays: 1,
        tripType: 'DALAM_KOTA',
        referenceDate: '2026-06-01',
      },
      createRepository(),
    );

    assert.equal(context.isSelectedCarAvailable, true);
    assert.equal(context.categoryAvailableUnits, 5);
    assert.equal(context.demandLevel, 'sepi');
  });

  it('returns normal demand when part of the category fleet is booked', async () => {
    const context = await buildPricingContext(
      {
        carId: 'suv-a',
        pickupDate: '2026-06-03',
        durationDays: 2,
        tripType: 'DALAM_KOTA',
        referenceDate: '2026-06-01',
      },
      createRepository({
        bookings: [
          { carId: 'suv-a', carUnitId: 'unit-a-1', status: 'PENDING', startDate: '2026-06-01', endDate: '2026-06-04' },
          { carId: 'suv-b', carUnitId: 'unit-b-1', status: 'CONFIRMED', startDate: '2026-06-03', endDate: '2026-06-05' },
        ],
      }),
    );

    assert.equal(context.categoryActiveUnits, 5);
    assert.equal(context.categoryAvailableUnits, 3);
    assert.equal(context.utilizationRate, 0.4);
    assert.equal(context.demandLevel, 'normal');
  });

  it('returns high demand when at least 70% of active category units are booked', async () => {
    const context = await buildPricingContext(
      {
        carId: 'suv-a',
        pickupDate: '2026-06-03',
        durationDays: 2,
        tripType: 'DALAM_KOTA',
        referenceDate: '2026-06-01',
      },
      createRepository({
        bookings: [
          { carId: 'suv-a', carUnitId: 'unit-a-1', status: 'PENDING', startDate: '2026-06-01', endDate: '2026-06-04' },
          { carId: 'suv-a', carUnitId: 'unit-a-2', status: 'CONFIRMED', startDate: '2026-06-01', endDate: '2026-06-04' },
          { carId: 'suv-b', carUnitId: 'unit-b-1', status: 'CONFIRMED', startDate: '2026-06-02', endDate: '2026-06-05' },
          { carId: 'suv-b', carUnitId: 'unit-b-2', status: 'CONFIRMED', startDate: '2026-06-02', endDate: '2026-06-05' },
        ],
      }),
    );

    assert.equal(context.categoryAvailableUnits, 1);
    assert.equal(context.utilizationRate, 0.8);
    assert.equal(context.demandLevel, 'ramai');
  });

  it('does not count CANCELLED or COMPLETED bookings as blocking availability', async () => {
    const context = await buildPricingContext(
      {
        carId: 'suv-a',
        pickupDate: '2026-06-03',
        durationDays: 2,
        tripType: 'DALAM_KOTA',
        referenceDate: '2026-06-01',
      },
      createRepository({
        bookings: [
          { carId: 'suv-a', carUnitId: 'unit-a-1', status: 'CANCELLED', startDate: '2026-06-01', endDate: '2026-06-04' },
          { carId: 'suv-b', carUnitId: 'unit-b-1', status: 'COMPLETED', startDate: '2026-06-03', endDate: '2026-06-05' },
        ],
      }),
    );

    assert.equal(context.categoryAvailableUnits, 5);
    assert.equal(context.selectedCarAvailableUnits, 2);
    assert.equal(context.demandLevel, 'sepi');
  });

  it('counts active PENDING reservations but ignores expired PENDING reservations', async () => {
    const context = await buildPricingContext(
      {
        carId: 'suv-a',
        pickupDate: '2026-06-03',
        durationDays: 2,
        tripType: 'DALAM_KOTA',
        referenceDate: new Date('2026-06-01T10:00:00.000Z'),
      },
      createRepository({
        bookings: [
          {
            carId: 'suv-a',
            carUnitId: 'unit-a-1',
            status: 'PENDING',
            startDate: '2026-06-01',
            endDate: '2026-06-04',
            reservationExpiresAt: new Date('2026-06-01T10:30:00.000Z'),
          },
          {
            carId: 'suv-b',
            carUnitId: 'unit-b-1',
            status: 'PENDING',
            startDate: '2026-06-03',
            endDate: '2026-06-05',
            reservationExpiresAt: new Date('2026-06-01T09:59:59.000Z'),
          },
        ],
      }),
    );

    assert.equal(context.selectedCarAvailableUnits, 1);
    assert.equal(context.categoryAvailableUnits, 4);
  });

  it('keeps legacy PENDING reservations with null expiry blocking for safety', async () => {
    const context = await buildPricingContext(
      {
        carId: 'suv-a',
        pickupDate: '2026-06-03',
        durationDays: 2,
        tripType: 'DALAM_KOTA',
        referenceDate: new Date('2026-06-01T10:00:00.000Z'),
      },
      createRepository({
        bookings: [
          {
            carId: 'suv-a',
            carUnitId: 'unit-a-1',
            status: 'PENDING',
            startDate: '2026-06-01',
            endDate: '2026-06-04',
            reservationExpiresAt: null,
          },
        ],
      }),
    );

    assert.equal(context.selectedCarAvailableUnits, 1);
    assert.equal(context.categoryAvailableUnits, 4);
  });

  it('keeps CONFIRMED bookings blocking regardless of reservation expiry', async () => {
    const context = await buildPricingContext(
      {
        carId: 'suv-a',
        pickupDate: '2026-06-03',
        durationDays: 2,
        tripType: 'DALAM_KOTA',
        referenceDate: new Date('2026-06-01T10:00:00.000Z'),
      },
      createRepository({
        bookings: [
          {
            carId: 'suv-a',
            carUnitId: 'unit-a-1',
            status: 'CONFIRMED',
            startDate: '2026-06-01',
            endDate: '2026-06-04',
            reservationExpiresAt: new Date('2026-06-01T09:00:00.000Z'),
          },
        ],
      }),
    );

    assert.equal(context.selectedCarAvailableUnits, 1);
    assert.equal(context.categoryAvailableUnits, 4);
  });

  it('does not count MAINTENANCE and INACTIVE units as active units', async () => {
    const context = await buildPricingContext(
      {
        carId: 'suv-b',
        pickupDate: '2026-06-08',
        durationDays: 1,
        tripType: 'DALAM_KOTA',
        referenceDate: '2026-06-01',
      },
      createRepository({
        units: [
          { id: 'unit-a-1', carId: 'suv-a', status: 'ACTIVE' },
          { id: 'unit-b-1', carId: 'suv-b', status: 'ACTIVE' },
          { id: 'unit-b-2', carId: 'suv-b', status: 'MAINTENANCE' },
          { id: 'unit-b-3', carId: 'suv-b', status: 'INACTIVE' },
        ],
      }),
    );

    assert.equal(context.categoryActiveUnits, 2);
    assert.equal(context.selectedCarActiveUnits, 1);
    assert.equal(context.categoryAvailableUnits, 2);
  });

  it('reports selected car unavailable while category utilization still uses the whole category', async () => {
    const context = await buildPricingContext(
      {
        carId: 'suv-a',
        pickupDate: '2026-06-03',
        durationDays: 2,
        tripType: 'DALAM_KOTA',
        referenceDate: '2026-06-01',
      },
      createRepository({
        units: [
          { id: 'unit-a-1', carId: 'suv-a', status: 'ACTIVE' },
          { id: 'unit-b-1', carId: 'suv-b', status: 'ACTIVE' },
          { id: 'unit-b-2', carId: 'suv-b', status: 'ACTIVE' },
          { id: 'unit-b-3', carId: 'suv-b', status: 'ACTIVE' },
          { id: 'unit-b-4', carId: 'suv-b', status: 'ACTIVE' },
        ],
        bookings: [
          { carId: 'suv-a', carUnitId: 'unit-a-1', status: 'CONFIRMED', startDate: '2026-06-01', endDate: '2026-06-04' },
        ],
      }),
    );

    assert.equal(context.selectedCarActiveUnits, 1);
    assert.equal(context.selectedCarAvailableUnits, 0);
    assert.equal(context.isSelectedCarAvailable, false);
    assert.equal(context.categoryActiveUnits, 5);
    assert.equal(context.categoryAvailableUnits, 4);
    assert.equal(context.utilizationRate, 0.2);
  });

  it('returns an explicit error for overlapping blocking bookings without carUnitId', async () => {
    await assert.rejects(
      () =>
        buildPricingContext(
          {
            carId: 'suv-a',
            pickupDate: '2026-06-03',
            durationDays: 2,
            tripType: 'DALAM_KOTA',
            referenceDate: '2026-06-01',
          },
          createRepository({
            bookings: [
              { carId: 'suv-a', carUnitId: null, status: 'PENDING', startDate: '2026-06-01', endDate: '2026-06-04' },
            ],
          }),
        ),
      (error) =>
        error instanceof PricingDomainError &&
        error.code === 'UNALLOCATED_BLOCKING_BOOKING_FOUND' &&
        error.message.includes('belum dialokasikan ke unit kendaraan'),
    );
  });

  it('rejects unsupported vehicle categories before building the model payload', async () => {
    await assert.rejects(
      () =>
        buildPricingContext(
          {
            carId: 'truck-a',
            pickupDate: '2026-06-08',
            durationDays: 1,
            tripType: 'DALAM_KOTA',
            referenceDate: '2026-06-01',
          },
          createRepository({
            cars: [{ id: 'truck-a', category: 'TRUCK', basePricePerDay: 500000 }],
            units: [{ id: 'truck-unit-1', carId: 'truck-a', status: 'ACTIVE' }],
          }),
        ),
      (error) => error instanceof PricingDomainError && error.code === 'UNSUPPORTED_MODEL_VEHICLE_CATEGORY',
    );
  });

  it('rejects missing cars and categories without active units', async () => {
    await assert.rejects(
      () =>
        buildPricingContext(
          {
            carId: 'missing',
            pickupDate: '2026-06-08',
            durationDays: 1,
            tripType: 'DALAM_KOTA',
            referenceDate: '2026-06-01',
          },
          createRepository(),
        ),
      (error) => error instanceof PricingDomainError && error.code === 'CAR_NOT_FOUND',
    );

    await assert.rejects(
      () =>
        buildPricingContext(
          {
            carId: 'suv-a',
            pickupDate: '2026-06-08',
            durationDays: 1,
            tripType: 'DALAM_KOTA',
            referenceDate: '2026-06-01',
          },
          createRepository({ units: [] }),
        ),
      (error) => error instanceof PricingDomainError && error.code === 'NO_ACTIVE_UNITS',
    );
  });
});
