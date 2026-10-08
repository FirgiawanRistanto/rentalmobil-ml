import { sql } from 'drizzle-orm';
import { db } from '../db';
import { parseDbTimestamp, toDateOnlyString } from '../domain/pricing/dateHelpers';
import {
  buildCustomerBookingPaymentPath,
  deriveCustomerBookingDisplayStatus,
  parseCustomerBookingsSearchParams,
  type CustomerBookingDisplayStatus,
  type CustomerBookingsQuery,
  type CustomerBookingsResponse,
  type CustomerDashboardBooking,
  type CustomerDashboardSummary,
} from '../lib/customerDashboardUi';
import { PaymentServiceError, drizzlePaymentRepository, type PaymentStatus } from './paymentService';

type BookingStatus = CustomerDashboardBooking['bookingStatus'];

interface AuthenticatedDashboardUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface CustomerBookingDashboardRow {
  bookingId: string;
  bookingStatus: BookingStatus;
  reservationExpiresAt: Date | null;
  createdAt: Date;
  carId: string;
  carBrand: string;
  carModel: string;
  carCategory: string;
  carUnitPlate: string | null;
  startDate: Date;
  endDate: Date;
  tripType: 'DALAM_KOTA' | 'LUAR_KOTA';
  totalPrice: number;
  snapshotDynamicPriceDisplayPerDay: number | null;
  snapshotTotalInvoiceDisplay: number | null;
  snapshotModelVersion: string | null;
  paymentStatus: PaymentStatus | null;
  paymentSubmittedAt: Date | null;
  paymentReviewExpiresAt: Date | null;
  paymentRejectionReason: string | null;
}

export interface CustomerBookingSummaryRow {
  bookingStatus: BookingStatus;
  reservationExpiresAt: Date | null;
  paymentStatus: PaymentStatus | null;
  paymentReviewExpiresAt: Date | null;
}

export interface CustomerBookingsRange {
  limit: number;
  offset: number;
}

interface CustomerBookingsPage {
  rows: CustomerBookingDashboardRow[];
  totalItems: number;
}

interface CustomerBookingDashboardRepository {
  expireSubmittedPayments(now: Date): Promise<void>;
  listCustomerBookings(userId: string, range: CustomerBookingsRange): Promise<CustomerBookingsPage>;
  /** Ringkasan metrik dihitung dari seluruh booking user, bukan hanya halaman aktif. */
  listCustomerBookingSummaryRows(userId: string): Promise<CustomerBookingSummaryRow[]>;
}

interface CustomerBookingDashboardDependencies {
  repository?: CustomerBookingDashboardRepository;
  now?: () => Date;
  query?: URLSearchParams | Record<string, string | string[] | undefined> | Partial<CustomerBookingsQuery>;
}

function normalizeDatabaseDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : parseDbTimestamp(value);
}

function requireDatabaseDate(value: Date | string): Date {
  return value instanceof Date ? value : parseDbTimestamp(value);
}

function calculateRentalDurationDays(startDate: Date, endDate: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay));
}

function mapRows<T>(result: { rows?: unknown[] } | unknown[]): T[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as T[];
}

