export const BOOKING_EXTENSION_STATUSES = [
  'AWAITING_PAYMENT',
  'SUBMITTED',
  'VERIFIED',
  'REJECTED',
  'CANCELLED',
] as const;

export type BookingExtensionStatus = (typeof BOOKING_EXTENSION_STATUSES)[number];

export interface BookingExtensionSummary {
  extensionId: string;
  bookingId: string;
  status: BookingExtensionStatus;
  previousEndDate: string;
  newEndDate: string;
  extraDays: number;
  extraAmount: number;
  dynamicPriceDisplayPerDay: number;
  pricingReasons: string[];
  modelVersion: string;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  hasProof: boolean;
}

export function getBookingExtensionStatusLabel(status: BookingExtensionStatus | string): string {
  switch (status) {
    case 'AWAITING_PAYMENT':
      return 'Menunggu Pembayaran';
    case 'SUBMITTED':
      return 'Menunggu Verifikasi Admin';
    case 'VERIFIED':
      return 'Disetujui — Terpasang';
    case 'REJECTED':
      return 'Ditolak';
    case 'CANCELLED':
      return 'Dibatalkan';
    default:
      return status;
  }
}

export function getBookingExtensionBadgeClass(status: BookingExtensionStatus | string): string {
  switch (status) {
    case 'AWAITING_PAYMENT':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
    case 'SUBMITTED':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
    case 'VERIFIED':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'REJECTED':
      return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function getBookingExtensionErrorMessage(code: string): string {
  switch (code) {
    case 'AUTHENTICATION_REQUIRED':
      return 'Silakan login untuk mengelola perpanjangan sewa.';
    case 'ADMIN_AUTHORIZATION_REQUIRED':
      return 'Hanya admin yang dapat memproses perpanjangan sewa.';
    case 'INVALID_EXTENSION_REQUEST':
      return 'Permintaan perpanjangan tidak valid. Periksa tanggal yang dipilih.';
    case 'BOOKING_NOT_FOUND':
      return 'Booking tidak ditemukan.';
    case 'BOOKING_NOT_OWNED_BY_USER':
      return 'Booking ini bukan milik akun Anda.';
    case 'EXTENSION_NOT_ALLOWED':
      return 'Perpanjangan tidak dapat dilakukan untuk booking ini.';
    case 'EXTENSION_ALREADY_ACTIVE':
      return 'Masih ada perpanjangan yang menunggu proses untuk booking ini.';
    case 'EXTENSION_NOT_FOUND':
      return 'Perpanjangan tidak ditemukan.';
    case 'EXTENSION_NOT_REVIEWABLE':
      return 'Status perpanjangan tidak memungkinkan aksi ini.';
    case 'EXTENSION_PRICING_FAILED':
      return 'Harga perpanjangan tidak dapat dihitung. Silakan coba lagi nanti.';
    case 'EXTENSION_PROOF_NOT_FOUND':
      return 'Bukti perpanjangan tidak ditemukan.';
    default:
      return 'Terjadi kesalahan. Silakan coba lagi.';
  }
}

/** Tanggal minimum untuk perpanjangan: satu hari setelah tanggal kembali saat ini. */
export function nextExtensionMinDate(currentEndDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(currentEndDate);
  if (!match) {
    return '';
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1);
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
