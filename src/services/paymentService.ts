import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { bookingPayments, bookings } from '../db/schema';
import { toDateOnlyString } from '../domain/pricing/dateHelpers';

export const MANUAL_BANK_TRANSFER_METHOD = 'BANK_TRANSFER_MANUAL';
export const PAYMENT_REVIEW_EXPIRY_HOURS = 24;
export const MAX_PAYMENT_PROOF_SIZE_BYTES = 5 * 1024 * 1024;
export const PAYMENT_PROOF_STORAGE_DIR = path.join(process.cwd(), 'storage', 'payment-proofs');

export const ALLOWED_PAYMENT_PROOF_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export type PaymentStatus = 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
export type BookingPaymentMethod = typeof MANUAL_BANK_TRANSFER_METHOD;

export type PaymentServiceErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'ADMIN_AUTHORIZATION_REQUIRED'
  | 'INVALID_PAYMENT_REQUEST'
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_NOT_OWNED_BY_USER'
  | 'BOOKING_NOT_PAYABLE'
  | 'RESERVATION_EXPIRED'
  | 'PAYMENT_ALREADY_SUBMITTED'
  | 'BOOKING_PRICE_SNAPSHOT_NOT_FOUND'
  | 'PAYMENT_PROOF_REQUIRED'
  | 'INVALID_PAYMENT_PROOF_TYPE'
  | 'PAYMENT_PROOF_TOO_LARGE'
  | 'PAYMENT_PROOF_STORAGE_FAILED'
  | 'PAYMENT_SUBMISSION_FAILED'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_NOT_REVIEWABLE'
  | 'PAYMENT_REVIEW_EXPIRED'
  | 'PAYMENT_AMOUNT_MISMATCH'
  | 'PAYMENT_PROOF_NOT_FOUND';

export class PaymentServiceError extends Error {
  constructor(
    public readonly code: PaymentServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PaymentServiceError';
  }
}

export interface AuthenticatedPaymentUser {
  id: string;
  role?: string | null;
}

