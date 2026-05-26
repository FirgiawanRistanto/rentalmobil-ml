import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { bookings, cars, carUnits, holidays } from '../../db/schema';
import {
  calculateBookingLeadDays,
  calculateReturnDate,
  isPeakSeasonDate,
  isWeekendPickup,
  parsePricingDate,
  toDateOnlyString,
} from './dateHelpers';
import { PricingDomainError } from './errors';
import {
  mapCarCategoryToModelCategory,
  mapTripTypeToModelTripType,
  type ModelTripType,
  type ModelVehicleCategory,
  type PricingTripType,
} from './modelMappings';
import { calculateUtilization, type DemandLevel } from './pricingHelpers';

export type { ModelTripType, ModelVehicleCategory, PricingTripType };
export type BlockingBookingStatus = 'PENDING' | 'CONFIRMED';

export const BLOCKING_BOOKING_STATUSES: readonly BlockingBookingStatus[] = ['PENDING', 'CONFIRMED'];

export interface BuildPricingContextInput {
  carId: string;
  pickupDate: Date | string;
  durationDays: number;
  tripType: PricingTripType;
  referenceDate?: Date | string;
}

export interface PricingCarRecord {
  id: string;
  category: string;
  basePricePerDay: number;
}

export interface PricingContextRepository {
  findCarForPricing(carId: string): Promise<PricingCarRecord | null>;
  countActiveUnitsByCategory(category: string): Promise<number>;
  countActiveUnitsByCarId(carId: string): Promise<number>;
  countBlockedActiveUnitsByCategory(
    category: string,
    pickupDate: Date,
    returnDate: Date,
    statuses: readonly BlockingBookingStatus[],
    referenceDate: Date,
  ): Promise<number>;
  countBlockedActiveUnitsByCarId(
    carId: string,
    pickupDate: Date,
    returnDate: Date,
    statuses: readonly BlockingBookingStatus[],
    referenceDate: Date,
  ): Promise<number>;
  countUnallocatedBlockingBookingsByCategory(
    category: string,
    pickupDate: Date,
    returnDate: Date,
    statuses: readonly BlockingBookingStatus[],
    referenceDate: Date,
  ): Promise<number>;
  isActiveHoliday(pickupDate: Date): Promise<boolean>;
}

export interface DynamicPricingV4ModelPayload {
  vehicle_category: ModelVehicleCategory;
  trip_type: ModelTripType;
  duration_days: number;
  is_weekend: boolean;
  is_holiday: boolean;
  is_peak_season: boolean;
  utilization_rate: number;
  booking_lead_days: number;
}

export interface PricingContext {
  carId: string;
  vehicleCategory: string;
  modelVehicleCategory: ModelVehicleCategory;
  basePricePerDay: number;
  pickupDate: Date;
  returnDate: Date;
  durationDays: number;
  tripType: PricingTripType;
  selectedCarActiveUnits: number;
  selectedCarAvailableUnits: number;
  isSelectedCarAvailable: boolean;
  categoryActiveUnits: number;
  categoryAvailableUnits: number;
  availabilityRatio: number;
  utilizationRate: number;
  demandLevel: DemandLevel;
  isWeekend: boolean;
  isHoliday: boolean;
  isPeakSeason: boolean;
  bookingLeadDays: number;
  modelPayload: DynamicPricingV4ModelPayload;
  modelFeatures: DynamicPricingV4ModelPayload;
}

function clampBlockedUnits(blockedUnits: number, activeUnits: number): number {
  if (!Number.isFinite(blockedUnits) || blockedUnits < 0) return 0;
  return Math.min(Math.trunc(blockedUnits), activeUnits);
}

