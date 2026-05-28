import { sql } from 'drizzle-orm';
import { db } from '../db';
import { toDateOnlyString } from '../domain/pricing/dateHelpers';
import {
  buildCustomerBookingPaymentPath,
  deriveCustomerBookingDisplayStatus,
  type CustomerBookingsResponse,
  type CustomerDashboardBooking,
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

interface CustomerBookingDashboardRepository {
  expireSubmittedPayments(now: Date): Promise<void>;
  listCustomerBookings(userId: string): Promise<CustomerBookingDashboardRow[]>;
}

interface CustomerBookingDashboardDependencies {
  repository?: CustomerBookingDashboardRepository;
  now?: () => Date;
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

function mapRows<T>(result: { rows?: unknown[] } | unknown[]): T[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as T[];
}

function createDefaultRepository(): CustomerBookingDashboardRepository {
  return {
    async expireSubmittedPayments(now) {
      await drizzlePaymentRepository.expireSubmittedPayments(now);
    },

    async listCustomerBookings(userId) {
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
        left join booking_price_snapshots bps on bps."bookingId" = b.id
        left join booking_payments p on p."bookingId" = b.id
        where b."userId" = ${userId}
        order by b."createdAt" desc
        limit 100
      `);

      return mapRows<CustomerBookingDashboardRow>(result).map((row) => ({
        ...row,
        reservationExpiresAt: normalizeDatabaseDate(row.reservationExpiresAt),
        createdAt: requireDatabaseDate(row.createdAt),
        startDate: requireDatabaseDate(row.startDate),
        endDate: requireDatabaseDate(row.endDate),
        paymentSubmittedAt: normalizeDatabaseDate(row.paymentSubmittedAt),
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
      paymentPath: buildCustomerBookingPaymentPath(row.bookingId),
    },
  };
}

function summarizeCustomerBookings(bookings: CustomerDashboardBooking[]) {
  return {
    totalBookings: bookings.length,
    activeBookings: bookings.filter((booking) =>
      booking.displayStatus === 'WAITING_PAYMENT_PROOF' ||
      booking.displayStatus === 'WAITING_ADMIN_VERIFICATION' ||
      booking.displayStatus === 'CONFIRMED'
    ).length,
    completedOrConfirmedBookings: bookings.filter((booking) =>
      booking.displayStatus === 'CONFIRMED' || booking.displayStatus === 'COMPLETED'
    ).length,
  };
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

  await repository.expireSubmittedPayments(referenceTime);

  const rows = await repository.listCustomerBookings(user.id);
  const bookings = rows.map((row) => mapCustomerBookingRow(row, referenceTime));

  return {
    customer: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
    },
    summary: summarizeCustomerBookings(bookings),
    bookings,
  };
}
