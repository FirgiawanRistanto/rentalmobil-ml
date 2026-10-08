import { sql } from 'drizzle-orm';
import { db } from '../db';
import { parseDbTimestamp, toDateOnlyString } from '../domain/pricing/dateHelpers';
import {
  buildAdminReportCode,
  parseAdminReportQuery,
  type AdminReportBreakdownItem,
  type AdminReportMetrics,
  type AdminReportQuery,
  type AdminReportRecentTransaction,
  type AdminReportResponse,
  type AdminReportTopItem,
} from '../lib/adminReportUi';
import {
  PaymentServiceError,
  drizzlePaymentRepository,
  type PaymentStatus,
} from './paymentService';
import type { BookingStatus, TripType } from '../lib/paymentUi';

export interface AdminReportUser {
  id: string;
  role?: string | null;
}

interface AdminReportRange {
  startDate: string;
  endDate: string;
  startAt: Date;
  endAtExclusive: Date;
}

type CountByKeyRow = {
  key: string;
  count: number | string;
};

interface AdminReportTopRow {
  id: string;
  label: string;
  category: string | null;
  bookingCount: number | string;
  totalInvoiceDisplay: number | string | null;
}

interface AdminReportRecentRow {
  bookingId: string;
  bookingStatus: BookingStatus;
  createdAt: Date | string;
  startDate: Date | string;
  endDate: Date | string;
  tripType: TripType;
  totalPrice: number;
  customerName: string;
  customerEmail: string;
  carBrand: string;
  carModel: string;
  carCategory: string;
  snapshotTotalInvoiceDisplay: number | null;
  paymentStatus: PaymentStatus | null;
}

interface AdminReportRepository {
  expireSubmittedPayments(now: Date): Promise<void>;
  getMetrics(range: AdminReportRange): Promise<AdminReportMetrics>;
  getBookingStatusBreakdown(range: AdminReportRange): Promise<CountByKeyRow[]>;
  getPaymentStatusBreakdown(range: AdminReportRange): Promise<CountByKeyRow[]>;
  listTopCars(range: AdminReportRange, limit: number): Promise<AdminReportTopRow[]>;
  listTopCategories(range: AdminReportRange, limit: number): Promise<AdminReportTopRow[]>;
  listRecentTransactions(range: AdminReportRange, limit: number): Promise<AdminReportRecentRow[]>;
}

interface AdminReportDependencies {
  repository?: AdminReportRepository;
  now?: () => Date;
  query?: URLSearchParams | Record<string, string | string[] | undefined> | Partial<AdminReportQuery>;
}

function assertAdminUser(user: AdminReportUser | null | undefined): AdminReportUser {
  if (!user?.id) {
    throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'Login admin diperlukan untuk membaca laporan.');
  }

  if (user.role !== 'ADMIN') {
    throw new PaymentServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'Hanya admin yang dapat membaca laporan.');
  }

  return user;
}

function mapRows<T>(result: { rows?: unknown[] } | unknown[]): T[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as T[];
}

function normalizeCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMoney(value: unknown): number {
  return Math.round(normalizeCount(value));
}

function normalizeDatabaseDate(value: Date | string): Date {
  return value instanceof Date ? value : parseDbTimestamp(value);
}

function calculateRentalDurationDays(startDate: Date, endDate: Date): number {
  const start = Date.parse(`${toDateOnlyString(startDate)}T00:00:00.000Z`);
  const end = Date.parse(`${toDateOnlyString(endDate)}T00:00:00.000Z`);
  return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)));
}

function normalizeQuery(
  query: AdminReportDependencies['query'],
  referenceDate: Date,
): AdminReportQuery {
  if (!query) {
    return parseAdminReportQuery({}, referenceDate);
  }

  if (query instanceof URLSearchParams) {
    return parseAdminReportQuery(query, referenceDate);
  }

  return parseAdminReportQuery(
    Object.fromEntries(
      Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? value : String(value ?? '')]),
    ),
    referenceDate,
  );
}

