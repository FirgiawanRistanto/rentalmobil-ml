import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { bookingExtensions, bookingPriceSnapshots, bookings } from '../db/schema';
import type { BookingExtensionSummary } from '../lib/bookingExtensionUi';
import {
  localPaymentProofStorage,
  PaymentServiceError,
  type PaymentProofUpload,
} from './paymentService';
import { createPricingQuote } from './pricingQuoteService';

export type BookingExtensionErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'ADMIN_AUTHORIZATION_REQUIRED'
  | 'INVALID_EXTENSION_REQUEST'
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_NOT_OWNED_BY_USER'
  | 'EXTENSION_NOT_ALLOWED'
  | 'EXTENSION_ALREADY_ACTIVE'
  | 'EXTENSION_NOT_FOUND'
  | 'EXTENSION_NOT_REVIEWABLE'
  | 'EXTENSION_PRICING_FAILED'
  | 'EXTENSION_PROOF_NOT_FOUND';

export class BookingExtensionError extends Error {
  constructor(
    public readonly code: BookingExtensionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BookingExtensionError';
  }
}

export function isBookingExtensionError(error: unknown): error is BookingExtensionError {
  return error instanceof BookingExtensionError;
}

export function bookingExtensionErrorStatus(error: BookingExtensionError): number {
  switch (error.code) {
    case 'AUTHENTICATION_REQUIRED':
      return 401;
    case 'ADMIN_AUTHORIZATION_REQUIRED':
    case 'BOOKING_NOT_OWNED_BY_USER':
      return 403;
    case 'BOOKING_NOT_FOUND':
    case 'EXTENSION_NOT_FOUND':
    case 'EXTENSION_PROOF_NOT_FOUND':
      return 404;
    case 'EXTENSION_NOT_ALLOWED':
    case 'EXTENSION_ALREADY_ACTIVE':
    case 'EXTENSION_NOT_REVIEWABLE':
    case 'EXTENSION_PRICING_FAILED':
      return 409;
    default:
      return 400;
  }
}

export interface ExtensionActor {
  id: string;
  role?: string | null;
}

interface BookingForExtension {
  id: string;
  userId: string;
  carId: string;
  status: string;
  tripType: 'DALAM_KOTA' | 'LUAR_KOTA';
  endDate: Date;
  totalPrice: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVE_EXTENSION_STATUSES = ['AWAITING_PAYMENT', 'SUBMITTED'] as const;
const REJECTION_REASON_MAX_LENGTH = 500;

function assertActor(user: ExtensionActor | null | undefined): ExtensionActor {
  if (!user?.id) {
    throw new BookingExtensionError('AUTHENTICATION_REQUIRED', 'Silakan login untuk mengelola perpanjangan sewa.');
  }

  return user;
}

function assertAdminActor(user: ExtensionActor | null | undefined): ExtensionActor {
  const actor = assertActor(user);
  if (actor.role !== 'ADMIN') {
    throw new BookingExtensionError('ADMIN_AUTHORIZATION_REQUIRED', 'Hanya admin yang dapat memproses perpanjangan sewa.');
  }

  return actor;
}

function assertBookingId(value: string): string {
  const trimmed = value.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    throw new BookingExtensionError('INVALID_EXTENSION_REQUEST', 'bookingId harus berupa UUID valid.');
  }

  return trimmed;
}

function parseDateOnly(value: unknown, fieldName: string): Date {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) {
    throw new BookingExtensionError('INVALID_EXTENSION_REQUEST', `${fieldName} wajib memakai format YYYY-MM-DD.`);
  }

  const date = new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
  if (Number.isNaN(date.getTime())) {
    throw new BookingExtensionError('INVALID_EXTENSION_REQUEST', `${fieldName} tidak valid.`);
  }

  return date;
}

