import {
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getTripTypeLabel,
} from './bookingConfirmationUi';

export const BOOKING_PAYMENT_ROUTE_PREFIX = '/booking/payment';
export const LEGACY_PAYMENT_ROUTE_PREFIX = '/payment';
export const ADMIN_PAYMENTS_ROUTE = '/admin/payments';
export const MAX_PAYMENT_PROOF_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_PAYMENT_PROOF_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const SIMULATED_BANK_TRANSFER_INSTRUCTIONS = {
  label: 'Transfer Bank Manual - Simulasi',
  bankName: 'Bank XYZ',
  accountNumber: '1234567890',
  accountHolder: 'Rental Mobil XYZ',
  notice: 'Informasi rekening ini hanya untuk demonstrasi sistem dan bukan tujuan transfer nyata.',
};

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type PaymentStatus = 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
export type PaymentMethod = 'BANK_TRANSFER_MANUAL';
export type TripType = 'DALAM_KOTA' | 'LUAR_KOTA';

export interface BookingPaymentReadResponse {
  bookingId: string;
  bookingStatus: BookingStatus;
  reservationExpiresAt: string | null;
  car: {
    id: string;
    name: string;
    category: string;
  };
  rental: {
    pickupDate: string;
    returnDate: string;
    durationDays: number;
    tripType: TripType;
  };
  pricing: {
    dynamicPriceDisplayPerDay: number | null;
    totalInvoiceDisplay: number;
    modelVersion: string | null;
  };
  payment: null | {
    paymentId: string;
    method: PaymentMethod;
    status: PaymentStatus;
    amount: number;
    submittedAt: string | null;
    reviewExpiresAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
  };
}

export interface PaymentProofSubmitResponse {
  paymentId: string;
  bookingId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: 'SUBMITTED';
  amount: number;
  submittedAt: string;
  reviewExpiresAt: string;
  bookingStatus: 'PENDING';
  reservationExpiresAt: string;
  nextStep: 'WAITING_ADMIN_VERIFICATION';
}

export interface AdminPaymentQueueItem {
  paymentId: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  bookingId: string;
  bookingStatus: BookingStatus;
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
    tripType: TripType;
  };
}

export interface AdminPaymentQueueResponse {
  payments: AdminPaymentQueueItem[];
}

export interface AdminPaymentDetailResponse extends AdminPaymentQueueItem {
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

export interface AdminPaymentReviewResponse {
  paymentId: string;
  paymentStatus: 'VERIFIED' | 'REJECTED';
  bookingId: string;
  bookingStatus: 'CONFIRMED' | 'CANCELLED';
  reviewedAt: string;
  reviewedByAdmin: true;
}

export class PaymentUiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PaymentUiError';
  }
}

export function buildBookingPaymentPath(bookingId: string): string {
  return `${BOOKING_PAYMENT_ROUTE_PREFIX}/${encodeURIComponent(bookingId)}`;
}

export function buildBookingPaymentReadEndpoint(bookingId: string): string {
  return `/api/bookings/${encodeURIComponent(bookingId)}`;
}

export function buildPaymentProofEndpoint(bookingId: string): string {
  return `/api/bookings/${encodeURIComponent(bookingId)}/payment-proof`;
}

export function buildAdminPaymentListEndpoint(status?: PaymentStatus | 'ALL'): string {
  return status && status !== 'ALL'
    ? `/api/admin/payments?status=${encodeURIComponent(status)}`
    : '/api/admin/payments';
}

export function buildAdminPaymentDetailPath(paymentId: string): string {
  return `${ADMIN_PAYMENTS_ROUTE}/${encodeURIComponent(paymentId)}`;
}

export function buildAdminPaymentDetailEndpoint(paymentId: string): string {
  return `/api/admin/payments/${encodeURIComponent(paymentId)}`;
}

export function buildAdminPaymentVerifyEndpoint(paymentId: string): string {
  return `/api/admin/payments/${encodeURIComponent(paymentId)}/verify`;
}

export function buildAdminPaymentRejectEndpoint(paymentId: string): string {
  return `/api/admin/payments/${encodeURIComponent(paymentId)}/reject`;
}

export function isPastIsoDateTime(value: string | null | undefined, referenceDate = new Date()): boolean {
  if (!value) {
    return true;
  }

  return new Date(value).getTime() <= referenceDate.getTime();
}

export function canUploadPaymentProof(
  booking: Pick<BookingPaymentReadResponse, 'bookingStatus' | 'reservationExpiresAt' | 'payment'>,
  referenceDate = new Date(),
): boolean {
  return booking.bookingStatus === 'PENDING' &&
    !booking.payment &&
    !isPastIsoDateTime(booking.reservationExpiresAt, referenceDate);
}

export function getEffectivePaymentStatus(
  booking: Pick<BookingPaymentReadResponse, 'payment' | 'reservationExpiresAt' | 'bookingStatus'>,
  referenceDate = new Date(),
): PaymentStatus | 'NONE' | 'RESERVATION_EXPIRED' {
  if (!booking.payment) {
    return booking.bookingStatus === 'PENDING' && isPastIsoDateTime(booking.reservationExpiresAt, referenceDate)
      ? 'RESERVATION_EXPIRED'
      : 'NONE';
  }

  if (
    booking.payment.status === 'SUBMITTED' &&
    isPastIsoDateTime(booking.payment.reviewExpiresAt, referenceDate)
  ) {
    return 'EXPIRED';
  }

  return booking.payment.status;
}

