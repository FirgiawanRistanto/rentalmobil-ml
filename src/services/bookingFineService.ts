import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { bookingFines, bookingPriceSnapshots, bookings } from '../db/schema';
import type { BookingFineSummary } from '../lib/bookingFineUi';
import {
  localPaymentProofStorage,
  PaymentServiceError,
  type PaymentProofUpload,
} from './paymentService';

export type BookingFineErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'ADMIN_AUTHORIZATION_REQUIRED'
  | 'INVALID_FINE_REQUEST'
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_NOT_OWNED_BY_USER'
  | 'FINE_NOT_FOUND'
  | 'FINE_NOT_REVIEWABLE'
  | 'FINE_PROOF_NOT_FOUND';

export class BookingFineError extends Error {
  constructor(
    public readonly code: BookingFineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BookingFineError';
  }
}

export function isBookingFineError(error: unknown): error is BookingFineError {
  return error instanceof BookingFineError;
}

export function bookingFineErrorStatus(error: BookingFineError): number {
  switch (error.code) {
    case 'AUTHENTICATION_REQUIRED':
      return 401;
    case 'ADMIN_AUTHORIZATION_REQUIRED':
    case 'BOOKING_NOT_OWNED_BY_USER':
      return 403;
    case 'BOOKING_NOT_FOUND':
    case 'FINE_NOT_FOUND':
    case 'FINE_PROOF_NOT_FOUND':
      return 404;
    case 'FINE_NOT_REVIEWABLE':
      return 409;
    default:
      return 400;
  }
}

export interface FineActor {
  id: string;
  role?: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REJECTION_REASON_MAX_LENGTH = 500;
const REJECTABLE_FINE_STATUSES = ['AWAITING_PAYMENT', 'SUBMITTED'] as const;

function assertActor(user: FineActor | null | undefined): FineActor {
  if (!user?.id) {
    throw new BookingFineError('AUTHENTICATION_REQUIRED', 'Silakan login untuk mengelola denda keterlambatan.');
  }

  return user;
}

function assertAdminActor(user: FineActor | null | undefined): FineActor {
  const actor = assertActor(user);
  if (actor.role !== 'ADMIN') {
    throw new BookingFineError('ADMIN_AUTHORIZATION_REQUIRED', 'Hanya admin yang dapat memproses denda keterlambatan.');
  }

  return actor;
}

function assertBookingId(value: string): string {
  const trimmed = value.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    throw new BookingFineError('INVALID_FINE_REQUEST', 'bookingId harus berupa UUID valid.');
  }

  return trimmed;
}

function toDateOnlyString(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

async function loadBookingForCustomer(bookingId: string, actor: FineActor): Promise<{ id: string }> {
  const [booking] = await db
    .select({ id: bookings.id, userId: bookings.userId })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new BookingFineError('BOOKING_NOT_FOUND', 'Booking tidak ditemukan.');
  }

  if (booking.userId !== actor.id) {
    throw new BookingFineError('BOOKING_NOT_OWNED_BY_USER', 'Booking ini bukan milik akun Anda.');
  }

  return booking;
}

async function loadBookingFine(bookingId: string): Promise<BookingFineSummary | null> {
  const [row] = await db
    .select()
    .from(bookingFines)
    .where(eq(bookingFines.bookingId, bookingId))
    .limit(1);

  return row ? mapFineRow(row) : null;
}

function mapFineRow(row: typeof bookingFines.$inferSelect): BookingFineSummary {
  return {
    fineId: row.id,
    bookingId: row.bookingId,
    status: row.status,
    originalEndDate: toDateOnlyString(row.originalEndDate),
    actualReturnDate: toDateOnlyString(row.actualReturnDate),
    lateDays: row.lateDays,
    finePerDay: row.finePerDay,
    fineAmount: row.fineAmount,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    hasProof: Boolean(row.proofStorageKey),
  };
}

/** Denda hanya dibuat admin saat booking diselesaikan — customer cukup membaca statusnya. */
export async function readBookingFine(
  bookingIdRaw: string,
  user: FineActor | null | undefined,
): Promise<BookingFineSummary | null> {
  const actor = assertActor(user);
  const bookingId = assertBookingId(bookingIdRaw);
  await loadBookingForCustomer(bookingId, actor);

  return loadBookingFine(bookingId);
}

