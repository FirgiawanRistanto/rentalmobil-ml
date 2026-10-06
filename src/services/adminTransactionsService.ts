import { sql } from 'drizzle-orm';
import { db } from '../db';
import { toDateOnlyString } from '../domain/pricing/dateHelpers';
import {
  buildAdminTransactionCode,
  buildAdminTransactionDetailPath,
  parseAdminTransactionsSearchParams,
  getAdminTransactionDisplayStatus,
  type AdminTransactionsQuery,
  type AdminBookingStatusUpdateResponse,
  type AdminTransactionDetailResponse,
  type AdminTransactionListItem,
  type AdminTransactionsResponse,
} from '../lib/adminTransactionUi';
import { computeLateReturnFine, LATE_FINE_DAILY_RATE_PCT } from '../lib/bookingFineUi';
import {
  BOOKING_EXTENSION_STATUSES,
  type BookingExtensionStatus,
} from '../lib/bookingExtensionUi';
import { LATE_FINE_RATE_SETTING_KEY, isValidLateFineRatePct } from '../lib/pricingSettingsUi';
import { type BookingStatus, type PaymentStatus, type TripType } from '../lib/paymentUi';
import {
  PaymentServiceError,
  drizzlePaymentRepository,
} from './paymentService';

export interface AdminTransactionsUser {
  id: string;
  role?: string | null;
}

export class AdminTransactionsServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AdminTransactionsServiceError';
  }
}

interface AdminTransactionRow {
  bookingId: string;
  bookingStatus: BookingStatus;
  createdAt: Date | string;
  reservationExpiresAt: Date | string | null;
  startDate: Date | string;
  endDate: Date | string;
  tripType: TripType;
  totalPrice: number;
  phoneNumber: string | null;
  pickupAddress: string | null;
  notes: string | null;
  customerId: string;
  customerName: string;
  customerEmail: string;
  carId: string;
  carBrand: string;
  carModel: string;
  carCategory: string;
  carUnitPlate: string | null;
  snapshotBasePricePerDay: number | null;
  snapshotPredictedPriceAdjustmentPct: string | number | null;
  snapshotDynamicPriceRawPerDay: number | null;
  snapshotDynamicPriceDisplayPerDay: number | null;
  snapshotTotalInvoiceDisplay: number | null;
  snapshotModelVersion: string | null;
  snapshotPricingReasons: unknown;
  paymentId: string | null;
  paymentStatus: PaymentStatus | null;
  paymentAmount: number | null;
  paymentSubmittedAt: Date | string | null;
  paymentReviewExpiresAt: Date | string | null;
  paymentReviewedAt: Date | string | null;
  paymentRejectionReason: string | null;
  extensionStatus: string | null;
}

interface AdminBookingStatusRow {
  bookingId: string;
  bookingStatus: BookingStatus;
}

interface AdminBookingStatusTransactionRepository {
  lockBooking(bookingId: string): Promise<AdminBookingStatusRow | null>;
  updateBookingStatus(bookingId: string, nextStatus: BookingStatus, updatedAt: Date): Promise<void>;
  completeBookingWithFine(bookingId: string, actualReturnDate: Date): Promise<void>;
}

interface AdminTransactionsRepository {
  expireSubmittedPayments(now: Date): Promise<void>;
  transaction?<T>(callback: (tx: AdminBookingStatusTransactionRepository) => Promise<T>): Promise<T>;
  listTransactions(query: AdminTransactionsQuery, now: Date): Promise<{
    rows: AdminTransactionRow[];
    totalItems: number;
  }>;
  findTransaction(bookingId: string): Promise<AdminTransactionRow | null>;
}

interface AdminTransactionsDependencies {
  repository?: AdminTransactionsRepository;
  now?: () => Date;
  query?: URLSearchParams | Record<string, string | string[] | undefined> | Partial<AdminTransactionsQuery>;
}

function mapRows<T>(result: { rows?: unknown[] } | unknown[]): T[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as T[];
}