export interface PaymentProofUpload {
  name?: string;
  type?: string;
  size?: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface StoredPaymentProof {
  storageKey: string;
  originalName: string | null;
  mimeType: string;
  sizeBytes: number;
}

export interface PaymentProofStorage {
  save(file: PaymentProofUpload): Promise<StoredPaymentProof>;
  delete(storageKey: string): Promise<void>;
  read?(storageKey: string): Promise<Uint8Array>;
}

interface PaymentBookingForSubmission {
  id: string;
  userId: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  reservationExpiresAt: Date | null;
  snapshotTotalInvoiceDisplay: number | null;
}

interface ExistingPaymentForBooking {
  id: string;
  status: PaymentStatus;
}

interface InsertPaymentInput {
  bookingId: string;
  amount: number;
  proof: StoredPaymentProof;
  submittedAt: Date;
  reviewExpiresAt: Date;
}

interface PaymentForReview {
  id: string;
  bookingId: string;
  status: PaymentStatus;
  amount: number;
  reviewExpiresAt: Date;
  bookingStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  bookingReservationExpiresAt: Date | null;
  snapshotTotalInvoiceDisplay: number | null;
}

interface BookingPaymentSummaryRow {
  id: string;
  userId: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  reservationExpiresAt: Date | null;
  startDate: Date;
  endDate: Date;
  tripType: 'DALAM_KOTA' | 'LUAR_KOTA';
  totalPrice: number;
  snapshotTotalInvoiceDisplay: number | null;
  snapshotDynamicPriceDisplayPerDay: number | null;
  snapshotModelVersion: string | null;
  paymentId: string | null;
  paymentStatus: PaymentStatus | null;
  paymentMethod: BookingPaymentMethod | null;
  paymentAmount: number | null;
  paymentSubmittedAt: Date | null;
  paymentReviewExpiresAt: Date | null;
  paymentReviewedAt: Date | null;
  paymentRejectionReason: string | null;
}

interface AdminPaymentListRow {
  paymentId: string;
  paymentStatus: PaymentStatus;
  method: BookingPaymentMethod;
  amount: number;
  submittedAt: Date;
  reviewExpiresAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  proofStorageKey: string;
  bookingId: string;
  bookingStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  reservationExpiresAt: Date | null;
  startDate: Date;
  endDate: Date;
  tripType: 'DALAM_KOTA' | 'LUAR_KOTA';
  customerId: string;
  customerName: string;
  customerEmail: string;
  carId: string;
  carBrand: string;
  carModel: string;
  carCategory: string;
}

interface AdminPaymentDetailRow extends AdminPaymentListRow {
  basePricePerDay: number | null;
  predictedPriceAdjustmentPct: string | number | null;
  dynamicPriceDisplayPerDay: number | null;
  totalInvoiceDisplay: number | null;
  modelVersion: string | null;
  pricingReasons: unknown;
}

interface PaymentProofMetadataRow {
  id: string;
  status: PaymentStatus;
  proofStorageKey: string;
  proofOriginalName: string | null;
  proofMimeType: string;
  proofSizeBytes: number;
}

export interface PaymentTransactionRepository {
  lockBookingForPayment(bookingId: string): Promise<PaymentBookingForSubmission | null>;
  findPaymentByBookingId(bookingId: string): Promise<ExistingPaymentForBooking | null>;
  insertPayment(input: InsertPaymentInput): Promise<{ id: string; status: 'SUBMITTED' }>;
  extendBookingReservation(bookingId: string, reservationExpiresAt: Date, updatedAt: Date): Promise<void>;
  lockPaymentForReview(paymentId: string): Promise<PaymentForReview | null>;
  markPaymentExpiredAndCancelBooking(paymentId: string, bookingId: string, reviewedAt: Date): Promise<void>;
  verifyPayment(paymentId: string, bookingId: string, adminUserId: string, reviewedAt: Date): Promise<void>;
  rejectPayment(paymentId: string, bookingId: string, adminUserId: string, reason: string, reviewedAt: Date): Promise<void>;
}

export interface PaymentRepository {
  transaction<T>(callback: (tx: PaymentTransactionRepository) => Promise<T>): Promise<T>;
  findBookingPaymentSummary(bookingId: string): Promise<BookingPaymentSummaryRow | null>;
  expireSubmittedPayments(now: Date): Promise<void>;
  listAdminPayments(status?: PaymentStatus): Promise<AdminPaymentListRow[]>;
  findAdminPaymentDetail(paymentId: string): Promise<AdminPaymentDetailRow | null>;
  findPaymentProofMetadata(paymentId: string): Promise<PaymentProofMetadataRow | null>;
}

export interface SubmitPaymentProofInput {
  bookingId: string;
  proofFile?: PaymentProofUpload | null;
}

export interface SubmitPaymentProofResult {
  paymentId: string;
  bookingId: string;
  paymentMethod: BookingPaymentMethod;
  paymentStatus: 'SUBMITTED';
  amount: number;
  submittedAt: string;
  reviewExpiresAt: string;
  bookingStatus: 'PENDING';
  reservationExpiresAt: string;
  nextStep: 'WAITING_ADMIN_VERIFICATION';
}

export interface ReviewPaymentResult {
  paymentId: string;
  paymentStatus: 'VERIFIED' | 'REJECTED';
  bookingId: string;
  bookingStatus: 'CONFIRMED' | 'CANCELLED';
  reviewedAt: string;
  reviewedByAdmin: true;
}

export interface ReadBookingPaymentResult {
  bookingId: string;
  bookingStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  reservationExpiresAt: string | null;
  rental: {
    pickupDate: string;
    returnDate: string;
    tripType: 'DALAM_KOTA' | 'LUAR_KOTA';
  };
  pricing: {
    dynamicPriceDisplayPerDay: number | null;
    totalInvoiceDisplay: number;
    modelVersion: string | null;
  };
  payment: null | {
    paymentId: string;
    method: BookingPaymentMethod;
    status: PaymentStatus;
    amount: number;
    submittedAt: string | null;
    reviewExpiresAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
  };
}

export interface AdminPaymentQueueItem {
  paymentId: string;
  paymentStatus: PaymentStatus;
  paymentMethod: BookingPaymentMethod;
  bookingId: string;
  bookingStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  amount: number;
  submittedAt: string;
  reviewExpiresAt: string;
  canReview: boolean;
  hasProof: boolean;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  car: {
    id: string;
    name: string;
    category: string;
  };
  rental: {
    pickupDate: string;
    returnDate: string;
    durationDays: number;
    tripType: 'DALAM_KOTA' | 'LUAR_KOTA';
  };
}

export interface AdminPaymentQueueResult {
  payments: AdminPaymentQueueItem[];
}

export interface AdminPaymentDetailResult extends AdminPaymentQueueItem {
  reviewedAt: string | null;
  rejectionReason: string | null;
  reservationExpiresAt: string | null;
  priceSnapshot: {
    basePricePerDay: number | null;
    predictedPriceAdjustmentPct: number | null;
    dynamicPriceDisplayPerDay: number | null;
    totalInvoiceDisplay: number | null;
    modelVersion: string | null;
    pricingReasons: unknown;
  };
  proofAvailable: boolean;
  proofUrl: string;
}

export interface AdminPaymentProofResult {
  paymentId: string;
  mimeType: string;
  filename: string;
  sizeBytes: number;
  data: Uint8Array;
}

interface SubmitPaymentDependencies {
  repository?: PaymentRepository;
  storage?: PaymentProofStorage;
  now?: () => Date;
}

interface ReviewPaymentDependencies {
  repository?: PaymentRepository;
  now?: () => Date;
}

interface ReadBookingPaymentDependencies {
  repository?: PaymentRepository;
}

interface AdminPaymentReadDependencies {
  repository?: PaymentRepository;
  now?: () => Date;
}

interface AdminPaymentProofDependencies {
  repository?: PaymentRepository;
  storage?: PaymentProofStorage;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REJECTION_REASON_MAX_LENGTH = 500;
const PAYMENT_PROOF_FILENAME_MAX_LENGTH = 120;

function mapRows<T>(result: unknown): T[] {
  const maybeRows = result as { rows?: T[] };
  return Array.isArray(maybeRows.rows) ? maybeRows.rows : [];
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function normalizeDatabaseDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const normalized = value
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1');
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid timestamp returned by database.');
  }