function parseDateOnlyAsLocalStart(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function createRange(query: AdminReportQuery): AdminReportRange {
  const startAt = parseDateOnlyAsLocalStart(query.startDate);
  const endAtExclusive = parseDateOnlyAsLocalStart(query.endDate);
  endAtExclusive.setDate(endAtExclusive.getDate() + 1);

  return {
    ...query,
    startAt,
    endAtExclusive,
  };
}

function createDefaultRepository(): AdminReportRepository {
  return {
    async expireSubmittedPayments(now) {
      await drizzlePaymentRepository.expireSubmittedPayments(now);
    },

    async getMetrics(range) {
      const result = await db.execute(sql`
        select
          (
            select count(*)::int
            from bookings b
            where b."createdAt" >= ${range.startAt}
              and b."createdAt" < ${range.endAtExclusive}
          ) as "totalBookings",
          (
            select count(*)::int
            from bookings b
            where b.status = 'PENDING'
              and b."createdAt" >= ${range.startAt}
              and b."createdAt" < ${range.endAtExclusive}
          ) as "pendingBookings",
          (
            select count(*)::int
            from bookings b
            where b.status = 'CONFIRMED'
              and b."createdAt" >= ${range.startAt}
              and b."createdAt" < ${range.endAtExclusive}
          ) as "confirmedBookings",
          (
            select count(*)::int
            from bookings b
            where b.status = 'COMPLETED'
              and b."createdAt" >= ${range.startAt}
              and b."createdAt" < ${range.endAtExclusive}
          ) as "completedBookings",
          (
            select count(*)::int
            from bookings b
            where b.status = 'CANCELLED'
              and b."createdAt" >= ${range.startAt}
              and b."createdAt" < ${range.endAtExclusive}
          ) as "cancelledBookings",
          (
            select count(*)::int
            from booking_payments p
            where p.status = 'SUBMITTED'
              and p."submittedAt" >= ${range.startAt}
              and p."submittedAt" < ${range.endAtExclusive}
          ) as "submittedPayments",
          (
            select count(*)::int
            from booking_payments p
            where p.status = 'VERIFIED'
              and p."submittedAt" >= ${range.startAt}
              and p."submittedAt" < ${range.endAtExclusive}
          ) as "verifiedPayments",
          (
            select count(*)::int
            from booking_payments p
            where p.status = 'REJECTED'
              and p."submittedAt" >= ${range.startAt}
              and p."submittedAt" < ${range.endAtExclusive}
          ) as "rejectedPayments",
          (
            select count(*)::int
            from booking_payments p
            where p.status = 'EXPIRED'
              and p."submittedAt" >= ${range.startAt}
              and p."submittedAt" < ${range.endAtExclusive}
          ) as "expiredPayments",
          (
            select coalesce(sum(coalesce(bps."totalInvoiceDisplay", p.amount)), 0)::int
            from booking_payments p
            join bookings b on b.id = p."bookingId"
            left join booking_price_snapshots bps on bps."bookingId" = b.id
            where p.status = 'VERIFIED'
              and p."submittedAt" >= ${range.startAt}
              and p."submittedAt" < ${range.endAtExclusive}
          ) as "verifiedPaymentTotal",
          (
            select coalesce(avg(coalesce(bps."totalInvoiceDisplay", b."totalPrice")), 0)::int
            from bookings b
            left join booking_price_snapshots bps on bps."bookingId" = b.id
            where b."createdAt" >= ${range.startAt}
              and b."createdAt" < ${range.endAtExclusive}
          ) as "averageInvoiceValue",
          (
            select count(*)::int
            from pricing_quotes pq
            where pq."createdAt" >= ${range.startAt}
              and pq."createdAt" < ${range.endAtExclusive}
          ) as "totalQuotes",
          (
            select count(*)::int
            from pricing_quotes pq
            where pq.status = 'ACCEPTED'
              and pq."createdAt" >= ${range.startAt}
              and pq."createdAt" < ${range.endAtExclusive}
          ) as "acceptedQuotes",
          (
            select coalesce(avg(bps."predictedPriceAdjustmentPct"::numeric) * 100, 0)::numeric
            from booking_price_snapshots bps
            join bookings b on b.id = bps."bookingId"
            where b."createdAt" >= ${range.startAt}
              and b."createdAt" < ${range.endAtExclusive}
          ) as "averageAdjustmentPercentDisplay",
          (
            select coalesce(sum(
              coalesce(bps."basePricePerDay", 0) *
              greatest(1, (b."endDate"::date - b."startDate"::date))
            ), 0)::int
            from booking_price_snapshots bps
            join bookings b on b.id = bps."bookingId"
            where b."createdAt" >= ${range.startAt}
              and b."createdAt" < ${range.endAtExclusive}
          ) as "dynamicPricingFlatTotal",
          (
            select coalesce(sum(coalesce(bps."totalInvoiceDisplay", 0)), 0)::int
            from booking_price_snapshots bps
            join bookings b on b.id = bps."bookingId"
            where b."createdAt" >= ${range.startAt}
              and b."createdAt" < ${range.endAtExclusive}
          ) as "dynamicPricingDynamicTotal",
          (
            select coalesce(sum(
              coalesce(bps."totalInvoiceDisplay", 0) -
              (coalesce(bps."basePricePerDay", 0) * greatest(1, (b."endDate"::date - b."startDate"::date)))
            ), 0)::int
            from booking_price_snapshots bps
            join bookings b on b.id = bps."bookingId"
            where b."createdAt" >= ${range.startAt}
              and b."createdAt" < ${range.endAtExclusive}
          ) as "dynamicPricingUplift",
          (
            select count(*)::int
            from booking_fines f
            where f."createdAt" >= ${range.startAt}
              and f."createdAt" < ${range.endAtExclusive}
          ) as "totalFines",
          (
            select coalesce(sum(f."fineAmount"), 0)::int
            from booking_fines f
            where f.status = 'VERIFIED'
              and f."createdAt" >= ${range.startAt}
              and f."createdAt" < ${range.endAtExclusive}
          ) as "verifiedFineTotal",
          (
            select coalesce(sum(f."fineAmount"), 0)::int
            from booking_fines f
            where f.status in ('AWAITING_PAYMENT', 'SUBMITTED')
              and f."createdAt" >= ${range.startAt}
              and f."createdAt" < ${range.endAtExclusive}
          ) as "pendingFineTotal",
          (
            select coalesce(sum(f."fineAmount"), 0)::int
            from booking_fines f
            where f.status = 'REJECTED'
              and f."createdAt" >= ${range.startAt}
              and f."createdAt" < ${range.endAtExclusive}
          ) as "rejectedFineTotal"
      `);
      const [row] = mapRows<Record<string, unknown>>(result);

      return {
        totalBookings: normalizeCount(row?.totalBookings),
        pendingBookings: normalizeCount(row?.pendingBookings),
        confirmedBookings: normalizeCount(row?.confirmedBookings),
        completedBookings: normalizeCount(row?.completedBookings),
        cancelledBookings: normalizeCount(row?.cancelledBookings),
        submittedPayments: normalizeCount(row?.submittedPayments),
        verifiedPayments: normalizeCount(row?.verifiedPayments),
        rejectedPayments: normalizeCount(row?.rejectedPayments),
        expiredPayments: normalizeCount(row?.expiredPayments),
        verifiedPaymentTotal: normalizeMoney(row?.verifiedPaymentTotal),
        averageInvoiceValue: normalizeMoney(row?.averageInvoiceValue),
        totalQuotes: normalizeCount(row?.totalQuotes),
        acceptedQuotes: normalizeCount(row?.acceptedQuotes),
        averageAdjustmentPercentDisplay: Number(row?.averageAdjustmentPercentDisplay ?? 0),
        dynamicPricingFlatTotal: normalizeMoney(row?.dynamicPricingFlatTotal),
        dynamicPricingDynamicTotal: normalizeMoney(row?.dynamicPricingDynamicTotal),
        dynamicPricingUplift: normalizeMoney(row?.dynamicPricingUplift),
        totalFines: normalizeCount(row?.totalFines),
        verifiedFineTotal: normalizeMoney(row?.verifiedFineTotal),
        pendingFineTotal: normalizeMoney(row?.pendingFineTotal),
        rejectedFineTotal: normalizeMoney(row?.rejectedFineTotal),
      };
    },

    async getBookingStatusBreakdown(range) {
      const result = await db.execute(sql`
        select b.status as "key", count(*)::int as "count"
        from bookings b
        where b."createdAt" >= ${range.startAt}
          and b."createdAt" < ${range.endAtExclusive}
        group by b.status
        order by count(*) desc
      `);
      return mapRows<CountByKeyRow>(result);
    },

    async getPaymentStatusBreakdown(range) {
      const result = await db.execute(sql`
        select p.status as "key", count(*)::int as "count"
        from booking_payments p
        where p."submittedAt" >= ${range.startAt}
          and p."submittedAt" < ${range.endAtExclusive}
        group by p.status
        order by count(*) desc
      `);
      return mapRows<CountByKeyRow>(result);
    },

    async listTopCars(range, limit) {
      const result = await db.execute(sql`
        select
          c.id as "id",
          concat(c.brand, ' ', c.model) as "label",
          c.category as "category",
          count(*)::int as "bookingCount",
          coalesce(sum(coalesce(bps."totalInvoiceDisplay", b."totalPrice")), 0)::int as "totalInvoiceDisplay"
        from bookings b
        join cars c on c.id = b."carId"
        left join booking_price_snapshots bps on bps."bookingId" = b.id
        where b."createdAt" >= ${range.startAt}
          and b."createdAt" < ${range.endAtExclusive}
        group by c.id, c.brand, c.model, c.category
        order by count(*) desc, "totalInvoiceDisplay" desc
        limit ${limit}
      `);
      return mapRows<AdminReportTopRow>(result);
    },

    async listTopCategories(range, limit) {
      const result = await db.execute(sql`
        select
          c.category as "id",
          c.category as "label",
          c.category as "category",
          count(*)::int as "bookingCount",
          coalesce(sum(coalesce(bps."totalInvoiceDisplay", b."totalPrice")), 0)::int as "totalInvoiceDisplay"
        from bookings b
        join cars c on c.id = b."carId"
        left join booking_price_snapshots bps on bps."bookingId" = b.id
        where b."createdAt" >= ${range.startAt}
          and b."createdAt" < ${range.endAtExclusive}
        group by c.category
        order by count(*) desc, "totalInvoiceDisplay" desc
        limit ${limit}
      `);
      return mapRows<AdminReportTopRow>(result);
    },

    async listRecentTransactions(range, limit) {
      const result = await db.execute(sql`
        select
          b.id as "bookingId",
          b.status as "bookingStatus",
          b."createdAt" as "createdAt",
          b."startDate" as "startDate",
          b."endDate" as "endDate",
          b."tripType" as "tripType",
          b."totalPrice" as "totalPrice",
          u.name as "customerName",
          u.email as "customerEmail",
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
        where b."createdAt" >= ${range.startAt}
          and b."createdAt" < ${range.endAtExclusive}
        order by b."createdAt" desc
        limit ${limit}
      `);
      return mapRows<AdminReportRecentRow>(result);
    },
  };
}

function mapBreakdown(rows: CountByKeyRow[], labels: Record<string, string>): AdminReportBreakdownItem[] {
  return rows.map((row) => ({
    key: row.key,
    label: labels[row.key] ?? row.key,
    count: normalizeCount(row.count),
  }));
}

function mapTopItem(row: AdminReportTopRow): AdminReportTopItem {
  return {
    id: row.id,
    label: row.label,
    category: row.category,
    bookingCount: normalizeCount(row.bookingCount),
    totalInvoiceDisplay: normalizeMoney(row.totalInvoiceDisplay),
  };
}

function mapRecentTransaction(row: AdminReportRecentRow): AdminReportRecentTransaction {
  const startDate = normalizeDatabaseDate(row.startDate);
  const endDate = normalizeDatabaseDate(row.endDate);

  return {
    bookingId: row.bookingId,
    bookingCode: buildAdminReportCode(row.bookingId),
    bookingStatus: row.bookingStatus,
    paymentStatus: row.paymentStatus,
    createdAt: normalizeDatabaseDate(row.createdAt).toISOString(),
    customer: {
      name: row.customerName,
      email: row.customerEmail,
    },
    car: {
      name: `${row.carBrand} ${row.carModel}`.trim(),
      category: row.carCategory,
    },
    rental: {
      pickupDate: toDateOnlyString(startDate),
      returnDate: toDateOnlyString(endDate),
      durationDays: calculateRentalDurationDays(startDate, endDate),
      tripType: row.tripType,
    },
    totalInvoiceDisplay: row.snapshotTotalInvoiceDisplay ?? row.totalPrice,
    detailPath: `/admin/transaksi/${encodeURIComponent(row.bookingId)}`,
  };
}

export async function readAdminReport(
  user: AdminReportUser | null | undefined,
  dependencies: AdminReportDependencies = {},
): Promise<AdminReportResponse> {
  assertAdminUser(user);

  const repository = dependencies.repository ?? createDefaultRepository();
  const now = dependencies.now ?? (() => new Date());
  const referenceTime = now();
  const period = normalizeQuery(dependencies.query, referenceTime);
  const range = createRange(period);

  await repository.expireSubmittedPayments(referenceTime);

  const [
    metrics,
    bookingStatusRows,
    paymentStatusRows,
    topCars,
    topCategories,
    recentTransactions,
  ] = await Promise.all([
    repository.getMetrics(range),
    repository.getBookingStatusBreakdown(range),
    repository.getPaymentStatusBreakdown(range),
    repository.listTopCars(range, 5),
    repository.listTopCategories(range, 5),
    repository.listRecentTransactions(range, 10),
  ]);

  return {
    generatedAt: referenceTime.toISOString(),
    period,
    modelLabel: 'Model Harga Dinamis',
    metrics,
    bookingStatusBreakdown: mapBreakdown(bookingStatusRows, {
      PENDING: 'Pending',
      CONFIRMED: 'Dikonfirmasi',
      CANCELLED: 'Dibatalkan',
      COMPLETED: 'Selesai',
      EXPIRED: 'Kedaluwarsa',
    }),
    paymentStatusBreakdown: mapBreakdown(paymentStatusRows, {
      SUBMITTED: 'Menunggu Verifikasi',
      VERIFIED: 'Terverifikasi',
      REJECTED: 'Ditolak',
      EXPIRED: 'Kedaluwarsa',
    }),
    topCars: topCars.map(mapTopItem),
    topCategories: topCategories.map(mapTopItem),
    recentTransactions: recentTransactions.map(mapRecentTransaction),
  };
}
