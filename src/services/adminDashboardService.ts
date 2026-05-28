import { sql } from 'drizzle-orm';
import { db } from '../db';
import { toDateOnlyString } from '../domain/pricing/dateHelpers';
import {
  type AdminDashboardMetrics,
  type AdminDashboardRecentBooking,
  type AdminDashboardRecentPayment,
  type AdminDashboardResponse,
} from '../lib/adminDashboardUi';
import {
  PaymentServiceError,
  drizzlePaymentRepository,
  type PaymentStatus,
} from './paymentService';

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
type TripType = 'DALAM_KOTA' | 'LUAR_KOTA';

export interface AdminDashboardUser {
  id: string;
  role?: string | null;
}

type AdminDashboardMetricsRow = AdminDashboardMetrics;

export interface AdminDashboardRecentPaymentRow {
  paymentId: string;
  paymentStatus: PaymentStatus;
  amount: number;
  submittedAt: Date;
  reviewExpiresAt: Date;
  bookingId: string;
  bookingStatus: BookingStatus;
  reservationExpiresAt: Date | null;
  customerId: string;
  customerName: string;
  customerEmail: string;
  carId: string;
  carBrand: string;
  carModel: string;
  carCategory: string;
}

export interface AdminDashboardRecentBookingRow {
  bookingId: string;
  bookingStatus: BookingStatus;
  createdAt: Date;
  reservationExpiresAt: Date | null;
  startDate: Date;
  endDate: Date;
  tripType: TripType;
  totalPrice: number;
  customerId: string;
  customerName: string;
  customerEmail: string;
  carId: string;
  carBrand: string;
  carModel: string;
  carCategory: string;
  snapshotTotalInvoiceDisplay: number | null;
  paymentStatus: PaymentStatus | null;
}

interface AdminDashboardRepository {
  expireSubmittedPayments(now: Date): Promise<void>;
  getMetrics(now: Date, today: string): Promise<AdminDashboardMetrics>;
  listRecentPayments(limit: number): Promise<AdminDashboardRecentPaymentRow[]>;
  listRecentBookings(limit: number): Promise<AdminDashboardRecentBookingRow[]>;
}

interface AdminDashboardDependencies {
  repository?: AdminDashboardRepository;
  now?: () => Date;
}

function mapRows<T>(result: { rows?: unknown[] } | unknown[]): T[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as T[];
}

function normalizeDatabaseDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

function requireDatabaseDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function calculateRentalDurationDays(startDate: Date, endDate: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay));
}

function normalizeCount(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function assertAdminUser(user: AdminDashboardUser | null | undefined): AdminDashboardUser {
  if (!user?.id) {
    throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'Login admin diperlukan untuk membaca dashboard.');
  }

  if (user.role !== 'ADMIN') {
    throw new PaymentServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'Hanya admin yang dapat membaca dashboard.');
  }

  return user;
}

function isPaymentReviewable(
  paymentStatus: PaymentStatus,
  bookingStatus: BookingStatus,
  reviewExpiresAt: Date,
  reservationExpiresAt: Date | null,
  now: Date,
): boolean {
  return paymentStatus === 'SUBMITTED' &&
    bookingStatus === 'PENDING' &&
    reviewExpiresAt.getTime() > now.getTime() &&
    !!reservationExpiresAt &&
    reservationExpiresAt.getTime() > now.getTime();
}