function toDateOnlyString(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

async function loadBookingForCustomer(bookingId: string, actor: ExtensionActor): Promise<BookingForExtension> {
  const [booking] = await db
    .select({
      id: bookings.id,
      userId: bookings.userId,
      carId: bookings.carId,
      status: bookings.status,
      tripType: bookings.tripType,
      endDate: bookings.endDate,
      totalPrice: bookings.totalPrice,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new BookingExtensionError('BOOKING_NOT_FOUND', 'Booking tidak ditemukan.');
  }

  if (booking.userId !== actor.id) {
    throw new BookingExtensionError('BOOKING_NOT_OWNED_BY_USER', 'Booking ini bukan milik akun Anda.');
  }

  return booking;
}

async function loadLatestExtension(bookingId: string): Promise<BookingExtensionSummary | null> {
  const [row] = await db
    .select()
    .from(bookingExtensions)
    .where(eq(bookingExtensions.bookingId, bookingId))
    .orderBy(desc(bookingExtensions.createdAt))
    .limit(1);

  return row ? mapExtensionRow(row) : null;
}

function mapExtensionRow(row: typeof bookingExtensions.$inferSelect): BookingExtensionSummary {
  const reasons = row.pricingReasons;

  return {
    extensionId: row.id,
    bookingId: row.bookingId,
    status: row.status,
    previousEndDate: toDateOnlyString(row.previousEndDate),
    newEndDate: toDateOnlyString(row.newEndDate),
    extraDays: row.extraDays,
    extraAmount: row.extraAmount,
    dynamicPriceDisplayPerDay: row.dynamicPriceDisplayPerDay,
    pricingReasons: Array.isArray(reasons) ? reasons.filter((item): item is string => typeof item === 'string') : [],
    modelVersion: row.modelVersion,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    hasProof: Boolean(row.proofStorageKey),
  };
}

/**
 * Buat permintaan perpanjangan: harga dinamis dihitung untuk hari tambahan
 * (window endDate saat ini -> tanggal baru) memakai pipeline quote yang sama
 * dengan booking biasa. Booking baru diperbarui setelah admin memverifikasi.
 */
export async function createBookingExtension(
  bookingIdRaw: string,
  rawInput: unknown,
  user: ExtensionActor | null | undefined,
): Promise<BookingExtensionSummary> {
  const actor = assertActor(user);
  const bookingId = assertBookingId(bookingIdRaw);

  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    throw new BookingExtensionError('INVALID_EXTENSION_REQUEST', 'Request body harus berupa object JSON.');
  }

  const input = rawInput as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (key !== 'newEndDate') {
      throw new BookingExtensionError('INVALID_EXTENSION_REQUEST', `Field ${key} tidak boleh dikirim untuk perpanjangan.`);
    }
  }

  const booking = await loadBookingForCustomer(bookingId, actor);

  if (booking.status !== 'CONFIRMED') {
    throw new BookingExtensionError('EXTENSION_NOT_ALLOWED', 'Hanya booking CONFIRMED yang dapat diperpanjang.');
  }

  const currentEndDate = booking.endDate;
  if (currentEndDate.getTime() < startOfToday().getTime()) {
    throw new BookingExtensionError('EXTENSION_NOT_ALLOWED', 'Tanggal kembali sudah berlalu. Hubungi admin untuk menyelesaikan booking ini.');
  }

  const newEndDate = parseDateOnly(input.newEndDate, 'newEndDate');
  const extraDays = daysBetween(currentEndDate, newEndDate);
  if (extraDays < 1) {
    throw new BookingExtensionError('INVALID_EXTENSION_REQUEST', 'Tanggal baru harus setelah tanggal kembali saat ini.');
  }

  const [activeExtension] = await db
    .select({ id: bookingExtensions.id })
    .from(bookingExtensions)
    .where(and(
      eq(bookingExtensions.bookingId, bookingId),
      inArray(bookingExtensions.status, [...ACTIVE_EXTENSION_STATUSES]),
    ))
    .limit(1);

  if (activeExtension) {
    throw new BookingExtensionError('EXTENSION_ALREADY_ACTIVE', 'Masih ada perpanjangan yang menunggu proses untuk booking ini.');
  }

  let quote;
  try {
    quote = await createPricingQuote({
      carId: booking.carId,
      userId: actor.id,
      pickupDate: toDateOnlyString(currentEndDate),
      durationDays: extraDays,
      tripType: booking.tripType,
    });
  } catch (error) {
    throw new BookingExtensionError(
      'EXTENSION_PRICING_FAILED',
      error instanceof Error && error.message
        ? error.message
        : 'Harga perpanjangan tidak dapat dihitung.',
    );
  }

  const [row] = await db
    .insert(bookingExtensions)
    .values({
      bookingId,
      previousEndDate: currentEndDate,
      newEndDate,
      extraDays,
      extraAmount: quote.pricing.totalInvoiceDisplay,
      dynamicPriceDisplayPerDay: quote.pricing.dynamicPriceDisplayPerDay,
      pricingReasons: quote.pricingReasons,
      modelVersion: quote.pricing.modelVersion,
      status: 'AWAITING_PAYMENT',
    })
    .returning();

  if (!row) {
    throw new BookingExtensionError('INVALID_EXTENSION_REQUEST', 'Perpanjangan gagal disimpan. Silakan coba lagi.');
  }

  return mapExtensionRow(row);
}

