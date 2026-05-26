import { and, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { bookingPriceSnapshots, bookings, cars, carUnits, holidays, pricingQuotes } from '../db/schema';
import {
  buildPricingContext,
  type BlockingBookingStatus,
  type PricingContext,
  type PricingContextRepository,
  type PricingTripType,
} from '../domain/pricing';
import { toDateOnlyString } from '../domain/pricing/dateHelpers';

export type BookingFromQuoteErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_BOOKING_REQUEST'
  | 'QUOTE_NOT_FOUND'
  | 'QUOTE_NOT_OWNED_BY_USER'
  | 'QUOTE_EXPIRED'
  | 'QUOTE_NOT_ACTIVE'
  | 'SELECTED_CAR_UNAVAILABLE'
  | 'QUOTE_REPRICE_REQUIRED'
  | 'CAR_UNIT_ALLOCATION_FAILED'
  | 'BOOKING_CREATION_FAILED';

export class BookingFromQuoteError extends Error {
  constructor(
    public readonly code: BookingFromQuoteErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BookingFromQuoteError';
  }
}

export interface CreateBookingFromQuoteInput {
  quoteId: string;
  phoneNumber?: string | null;
  pickupAddress?: string | null;
  notes?: string | null;
}

export interface AuthenticatedBookingUser {
  id: string;
}

export interface BookingFromQuoteResult {
  bookingId: string;
  status: 'PENDING';
  quoteId: string;
  quoteStatus: 'ACCEPTED';
  carUnitAllocated: boolean;
  rental: {
    pickupDate: string;
    returnDate: string;
    durationDays: number;
    tripType: PricingTripType;
  };
  pricing: {
    modelVersion: string;
    basePricePerDay: number;
    predictedPriceAdjustmentPct: number;
    dynamicPriceDisplayPerDay: number;
    totalInvoiceDisplay: number;
  };
  nextStep: 'PAYMENT_PENDING';
}

type QuoteStatus = 'ACTIVE' | 'ACCEPTED' | 'EXPIRED' | 'INVALIDATED';
type DemandLevel = PricingContext['demandLevel'];

export interface PricingQuoteForBooking {
  id: string;
  carId: string;
  userId: string | null;
  pickupDate: Date;
  returnDate: Date;
  durationDays: number;
  tripType: PricingTripType;
  basePricePerDay: number;
  categoryActiveUnits: number;
  categoryAvailableUnits: number;
  availabilityRatio: string;
  utilizationRate: string;
  demandLevel: DemandLevel;
  isWeekend: boolean;
  isHoliday: boolean;
  isPeakSeason: boolean;
  bookingLeadDays: number;
  predictedPriceAdjustmentPct: string;
  dynamicPriceRawPerDay: number;
  dynamicPriceDisplayPerDay: number;
  totalInvoiceDisplay: number;
  pricingReasons: string[];
  modelVersion: string;
  status: QuoteStatus;
  expiresAt: Date;
}

interface InsertBookingInput {
  userId: string;
  carId: string;
  carUnitId: string;
  pickupDate: Date;
  returnDate: Date;
  tripType: PricingTripType;
  phoneNumber: string | null;
  pickupAddress: string | null;
  notes: string | null;
  pricingQuoteId: string;
  totalPrice: number;
  createdAt: Date;
}

interface InsertBookingSnapshotInput {
  bookingId: string;
  quote: PricingQuoteForBooking;
  createdAt: Date;
}

export interface BookingFromQuoteTransactionRepository {
  lockQuote(quoteId: string): Promise<PricingQuoteForBooking | null>;
  markQuoteExpired(quoteId: string, updatedAt: Date): Promise<void>;
  markQuoteInvalidated(quoteId: string, updatedAt: Date): Promise<void>;
  acceptQuote(quoteId: string, userId: string, updatedAt: Date): Promise<void>;
  allocateAvailableCarUnit(carId: string, pickupDate: Date, returnDate: Date): Promise<string | null>;
  insertBooking(input: InsertBookingInput): Promise<{ id: string; status: 'PENDING' }>;
  insertSnapshot(input: InsertBookingSnapshotInput): Promise<void>;
  createPricingContextRepository(): PricingContextRepository;
}

export interface BookingFromQuoteRepository {
  transaction<T>(callback: (tx: BookingFromQuoteTransactionRepository) => Promise<T>): Promise<T>;
}

interface BookingFromQuoteServiceDependencies {
  repository?: BookingFromQuoteRepository;
  buildContext?: (
    quote: PricingQuoteForBooking,
    tx: BookingFromQuoteTransactionRepository,
    referenceDate: Date,
  ) => Promise<PricingContext>;
  now?: () => Date;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_REQUEST_FIELDS = new Set(['quoteId', 'phoneNumber', 'pickupAddress', 'notes']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function optionalText(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BookingFromQuoteError('INVALID_BOOKING_REQUEST', `${fieldName} harus berupa teks.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isBlockingBookingStatusForAllocation(status: string): boolean {
  return status === 'PENDING' || status === 'CONFIRMED';
}

export function doBookingPeriodsOverlapForAllocation(
  existingStartDate: Date,
  existingEndDate: Date,
  requestedPickupDate: Date,
  requestedReturnDate: Date,
): boolean {
  return existingStartDate < requestedReturnDate && existingEndDate > requestedPickupDate;
}

export function validateCreateBookingFromQuoteRequest(value: unknown): CreateBookingFromQuoteInput {
  if (!isRecord(value)) {
    throw new BookingFromQuoteError('INVALID_BOOKING_REQUEST', 'Request body harus berupa object JSON.');
  }

  for (const key of Object.keys(value)) {
    if (!ALLOWED_REQUEST_FIELDS.has(key)) {
      throw new BookingFromQuoteError(
        'INVALID_BOOKING_REQUEST',
        `Field ${key} tidak boleh dikirim untuk booking dari quote.`,
      );
    }
  }

  if (typeof value.quoteId !== 'string' || !UUID_PATTERN.test(value.quoteId)) {
    throw new BookingFromQuoteError('INVALID_BOOKING_REQUEST', 'quoteId wajib berupa UUID valid.');
  }

  return {
    quoteId: value.quoteId,
    phoneNumber: optionalText(value.phoneNumber, 'phoneNumber'),
    pickupAddress: optionalText(value.pickupAddress, 'pickupAddress'),
    notes: optionalText(value.notes, 'notes'),
  };
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function normalizeRatio(value: number): string {
  return value.toFixed(4);
}

function contextMismatchReasons(quote: PricingQuoteForBooking, context: PricingContext): string[] {
  const reasons: string[] = [];

  if (quote.basePricePerDay !== context.basePricePerDay) reasons.push('basePricePerDay');
  if (quote.categoryActiveUnits !== context.categoryActiveUnits) reasons.push('categoryActiveUnits');
  if (quote.categoryAvailableUnits !== context.categoryAvailableUnits) reasons.push('categoryAvailableUnits');
  if (quote.availabilityRatio !== normalizeRatio(context.availabilityRatio)) reasons.push('availabilityRatio');
  if (quote.utilizationRate !== normalizeRatio(context.utilizationRate)) reasons.push('utilizationRate');
  if (quote.demandLevel !== context.demandLevel) reasons.push('demandLevel');
  if (quote.isWeekend !== context.isWeekend) reasons.push('isWeekend');
  if (quote.isHoliday !== context.isHoliday) reasons.push('isHoliday');
  if (quote.isPeakSeason !== context.isPeakSeason) reasons.push('isPeakSeason');
  if (quote.bookingLeadDays !== context.bookingLeadDays) reasons.push('bookingLeadDays');

  return reasons;
}

function mapRows<T>(result: unknown): T[] {
  const maybeRows = result as { rows?: T[] };
  if (Array.isArray(maybeRows.rows)) {
    return maybeRows.rows;
  }

  if (Array.isArray(result)) {
    return result as T[];
  }

  return [];
}

function createDrizzleBookingFromQuoteRepository(): BookingFromQuoteRepository {
  return {
    async transaction(callback) {
      return db.transaction(async (tx) => {
        const txRepository: BookingFromQuoteTransactionRepository = {
          async lockQuote(quoteId) {
            const [row] = await tx
              .select({
                id: pricingQuotes.id,
                carId: pricingQuotes.carId,
                userId: pricingQuotes.userId,
                pickupDate: pricingQuotes.pickupDate,
                returnDate: pricingQuotes.returnDate,
                durationDays: pricingQuotes.durationDays,
                tripType: pricingQuotes.tripType,
                basePricePerDay: pricingQuotes.basePricePerDay,
                categoryActiveUnits: pricingQuotes.categoryActiveUnits,
                categoryAvailableUnits: pricingQuotes.categoryAvailableUnits,
                availabilityRatio: pricingQuotes.availabilityRatio,
                utilizationRate: pricingQuotes.utilizationRate,
                demandLevel: pricingQuotes.demandLevel,
                isWeekend: pricingQuotes.isWeekend,
                isHoliday: pricingQuotes.isHoliday,
                isPeakSeason: pricingQuotes.isPeakSeason,
                bookingLeadDays: pricingQuotes.bookingLeadDays,
                predictedPriceAdjustmentPct: pricingQuotes.predictedPriceAdjustmentPct,
                dynamicPriceRawPerDay: pricingQuotes.dynamicPriceRawPerDay,
                dynamicPriceDisplayPerDay: pricingQuotes.dynamicPriceDisplayPerDay,
                totalInvoiceDisplay: pricingQuotes.totalInvoiceDisplay,
                pricingReasons: pricingQuotes.pricingReasons,
                modelVersion: pricingQuotes.modelVersion,
                status: pricingQuotes.status,
                expiresAt: pricingQuotes.expiresAt,
              })
              .from(pricingQuotes)
              .where(eq(pricingQuotes.id, quoteId))
              .for('update')
              .limit(1);

            if (!row) {
              return null;
            }

            return {
              id: row.id,
              carId: row.carId,
              userId: row.userId,
              pickupDate: row.pickupDate,
              returnDate: row.returnDate,
              durationDays: row.durationDays,
              tripType: row.tripType,
              basePricePerDay: row.basePricePerDay,
              categoryActiveUnits: row.categoryActiveUnits,
              categoryAvailableUnits: row.categoryAvailableUnits,
              availabilityRatio: Number(row.availabilityRatio).toFixed(4),
              utilizationRate: Number(row.utilizationRate).toFixed(4),
              demandLevel: row.demandLevel,
              isWeekend: row.isWeekend,
              isHoliday: row.isHoliday,
              isPeakSeason: row.isPeakSeason,
              bookingLeadDays: row.bookingLeadDays,
              predictedPriceAdjustmentPct: Number(row.predictedPriceAdjustmentPct).toFixed(6),
              dynamicPriceRawPerDay: row.dynamicPriceRawPerDay,
              dynamicPriceDisplayPerDay: row.dynamicPriceDisplayPerDay,
              totalInvoiceDisplay: row.totalInvoiceDisplay,
              pricingReasons: Array.isArray(row.pricingReasons) ? row.pricingReasons.map(String) : [],
              modelVersion: row.modelVersion,
              status: row.status,
              expiresAt: row.expiresAt,
            };
          },

          async markQuoteExpired(quoteId, updatedAt) {
            await tx
              .update(pricingQuotes)
              .set({ status: 'EXPIRED', updatedAt })
              .where(eq(pricingQuotes.id, quoteId));
          },

          async markQuoteInvalidated(quoteId, updatedAt) {
            await tx
              .update(pricingQuotes)
              .set({ status: 'INVALIDATED', updatedAt })
              .where(eq(pricingQuotes.id, quoteId));
          },

          async acceptQuote(quoteId, userId, updatedAt) {
            await tx
              .update(pricingQuotes)
              .set({ status: 'ACCEPTED', userId, updatedAt })
              .where(eq(pricingQuotes.id, quoteId));
          },

          async allocateAvailableCarUnit(carId, pickupDate, returnDate) {
            const result = await tx.execute(sql`
              select cu.id
              from car_units cu
              where cu."carId" = ${carId}
                and cu.status = 'ACTIVE'
                and not exists (
                  select 1
                  from bookings b
                  where b."carUnitId" = cu.id
                    and b.status in ('PENDING', 'CONFIRMED')
                    and b."startDate" < ${returnDate}
                    and b."endDate" > ${pickupDate}
                )
              order by cu."createdAt", cu.id
              for update of cu skip locked
              limit 1
            `);
            const [row] = mapRows<{ id: string }>(result);

            return row?.id ?? null;
          },

          async insertBooking(input) {
            const [booking] = await tx
              .insert(bookings)
              .values({
                userId: input.userId,
                carId: input.carId,
                carUnitId: input.carUnitId,
                startDate: input.pickupDate,
                endDate: input.returnDate,
                tripType: input.tripType,
                phoneNumber: input.phoneNumber,
                pickupAddress: input.pickupAddress,
                notes: input.notes,
                pricingQuoteId: input.pricingQuoteId,
                totalPrice: input.totalPrice,
                status: 'PENDING',
                createdAt: input.createdAt,
                updatedAt: input.createdAt,
              })
              .returning({ id: bookings.id, status: bookings.status });

            if (!booking || booking.status !== 'PENDING') {
              throw new Error('Insert booking did not return a PENDING booking.');
            }

            return { id: booking.id, status: booking.status };
          },

          async insertSnapshot(input) {
            await tx.insert(bookingPriceSnapshots).values({
              bookingId: input.bookingId,
              pricingQuoteId: input.quote.id,
              basePricePerDay: input.quote.basePricePerDay,
              categoryActiveUnits: input.quote.categoryActiveUnits,
              categoryAvailableUnits: input.quote.categoryAvailableUnits,
              availabilityRatio: input.quote.availabilityRatio,
              utilizationRate: input.quote.utilizationRate,
              demandLevel: input.quote.demandLevel,
              predictedPriceAdjustmentPct: input.quote.predictedPriceAdjustmentPct,
              dynamicPriceRawPerDay: input.quote.dynamicPriceRawPerDay,
              dynamicPriceDisplayPerDay: input.quote.dynamicPriceDisplayPerDay,
              totalInvoiceDisplay: input.quote.totalInvoiceDisplay,
              pricingReasons: input.quote.pricingReasons,
              modelVersion: input.quote.modelVersion,
              createdAt: input.createdAt,
            });
          },

          createPricingContextRepository() {
            const overlapFilter = (
              pickupDate: Date,
              returnDate: Date,
              statuses: readonly BlockingBookingStatus[],
            ) => and(
              inArray(bookings.status, [...statuses]),
              lt(bookings.startDate, returnDate),
              gt(bookings.endDate, pickupDate),
            );

            return {
              async findCarForPricing(carId) {
                const [car] = await tx
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
                const [row] = await tx
                  .select({ count: sql<number>`count(*)::int` })
                  .from(carUnits)
                  .innerJoin(cars, eq(carUnits.carId, cars.id))
                  .where(and(eq(cars.category, category), eq(carUnits.status, 'ACTIVE')));

                return Number(row?.count ?? 0);
              },
              async countActiveUnitsByCarId(carId) {
                const [row] = await tx
                  .select({ count: sql<number>`count(*)::int` })
                  .from(carUnits)
                  .where(and(eq(carUnits.carId, carId), eq(carUnits.status, 'ACTIVE')));

                return Number(row?.count ?? 0);
              },
              async countBlockedActiveUnitsByCategory(category, pickupDate, returnDate, statuses) {
                const [row] = await tx
                  .select({ count: sql<number>`count(distinct ${bookings.carUnitId})::int` })
                  .from(bookings)
                  .innerJoin(cars, eq(bookings.carId, cars.id))
                  .innerJoin(carUnits, eq(bookings.carUnitId, carUnits.id))
                  .where(and(
                    eq(cars.category, category),
                    eq(carUnits.status, 'ACTIVE'),
                    overlapFilter(pickupDate, returnDate, statuses),
                  ));

                return Number(row?.count ?? 0);
              },
              async countBlockedActiveUnitsByCarId(carId, pickupDate, returnDate, statuses) {
                const [row] = await tx
                  .select({ count: sql<number>`count(distinct ${bookings.carUnitId})::int` })
                  .from(bookings)
                  .innerJoin(carUnits, eq(bookings.carUnitId, carUnits.id))
                  .where(and(
                    eq(bookings.carId, carId),
                    eq(carUnits.status, 'ACTIVE'),
                    overlapFilter(pickupDate, returnDate, statuses),
                  ));

                return Number(row?.count ?? 0);
              },
              async countUnallocatedBlockingBookingsByCategory(category, pickupDate, returnDate, statuses) {
                const [row] = await tx
                  .select({ count: sql<number>`count(*)::int` })
                  .from(bookings)
                  .innerJoin(cars, eq(bookings.carId, cars.id))
                  .where(and(
                    eq(cars.category, category),
                    isNull(bookings.carUnitId),
                    overlapFilter(pickupDate, returnDate, statuses),
                  ));

                return Number(row?.count ?? 0);
              },
              async isActiveHoliday(pickupDate) {
                const pickupDateOnly = toDateOnlyString(pickupDate);
                const result = await tx
                  .select({ id: holidays.id })
                  .from(holidays)
                  .where(and(eq(holidays.isActive, true), sql`${holidays.date} = ${pickupDateOnly}::date`))
                  .limit(1);

                return result.length > 0;
              },
            };
          },
        };

        return callback(txRepository);
      });
    },
  };
}

export const drizzleBookingFromQuoteRepository = createDrizzleBookingFromQuoteRepository();

export async function createBookingFromQuote(
  rawInput: unknown,
  user: AuthenticatedBookingUser | null | undefined,
  dependencies: BookingFromQuoteServiceDependencies = {},
): Promise<BookingFromQuoteResult> {
  if (!user?.id) {
    throw new BookingFromQuoteError('AUTHENTICATION_REQUIRED', 'Login diperlukan untuk membuat booking.');
  }

  const input = validateCreateBookingFromQuoteRequest(rawInput);
  const repository = dependencies.repository ?? drizzleBookingFromQuoteRepository;
  const buildContext = dependencies.buildContext ?? ((quote: PricingQuoteForBooking, tx: BookingFromQuoteTransactionRepository, referenceDate: Date) =>
    buildPricingContext(
      {
        carId: quote.carId,
        pickupDate: quote.pickupDate,
        durationDays: quote.durationDays,
        tripType: quote.tripType,
        referenceDate,
      },
      tx.createPricingContextRepository(),
    ));
  const now = dependencies.now ?? (() => new Date());
  const acceptedAt = now();

  try {
    return await repository.transaction(async (tx) => {
      const quote = await tx.lockQuote(input.quoteId);

      if (!quote) {
        throw new BookingFromQuoteError('QUOTE_NOT_FOUND', 'Pricing quote tidak ditemukan.');
      }

      if (quote.userId && quote.userId !== user.id) {
        throw new BookingFromQuoteError('QUOTE_NOT_OWNED_BY_USER', 'Pricing quote bukan milik user ini.');
      }

      if (quote.status !== 'ACTIVE') {
        throw new BookingFromQuoteError('QUOTE_NOT_ACTIVE', 'Pricing quote sudah tidak aktif.');
      }

      if (quote.expiresAt.getTime() <= acceptedAt.getTime()) {
        await tx.markQuoteExpired(quote.id, acceptedAt);
        throw new BookingFromQuoteError('QUOTE_EXPIRED', 'Pricing quote sudah kadaluarsa.');
      }

      const context = await buildContext(quote, tx, acceptedAt);

      if (!context.isSelectedCarAvailable) {
        await tx.markQuoteInvalidated(quote.id, acceptedAt);
        throw new BookingFromQuoteError(
          'SELECTED_CAR_UNAVAILABLE',
          'Mobil yang dipilih tidak tersedia lagi pada periode sewa tersebut.',
        );
      }

      const mismatchReasons = contextMismatchReasons(quote, context);
      if (mismatchReasons.length > 0) {
        await tx.markQuoteInvalidated(quote.id, acceptedAt);
        throw new BookingFromQuoteError(
          'QUOTE_REPRICE_REQUIRED',
          'Ketersediaan atau kondisi harga telah berubah. Silakan hitung ulang harga.',
        );
      }

      const carUnitId = await tx.allocateAvailableCarUnit(quote.carId, quote.pickupDate, quote.returnDate);
      if (!carUnitId) {
        await tx.markQuoteInvalidated(quote.id, acceptedAt);
        throw new BookingFromQuoteError(
          'CAR_UNIT_ALLOCATION_FAILED',
          'Unit kendaraan tidak berhasil dialokasikan untuk periode ini.',
        );
      }

      const booking = await tx.insertBooking({
        userId: user.id,
        carId: quote.carId,
        carUnitId,
        pickupDate: quote.pickupDate,
        returnDate: quote.returnDate,
        tripType: quote.tripType,
        phoneNumber: input.phoneNumber ?? null,
        pickupAddress: input.pickupAddress ?? null,
        notes: input.notes ?? null,
        pricingQuoteId: quote.id,
        totalPrice: quote.totalInvoiceDisplay,
        createdAt: acceptedAt,
      });

      await tx.insertSnapshot({
        bookingId: booking.id,
        quote,
        createdAt: acceptedAt,
      });

      await tx.acceptQuote(quote.id, user.id, acceptedAt);

      return {
        bookingId: booking.id,
        status: booking.status,
        quoteId: quote.id,
        quoteStatus: 'ACCEPTED',
        carUnitAllocated: true,
        rental: {
          pickupDate: toDateOnlyString(quote.pickupDate),
          returnDate: toDateOnlyString(quote.returnDate),
          durationDays: quote.durationDays,
          tripType: quote.tripType,
        },
        pricing: {
          modelVersion: quote.modelVersion,
          basePricePerDay: quote.basePricePerDay,
          predictedPriceAdjustmentPct: toNumber(quote.predictedPriceAdjustmentPct),
          dynamicPriceDisplayPerDay: quote.dynamicPriceDisplayPerDay,
          totalInvoiceDisplay: quote.totalInvoiceDisplay,
        },
        nextStep: 'PAYMENT_PENDING',
      };
    });
  } catch (error) {
    if (error instanceof BookingFromQuoteError) {
      throw error;
    }

    throw new BookingFromQuoteError('BOOKING_CREATION_FAILED', 'Gagal membuat booking dari pricing quote.');
  }
}