export async function readAdminBookingFine(
  bookingIdRaw: string,
  user: FineActor | null | undefined,
): Promise<BookingFineSummary | null> {
  assertAdminActor(user);
  const bookingId = assertBookingId(bookingIdRaw);

  const [booking] = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) {
    throw new BookingFineError('BOOKING_NOT_FOUND', 'Booking tidak ditemukan.');
  }

  return loadBookingFine(bookingId);
}

/** Upload bukti transfer denda keterlambatan (storage pembayaran yang sama). */
export async function submitBookingFineProof(
  bookingIdRaw: string,
  proofFile: PaymentProofUpload | null | undefined,
  user: FineActor | null | undefined,
): Promise<BookingFineSummary> {
  const actor = assertActor(user);
  const bookingId = assertBookingId(bookingIdRaw);
  await loadBookingForCustomer(bookingId, actor);

  if (!proofFile) {
    throw new BookingFineError('INVALID_FINE_REQUEST', 'Bukti pembayaran wajib diupload.');
  }

  const fine = await loadBookingFine(bookingId);
  if (!fine) {
    throw new BookingFineError('FINE_NOT_FOUND', 'Denda keterlambatan tidak ditemukan.');
  }
  if (fine.status !== 'AWAITING_PAYMENT') {
    throw new BookingFineError('FINE_NOT_REVIEWABLE', 'Denda tidak sedang menunggu pembayaran.');
  }

  const saved = await localPaymentProofStorage.save(proofFile);
  const submittedAt = new Date();

  const [row] = await db
    .update(bookingFines)
    .set({
      status: 'SUBMITTED',
      proofStorageKey: saved.storageKey,
      proofOriginalName: saved.originalName,
      proofMimeType: saved.mimeType,
      proofSizeBytes: saved.sizeBytes,
      submittedAt,
      updatedAt: submittedAt,
    })
    .where(and(
      eq(bookingFines.id, fine.fineId),
      eq(bookingFines.status, 'AWAITING_PAYMENT'),
    ))
    .returning();

  if (!row) {
    await localPaymentProofStorage.delete(saved.storageKey);
    throw new BookingFineError('FINE_NOT_REVIEWABLE', 'Denda tidak sedang menunggu pembayaran.');
  }

  return mapFineRow(row);
}

/**
 * Verifikasi admin: tagihan denda diterapkan — totalPrice booking dan
 * snapshot invoice booking bertambah dalam satu transaksi (sama seperti
 * perpanjangan, invoice hanya naik setelah bukti dibayar & diverifikasi).
 */
export async function verifyBookingFine(
  bookingIdRaw: string,
  user: FineActor | null | undefined,
): Promise<BookingFineSummary> {
  const actor = assertAdminActor(user);
  const bookingId = assertBookingId(bookingIdRaw);
  const reviewedAt = new Date();

  return db.transaction(async (tx) => {
    const [fine] = await tx
      .select()
      .from(bookingFines)
      .where(eq(bookingFines.bookingId, bookingId))
      .limit(1);

    if (!fine) {
      throw new BookingFineError('FINE_NOT_FOUND', 'Denda keterlambatan tidak ditemukan.');
    }
    if (fine.status !== 'SUBMITTED') {
      throw new BookingFineError('FINE_NOT_REVIEWABLE', 'Denda tidak berstatus SUBMITTED.');
    }

    const [updatedBooking] = await tx
      .update(bookings)
      .set({
        totalPrice: sql`${bookings.totalPrice} + ${fine.fineAmount}`,
        updatedAt: reviewedAt,
      })
      .where(and(
        eq(bookings.id, bookingId),
        eq(bookings.status, 'COMPLETED'),
      ))
      .returning({ id: bookings.id });

    if (!updatedBooking) {
      throw new BookingFineError('FINE_NOT_REVIEWABLE', 'Booking sudah tidak COMPLETED — denda tidak dapat diterapkan.');
    }

    await tx
      .update(bookingPriceSnapshots)
      .set({ totalInvoiceDisplay: sql`${bookingPriceSnapshots.totalInvoiceDisplay} + ${fine.fineAmount}` })
      .where(eq(bookingPriceSnapshots.bookingId, bookingId));

    const [updatedFine] = await tx
      .update(bookingFines)
      .set({
        status: 'VERIFIED',
        reviewedAt,
        reviewedByUserId: actor.id,
        updatedAt: reviewedAt,
      })
      .where(and(
        eq(bookingFines.id, fine.id),
        eq(bookingFines.status, 'SUBMITTED'),
      ))
      .returning();

    if (!updatedFine) {
      throw new BookingFineError('FINE_NOT_REVIEWABLE', 'Denda tidak berstatus SUBMITTED.');
    }

    return mapFineRow(updatedFine);
  });
}