function buildStatusBlockingFilter(statuses: readonly BlockingBookingStatus[], referenceDate: Date) {
  const statusFilters = [];

  if (statuses.includes('CONFIRMED')) {
    statusFilters.push(eq(bookings.status, 'CONFIRMED'));
  }

  if (statuses.includes('PENDING')) {
    statusFilters.push(and(
      eq(bookings.status, 'PENDING'),
      or(
        isNull(bookings.reservationExpiresAt),
        gt(bookings.reservationExpiresAt, referenceDate),
      ),
    ));
  }

  if (statusFilters.length === 0) {
    return sql`false`;
  }

  return or(...statusFilters);
}

function buildOverlapFilter(
  pickupDate: Date,
  returnDate: Date,
  statuses: readonly BlockingBookingStatus[],
  referenceDate: Date,
) {
  return and(
    buildStatusBlockingFilter(statuses, referenceDate),
    lt(bookings.startDate, returnDate),
    gt(bookings.endDate, pickupDate),
  );
}

function resolveBlockingReferenceDate(referenceDate?: Date | string): Date {
  if (referenceDate === undefined) {
    return new Date();
  }

  if (referenceDate instanceof Date) {
    return new Date(referenceDate);
  }

  return parsePricingDate(referenceDate, 'Tanggal referensi');
}

export const drizzlePricingContextRepository: PricingContextRepository = {
  async findCarForPricing(carId) {
    const [car] = await db
      .select({
        id: cars.id,
        category: cars.category,
        basePricePerDay: cars.basePricePerDay,
      })
      .from(cars)
      .where(eq(cars.id, carId))
      .limit(1);

    return car ?? null;
  },

  async countActiveUnitsByCategory(category) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(carUnits)
      .innerJoin(cars, eq(carUnits.carId, cars.id))
      .where(and(eq(cars.category, category), eq(carUnits.status, 'ACTIVE')));

    return Number(row?.count ?? 0);
  },

  async countActiveUnitsByCarId(carId) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(carUnits)
      .where(and(eq(carUnits.carId, carId), eq(carUnits.status, 'ACTIVE')));

    return Number(row?.count ?? 0);
  },

  async countBlockedActiveUnitsByCategory(category, pickupDate, returnDate, statuses, referenceDate) {
    const [row] = await db
      .select({ count: sql<number>`count(distinct ${bookings.carUnitId})::int` })
      .from(bookings)
      .innerJoin(cars, eq(bookings.carId, cars.id))
      .innerJoin(carUnits, eq(bookings.carUnitId, carUnits.id))
      .where(and(
        eq(cars.category, category),
        eq(carUnits.status, 'ACTIVE'),
        buildOverlapFilter(pickupDate, returnDate, statuses, referenceDate),
      ));

    return Number(row?.count ?? 0);
  },

  async countBlockedActiveUnitsByCarId(carId, pickupDate, returnDate, statuses, referenceDate) {
    const [row] = await db
      .select({ count: sql<number>`count(distinct ${bookings.carUnitId})::int` })
      .from(bookings)
      .innerJoin(carUnits, eq(bookings.carUnitId, carUnits.id))
      .where(and(
        eq(bookings.carId, carId),
        eq(carUnits.status, 'ACTIVE'),
        buildOverlapFilter(pickupDate, returnDate, statuses, referenceDate),
      ));

    return Number(row?.count ?? 0);
  },

  async countUnallocatedBlockingBookingsByCategory(category, pickupDate, returnDate, statuses, referenceDate) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .innerJoin(cars, eq(bookings.carId, cars.id))
      .where(and(
        eq(cars.category, category),
        isNull(bookings.carUnitId),
        buildOverlapFilter(pickupDate, returnDate, statuses, referenceDate),
      ));

    return Number(row?.count ?? 0);
  },

  async isActiveHoliday(pickupDate) {
    const pickupDateOnly = toDateOnlyString(pickupDate);
    const result = await db
      .select({ id: holidays.id })
      .from(holidays)
      .where(and(eq(holidays.isActive, true), sql`${holidays.date} = ${pickupDateOnly}::date`))
      .limit(1);

    return result.length > 0;
  },
};