export async function readBookingExtension(
  bookingIdRaw: string,
  user: ExtensionActor | null | undefined,
): Promise<BookingExtensionSummary | null> {
  const actor = assertActor(user);
  const bookingId = assertBookingId(bookingIdRaw);
  await loadBookingForCustomer(bookingId, actor);

  return loadLatestExtension(bookingId);
}

export async function readAdminBookingExtension(
  bookingIdRaw: string,
  user: ExtensionActor | null | undefined,
): Promise<BookingExtensionSummary | null> {
  assertAdminActor(user);
  const bookingId = assertBookingId(bookingIdRaw);

  const [booking] = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) {
    throw new BookingExtensionError('BOOKING_NOT_FOUND', 'Booking tidak ditemukan.');
  }

  return loadLatestExtension(bookingId);
}

/** Upload bukti transfer selisih perpanjangan (storage pembayaran yang sama). */
export async function submitBookingExtensionProof(
  bookingIdRaw: string,
  proofFile: PaymentProofUpload | null | undefined,
  user: ExtensionActor | null | undefined,
): Promise<BookingExtensionSummary> {
  const actor = assertActor(user);
  const bookingId = assertBookingId(bookingIdRaw);
  await loadBookingForCustomer(bookingId, actor);

  if (!proofFile) {
    throw new BookingExtensionError('INVALID_EXTENSION_REQUEST', 'Bukti pembayaran wajib diupload.');
  }

  const extension = await loadLatestExtension(bookingId);
  if (!extension) {
    throw new BookingExtensionError('EXTENSION_NOT_FOUND', 'Perpanjangan tidak ditemukan.');
  }
  if (extension.status !== 'AWAITING_PAYMENT') {
    throw new BookingExtensionError('EXTENSION_NOT_REVIEWABLE', 'Perpanjangan tidak sedang menunggu pembayaran.');
  }

  const saved = await localPaymentProofStorage.save(proofFile);
  const submittedAt = new Date();

  const [row] = await db
    .update(bookingExtensions)
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
      eq(bookingExtensions.id, extension.extensionId),
      eq(bookingExtensions.status, 'AWAITING_PAYMENT'),
    ))
    .returning();

  if (!row) {
    await localPaymentProofStorage.delete(saved.storageKey);
    throw new BookingExtensionError('EXTENSION_NOT_REVIEWABLE', 'Perpanjangan tidak sedang menunggu pembayaran.');
  }

  return mapExtensionRow(row);
}

