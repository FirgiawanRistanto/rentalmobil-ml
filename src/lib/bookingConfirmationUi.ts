import {
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  formatSignedPercentId,
  getDemandDisplayLabel,
  getTripTypeLabel,
  isQuoteExpired,
  type DemandLevel,
  type PricingTripType,
} from './pricingQuoteUi';

export const BOOKING_FROM_QUOTE_ENDPOINT = '/api/bookings/from-quote';
export const BOOKING_CONFIRM_ROUTE = '/booking/confirm';
export const PHONE_NUMBER_MAX_LENGTH = 32;
export const PICKUP_ADDRESS_MAX_LENGTH = 500;
export const BOOKING_NOTES_MAX_LENGTH = 1000;

export type QuoteReadStatus = 'ACTIVE' | 'ACCEPTED' | 'EXPIRED' | 'INVALIDATED';

export interface BookingQuoteReadResponse {
  quoteId: string;
  quoteStatus: QuoteReadStatus;
  canSubmit: boolean;
  unavailableReason?: string;
  expiresAt: string;
  car: {
    id: string;
    name: string;
    category: string;
    basePricePerDay: number;
  };
  rental: {
    pickupDate: string;
    returnDate: string;
    durationDays: number;
    tripType: PricingTripType;
  };
  pricingContext: {
    availabilityRatio: number;
    utilizationRate: number;
    demandLevel: DemandLevel;
    isWeekend: 0 | 1;
    isHoliday: 0 | 1;
    isPeakSeason: 0 | 1;
    bookingLeadDays: number;
  };
  pricing: {
    modelVersion: string;
    predictedPriceAdjustmentPct: number;
    predictedPriceAdjustmentPercentDisplay: number;
    dynamicPriceRawPerDay: number;
    dynamicPriceDisplayPerDay: number;
    totalInvoiceDisplay: number;
  };
  pricingReasons: string[];
}

export interface BookingFromQuoteRequest {
  quoteId: string;
  phoneNumber: string;
  pickupAddress: string;
  notes?: string | null;
}

export interface BookingFromQuoteResponse {
  bookingId: string;
  status: 'PENDING';
  quoteId: string;
  quoteStatus: 'ACCEPTED';
  carUnitAllocated: boolean;
  reservationExpiresAt: string;
  rental: {
    pickupDate: string;
    returnDate: string;
    durationDays: number;
    tripType: PricingTripType;
  };
  pricing: {
    modelVersion: string;
    basePricePerDay: number;
    predictedPriceAdjustmentPct: number;
    dynamicPriceDisplayPerDay: number;
    totalInvoiceDisplay: number;
  };
  nextStep: 'PAYMENT_PENDING';
}

export interface BookingApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

export class BookingConfirmationClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BookingConfirmationClientError';
  }
}

function trimRequiredText(value: string, fieldLabel: string, maxLength: number): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new BookingConfirmationClientError(
      'INVALID_BOOKING_REQUEST',
      `${fieldLabel} wajib diisi.`,
    );
  }

  if (trimmed.length > maxLength) {
    throw new BookingConfirmationClientError(
      'INVALID_BOOKING_REQUEST',
      `${fieldLabel} maksimal ${maxLength} karakter.`,
    );
  }

  return trimmed;
}

export function buildQuoteReadEndpoint(quoteId: string): string {
  return `/api/pricing/quotes/${encodeURIComponent(quoteId)}`;
}

export function buildBookingConfirmPath(quoteId: string): string {
  return `${BOOKING_CONFIRM_ROUTE}?quoteId=${encodeURIComponent(quoteId)}`;
}

export function validateBookingConfirmationForm(input: BookingFromQuoteRequest): BookingFromQuoteRequest {
  const quoteId = input.quoteId.trim();

  if (!quoteId) {
    throw new BookingConfirmationClientError(
      'INVALID_BOOKING_REQUEST',
      'Estimasi harga tidak valid.',
    );
  }

  const notes = input.notes?.trim() || null;

  if (notes && notes.length > BOOKING_NOTES_MAX_LENGTH) {
    throw new BookingConfirmationClientError(
      'INVALID_BOOKING_REQUEST',
      `Catatan maksimal ${BOOKING_NOTES_MAX_LENGTH} karakter.`,
    );
  }

  return {
    quoteId,
    phoneNumber: trimRequiredText(input.phoneNumber, 'Nomor HP', PHONE_NUMBER_MAX_LENGTH),
    pickupAddress: trimRequiredText(input.pickupAddress, 'Alamat penjemputan', PICKUP_ADDRESS_MAX_LENGTH),
    notes,
  };
}

export function getBookingFromQuoteErrorMessage(code: string): string {
  switch (code) {
    case 'AUTHENTICATION_REQUIRED':
      return 'Silakan login untuk melanjutkan booking.';
    case 'INVALID_BOOKING_REQUEST':
      return 'Lengkapi nomor HP dan alamat penjemputan.';
    case 'QUOTE_NOT_FOUND':
      return 'Estimasi harga tidak ditemukan. Silakan hitung ulang harga.';
    case 'QUOTE_NOT_OWNED_BY_USER':
      return 'Estimasi harga ini tidak dapat digunakan oleh akun Anda.';
    case 'QUOTE_EXPIRED':
      return 'Estimasi harga telah kedaluwarsa. Silakan hitung ulang harga.';
    case 'QUOTE_NOT_ACTIVE':
    case 'QUOTE_ALREADY_USED':
      return 'Estimasi harga sudah digunakan atau tidak lagi aktif.';
    case 'SELECTED_CAR_UNAVAILABLE':
      return 'Mobil tidak lagi tersedia pada periode tersebut. Silakan pilih ulang.';
    case 'QUOTE_REPRICE_REQUIRED':
      return 'Ketersediaan atau kondisi harga telah berubah. Silakan hitung ulang harga.';
    case 'CAR_UNIT_ALLOCATION_FAILED':
      return 'Unit kendaraan tidak lagi tersedia. Silakan pilih ulang.';
    case 'BOOKING_CREATION_FAILED':
      return 'Booking belum berhasil dibuat. Silakan coba kembali.';
    default:
      return 'Booking belum berhasil dibuat. Silakan coba kembali.';
  }
}

export function getQuoteReadStatusMessage(quote: Pick<BookingQuoteReadResponse, 'quoteStatus' | 'expiresAt'>): string | null {
  if (quote.quoteStatus === 'ACCEPTED') {
    return 'Estimasi harga ini sudah digunakan untuk booking.';
  }

  if (quote.quoteStatus === 'INVALIDATED') {
    return 'Estimasi harga ini tidak lagi valid. Silakan hitung ulang harga.';
  }

  if (quote.quoteStatus === 'EXPIRED' || isQuoteExpired(quote.expiresAt)) {
    return 'Estimasi harga telah kedaluwarsa. Silakan hitung ulang harga.';
  }

  return null;
}

export function isBookingReservationExpired(reservationExpiresAt: string, referenceDate = new Date()): boolean {
  return new Date(reservationExpiresAt).getTime() <= referenceDate.getTime();
}

export {
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  formatSignedPercentId,
  getDemandDisplayLabel,
  getTripTypeLabel,
};