function readCount(result: { rows?: unknown[] } | unknown[]): number {
  const [row] = mapRows<Record<string, unknown>>(result);
  const value = row?.count ?? row?.totalItems ?? 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const start = Date.parse(`${toDateOnlyString(startDate)}T00:00:00.000Z`);
  const end = Date.parse(`${toDateOnlyString(endDate)}T00:00:00.000Z`);

  return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)));
}

function normalizeOptionalNumber(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOOKING_STATUSES = new Set<BookingStatus>(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED']);

function assertAdminUser(user: AdminTransactionsUser | null | undefined): AdminTransactionsUser {
  if (!user?.id) {
    throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'Login admin diperlukan untuk membaca transaksi.');
  }

  if (user.role !== 'ADMIN') {
    throw new PaymentServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'Hanya admin yang dapat membaca transaksi.');
  }

  return user;
}

function assertBookingId(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new AdminTransactionsServiceError('ADMIN_TRANSACTION_NOT_FOUND', 'Data transaksi tidak ditemukan.');
  }

  return value;
}

function normalizeBookingStatus(value: unknown): BookingStatus {
  if (typeof value !== 'string' || !BOOKING_STATUSES.has(value as BookingStatus)) {
    throw new AdminTransactionsServiceError('INVALID_BOOKING_STATUS_TRANSITION', 'Status booking tujuan tidak valid.');
  }

  return value as BookingStatus;
}

function assertAdminBookingStatusTransition(currentStatus: BookingStatus, nextStatus: BookingStatus): void {
  if (currentStatus === 'COMPLETED' || currentStatus === 'CANCELLED' || currentStatus === 'EXPIRED') {
    throw new AdminTransactionsServiceError('BOOKING_STATUS_FINAL', 'Status final tidak dapat diubah.');
  }

  if (currentStatus === 'CONFIRMED' && nextStatus === 'COMPLETED') {
    return;
  }

  throw new AdminTransactionsServiceError('INVALID_BOOKING_STATUS_TRANSITION', 'Transisi status booking tidak valid.');
}


function parseActualReturnDate(value: unknown, fallback: Date): Date {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AdminTransactionsServiceError('INVALID_RETURN_DATE', 'Tanggal kembali aktual harus memakai format YYYY-MM-DD.');
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new AdminTransactionsServiceError('INVALID_RETURN_DATE', 'Tanggal kembali aktual tidak valid.');
  }

  return date;
}
function normalizeAdminTransactionsQuery(
  query: AdminTransactionsDependencies['query'],
): AdminTransactionsQuery {
  if (!query) {
    return parseAdminTransactionsSearchParams({});
  }

  if (query instanceof URLSearchParams) {
    return parseAdminTransactionsSearchParams(query);
  }

  return parseAdminTransactionsSearchParams(
    Object.fromEntries(
      Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? value : String(value ?? '')]),
    ),
  );
}

function buildSearchSql(query: string) {
  if (!query) {
    return sql``;
  }

  const pattern = `%${query}%`;
  return sql`
    and (
      b.id::text ilike ${pattern}
      or concat('BRM-', upper(substr(b.id::text, 1, 8))) ilike ${pattern}
      or u.name ilike ${pattern}
      or u.email ilike ${pattern}
      or concat(c.brand, ' ', c.model) ilike ${pattern}
    )
  `;
}

function buildStatusSql(query: AdminTransactionsQuery, now: Date) {
  switch (query.status) {
    case 'unpaid':
      return sql`and b.status = 'PENDING' and p.id is null and (b."reservationExpiresAt" is null or b."reservationExpiresAt" > ${now})`;
    case 'waiting_verification':
      return sql`and p.status = 'SUBMITTED' and p."reviewExpiresAt" > ${now}`;
    case 'verified':
      return sql`and (p.status = 'VERIFIED' or b.status = 'CONFIRMED')`;
    case 'rejected':
      return sql`and p.status = 'REJECTED'`;
    case 'expired':
      return sql`
        and (
          b.status = 'EXPIRED'
          or
          p.status = 'EXPIRED'
          or (b.status = 'PENDING' and p.id is null and b."reservationExpiresAt" is not null and b."reservationExpiresAt" <= ${now})
          or (b.status = 'PENDING' and p.status = 'SUBMITTED' and p."reviewExpiresAt" <= ${now})
        )
      `;
    case 'completed':
      return sql`and b.status = 'COMPLETED'`;
    case 'cancelled':
      return sql`and b.status = 'CANCELLED' and (p.status is null or p.status not in ('REJECTED', 'EXPIRED'))`;
    case 'all':
      return sql``;
  }
}