/** Batalkan perpanjangan selama masih AWAITING_PAYMENT (belum upload bukti). */
export async function cancelBookingExtension(
  bookingIdRaw: string,
  user: ExtensionActor | null | undefined,
): Promise<BookingExtensionSummary> {
  const actor = assertActor(user);
  const bookingId = assertBookingId(bookingIdRaw);
  await loadBookingForCustomer(bookingId, actor);

  const extension = await loadLatestExtension(bookingId);
  if (!extension) {
    throw new BookingExtensionError('EXTENSION_NOT_FOUND', 'Perpanjangan tidak ditemukan.');
  }
  if (extension.status !== 'AWAITING_PAYMENT') {
    throw new BookingExtensionError('EXTENSION_NOT_REVIEWABLE', 'Perpanjangan hanya bisa dibatalkan sebelum bukti diupload.');
  }

  const [row] = await db
    .update(bookingExtensions)
    .set({ status: 'CANCELLED', updatedAt: new Date() })
    .where(and(
      eq(bookingExtensions.id, extension.extensionId),
      eq(bookingExtensions.status, 'AWAITING_PAYMENT'),
    ))
    .returning();

  if (!row) {
    throw new BookingExtensionError('EXTENSION_NOT_REVIEWABLE', 'Perpanjangan hanya bisa dibatalkan sebelum bukti diupload.');
  }

  return mapExtensionRow(row);
}

/**
 * Verifikasi admin: terapkan perpanjangan — endDate booking, total invoice
 * booking, dan snapshot invoice diperbarui (hari tambahan baru "dimiliki"
 * customer setelah selisih dibayar & diverifikasi).
 */
export async function verifyBookingExtension(
  bookingIdRaw: string,
  user: ExtensionActor | null | undefined,
): Promise<BookingExtensionSummary> {
  const actor = assertAdminActor(user);
  const bookingId = assertBookingId(bookingIdRaw);
  const reviewedAt = new Date();

  return db.transaction(async (tx) => {
    const extension = await (async () => {
      const [row] = await tx
        .select()
        .from(bookingExtensions)
        .where(eq(bookingExtensions.bookingId, bookingId))
        .orderBy(desc(bookingExtensions.createdAt))
        .limit(1);
      return row ?? null;
    })();

    if (!extension) {
      throw new BookingExtensionError('EXTENSION_NOT_FOUND', 'Perpanjangan tidak ditemukan.');
    }
    if (extension.status !== 'SUBMITTED') {
      throw new BookingExtensionError('EXTENSION_NOT_REVIEWABLE', 'Perpanjangan tidak berstatus SUBMITTED.');
    }

    const [updatedBooking] = await tx
      .update(bookings)
      .set({
        endDate: extension.newEndDate,
        totalPrice: sql`${bookings.totalPrice} + ${extension.extraAmount}`,
        updatedAt: reviewedAt,
      })
      .where(and(
        eq(bookings.id, bookingId),
        eq(bookings.status, 'CONFIRMED'),
      ))
      .returning({ id: bookings.id });

    if (!updatedBooking) {
      throw new BookingExtensionError('EXTENSION_NOT_ALLOWED', 'Booking sudah tidak CONFIRMED — perpanjangan tidak dapat diterapkan.');
    }

    await tx
      .update(bookingPriceSnapshots)
      .set({ totalInvoiceDisplay: sql`${bookingPriceSnapshots.totalInvoiceDisplay} + ${extension.extraAmount}` })
      .where(eq(bookingPriceSnapshots.bookingId, bookingId));

    const [updatedExtension] = await tx
      .update(bookingExtensions)
      .set({
        status: 'VERIFIED',
        reviewedAt,
        reviewedByUserId: actor.id,
        updatedAt: reviewedAt,
      })
      .where(and(
        eq(bookingExtensions.id, extension.id),
        eq(bookingExtensions.status, 'SUBMITTED'),
      ))
      .returning();

    if (!updatedExtension) {
      throw new BookingExtensionError('EXTENSION_NOT_REVIEWABLE', 'Perpanjangan tidak berstatus SUBMITTED.');
    }

    return mapExtensionRow(updatedExtension);
  });
}