export function validatePaymentProofFile(file: File | null | undefined): File {
  if (!file) {
    throw new PaymentUiError('PAYMENT_PROOF_REQUIRED', getPaymentErrorMessage('PAYMENT_PROOF_REQUIRED'));
  }

  if (!ALLOWED_PAYMENT_PROOF_MIME_TYPES.includes(file.type as (typeof ALLOWED_PAYMENT_PROOF_MIME_TYPES)[number])) {
    throw new PaymentUiError('INVALID_PAYMENT_PROOF_TYPE', getPaymentErrorMessage('INVALID_PAYMENT_PROOF_TYPE'));
  }

  if (file.size > MAX_PAYMENT_PROOF_SIZE_BYTES) {
    throw new PaymentUiError('PAYMENT_PROOF_TOO_LARGE', getPaymentErrorMessage('PAYMENT_PROOF_TOO_LARGE'));
  }

  return file;
}

export function getPaymentErrorMessage(code: string): string {
  switch (code) {
    case 'AUTHENTICATION_REQUIRED':
      return 'Silakan login untuk melihat atau melanjutkan pembayaran.';
    case 'BOOKING_NOT_FOUND':
      return 'Data booking tidak ditemukan.';
    case 'BOOKING_NOT_OWNED_BY_USER':
      return 'Anda tidak dapat mengakses booking ini.';
    case 'BOOKING_NOT_PAYABLE':
      return 'Booking ini tidak dapat menerima pembayaran.';
    case 'RESERVATION_EXPIRED':
      return 'Batas waktu reservasi telah berakhir. Silakan membuat booking baru.';
    case 'PAYMENT_ALREADY_SUBMITTED':
      return 'Bukti pembayaran telah dikirim dan sedang diproses.';
    case 'PAYMENT_PROOF_REQUIRED':
      return 'Pilih file bukti pembayaran terlebih dahulu.';
    case 'INVALID_PAYMENT_PROOF_TYPE':
      return 'Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.';
    case 'PAYMENT_PROOF_TOO_LARGE':
      return 'Ukuran file maksimal 5 MB.';
    case 'PAYMENT_SUBMISSION_FAILED':
      return 'Bukti pembayaran belum berhasil dikirim. Silakan coba kembali.';
    default:
      return 'Pembayaran belum berhasil diproses. Silakan coba kembali.';
  }
}

export function getAdminPaymentErrorMessage(code: string): string {
  switch (code) {
    case 'AUTHENTICATION_REQUIRED':
      return 'Silakan login kembali.';
    case 'FORBIDDEN':
    case 'ADMIN_REQUIRED':
    case 'ADMIN_AUTHORIZATION_REQUIRED':
      return 'Anda tidak memiliki akses admin.';
    case 'PAYMENT_NOT_FOUND':
      return 'Data pembayaran tidak ditemukan.';
    case 'PAYMENT_NOT_REVIEWABLE':
      return 'Pembayaran tidak dapat diproses.';
    case 'PAYMENT_REVIEW_EXPIRED':
      return 'Masa verifikasi telah berakhir. Booking dibatalkan.';
    case 'PAYMENT_AMOUNT_MISMATCH':
      return 'Nominal pembayaran tidak sesuai invoice.';
    case 'PAYMENT_VERIFICATION_FAILED':
      return 'Verifikasi belum berhasil.';
    case 'PAYMENT_REJECTION_FAILED':
      return 'Penolakan belum berhasil.';
    case 'ADMIN_DASHBOARD_READ_FAILED':
    case 'ADMIN_DASHBOARD_RESPONSE_INVALID':
      return 'Dashboard admin belum dapat dibaca.';
    default:
      return 'Data pembayaran belum dapat diproses. Silakan coba kembali.';
  }
}

export function getBookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Menunggu Pembayaran';
    case 'CONFIRMED':
      return 'Dikonfirmasi';
    case 'CANCELLED':
      return 'Dibatalkan';
    case 'COMPLETED':
      return 'Selesai';
  }
}

export function getPaymentStatusLabel(status: PaymentStatus | 'NONE' | 'RESERVATION_EXPIRED'): string {
  switch (status) {
    case 'SUBMITTED':
      return 'Menunggu Verifikasi Admin';
    case 'VERIFIED':
      return 'Pembayaran Terverifikasi';
    case 'REJECTED':
      return 'Bukti Pembayaran Ditolak';
    case 'EXPIRED':
    case 'RESERVATION_EXPIRED':
      return 'Kedaluwarsa';
    case 'NONE':
      return 'Menunggu Upload Bukti';
  }
}

export function getPaymentStatusBadgeClass(status: PaymentStatus | 'NONE' | 'RESERVATION_EXPIRED'): string {
  switch (status) {
    case 'SUBMITTED':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/60';
    case 'VERIFIED':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60';
    case 'REJECTED':
    case 'EXPIRED':
    case 'RESERVATION_EXPIRED':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/60';
    case 'NONE':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export {
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getTripTypeLabel,
};