function buildOrderSql(query: AdminTransactionsQuery) {
  const sortSql = {
    createdAt: sql`b."createdAt"`,
    startDate: sql`b."startDate"`,
    totalInvoice: sql`coalesce(bps."totalInvoiceDisplay", p.amount, b."totalPrice")`,
    customerName: sql`lower(u.name)`,
    carName: sql`lower(concat(c.brand, ' ', c.model))`,
  }[query.sort];
  const directionSql = query.order === 'asc' ? sql`asc` : sql`desc`;

  return sql`${sortSql} ${directionSql}, b."createdAt" desc`;
}

function createDefaultRepository(): AdminTransactionsRepository {
  const baseFromSql = sql`
    from bookings b
    join users u on u.id = b."userId"
    join cars c on c.id = b."carId"
    left join car_units cu on cu.id = b."carUnitId"
    left join booking_price_snapshots bps on bps."bookingId" = b.id
    left join booking_payments p on p."bookingId" = b.id
  `;

  function buildWhereSql(query: AdminTransactionsQuery, now: Date) {
    return sql`
      where 1 = 1
      ${buildSearchSql(query.q)}
      ${buildStatusSql(query, now)}
    `;
  }

  async function readRows(
    whereSql = sql`where 1 = 1`,
    orderSql = sql`b."createdAt" desc`,
    limit = 1,
    offset = 0,
  ): Promise<AdminTransactionRow[]> {
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
        b."phoneNumber" as "phoneNumber",
        b."pickupAddress" as "pickupAddress",
        b.notes as "notes",
        u.id as "customerId",
        u.name as "customerName",
        u.email as "customerEmail",
        c.id as "carId",
        c.brand as "carBrand",
        c.model as "carModel",
        c.category as "carCategory",
        cu."plateNumber" as "carUnitPlate",
        bps."basePricePerDay" as "snapshotBasePricePerDay",
        bps."predictedPriceAdjustmentPct" as "snapshotPredictedPriceAdjustmentPct",
        bps."dynamicPriceRawPerDay" as "snapshotDynamicPriceRawPerDay",
        bps."dynamicPriceDisplayPerDay" as "snapshotDynamicPriceDisplayPerDay",
        bps."totalInvoiceDisplay" as "snapshotTotalInvoiceDisplay",
        bps."modelVersion" as "snapshotModelVersion",
        bps."pricingReasons" as "snapshotPricingReasons",
        p.id as "paymentId",
        p.status as "paymentStatus",
        p.amount as "paymentAmount",
        p."submittedAt" as "paymentSubmittedAt",
        p."reviewExpiresAt" as "paymentReviewExpiresAt",
        p."reviewedAt" as "paymentReviewedAt",
        p."rejectionReason" as "paymentRejectionReason",
        (
          select be."status"
          from booking_extensions be
          where be."bookingId" = b.id
          order by be."createdAt" desc
          limit 1
        ) as "extensionStatus"
      ${baseFromSql}
      ${whereSql}
      order by ${orderSql}
      limit ${limit}
      offset ${offset}
    `);

    return mapRows<AdminTransactionRow>(result);
  }

  async function countRows(whereSql = sql`where 1 = 1`): Promise<number> {
    const result = await db.execute(sql`
      select count(*) as "count"
      ${baseFromSql}
      ${whereSql}
    `);

    return readCount(result);
  }

  return {
    async expireSubmittedPayments(now) {
      await drizzlePaymentRepository.expireSubmittedPayments(now);
    },

    async transaction(callback) {
      return db.transaction(async (tx) => {
        const txRepository: AdminBookingStatusTransactionRepository = {
          async lockBooking(bookingId) {
            const result = await tx.execute(sql`
              select
                b.id as "bookingId",
                b.status as "bookingStatus"
              from bookings b
              where b.id = ${bookingId}::uuid
              for update of b
            `);
            const [row] = mapRows<AdminBookingStatusRow>(result);
            return row ?? null;
          },

          async updateBookingStatus(bookingId, nextStatus, updatedAt) {
            await tx.execute(sql`
              update bookings
              set status = ${nextStatus}, "updatedAt" = ${updatedAt}
              where id = ${bookingId}::uuid
            `);
          },
          async completeBookingWithFine(bookingId, actualReturnDate) {
            const extensionRows = mapRows<{ id: string; status: string }>(await tx.execute(sql`
              select id, status
              from booking_extensions
              where "bookingId" = ${bookingId}::uuid
                and status in ('AWAITING_PAYMENT', 'SUBMITTED')
            `));

            if (extensionRows.some((extension) => extension.status === 'SUBMITTED')) {
              throw new AdminTransactionsServiceError(
                'EXTENSION_PENDING_VERIFICATION',
                'Masih ada perpanjangan yang menunggu verifikasi. Verifikasi atau tolak perpanjangan terlebih dahulu.',
              );
            }

            if (extensionRows.some((extension) => extension.status === 'AWAITING_PAYMENT')) {
              await tx.execute(sql`
                update booking_extensions
                set status = 'CANCELLED', "updatedAt" = now()
                where "bookingId" = ${bookingId}::uuid
                  and status = 'AWAITING_PAYMENT'
              `);
            }

            const [bookingRow] = mapRows<{
              endDate: Date | string;
              startDate: Date | string;
              totalPrice: number;
              dynamicPriceDisplayPerDay: number | null;
            }>(await tx.execute(sql`
              select
                b."endDate" as "endDate",
                b."startDate" as "startDate",
                b."totalPrice" as "totalPrice",
                bps."dynamicPriceDisplayPerDay" as "dynamicPriceDisplayPerDay"
              from bookings b
              left join booking_price_snapshots bps on bps."bookingId" = b.id
              where b.id = ${bookingId}::uuid
            `));

            const endDate = bookingRow ? normalizeDatabaseDate(bookingRow.endDate) : null;
            const startDate = bookingRow ? normalizeDatabaseDate(bookingRow.startDate) : null;
            if (!bookingRow || !endDate || !startDate) {
              throw new AdminTransactionsServiceError('ADMIN_TRANSACTION_NOT_FOUND', 'Data transaksi tidak ditemukan.');
            }

            const durationDays = calculateRentalDurationDays(startDate, endDate);
            const fallbackDaily = Math.max(0, Math.round(Number(bookingRow.totalPrice) / durationDays));
            const dailyRate = bookingRow.dynamicPriceDisplayPerDay ?? fallbackDaily;

            // Persentase tarif denda dikonfigurasi admin (pricing_settings);
            // baris absen/rusak jatuh ke default konstanta.
            const rateRows = mapRows<{ value: unknown }>(await tx.execute(sql`
              select "value"
              from pricing_settings
              where "key" = ${LATE_FINE_RATE_SETTING_KEY}
            `));
            const configuredRate = Number(rateRows[0]?.value);
            const lateFineRatePct = isValidLateFineRatePct(configuredRate)
              ? configuredRate
              : LATE_FINE_DAILY_RATE_PCT;

            const fine = computeLateReturnFine(dailyRate, toDateOnlyString(endDate), toDateOnlyString(actualReturnDate), lateFineRatePct);

            if (fine.lateDays < 1) {
              return;
            }

            await tx.execute(sql`
              insert into booking_fines (
                "bookingId", "originalEndDate", "actualReturnDate", "lateDays",
                "finePerDay", "fineAmount", status
              ) values (
                ${bookingId}::uuid,
                ${toDateOnlyString(endDate)}::timestamp,
                ${toDateOnlyString(actualReturnDate)}::timestamp,
                ${fine.lateDays},
                ${fine.finePerDay},
                ${fine.fineAmount},
                'AWAITING_PAYMENT'
              )
            `);
          },
        };

        return callback(txRepository);
      });
    },

    async listTransactions(query, now) {
      const whereSql = buildWhereSql(query, now);
      const totalItems = await countRows(whereSql);
      const rows = totalItems > 0
        ? await readRows(
          whereSql,
          buildOrderSql(query),
          query.pageSize,
          (query.page - 1) * query.pageSize,
        )
        : [];

      return { rows, totalItems };
    },

    async findTransaction(bookingId) {
      const [row] = await readRows(sql`where b.id = ${bookingId}::uuid`);
      return row ?? null;
    },
  };
}

function normalizeExtensionStatus(value: string | null): BookingExtensionStatus | null {
  return BOOKING_EXTENSION_STATUSES.includes(value as BookingExtensionStatus)
    ? (value as BookingExtensionStatus)
    : null;
}

function mapTransactionRow(row: AdminTransactionRow, referenceTime: Date): AdminTransactionListItem {
  const createdAt = requireDatabaseDate(row.createdAt);
  const reservationExpiresAt = normalizeDatabaseDate(row.reservationExpiresAt);
  const startDate = requireDatabaseDate(row.startDate);
  const endDate = requireDatabaseDate(row.endDate);
  const paymentSubmittedAt = normalizeDatabaseDate(row.paymentSubmittedAt);
  const paymentReviewExpiresAt = normalizeDatabaseDate(row.paymentReviewExpiresAt);
  const paymentReviewedAt = normalizeDatabaseDate(row.paymentReviewedAt);
  const totalInvoiceDisplay = row.snapshotTotalInvoiceDisplay ?? row.paymentAmount ?? row.totalPrice;
  const displayStatus = getAdminTransactionDisplayStatus(
    row.bookingStatus,
    row.paymentStatus,
    reservationExpiresAt?.toISOString() ?? null,
    paymentReviewExpiresAt?.toISOString() ?? null,
    referenceTime,
  );

  return {
    bookingId: row.bookingId,
    bookingCode: buildAdminTransactionCode(row.bookingId),
    bookingStatus: row.bookingStatus,
    displayStatus,
    extensionStatus: normalizeExtensionStatus(row.extensionStatus),
    createdAt: createdAt.toISOString(),
    reservationExpiresAt: reservationExpiresAt?.toISOString() ?? null,
    customer: {
      id: row.customerId,
      name: row.customerName,
      email: row.customerEmail,
    },
    car: {
      id: row.carId,
      name: `${row.carBrand} ${row.carModel}`.trim(),
      category: row.carCategory,
      unitPlate: row.carUnitPlate,
    },
    rental: {
      pickupDate: toDateOnlyString(startDate),
      returnDate: toDateOnlyString(endDate),
      durationDays: calculateRentalDurationDays(startDate, endDate),
      tripType: row.tripType,
    },
    pricing: {
      dynamicPriceDisplayPerDay: row.snapshotDynamicPriceDisplayPerDay,
      totalInvoiceDisplay,
      modelVersion: row.snapshotModelVersion,
    },
    payment: row.paymentId
      ? {
        paymentId: row.paymentId,
        paymentStatus: row.paymentStatus ?? 'SUBMITTED',
        amount: row.paymentAmount ?? totalInvoiceDisplay,
        submittedAt: paymentSubmittedAt?.toISOString() ?? null,
        reviewExpiresAt: paymentReviewExpiresAt?.toISOString() ?? null,
        reviewedAt: paymentReviewedAt?.toISOString() ?? null,
        rejectionReason: row.paymentRejectionReason,
      }
      : null,
    actions: {
      detailPath: buildAdminTransactionDetailPath(row.bookingId),
      paymentReviewPath: null,
      proofPath: row.paymentId ? `/api/admin/payments/${row.paymentId}/proof` : null,
    },
  };
}

function mapTransactionDetailRow(row: AdminTransactionRow, referenceTime: Date): AdminTransactionDetailResponse {
  return {
    ...mapTransactionRow(row, referenceTime),
    phoneNumber: row.phoneNumber,
    pickupAddress: row.pickupAddress,
    notes: row.notes,
    priceSnapshot: {
      basePricePerDay: row.snapshotBasePricePerDay,
      predictedPriceAdjustmentPct: normalizeOptionalNumber(row.snapshotPredictedPriceAdjustmentPct),
      dynamicPriceRawPerDay: row.snapshotDynamicPriceRawPerDay,
      dynamicPriceDisplayPerDay: row.snapshotDynamicPriceDisplayPerDay,
      totalInvoiceDisplay: row.snapshotTotalInvoiceDisplay,
      modelVersion: row.snapshotModelVersion,
      pricingReasons: row.snapshotPricingReasons,
    },
  };
}

export async function listAdminTransactions(
  user: AdminTransactionsUser | null | undefined,
  dependencies: AdminTransactionsDependencies = {},
): Promise<AdminTransactionsResponse> {
  assertAdminUser(user);
  const repository = dependencies.repository ?? createDefaultRepository();
  const now = dependencies.now ?? (() => new Date());
  const referenceTime = now();
  const query = normalizeAdminTransactionsQuery(dependencies.query);

  await repository.expireSubmittedPayments(referenceTime);
  const { rows, totalItems } = await repository.listTransactions(query, referenceTime);
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

  return {
    items: rows.map((row) => mapTransactionRow(row, referenceTime)),
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages,
    hasNextPage: query.page < totalPages,
    hasPreviousPage: query.page > 1,
  };
}

export async function readAdminTransactionDetail(
  bookingId: string,
  user: AdminTransactionsUser | null | undefined,
  dependencies: AdminTransactionsDependencies = {},
): Promise<AdminTransactionDetailResponse> {
  assertAdminUser(user);
  const normalizedBookingId = assertBookingId(bookingId);
  const repository = dependencies.repository ?? createDefaultRepository();
  const now = dependencies.now ?? (() => new Date());
  const referenceTime = now();

  await repository.expireSubmittedPayments(referenceTime);
  const row = await repository.findTransaction(normalizedBookingId);

  if (!row) {
    throw new AdminTransactionsServiceError('ADMIN_TRANSACTION_NOT_FOUND', 'Data transaksi tidak ditemukan.');
  }

  return mapTransactionDetailRow(row, referenceTime);
}

export async function updateAdminBookingStatus(
  bookingId: string,
  rawNextStatus: unknown,
  user: AdminTransactionsUser | null | undefined,
  dependencies: AdminTransactionsDependencies = {},
  options: { actualReturnDate?: unknown } = {},
): Promise<AdminBookingStatusUpdateResponse> {
  assertAdminUser(user);
  const normalizedBookingId = assertBookingId(bookingId);
  const nextStatus = normalizeBookingStatus(rawNextStatus);
  const repository = dependencies.repository ?? createDefaultRepository();
  const now = dependencies.now ?? (() => new Date());
  const updatedAt = now();
  const completing = nextStatus === 'COMPLETED';
  const fallbackReturnDate = new Date(updatedAt.getFullYear(), updatedAt.getMonth(), updatedAt.getDate());
  const actualReturnDate = completing ? parseActualReturnDate(options.actualReturnDate, fallbackReturnDate) : null;

  await repository.expireSubmittedPayments(updatedAt);

  if (!repository.transaction) {
    throw new AdminTransactionsServiceError('ADMIN_TRANSACTION_UPDATE_FAILED', 'Repository tidak mendukung update status booking.');
  }

  return repository.transaction(async (tx) => {
    const booking = await tx.lockBooking(normalizedBookingId);

    if (!booking) {
      throw new AdminTransactionsServiceError('ADMIN_TRANSACTION_NOT_FOUND', 'Data transaksi tidak ditemukan.');
    }

    assertAdminBookingStatusTransition(booking.bookingStatus, nextStatus);

    if (completing && actualReturnDate) {
      await tx.completeBookingWithFine(booking.bookingId, actualReturnDate);
    }

    await tx.updateBookingStatus(booking.bookingId, nextStatus, updatedAt);

    return {
      bookingId: booking.bookingId,
      bookingStatus: nextStatus,
      updatedAt: updatedAt.toISOString(),
    };
  });
}