export async function buildPricingContext(
  input: BuildPricingContextInput,
  repository: PricingContextRepository = drizzlePricingContextRepository,
): Promise<PricingContext> {
  const modelTripType = mapTripTypeToModelTripType(input.tripType);
  const pickupDate = parsePricingDate(input.pickupDate, 'Tanggal pickup');
  const returnDate = calculateReturnDate(pickupDate, input.durationDays);
  const blockingReferenceDate = resolveBlockingReferenceDate(input.referenceDate);
  const bookingLeadDays = calculateBookingLeadDays(pickupDate, input.referenceDate);

  const car = await repository.findCarForPricing(input.carId);
  if (!car) {
    throw new PricingDomainError('CAR_NOT_FOUND', 'Mobil tidak ditemukan.');
  }

  const modelVehicleCategory = mapCarCategoryToModelCategory(car.category);
  const unallocatedBlockingBookings = await repository.countUnallocatedBlockingBookingsByCategory(
    car.category,
    pickupDate,
    returnDate,
    BLOCKING_BOOKING_STATUSES,
    blockingReferenceDate,
  );

  if (unallocatedBlockingBookings > 0) {
    throw new PricingDomainError(
      'UNALLOCATED_BLOCKING_BOOKING_FOUND',
      'Availability tidak dapat dihitung presisi karena ada booking aktif overlap yang belum dialokasikan ke unit kendaraan.',
    );
  }

  const categoryActiveUnits = await repository.countActiveUnitsByCategory(car.category);
  const selectedCarActiveUnits = await repository.countActiveUnitsByCarId(car.id);
  const categoryBlockedUnits = await repository.countBlockedActiveUnitsByCategory(
    car.category,
    pickupDate,
    returnDate,
    BLOCKING_BOOKING_STATUSES,
    blockingReferenceDate,
  );
  const selectedCarBlockedUnits = await repository.countBlockedActiveUnitsByCarId(
    car.id,
    pickupDate,
    returnDate,
    BLOCKING_BOOKING_STATUSES,
    blockingReferenceDate,
  );
  const categoryAvailableUnits = categoryActiveUnits - clampBlockedUnits(categoryBlockedUnits, categoryActiveUnits);
  const selectedCarAvailableUnits = selectedCarActiveUnits - clampBlockedUnits(
    selectedCarBlockedUnits,
    selectedCarActiveUnits,
  );
  const utilization = calculateUtilization(categoryActiveUnits, categoryAvailableUnits);
  const isWeekend = isWeekendPickup(pickupDate);
  const isHoliday = await repository.isActiveHoliday(pickupDate);
  const isPeakSeason = isPeakSeasonDate(pickupDate);
  const modelPayload: DynamicPricingV4ModelPayload = {
    vehicle_category: modelVehicleCategory,
    trip_type: modelTripType,
    duration_days: input.durationDays,
    is_weekend: isWeekend,
    is_holiday: isHoliday,
    is_peak_season: isPeakSeason,
    utilization_rate: utilization.utilizationRate,
    booking_lead_days: bookingLeadDays,
  };

  return {
    carId: car.id,
    vehicleCategory: car.category,
    modelVehicleCategory,
    basePricePerDay: car.basePricePerDay,
    pickupDate,
    returnDate,
    durationDays: input.durationDays,
    tripType: input.tripType,
    selectedCarActiveUnits,
    selectedCarAvailableUnits,
    isSelectedCarAvailable: selectedCarAvailableUnits > 0,
    categoryActiveUnits,
    categoryAvailableUnits,
    availabilityRatio: utilization.availabilityRatio,
    utilizationRate: utilization.utilizationRate,
    demandLevel: utilization.demandLevel,
    isWeekend,
    isHoliday,
    isPeakSeason,
    bookingLeadDays,
    modelPayload,
    modelFeatures: modelPayload,
  };
}