/**
 * Tolak/batalkan denda — dari SUBMITTED (bukti ditolak) maupun
 * AWAITING_PAYMENT (denda dibatalkan sebelum dibayar). Tanpa tagihan.
 */
export async function rejectBookingFine(
  bookingIdRaw: string,
  rawReason: unknown,
  user: FineActor | null | undefined,
): Promise<BookingFineSummary> {
  const actor = assertAdminActor(user);
  const bookingId = assertBookingId(bookingIdRaw);
  const reviewedAt = new Date();

  let rejectionReason: string | null = null;
  if (rawReason !== undefined && rawReason !== null) {
    if (typeof rawReason !== 'string') {
      throw new BookingFineError('INVALID_FINE_REQUEST', 'rejectionReason harus berupa teks.');
    }
    const trimmed = rawReason.trim();
    if (trimmed.length > REJECTION_REASON_MAX_LENGTH) {
      throw new BookingFineError('INVALID_FINE_REQUEST', 'rejectionReason maksimal ' + REJECTION_REASON_MAX_LENGTH + ' karakter.');
    }
    rejectionReason = trimmed || null;
  }

  const [row] = await db
    .update(bookingFines)
    .set({
      status: 'REJECTED',
      rejectionReason,
      reviewedAt,
      reviewedByUserId: actor.id,
      updatedAt: reviewedAt,
    })
    .where(and(
      eq(bookingFines.bookingId, bookingId),
      inArray(bookingFines.status, [...REJECTABLE_FINE_STATUSES]),
    ))
    .returning();

  if (!row) {
    const fine = await loadBookingFine(bookingId);
    if (!fine) {
      throw new BookingFineError('FINE_NOT_FOUND', 'Denda keterlambatan tidak ditemukan.');
    }
    throw new BookingFineError('FINE_NOT_REVIEWABLE', 'Denda tidak dapat ditolak dari status saat ini.');
  }

  return mapFineRow(row);
}

export interface AdminFineProofResult {
  fineId: string;
  mimeType: string;
  filename: string;
  sizeBytes: number;
  data: Uint8Array;
}

const FINE_PROOF_FALLBACK_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export async function getAdminBookingFineProof(
  bookingIdRaw: string,
  user: FineActor | null | undefined,
): Promise<AdminFineProofResult> {
  assertAdminActor(user);
  const bookingId = assertBookingId(bookingIdRaw);

  const fine = await loadBookingFine(bookingId);
  if (!fine) {
    throw new BookingFineError('FINE_NOT_FOUND', 'Denda keterlambatan tidak ditemukan.');
  }

  const row = await db
    .select({
      id: bookingFines.id,
      proofStorageKey: bookingFines.proofStorageKey,
      proofOriginalName: bookingFines.proofOriginalName,
      proofMimeType: bookingFines.proofMimeType,
      proofSizeBytes: bookingFines.proofSizeBytes,
    })
    .from(bookingFines)
    .where(eq(bookingFines.id, fine.fineId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row?.proofStorageKey || !row.proofMimeType || !localPaymentProofStorage.read) {
    throw new BookingFineError('FINE_PROOF_NOT_FOUND', 'Bukti pembayaran denda tidak ditemukan.');
  }

  const mimeType = row.proofMimeType.trim().toLowerCase();
  const fallbackExtension = FINE_PROOF_FALLBACK_EXTENSIONS[mimeType] ?? 'bin';
  const sanitizedName = (row.proofOriginalName ?? '')
    .trim()
    .replace(/[/\\]/g, '-')
    .replace(/["\r\n]/g, '_');
  const filename = sanitizedName || 'fine-proof-' + row.id + '.' + fallbackExtension;

  const data = await localPaymentProofStorage.read(row.proofStorageKey);

  return {
    fineId: row.id,
    mimeType,
    filename,
    sizeBytes: row.proofSizeBytes ?? data.byteLength,
    data,
  };
}

export { PaymentServiceError };