  return date;
}

function requireDatabaseDate(value: Date | string | null | undefined): Date {
  const date = normalizeDatabaseDate(value);

  if (!date) {
    throw new Error('Required timestamp was not returned by database.');
  }

  return date;
}

function normalizeOptionalNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function calculateRentalDurationDays(startDate: Date, endDate: Date): number {
  const start = Date.parse(`${toDateOnlyString(startDate)}T00:00:00.000Z`);
  const end = Date.parse(`${toDateOnlyString(endDate)}T00:00:00.000Z`);

  return Math.max(0, Math.round((end - start) / (24 * 60 * 60 * 1000)));
}

function isPaymentReviewable(
  paymentStatus: PaymentStatus,
  bookingStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED',
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

function normalizePaymentStatus(rawStatus: string | null): PaymentStatus | undefined {
  if (
    rawStatus === 'SUBMITTED' ||
    rawStatus === 'VERIFIED' ||
    rawStatus === 'REJECTED' ||
    rawStatus === 'EXPIRED'
  ) {
    return rawStatus;
  }

  if (!rawStatus) {
    return undefined;
  }

  throw new PaymentServiceError('INVALID_PAYMENT_REQUEST', 'Status payment tidak valid.');
}

function sanitizeProofFilename(originalName: string | null, mimeType: string, paymentId: string): string {
  const fallback = `payment-proof-${paymentId}.${fileExtensionForMimeType(mimeType)}`;
  const trimmed = originalName?.trim();

  if (!trimmed) {
    return fallback;
  }

  const safeName = trimmed
    .replace(/[/\\]/g, '-')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, PAYMENT_PROOF_FILENAME_MAX_LENGTH)
    .trim();

  return safeName || fallback;
}

function assertUuid(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    throw new PaymentServiceError('INVALID_PAYMENT_REQUEST', `${fieldName} harus berupa UUID valid.`);
  }

  return trimmed;
}

function assertAuthenticatedUser(user: AuthenticatedPaymentUser | null | undefined): AuthenticatedPaymentUser {
  if (!user?.id) {
    throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'Login diperlukan untuk pembayaran booking.');
  }

  return user;
}

function assertAdminUser(user: AuthenticatedPaymentUser | null | undefined): AuthenticatedPaymentUser {
  const authenticated = assertAuthenticatedUser(user);

  if (authenticated.role !== 'ADMIN') {
    throw new PaymentServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'Hanya admin yang dapat memverifikasi pembayaran.');
  }

  return authenticated;
}

function normalizeMimeType(file: PaymentProofUpload): string {
  return String(file.type ?? '').trim().toLowerCase();
}

function validatePaymentProofFile(file: PaymentProofUpload | null | undefined): PaymentProofUpload {
  if (!file) {
    throw new PaymentServiceError('PAYMENT_PROOF_REQUIRED', 'File bukti pembayaran wajib diunggah.');
  }

  const size = Number(file.size ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw new PaymentServiceError('PAYMENT_PROOF_REQUIRED', 'File bukti pembayaran wajib diunggah.');
  }

  if (size > MAX_PAYMENT_PROOF_SIZE_BYTES) {
    throw new PaymentServiceError('PAYMENT_PROOF_TOO_LARGE', 'Ukuran file bukti pembayaran maksimal 5 MB.');
  }

  const mimeType = normalizeMimeType(file);
  if (!ALLOWED_PAYMENT_PROOF_MIME_TYPES.has(mimeType)) {
    throw new PaymentServiceError('INVALID_PAYMENT_PROOF_TYPE', 'Tipe file bukti pembayaran tidak didukung.');
  }

  return file;
}

function fileExtensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

export const localPaymentProofStorage: PaymentProofStorage = {
  async save(file) {
    const validFile = validatePaymentProofFile(file);
    const mimeType = normalizeMimeType(validFile);
    const storageKey = `${randomUUID()}.${fileExtensionForMimeType(mimeType)}`;
    const targetPath = path.join(PAYMENT_PROOF_STORAGE_DIR, storageKey);

    try {
      await mkdir(PAYMENT_PROOF_STORAGE_DIR, { recursive: true });
      await writeFile(targetPath, Buffer.from(await validFile.arrayBuffer()));
    } catch {
      throw new PaymentServiceError('PAYMENT_PROOF_STORAGE_FAILED', 'Gagal menyimpan bukti pembayaran.');
    }

    return {
      storageKey,
      originalName: validFile.name?.trim() || null,
      mimeType,
      sizeBytes: Number(validFile.size),
    };
  },

  async delete(storageKey) {
    if (!storageKey || storageKey.includes('/') || storageKey.includes('\\')) {
      return;
    }

    try {
      await unlink(path.join(PAYMENT_PROOF_STORAGE_DIR, storageKey));
    } catch {
      // Best-effort cleanup; callers should not expose local paths or fail user flows on cleanup miss.
    }
  },

  async read(storageKey) {
    if (!storageKey || storageKey.includes('/') || storageKey.includes('\\')) {
      throw new PaymentServiceError('PAYMENT_PROOF_NOT_FOUND', 'Bukti pembayaran tidak ditemukan.');
    }

    try {
      return await readFile(path.join(PAYMENT_PROOF_STORAGE_DIR, storageKey));
    } catch {
      throw new PaymentServiceError('PAYMENT_PROOF_NOT_FOUND', 'Bukti pembayaran tidak ditemukan.');
    }
  },
};