function createDefaultRepository(): AdminDashboardRepository {
  return {
    async expireSubmittedPayments(now) {
      await drizzlePaymentRepository.expireSubmittedPayments(now);
    },

    async getMetrics(now, today) {
      const result = await db.execute(sql`
        select
          (select count(*)::int from bookings) as "totalBookings",
          (
            select count(*)::int
            from bookings b
            where b.status = 'PENDING'
              and (b."reservationExpiresAt" is null or b."reservationExpiresAt" > ${now})
          ) as "activePendingBookings",
          (
            select count(*)::int
            from bookings b
            left join booking_payments p on p."bookingId" = b.id
            where b.status = 'PENDING'
              and (b."reservationExpiresAt" is null or b."reservationExpiresAt" > ${now})
              and p.id is null
          ) as "awaitingPaymentProof",
          (
            select count(*)::int
            from booking_payments p
            join bookings b on b.id = p."bookingId"
            where p.status = 'SUBMITTED'
              and p."reviewExpiresAt" > ${now}
              and b.status = 'PENDING'
              and b."reservationExpiresAt" is not null
              and b."reservationExpiresAt" > ${now}
          ) as "awaitingPaymentVerification",
          (
            select count(*)::int
            from bookings b
            where b.status = 'CONFIRMED'
          ) as "confirmedBookings",
          (
            select count(*)::int
            from bookings b
            left join booking_payments p on p."bookingId" = b.id
            where b.status = 'CANCELLED' or p.status = 'EXPIRED'
          ) as "cancelledOrExpiredBookings",
          (
            select coalesce(sum(coalesce(bps."totalInvoiceDisplay", p.amount)), 0)::int
            from booking_payments p
            join bookings b on b.id = p."bookingId"
            left join booking_price_snapshots bps on bps."bookingId" = b.id
            where p.status = 'VERIFIED'
          ) as "verifiedPaymentTotal",
          (
            select count(*)::int
            from car_units cu
            where cu.status = 'ACTIVE'
          ) as "activeFleetUnits",
          (
            select count(*)::int
            from car_units cu
            where cu.status = 'ACTIVE'
              and not exists (
                select 1
                from bookings b
                where b."carUnitId" = cu.id
                  and b."startDate"::date <= ${today}::date
                  and b."endDate"::date > ${today}::date
                  and (
                    b.status = 'CONFIRMED'
                    or (
                      b.status = 'PENDING'
                      and (b."reservationExpiresAt" is null or b."reservationExpiresAt" > ${now})
                    )
                  )
              )
          ) as "availableFleetUnitsNow"
      `);
      const [row] = mapRows<AdminDashboardMetricsRow>(result);

      return {
        totalBookings: normalizeCount(row?.totalBookings),
        activePendingBookings: normalizeCount(row?.activePendingBookings),
        awaitingPaymentProof: normalizeCount(row?.awaitingPaymentProof),
        awaitingPaymentVerification: normalizeCount(row?.awaitingPaymentVerification),
        confirmedBookings: normalizeCount(row?.confirmedBookings),
        cancelledOrExpiredBookings: normalizeCount(row?.cancelledOrExpiredBookings),
        verifiedPaymentTotal: normalizeCount(row?.verifiedPaymentTotal),
        activeFleetUnits: normalizeCount(row?.activeFleetUnits),
        availableFleetUnitsNow: normalizeCount(row?.availableFleetUnitsNow),
      };
    },

    async listRecentPayments(limit) {
      const result = await db.execute(sql`
        select
          p.id as "paymentId",
          p.status as "paymentStatus",
          p.amount,
          p."submittedAt" as "submittedAt",
          p."reviewExpiresAt" as "reviewExpiresAt",
          b.id as "bookingId",
          b.status as "bookingStatus",
          b."reservationExpiresAt" as "reservationExpiresAt",
          u.id as "customerId",
          u.name as "customerName",
          u.email as "customerEmail",
          c.id as "carId",
          c.brand as "carBrand",
          c.model as "carModel",
          c.category as "carCategory"
        from booking_payments p
        join bookings b on b.id = p."bookingId"
        join users u on u.id = b."userId"
        join cars c on c.id = b."carId"
        order by
          case when p.status = 'SUBMITTED' then 0 else 1 end,
          p."submittedAt" desc
        limit ${limit}
      `);

      return mapRows<AdminDashboardRecentPaymentRow>(result).map((row) => ({
        ...row,
        submittedAt: requireDatabaseDate(row.submittedAt),
        reviewExpiresAt: requireDatabaseDate(row.reviewExpiresAt),
        reservationExpiresAt: normalizeDatabaseDate(row.reservationExpiresAt),
      }));
    },

    async listRecentBookings(limit) {
      const result = await db.execute(sql`
        select
          b.id as "bookingId",
          b.status as "bookingStatus",
          b."createdAt" as "createdAt",
          b."reservationExpiresAt" as "reservationExpiresAt",
          b."startDate" as "startDate",
          b."endDate" as "endDate",
          b."tripType" as "tripType",
          b."totalPrice" as "totalPrice",
          u.id as "customerId",
          u.name as "customerName",
          u.email as "customerEmail",
          c.id as "carId",
          c.brand as "carBrand",
          c.model as "carModel",
          c.category as "carCategory",
          bps."totalInvoiceDisplay" as "snapshotTotalInvoiceDisplay",
          p.status as "paymentStatus"
        from bookings b
        join users u on u.id = b."userId"
        join cars c on c.id = b."carId"
        left join booking_price_snapshots bps on bps."bookingId" = b.id
        left join booking_payments p on p."bookingId" = b.id
        order by b."createdAt" desc
        limit ${limit}
      `);

      return mapRows<AdminDashboardRecentBookingRow>(result).map((row) => ({
        ...row,
        createdAt: requireDatabaseDate(row.createdAt),
        reservationExpiresAt: normalizeDatabaseDate(row.reservationExpiresAt),
        startDate: requireDatabaseDate(row.startDate),
        endDate: requireDatabaseDate(row.endDate),
      }));
    },
  };
}

