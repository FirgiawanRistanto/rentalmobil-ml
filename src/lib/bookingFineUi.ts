export const BOOKING_FINE_STATUSES = [
  'AWAITING_PAYMENT',
  'SUBMITTED',
  'VERIFIED',
  'REJECTED',
] as const;

export type BookingFineStatus = (typeof BOOKING_FINE_STATUSES)[number];

/**
 * Denda keterlambatan dihitung sebagai persentase dari tarif harian yang
 * sudah disepakati customer (snapshot harga booking) per hari telat.
 * 100% = setara biaya sewa satu hari tambahan (standar industri overstay).
 * Nilai default ini bisa dikonfigurasi admin lewat pricing settings
 * (`lateFineDailyRatePct`); konstanta dipakai sebagai fallback.
 */
export const LATE_FINE_DAILY_RATE_PCT = 100;

export interface BookingFineSummary {
  fineId: string;
  bookingId: string;
  status: BookingFineStatus;
  originalEndDate: string;
  actualReturnDate: string;
  lateDays: number;
  finePerDay: number;
  fineAmount: number;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  hasProof: boolean;
}

export interface LateReturnFineCalculation {
  lateDays: number;
  finePerDay: number;
  fineAmount: number;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Hitung denda keterlambatan per hari kalender. `actualReturnDate` sebelum
 * `originalEndDate` dianggap tepat waktu (tanpa denda).
 * `dailyRatePct` = persentase tarif harian per hari telat (default konstanta;
 * dikonfigurasi admin lewat pricing settings).
 */
export function computeLateReturnFine(
  dailyRatePerDay: number,
  originalEndDate: string,
  actualReturnDate: string,
  dailyRatePct: number = LATE_FINE_DAILY_RATE_PCT,
): LateReturnFineCalculation {
  const due = parseDateOnly(originalEndDate);
  const actual = parseDateOnly(actualReturnDate);
  if (!due || !actual) {
    return { lateDays: 0, finePerDay: 0, fineAmount: 0 };
  }

  const effectivePct = Number.isFinite(dailyRatePct) ? dailyRatePct : LATE_FINE_DAILY_RATE_PCT;
  const lateDays = Math.max(0, dayDiff(due, actual));
  const finePerDay = Math.max(0, Math.round((dailyRatePerDay * effectivePct) / 100));
  return { lateDays, finePerDay, fineAmount: finePerDay * lateDays };
}

/** Hari melewati `dateOnly` sampai reference; negatif berarti masih sebelum tanggal. */
export function daysPastDateOnly(dateOnly: string, referenceDate = new Date()): number {
  const due = parseDateOnly(dateOnly);
  if (!due) {
    return 0;
  }

  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  return dayDiff(due, today);
}

export function getBookingFineStatusLabel(status: BookingFineStatus | string): string {
  switch (status) {
    case 'AWAITING_PAYMENT':
      return 'Menunggu Pembayaran';
    case 'SUBMITTED':
      return 'Menunggu Verifikasi Admin';
    case 'VERIFIED':
      return 'Disetujui — Masuk Tagihan';
    case 'REJECTED':
      return 'Dibatalkan';
    default:
      return status;
  }
}

export function getBookingFineBadgeClass(status: BookingFineStatus | string): string {
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

export function getBookingFineErrorMessage(code: string): string {
  switch (code) {
    case 'AUTHENTICATION_REQUIRED':
      return 'Silakan login untuk mengelola denda keterlambatan.';
    case 'ADMIN_AUTHORIZATION_REQUIRED':
      return 'Hanya admin yang dapat memproses denda keterlambatan.';
    case 'INVALID_FINE_REQUEST':
      return 'Permintaan denda tidak valid. Periksa data yang dikirim.';
    case 'BOOKING_NOT_FOUND':
      return 'Booking tidak ditemukan.';
    case 'BOOKING_NOT_OWNED_BY_USER':
      return 'Booking ini bukan milik akun Anda.';
    case 'FINE_NOT_FOUND':
      return 'Denda keterlambatan tidak ditemukan.';
    case 'FINE_NOT_REVIEWABLE':
      return 'Status denda tidak memungkinkan aksi ini.';
    case 'FINE_PROOF_NOT_FOUND':
      return 'Bukti pembayaran denda tidak ditemukan.';
    case 'EXTENSION_PENDING_VERIFICATION':
      return 'Masih ada perpanjangan yang menunggu verifikasi. Selesaikan dulu sebelum menyelesaikan booking.';
    default:
      return 'Terjadi kesalahan. Silakan coba lagi.';
  }
}