export function validateRejectionReason(value: unknown): string {
  if (typeof value !== 'string') {
    throw new PaymentServiceError('INVALID_PAYMENT_REQUEST', 'Alasan penolakan wajib diisi.');
  }

  const reason = value.trim();
  if (!reason) {
    throw new PaymentServiceError('INVALID_PAYMENT_REQUEST', 'Alasan penolakan wajib diisi.');
  }

  if (reason.length > REJECTION_REASON_MAX_LENGTH) {
    throw new PaymentServiceError(
      'INVALID_PAYMENT_REQUEST',
      `Alasan penolakan maksimal ${REJECTION_REASON_MAX_LENGTH} karakter.`,
    );
  }

  return reason;
}

export function createDrizzlePaymentRepository(): PaymentRepository {
  return {
    async transaction(callback) {
      return db.transaction(async (tx) => {
        const txRepository: PaymentTransactionRepository = {
          async lockBookingForPayment(bookingId) {
            const result = await tx.execute(sql`
              select
                b.id,
                b."userId" as "userId",
                b.status,
                b."reservationExpiresAt" as "reservationExpiresAt",
                bps."totalInvoiceDisplay" as "snapshotTotalInvoiceDisplay"
              from bookings b
              left join booking_price_snapshots bps on bps."bookingId" = b.id
              where b.id = ${bookingId}
              for update of b
            `);
            const [row] = mapRows<PaymentBookingForSubmission>(result);

            return row
              ? {
                ...row,
                reservationExpiresAt: normalizeDatabaseDate(row.reservationExpiresAt),
              }
              : null;
          },

          async findPaymentByBookingId(bookingId) {
            const [payment] = await tx
              .select({ id: bookingPayments.id, status: bookingPayments.status })
              .from(bookingPayments)
              .where(sql`${bookingPayments.bookingId} = ${bookingId}`)
              .limit(1);

            return payment ?? null;
          },

          async insertPayment(input) {
            const [payment] = await tx
              .insert(bookingPayments)
              .values({
                bookingId: input.bookingId,
                method: MANUAL_BANK_TRANSFER_METHOD,
                status: 'SUBMITTED',
                amount: input.amount,
                proofStorageKey: input.proof.storageKey,
                proofOriginalName: input.proof.originalName,
                proofMimeType: input.proof.mimeType,
                proofSizeBytes: input.proof.sizeBytes,
                submittedAt: input.submittedAt,
                reviewExpiresAt: input.reviewExpiresAt,
                createdAt: input.submittedAt,
                updatedAt: input.submittedAt,
              })
              .returning({ id: bookingPayments.id, status: bookingPayments.status });

            if (!payment || payment.status !== 'SUBMITTED') {
              throw new Error('Insert payment did not return a SUBMITTED payment.');
            }

            return { id: payment.id, status: payment.status };
          },

          async extendBookingReservation(bookingId, reservationExpiresAt, updatedAt) {
            await tx
              .update(bookings)
              .set({ reservationExpiresAt, updatedAt })
              .where(sql`${bookings.id} = ${bookingId}`);
          },

          async lockPaymentForReview(paymentId) {
            const result = await tx.execute(sql`
              select
                p.id,
                p."bookingId" as "bookingId",
                p.status,
                p.amount,
                p."reviewExpiresAt" as "reviewExpiresAt",
                b.status as "bookingStatus",
                b."reservationExpiresAt" as "bookingReservationExpiresAt",
                bps."totalInvoiceDisplay" as "snapshotTotalInvoiceDisplay"
              from booking_payments p
              join bookings b on b.id = p."bookingId"
              left join booking_price_snapshots bps on bps."bookingId" = b.id
              where p.id = ${paymentId}
              for update of p, b
            `);
            const [row] = mapRows<PaymentForReview>(result);

            return row
              ? {
                ...row,
                reviewExpiresAt: requireDatabaseDate(row.reviewExpiresAt),
                bookingReservationExpiresAt: normalizeDatabaseDate(row.bookingReservationExpiresAt),
              }
              : null;
          },

          async markPaymentExpiredAndCancelBooking(paymentId, bookingId, reviewedAt) {
            await tx
              .update(bookingPayments)
              .set({ status: 'EXPIRED', reviewedAt, updatedAt: reviewedAt })
              .where(sql`${bookingPayments.id} = ${paymentId}`);
            await tx
              .update(bookings)
              .set({ status: 'CANCELLED', updatedAt: reviewedAt })
              .where(sql`${bookings.id} = ${bookingId}`);
          },

          async verifyPayment(paymentId, bookingId, adminUserId, reviewedAt) {
            await tx
              .update(bookingPayments)
              .set({
                status: 'VERIFIED',
                reviewedAt,
                reviewedByUserId: adminUserId,
                updatedAt: reviewedAt,
              })
              .where(sql`${bookingPayments.id} = ${paymentId}`);
            await tx
              .update(bookings)
              .set({ status: 'CONFIRMED', updatedAt: reviewedAt })
              .where(sql`${bookings.id} = ${bookingId}`);
          },

          async rejectPayment(paymentId, bookingId, adminUserId, reason, reviewedAt) {
            await tx
              .update(bookingPayments)
              .set({
                status: 'REJECTED',
                reviewedAt,
                reviewedByUserId: adminUserId,
                rejectionReason: reason,
                updatedAt: reviewedAt,
              })
              .where(sql`${bookingPayments.id} = ${paymentId}`);
            await tx
              .update(bookings)
              .set({ status: 'CANCELLED', updatedAt: reviewedAt })
              .where(sql`${bookings.id} = ${bookingId}`);
          },
        };

        return callback(txRepository);
      });
    },

    async findBookingPaymentSummary(bookingId) {
      const result = await db.execute(sql`
        select
          b.id,
          b."userId" as "userId",
          b.status,
          b."reservationExpiresAt" as "reservationExpiresAt",
          b."startDate" as "startDate",
          b."endDate" as "endDate",
          b."tripType" as "tripType",
          b."totalPrice" as "totalPrice",
          bps."totalInvoiceDisplay" as "snapshotTotalInvoiceDisplay",
          bps."dynamicPriceDisplayPerDay" as "snapshotDynamicPriceDisplayPerDay",
          bps."modelVersion" as "snapshotModelVersion",
          p.id as "paymentId",
          p.status as "paymentStatus",
          p.method as "paymentMethod",
          p.amount as "paymentAmount",
          p."submittedAt" as "paymentSubmittedAt",
          p."reviewExpiresAt" as "paymentReviewExpiresAt",
          p."reviewedAt" as "paymentReviewedAt",
          p."rejectionReason" as "paymentRejectionReason"
        from bookings b
        left join booking_price_snapshots bps on bps."bookingId" = b.id
        left join booking_payments p on p."bookingId" = b.id
        where b.id = ${bookingId}
      `);
      const [row] = mapRows<BookingPaymentSummaryRow>(result);

      return row
        ? {
          ...row,
          reservationExpiresAt: normalizeDatabaseDate(row.reservationExpiresAt),
          startDate: requireDatabaseDate(row.startDate),
          endDate: requireDatabaseDate(row.endDate),
          paymentSubmittedAt: normalizeDatabaseDate(row.paymentSubmittedAt),
          paymentReviewExpiresAt: normalizeDatabaseDate(row.paymentReviewExpiresAt),
          paymentReviewedAt: normalizeDatabaseDate(row.paymentReviewedAt),
        }
        : null;
    },

    async expireSubmittedPayments(now) {
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          with expired_payments as (
            update booking_payments p
            set
              status = 'EXPIRED',
              "reviewedAt" = coalesce(p."reviewedAt", ${now}),
              "updatedAt" = ${now}
            from bookings b
            where p."bookingId" = b.id
              and p.status = 'SUBMITTED'
              and p."reviewExpiresAt" <= ${now}
              and b.status = 'PENDING'
            returning p."bookingId" as "bookingId"
          )
          update bookings b
          set status = 'CANCELLED', "updatedAt" = ${now}
          where b.id in (select "bookingId" from expired_payments)
            and b.status = 'PENDING'
        `);
      });
    },

    async listAdminPayments(status) {
      const statusFilter = status ? sql`where p.status = ${status}` : sql``;
      const result = await db.execute(sql`
        select
          p.id as "paymentId",
          p.status as "paymentStatus",
          p.method,
          p.amount,
          p."submittedAt" as "submittedAt",
          p."reviewExpiresAt" as "reviewExpiresAt",
          p."reviewedAt" as "reviewedAt",
          p."rejectionReason" as "rejectionReason",
          p."proofStorageKey" as "proofStorageKey",
          b.id as "bookingId",
          b.status as "bookingStatus",
          b."reservationExpiresAt" as "reservationExpiresAt",
          b."startDate" as "startDate",
          b."endDate" as "endDate",
          b."tripType" as "tripType",
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
        ${statusFilter}
        order by p."submittedAt" desc
        limit 100
      `);

      return mapRows<AdminPaymentListRow>(result).map((row) => ({
        ...row,
        submittedAt: requireDatabaseDate(row.submittedAt),
        reviewExpiresAt: requireDatabaseDate(row.reviewExpiresAt),
        reviewedAt: normalizeDatabaseDate(row.reviewedAt),
        reservationExpiresAt: normalizeDatabaseDate(row.reservationExpiresAt),
        startDate: requireDatabaseDate(row.startDate),
        endDate: requireDatabaseDate(row.endDate),
      }));
    },

    async findAdminPaymentDetail(paymentId) {
      const result = await db.execute(sql`
        select
          p.id as "paymentId",
          p.status as "paymentStatus",
          p.method,
          p.amount,
          p."submittedAt" as "submittedAt",
          p."reviewExpiresAt" as "reviewExpiresAt",
          p."reviewedAt" as "reviewedAt",
          p."rejectionReason" as "rejectionReason",
          p."proofStorageKey" as "proofStorageKey",
          b.id as "bookingId",
          b.status as "bookingStatus",
          b."reservationExpiresAt" as "reservationExpiresAt",
          b."startDate" as "startDate",
          b."endDate" as "endDate",
          b."tripType" as "tripType",
          u.id as "customerId",
          u.name as "customerName",
          u.email as "customerEmail",
          c.id as "carId",
          c.brand as "carBrand",
          c.model as "carModel",
          c.category as "carCategory",
          bps."basePricePerDay" as "basePricePerDay",
          bps."predictedPriceAdjustmentPct" as "predictedPriceAdjustmentPct",
          bps."dynamicPriceDisplayPerDay" as "dynamicPriceDisplayPerDay",
          bps."totalInvoiceDisplay" as "totalInvoiceDisplay",
          bps."modelVersion" as "modelVersion",
          bps."pricingReasons" as "pricingReasons"
        from booking_payments p
        join bookings b on b.id = p."bookingId"
        join users u on u.id = b."userId"
        join cars c on c.id = b."carId"
        left join booking_price_snapshots bps on bps."bookingId" = b.id
        where p.id = ${paymentId}
        limit 1
      `);
      const [row] = mapRows<AdminPaymentDetailRow>(result);

      return row
        ? {
          ...row,
          submittedAt: requireDatabaseDate(row.submittedAt),
          reviewExpiresAt: requireDatabaseDate(row.reviewExpiresAt),
          reviewedAt: normalizeDatabaseDate(row.reviewedAt),
          reservationExpiresAt: normalizeDatabaseDate(row.reservationExpiresAt),
          startDate: requireDatabaseDate(row.startDate),
          endDate: requireDatabaseDate(row.endDate),
        }
        : null;
    },

    async findPaymentProofMetadata(paymentId) {
      const result = await db.execute(sql`
        select
          id,
          status,
          "proofStorageKey",
          "proofOriginalName",
          "proofMimeType",
          "proofSizeBytes"
        from booking_payments
        where id = ${paymentId}
        limit 1
      `);
      const [row] = mapRows<PaymentProofMetadataRow>(result);

      return row ?? null;
    },
  };
}

export const drizzlePaymentRepository = createDrizzlePaymentRepository();

export async function submitPaymentProof(
  rawInput: SubmitPaymentProofInput,
  user: AuthenticatedPaymentUser | null | undefined,
  dependencies: SubmitPaymentDependencies = {},
): Promise<SubmitPaymentProofResult> {
  const authenticated = assertAuthenticatedUser(user);
  const bookingId = assertUuid(rawInput.bookingId, 'bookingId');
  const proofFile = validatePaymentProofFile(rawInput.proofFile);
  const repository = dependencies.repository ?? drizzlePaymentRepository;
  const storage = dependencies.storage ?? localPaymentProofStorage;
  const now = dependencies.now ?? (() => new Date());
  const submittedAt = now();
  const reviewExpiresAt = addHours(submittedAt, PAYMENT_REVIEW_EXPIRY_HOURS);
  let storedProofKey: string | null = null;

  try {
    return await repository.transaction(async (tx) => {
      const booking = await tx.lockBookingForPayment(bookingId);

      if (!booking) {
        throw new PaymentServiceError('BOOKING_NOT_FOUND', 'Booking tidak ditemukan.');
      }

      if (booking.userId !== authenticated.id) {
        throw new PaymentServiceError('BOOKING_NOT_OWNED_BY_USER', 'Booking bukan milik user ini.');
      }

      if (booking.status !== 'PENDING') {
        throw new PaymentServiceError('BOOKING_NOT_PAYABLE', 'Booking tidak dapat dibayar pada status saat ini.');
      }

      if (!booking.reservationExpiresAt || booking.reservationExpiresAt.getTime() <= submittedAt.getTime()) {
        throw new PaymentServiceError('RESERVATION_EXPIRED', 'Masa reservasi booking sudah berakhir.');
      }

      if (booking.snapshotTotalInvoiceDisplay === null) {
        throw new PaymentServiceError('BOOKING_PRICE_SNAPSHOT_NOT_FOUND', 'Snapshot harga booking tidak ditemukan.');
      }

      const existingPayment = await tx.findPaymentByBookingId(booking.id);
      if (existingPayment) {
        throw new PaymentServiceError('PAYMENT_ALREADY_SUBMITTED', 'Bukti pembayaran sudah pernah disubmit.');
      }

      const storedProof = await storage.save(proofFile);
      storedProofKey = storedProof.storageKey;
      const payment = await tx.insertPayment({
        bookingId: booking.id,
        amount: booking.snapshotTotalInvoiceDisplay,
        proof: storedProof,
        submittedAt,
        reviewExpiresAt,
      });
      await tx.extendBookingReservation(booking.id, reviewExpiresAt, submittedAt);

      return {
        paymentId: payment.id,
        bookingId: booking.id,
        paymentMethod: MANUAL_BANK_TRANSFER_METHOD,
        paymentStatus: payment.status,
        amount: booking.snapshotTotalInvoiceDisplay,
        submittedAt: submittedAt.toISOString(),
        reviewExpiresAt: reviewExpiresAt.toISOString(),
        bookingStatus: 'PENDING',
        reservationExpiresAt: reviewExpiresAt.toISOString(),
        nextStep: 'WAITING_ADMIN_VERIFICATION',
      };
    });
  } catch (error) {
    if (storedProofKey) {
      await storage.delete(storedProofKey);
    }

    if (error instanceof PaymentServiceError) {
      throw error;
    }

    throw new PaymentServiceError('PAYMENT_SUBMISSION_FAILED', 'Gagal menyimpan submission pembayaran.');
  }
}

function assertPaymentCanBeReviewed(payment: PaymentForReview, now: Date): void {
  if (payment.status !== 'SUBMITTED') {
    throw new PaymentServiceError('PAYMENT_NOT_REVIEWABLE', 'Payment tidak berada pada status SUBMITTED.');
  }

  if (payment.bookingStatus !== 'PENDING') {
    throw new PaymentServiceError('BOOKING_NOT_PAYABLE', 'Booking tidak berada pada status PENDING.');
  }

  if (
    payment.reviewExpiresAt.getTime() <= now.getTime() ||
    !payment.bookingReservationExpiresAt ||
    payment.bookingReservationExpiresAt.getTime() <= now.getTime()
  ) {
    throw new PaymentServiceError('PAYMENT_REVIEW_EXPIRED', 'Masa review pembayaran sudah berakhir.');
  }

  if (payment.snapshotTotalInvoiceDisplay === null) {
    throw new PaymentServiceError('BOOKING_PRICE_SNAPSHOT_NOT_FOUND', 'Snapshot harga booking tidak ditemukan.');
  }

  if (payment.amount !== payment.snapshotTotalInvoiceDisplay) {
    throw new PaymentServiceError('PAYMENT_AMOUNT_MISMATCH', 'Nominal payment tidak sesuai snapshot invoice.');
  }
}

async function handleReviewExpired(
  tx: PaymentTransactionRepository,
  payment: PaymentForReview,
  now: Date,
): Promise<never> {
  await tx.markPaymentExpiredAndCancelBooking(payment.id, payment.bookingId, now);
  throw new PaymentServiceError('PAYMENT_REVIEW_EXPIRED', 'Masa review pembayaran sudah berakhir.');
}

export async function verifyPaymentSubmission(
  paymentIdRaw: string,
  user: AuthenticatedPaymentUser | null | undefined,
  dependencies: ReviewPaymentDependencies = {},
): Promise<ReviewPaymentResult> {
  const admin = assertAdminUser(user);
  const paymentId = assertUuid(paymentIdRaw, 'paymentId');
  const repository = dependencies.repository ?? drizzlePaymentRepository;
  const now = dependencies.now ?? (() => new Date());
  const reviewedAt = now();

  return repository.transaction(async (tx) => {
    const payment = await tx.lockPaymentForReview(paymentId);

    if (!payment) {
      throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Payment tidak ditemukan.');
    }

    if (
      payment.status === 'SUBMITTED' &&
      payment.bookingStatus === 'PENDING' &&
      (payment.reviewExpiresAt.getTime() <= reviewedAt.getTime() ||
        !payment.bookingReservationExpiresAt ||
        payment.bookingReservationExpiresAt.getTime() <= reviewedAt.getTime())
    ) {
      return handleReviewExpired(tx, payment, reviewedAt);
    }

    if (payment.status === 'EXPIRED') {
      throw new PaymentServiceError('PAYMENT_REVIEW_EXPIRED', 'Masa review pembayaran sudah berakhir.');
    }

    assertPaymentCanBeReviewed(payment, reviewedAt);
    await tx.verifyPayment(payment.id, payment.bookingId, admin.id, reviewedAt);

    return {
      paymentId: payment.id,
      paymentStatus: 'VERIFIED',
      bookingId: payment.bookingId,
      bookingStatus: 'CONFIRMED',
      reviewedAt: reviewedAt.toISOString(),
      reviewedByAdmin: true,
    };
  });
}

export async function rejectPaymentSubmission(
  paymentIdRaw: string,
  reasonRaw: unknown,
  user: AuthenticatedPaymentUser | null | undefined,
  dependencies: ReviewPaymentDependencies = {},
): Promise<ReviewPaymentResult> {
  const admin = assertAdminUser(user);
  const reason = validateRejectionReason(reasonRaw);
  const paymentId = assertUuid(paymentIdRaw, 'paymentId');
  const repository = dependencies.repository ?? drizzlePaymentRepository;
  const now = dependencies.now ?? (() => new Date());
  const reviewedAt = now();

  return repository.transaction(async (tx) => {
    const payment = await tx.lockPaymentForReview(paymentId);

    if (!payment) {
      throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Payment tidak ditemukan.');
    }

    if (
      payment.status === 'SUBMITTED' &&
      payment.bookingStatus === 'PENDING' &&
      (payment.reviewExpiresAt.getTime() <= reviewedAt.getTime() ||
        !payment.bookingReservationExpiresAt ||
        payment.bookingReservationExpiresAt.getTime() <= reviewedAt.getTime())
    ) {
      return handleReviewExpired(tx, payment, reviewedAt);
    }

    if (payment.status === 'EXPIRED') {
      throw new PaymentServiceError('PAYMENT_REVIEW_EXPIRED', 'Masa review pembayaran sudah berakhir.');
    }

    assertPaymentCanBeReviewed(payment, reviewedAt);
    await tx.rejectPayment(payment.id, payment.bookingId, admin.id, reason, reviewedAt);

    return {
      paymentId: payment.id,
      paymentStatus: 'REJECTED',
      bookingId: payment.bookingId,
      bookingStatus: 'CANCELLED',
      reviewedAt: reviewedAt.toISOString(),
      reviewedByAdmin: true,
    };
  });
}

export async function readBookingPayment(
  bookingIdRaw: string,
  user: AuthenticatedPaymentUser | null | undefined,
  dependencies: ReadBookingPaymentDependencies = {},
): Promise<ReadBookingPaymentResult> {
  const authenticated = assertAuthenticatedUser(user);
  const bookingId = assertUuid(bookingIdRaw, 'bookingId');
  const repository = dependencies.repository ?? drizzlePaymentRepository;
  const booking = await repository.findBookingPaymentSummary(bookingId);

  if (!booking) {
    throw new PaymentServiceError('BOOKING_NOT_FOUND', 'Booking tidak ditemukan.');
  }

  if (booking.userId !== authenticated.id && authenticated.role !== 'ADMIN') {
    throw new PaymentServiceError('BOOKING_NOT_OWNED_BY_USER', 'Booking bukan milik user ini.');
  }

  const totalInvoiceDisplay = booking.snapshotTotalInvoiceDisplay ?? booking.totalPrice;

  return {
    bookingId: booking.id,
    bookingStatus: booking.status,
    reservationExpiresAt: booking.reservationExpiresAt?.toISOString() ?? null,
    rental: {
      pickupDate: toDateOnlyString(booking.startDate),
      returnDate: toDateOnlyString(booking.endDate),
      tripType: booking.tripType,
    },
    pricing: {
      dynamicPriceDisplayPerDay: booking.snapshotDynamicPriceDisplayPerDay,
      totalInvoiceDisplay,
      modelVersion: booking.snapshotModelVersion,
    },
    payment: booking.paymentId
      ? {
        paymentId: booking.paymentId,
        method: booking.paymentMethod ?? MANUAL_BANK_TRANSFER_METHOD,
        status: booking.paymentStatus ?? 'SUBMITTED',
        amount: booking.paymentAmount ?? totalInvoiceDisplay,
        submittedAt: booking.paymentSubmittedAt?.toISOString() ?? null,
        reviewExpiresAt: booking.paymentReviewExpiresAt?.toISOString() ?? null,
        reviewedAt: booking.paymentReviewedAt?.toISOString() ?? null,
        rejectionReason: booking.paymentRejectionReason,
      }
      : null,
  };
}

function buildAdminPaymentQueueItem(
  row: AdminPaymentListRow,
  now: Date,
): AdminPaymentQueueItem {
  return {
    paymentId: row.paymentId,
    paymentStatus: row.paymentStatus,
    paymentMethod: row.method,
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
    hasProof: !!row.proofStorageKey,
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
  };
}

export async function listAdminPayments(
  rawStatus: string | null | undefined,
  user: AuthenticatedPaymentUser | null | undefined,
  dependencies: AdminPaymentReadDependencies = {},
): Promise<AdminPaymentQueueResult> {
  assertAdminUser(user);
  const status = normalizePaymentStatus(rawStatus ?? null);
  const repository = dependencies.repository ?? drizzlePaymentRepository;
  const now = dependencies.now ?? (() => new Date());
  const referenceTime = now();

  await repository.expireSubmittedPayments(referenceTime);

  const payments = await repository.listAdminPayments(status);
  return {
    payments: payments.map((payment) => buildAdminPaymentQueueItem(payment, referenceTime)),
  };
}

export async function readAdminPaymentDetail(
  paymentIdRaw: string,
  user: AuthenticatedPaymentUser | null | undefined,
  dependencies: AdminPaymentReadDependencies = {},
): Promise<AdminPaymentDetailResult> {
  assertAdminUser(user);
  const paymentId = assertUuid(paymentIdRaw, 'paymentId');
  const repository = dependencies.repository ?? drizzlePaymentRepository;
  const now = dependencies.now ?? (() => new Date());
  const referenceTime = now();

  await repository.expireSubmittedPayments(referenceTime);

  const payment = await repository.findAdminPaymentDetail(paymentId);
  if (!payment) {
    throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Payment tidak ditemukan.');
  }

  return {
    ...buildAdminPaymentQueueItem(payment, referenceTime),
    reviewedAt: payment.reviewedAt?.toISOString() ?? null,
    rejectionReason: payment.rejectionReason,
    reservationExpiresAt: payment.reservationExpiresAt?.toISOString() ?? null,
    priceSnapshot: {
      basePricePerDay: payment.basePricePerDay,
      predictedPriceAdjustmentPct: normalizeOptionalNumber(payment.predictedPriceAdjustmentPct),
      dynamicPriceDisplayPerDay: payment.dynamicPriceDisplayPerDay,
      totalInvoiceDisplay: payment.totalInvoiceDisplay,
      modelVersion: payment.modelVersion,
      pricingReasons: payment.pricingReasons,
    },
    proofAvailable: !!payment.proofStorageKey,
    proofUrl: `/api/admin/payments/${payment.paymentId}/proof`,
  };
}

export async function getAdminPaymentProof(
  paymentIdRaw: string,
  user: AuthenticatedPaymentUser | null | undefined,
  dependencies: AdminPaymentProofDependencies = {},
): Promise<AdminPaymentProofResult> {
  assertAdminUser(user);
  const paymentId = assertUuid(paymentIdRaw, 'paymentId');
  const repository = dependencies.repository ?? drizzlePaymentRepository;
  const storage = dependencies.storage ?? localPaymentProofStorage;
  const payment = await repository.findPaymentProofMetadata(paymentId);

  if (!payment) {
    throw new PaymentServiceError('PAYMENT_NOT_FOUND', 'Payment tidak ditemukan.');
  }

  if (!payment.proofStorageKey || !storage.read) {
    throw new PaymentServiceError('PAYMENT_PROOF_NOT_FOUND', 'Bukti pembayaran tidak ditemukan.');
  }

  const mimeType = payment.proofMimeType.trim().toLowerCase();
  if (!ALLOWED_PAYMENT_PROOF_MIME_TYPES.has(mimeType)) {
    throw new PaymentServiceError('PAYMENT_PROOF_NOT_FOUND', 'Bukti pembayaran tidak ditemukan.');
  }

  const data = await storage.read(payment.proofStorageKey);

  return {
    paymentId: payment.id,
    mimeType,
    filename: sanitizeProofFilename(payment.proofOriginalName, mimeType, payment.id),
    sizeBytes: payment.proofSizeBytes,
    data,
  };
}