function mapRecentPayment(row: AdminDashboardRecentPaymentRow, now: Date): AdminDashboardRecentPayment {
  return {
    paymentId: row.paymentId,
    paymentStatus: row.paymentStatus,
    bookingId: row.bookingId,
    bookingStatus: row.bookingStatus,
    amount: row.amount,
    submittedAt: row.submittedAt.toISOString(),
    reviewExpiresAt: row.reviewExpiresAt.toISOString(),
    canReview: isPaymentReviewable(
      row.paymentStatus,
      row.bookingStatus,
      row.reviewExpiresAt,
      row.reservationExpiresAt,
      now,
    ),
    customer: {
      id: row.customerId,
      name: row.customerName,
      email: row.customerEmail,
    },
    car: {
      id: row.carId,
      name: `${row.carBrand} ${row.carModel}`.trim(),
      category: row.carCategory,
    },
  };
}

function mapRecentBooking(row: AdminDashboardRecentBookingRow): AdminDashboardRecentBooking {
  return {
    bookingId: row.bookingId,
    bookingStatus: row.bookingStatus,
    createdAt: row.createdAt.toISOString(),
    customer: {
      id: row.customerId,
      name: row.customerName,
      email: row.customerEmail,
    },
    car: {
      id: row.carId,
      name: `${row.carBrand} ${row.carModel}`.trim(),
      category: row.carCategory,
    },
    rental: {
      pickupDate: toDateOnlyString(row.startDate),
      returnDate: toDateOnlyString(row.endDate),
      durationDays: calculateRentalDurationDays(row.startDate, row.endDate),
      tripType: row.tripType,
    },
    totalInvoiceDisplay: row.snapshotTotalInvoiceDisplay ?? row.totalPrice,
    paymentStatus: row.paymentStatus,
  };
}

export async function readAdminDashboard(
  user: AdminDashboardUser | null | undefined,
  dependencies: AdminDashboardDependencies = {},
): Promise<AdminDashboardResponse> {
  assertAdminUser(user);

  const repository = dependencies.repository ?? createDefaultRepository();
  const now = dependencies.now ?? (() => new Date());
  const referenceTime = now();
  const today = toDateOnlyString(referenceTime);

  await repository.expireSubmittedPayments(referenceTime);

  const [metrics, recentPayments, recentBookings] = await Promise.all([
    repository.getMetrics(referenceTime, today),
    repository.listRecentPayments(5),
    repository.listRecentBookings(5),
  ]);

  return {
    generatedAt: referenceTime.toISOString(),
    metrics,
    recentPayments: recentPayments.map((row) => mapRecentPayment(row, referenceTime)),
    recentBookings: recentBookings.map(mapRecentBooking),
  };
}