function readCount(result: { rows?: unknown[] } | unknown[]): number {
  const [row] = mapRows<Record<string, unknown>>(result);
  const parsed = Number(row?.count ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createDefaultRepository(): CustomerBookingDashboardRepository {
  return {
    async expireSubmittedPayments(now) {
      await drizzlePaymentRepository.expireSubmittedPayments(now);
    },

    async listCustomerBookings(userId, range) {
      const countResult = await db.execute(sql`
        select count(*) as "count"
        from bookings b
        where b."userId" = ${userId}
      `);
      const result = await db.execute(sql`
        select
          b.id as "bookingId",
          b.status as "bookingStatus",
          b."reservationExpiresAt" as "reservationExpiresAt",
          b."createdAt" as "createdAt",
          c.id as "carId",
          c.brand as "carBrand",
          c.model as "carModel",
          c.category as "carCategory",
          cu."plateNumber" as "carUnitPlate",
          b."startDate" as "startDate",
          b."endDate" as "endDate",
          b."tripType" as "tripType",
          b."totalPrice" as "totalPrice",
          bps."dynamicPriceDisplayPerDay" as "snapshotDynamicPriceDisplayPerDay",
          bps."totalInvoiceDisplay" as "snapshotTotalInvoiceDisplay",
          bps."modelVersion" as "snapshotModelVersion",
          p.status as "paymentStatus",
          p."submittedAt" as "paymentSubmittedAt",
          p."reviewExpiresAt" as "paymentReviewExpiresAt",
          p."rejectionReason" as "paymentRejectionReason"
        from bookings b
        join cars c on c.id = b."carId"
        left join car_units cu on cu.id = b."carUnitId"
        left join booking_price_snapshots bps on bps."bookingId" = b.id
        left join booking_payments p on p."bookingId" = b.id
        where b."userId" = ${userId}
        order by b."createdAt" desc
        limit ${range.limit}
        offset ${range.offset}
      `);

      return {
        rows: mapRows<CustomerBookingDashboardRow>(result).map((row) => ({
          ...row,
          reservationExpiresAt: normalizeDatabaseDate(row.reservationExpiresAt),
          createdAt: requireDatabaseDate(row.createdAt),
          startDate: requireDatabaseDate(row.startDate),
          endDate: requireDatabaseDate(row.endDate),
          paymentSubmittedAt: normalizeDatabaseDate(row.paymentSubmittedAt),
          paymentReviewExpiresAt: normalizeDatabaseDate(row.paymentReviewExpiresAt),
        })),
        totalItems: readCount(countResult),
      };
    },

    async listCustomerBookingSummaryRows(userId) {
      const result = await db.execute(sql`
        select
          b.status as "bookingStatus",
          b."reservationExpiresAt" as "reservationExpiresAt",
          p.status as "paymentStatus",
          p."reviewExpiresAt" as "paymentReviewExpiresAt"
        from bookings b
        left join booking_payments p on p."bookingId" = b.id
        where b."userId" = ${userId}
      `);

      return mapRows<CustomerBookingSummaryRow>(result).map((row) => ({
        ...row,
        reservationExpiresAt: normalizeDatabaseDate(row.reservationExpiresAt),
        paymentReviewExpiresAt: normalizeDatabaseDate(row.paymentReviewExpiresAt),
      }));
    },
  };
}

function mapCustomerBookingRow(
  row: CustomerBookingDashboardRow,
  referenceTime: Date,
): CustomerDashboardBooking {
  const reservationExpiresAt = normalizeDatabaseDate(row.reservationExpiresAt)?.toISOString() ?? null;
  const paymentReviewExpiresAt = normalizeDatabaseDate(row.paymentReviewExpiresAt)?.toISOString() ?? null;
  const paymentSubmittedAt = normalizeDatabaseDate(row.paymentSubmittedAt)?.toISOString() ?? null;
  const displayStatus = deriveCustomerBookingDisplayStatus(
    {
      bookingStatus: row.bookingStatus,
      reservationExpiresAt,
      payment: {
        paymentStatus: row.paymentStatus,
        reviewExpiresAt: paymentReviewExpiresAt,
      },
    },
    referenceTime,
  );

  return {
    bookingId: row.bookingId,
    bookingStatus: row.bookingStatus,
    displayStatus,
    car: {
      id: row.carId,
      name: `${row.carBrand} ${row.carModel}`.trim(),
      category: row.carCategory,
      unitPlate: row.carUnitPlate,
    },
    rental: {
      pickupDate: toDateOnlyString(row.startDate),
      returnDate: toDateOnlyString(row.endDate),
      durationDays: calculateRentalDurationDays(row.startDate, row.endDate),
      tripType: row.tripType,
    },
    pricing: {
      modelVersion: row.snapshotModelVersion,
      dynamicPriceDisplayPerDay: row.snapshotDynamicPriceDisplayPerDay,
      totalInvoiceDisplay: row.snapshotTotalInvoiceDisplay ?? row.totalPrice,
    },
    reservationExpiresAt,
    createdAt: row.createdAt.toISOString(),
    payment: {
      paymentStatus: row.paymentStatus,
      submittedAt: paymentSubmittedAt,
      reviewExpiresAt: paymentReviewExpiresAt,
      rejectionReason: row.paymentRejectionReason,
    },
    actions: {
      canUploadPaymentProof: displayStatus === 'WAITING_PAYMENT_PROOF',
      canCancelReservation: displayStatus === 'WAITING_PAYMENT_PROOF',
      paymentPath: buildCustomerBookingPaymentPath(row.bookingId),
    },
  };
}

function summarizeCustomerBookings(
  statuses: CustomerBookingDisplayStatus[],
): CustomerDashboardSummary {
  return {
    totalBookings: statuses.length,
    activeBookings: statuses.filter((status) =>
      status === 'WAITING_PAYMENT_PROOF' ||
      status === 'WAITING_ADMIN_VERIFICATION' ||
      status === 'CONFIRMED'
    ).length,
    completedOrConfirmedBookings: statuses.filter((status) =>
      status === 'CONFIRMED' || status === 'COMPLETED'
    ).length,
  };
}

function deriveSummaryDisplayStatus(
  row: CustomerBookingSummaryRow,
  referenceTime: Date,
): CustomerBookingDisplayStatus {
  return deriveCustomerBookingDisplayStatus(
    {
      bookingStatus: row.bookingStatus,
      reservationExpiresAt: normalizeDatabaseDate(row.reservationExpiresAt)?.toISOString() ?? null,
      payment: {
        paymentStatus: row.paymentStatus,
        reviewExpiresAt: normalizeDatabaseDate(row.paymentReviewExpiresAt)?.toISOString() ?? null,
      },
    },
    referenceTime,
  );
}

function normalizeCustomerBookingsQuery(
  query: CustomerBookingDashboardDependencies['query'],
): CustomerBookingsQuery {
  if (!query) {
    return parseCustomerBookingsSearchParams({});
  }

  if (query instanceof URLSearchParams) {
    return parseCustomerBookingsSearchParams(query);
  }

  return parseCustomerBookingsSearchParams(
    Object.fromEntries(
      Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? value : String(value ?? '')]),
    ),
  );
}

export async function listCustomerDashboardBookings(
  user: AuthenticatedDashboardUser | null | undefined,
  dependencies: CustomerBookingDashboardDependencies = {},
): Promise<CustomerBookingsResponse> {
  if (!user?.id) {
    throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'Login diperlukan untuk membaca dashboard booking.');
  }

  const repository = dependencies.repository ?? createDefaultRepository();
  const now = dependencies.now ?? (() => new Date());
  const referenceTime = now();

  const query = normalizeCustomerBookingsQuery(dependencies.query);

  await repository.expireSubmittedPayments(referenceTime);

  const { rows, totalItems } = await repository.listCustomerBookings(user.id, {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  const summaryRows = await repository.listCustomerBookingSummaryRows(user.id);
  const bookings = rows.map((row) => mapCustomerBookingRow(row, referenceTime));
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

  return {
    customer: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
    },
    // Metrik dashboard menjumlahkan seluruh booking user, bukan hanya halaman aktif.
    summary: summarizeCustomerBookings(
      summaryRows.map((row) => deriveSummaryDisplayStatus(row, referenceTime)),
    ),
    bookings,
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages,
    hasNextPage: query.page < totalPages,
    hasPreviousPage: query.page > 1,
  };
}