export async function rejectBookingExtension(
  bookingIdRaw: string,
  rawReason: unknown,
  user: ExtensionActor | null | undefined,
): Promise<BookingExtensionSummary> {
  const actor = assertAdminActor(user);
  const bookingId = assertBookingId(bookingIdRaw);
  const reviewedAt = new Date();

  let rejectionReason: string | null = null;
  if (rawReason !== undefined && rawReason !== null) {
    if (typeof rawReason !== 'string') {
      throw new BookingExtensionError('INVALID_EXTENSION_REQUEST', 'rejectionReason harus berupa teks.');
    }
    const trimmed = rawReason.trim();
    if (trimmed.length > REJECTION_REASON_MAX_LENGTH) {
      throw new BookingExtensionError('INVALID_EXTENSION_REQUEST', `rejectionReason maksimal ${REJECTION_REASON_MAX_LENGTH} karakter.`);
    }
    rejectionReason = trimmed || null;
  }

  const [row] = await db
    .update(bookingExtensions)
    .set({
      status: 'REJECTED',
      rejectionReason,
      reviewedAt,
      reviewedByUserId: actor.id,
      updatedAt: reviewedAt,
    })
    .where(and(
      eq(bookingExtensions.bookingId, bookingId),
      eq(bookingExtensions.status, 'SUBMITTED'),
    ))
    .returning();

  if (!row) {
    const extension = await loadLatestExtension(bookingId);
    if (!extension) {
      throw new BookingExtensionError('EXTENSION_NOT_FOUND', 'Perpanjangan tidak ditemukan.');
    }
    throw new BookingExtensionError('EXTENSION_NOT_REVIEWABLE', 'Perpanjangan tidak berstatus SUBMITTED.');
  }

  return mapExtensionRow(row);
}

export interface AdminExtensionProofResult {
  extensionId: string;
  mimeType: string;
  filename: string;
  sizeBytes: number;
  data: Uint8Array;
}

const EXTENSION_PROOF_FALLBACK_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export async function getAdminBookingExtensionProof(
  bookingIdRaw: string,
  user: ExtensionActor | null | undefined,
): Promise<AdminExtensionProofResult> {
  assertAdminActor(user);
  const bookingId = assertBookingId(bookingIdRaw);

  const extension = await loadLatestExtension(bookingId);
  if (!extension) {
    throw new BookingExtensionError('EXTENSION_NOT_FOUND', 'Perpanjangan tidak ditemukan.');
  }

  const row = await db
    .select({
      id: bookingExtensions.id,
      proofStorageKey: bookingExtensions.proofStorageKey,
      proofOriginalName: bookingExtensions.proofOriginalName,
      proofMimeType: bookingExtensions.proofMimeType,
      proofSizeBytes: bookingExtensions.proofSizeBytes,
    })
    .from(bookingExtensions)
    .where(eq(bookingExtensions.id, extension.extensionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row?.proofStorageKey || !row.proofMimeType || !localPaymentProofStorage.read) {
    throw new BookingExtensionError('EXTENSION_PROOF_NOT_FOUND', 'Bukti perpanjangan tidak ditemukan.');
  }

  const mimeType = row.proofMimeType.trim().toLowerCase();
  const fallbackExtension = EXTENSION_PROOF_FALLBACK_EXTENSIONS[mimeType] ?? 'bin';
  const sanitizedName = (row.proofOriginalName ?? '')
    .trim()
    .replace(/[/\\]/g, '-')
    .replace(/["\r\n]/g, '_');
  const filename = sanitizedName || `extension-proof-${row.id}.${fallbackExtension}`;

  const data = await localPaymentProofStorage.read(row.proofStorageKey);

  return {
    extensionId: row.id,
    mimeType,
    filename,
    sizeBytes: row.proofSizeBytes ?? data.byteLength,
    data,
  };
}

export { PaymentServiceError };
