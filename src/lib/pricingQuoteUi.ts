export const MAX_QUOTE_DURATION_DAYS = 30;
export const PRICING_QUOTE_ENDPOINT = '/api/pricing/quotes';
export const LEGACY_PRICING_ESTIMATE_ENDPOINT = '/api/pricing/estimate';

export type PricingTripType = 'DALAM_KOTA' | 'LUAR_KOTA';
export type DemandLevel = 'sepi' | 'normal' | 'ramai';

export interface PricingQuoteRequest {
  carId: string;
  pickupDate: string;
  durationDays: number;
  tripType: PricingTripType;
}

export interface PricingQuoteResponse {
  quoteId: string;
  quoteStatus: 'ACTIVE' | 'ACCEPTED' | 'EXPIRED' | 'INVALIDATED';
  expiresAt: string;
  car: {
    id: string;
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

export type PricingQuoteErrorCode =
  | 'INVALID_PRICING_QUOTE_REQUEST'
  | 'CAR_NOT_FOUND'
  | 'SELECTED_CAR_UNAVAILABLE'
  | 'NO_ACTIVE_CATEGORY_UNITS'
  | 'UNALLOCATED_BLOCKING_BOOKING_FOUND'
  | 'UNSUPPORTED_MODEL_VEHICLE_CATEGORY'
  | 'ML_SERVICE_UNAVAILABLE'
  | 'ML_MODEL_NOT_READY'
  | 'ML_CONTRACT_MISMATCH'
  | 'PRICING_QUOTE_PERSIST_FAILED';

export interface PricingQuoteApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

export class PricingQuoteClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PricingQuoteClientError';
  }
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getTodayDateOnly(referenceDate = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function validatePricingQuoteForm(input: PricingQuoteRequest, referenceDate = new Date()): void {
  if (!input.carId.trim()) {
    throw new PricingQuoteClientError('INVALID_PRICING_QUOTE_REQUEST', 'Mobil tidak valid.');
  }

  if (!DATE_ONLY_PATTERN.test(input.pickupDate)) {
    throw new PricingQuoteClientError('INVALID_PRICING_QUOTE_REQUEST', 'Tanggal mulai sewa wajib diisi.');
  }

  if (input.pickupDate < getTodayDateOnly(referenceDate)) {
    throw new PricingQuoteClientError('INVALID_PRICING_QUOTE_REQUEST', 'Tanggal mulai sewa tidak boleh lampau.');
  }

  if (
    !Number.isInteger(input.durationDays) ||
    input.durationDays < 1 ||
    input.durationDays > MAX_QUOTE_DURATION_DAYS
  ) {
    throw new PricingQuoteClientError(
      'INVALID_PRICING_QUOTE_REQUEST',
      `Durasi sewa wajib 1 sampai ${MAX_QUOTE_DURATION_DAYS} hari.`,
    );
  }

  if (input.tripType !== 'DALAM_KOTA' && input.tripType !== 'LUAR_KOTA') {
    throw new PricingQuoteClientError('INVALID_PRICING_QUOTE_REQUEST', 'Jenis perjalanan tidak valid.');
  }
}

export function getPricingQuoteErrorMessage(code: string): string {
  switch (code) {
    case 'INVALID_PRICING_QUOTE_REQUEST':
      return 'Periksa kembali tanggal, durasi, dan jenis perjalanan.';
    case 'CAR_NOT_FOUND':
      return 'Mobil tidak ditemukan atau sudah tidak tersedia.';
    case 'SELECTED_CAR_UNAVAILABLE':
      return 'Mobil ini tidak tersedia pada periode yang dipilih. Silakan pilih tanggal atau mobil lain.';
    case 'NO_ACTIVE_CATEGORY_UNITS':
      return 'Unit kendaraan untuk kategori ini sedang tidak tersedia.';
    case 'UNALLOCATED_BLOCKING_BOOKING_FOUND':
      return 'Harga belum dapat dihitung saat ini. Silakan coba kembali atau hubungi admin.';
    case 'UNSUPPORTED_MODEL_VEHICLE_CATEGORY':
      return 'Kategori kendaraan belum mendukung perhitungan harga dinamis.';
    case 'ML_SERVICE_UNAVAILABLE':
    case 'ML_MODEL_NOT_READY':
      return 'Sistem rekomendasi harga sedang tidak tersedia. Silakan coba beberapa saat lagi.';
    default:
      return 'Terjadi kendala saat menghitung harga. Silakan coba kembali.';
  }
}

export function formatRupiahId(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace(/\s/g, '');
}

export function formatSignedPercentId(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export function formatPercentId(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDateId(dateOnlyOrIso: string): string {
  const [datePart] = dateOnlyOrIso.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateTimeId(isoDate: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

export function getTripTypeLabel(tripType: PricingTripType): string {
  return tripType === 'LUAR_KOTA' ? 'Luar Kota' : 'Dalam Kota';
}

export function getDemandDisplayLabel(demandLevel: DemandLevel): string {
  if (demandLevel === 'ramai') {
    return 'Permintaan Tinggi';
  }

  if (demandLevel === 'normal') {
    return 'Ketersediaan Normal';
  }

  return 'Ketersediaan Tinggi';
}

export function isQuoteExpired(expiresAt: string, referenceDate = new Date()): boolean {
  return new Date(expiresAt).getTime() <= referenceDate.getTime();
}

export function buildSafeBookingHandoffPath(_slug: string, quoteId: string): string {
  return `/booking/confirm?quoteId=${encodeURIComponent(quoteId)}`;
}

export function buildLoginCallbackForQuote(slug: string, quoteId: string): string {
  return `/login?callbackURL=${encodeURIComponent(buildSafeBookingHandoffPath(slug, quoteId))}`;
}
