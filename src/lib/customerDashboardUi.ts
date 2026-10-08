import { buildBookingPaymentPath, type BookingStatus, type PaymentStatus, type TripType } from './paymentUi';

export const CUSTOMER_BOOKINGS_ENDPOINT = '/api/customer/bookings';

/** Riwayat booking ditampilkan sebagai kartu besar, jadi satu halaman berisi 5 kartu. */
export const DEFAULT_CUSTOMER_BOOKINGS_PAGE_SIZE = 5;
export const CUSTOMER_BOOKINGS_MAX_PAGE_SIZE = 20;

export type CustomerBookingDisplayStatus =
  | 'WAITING_PAYMENT_PROOF'
  | 'WAITING_ADMIN_VERIFICATION'
  | 'CONFIRMED'
  | 'PAYMENT_REJECTED'
  | 'EXPIRED'
  | 'COMPLETED';

export interface CustomerDashboardBooking {
  bookingId: string;
  bookingStatus: BookingStatus;
  displayStatus: CustomerBookingDisplayStatus;
  car: {
    id: string;
    name: string;
    category: string;
    unitPlate: string | null;
  };
  rental: {
    pickupDate: string;
    returnDate: string;
    durationDays: number;
    tripType: TripType;
  };
  pricing: {
    modelVersion: string | null;
    dynamicPriceDisplayPerDay: number | null;
    totalInvoiceDisplay: number;
  };
  reservationExpiresAt: string | null;
  createdAt: string;
  payment: {
    paymentStatus: PaymentStatus | null;
    submittedAt: string | null;
    reviewExpiresAt: string | null;
    rejectionReason: string | null;
  };
  actions: {
    canUploadPaymentProof: boolean;
    canCancelReservation: boolean;
    paymentPath: string;
  };
}

export interface CustomerDashboardSummary {
  totalBookings: number;
  activeBookings: number;
  completedOrConfirmedBookings: number;
}

export interface CustomerBookingsQuery {
  page: number;
  pageSize: number;
}

export const DEFAULT_CUSTOMER_BOOKINGS_QUERY: CustomerBookingsQuery = {
  page: 1,
  pageSize: DEFAULT_CUSTOMER_BOOKINGS_PAGE_SIZE,
};

export interface CustomerBookingsResponse {
  customer: {
    id: string;
    name: string | null;
    email: string | null;
  };
  summary: CustomerDashboardSummary;
  bookings: CustomerDashboardBooking[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface DisplayStatusInput {
  bookingStatus: BookingStatus;
  reservationExpiresAt: string | null;
  payment: {
    paymentStatus: PaymentStatus | null;
    reviewExpiresAt: string | null;
  };
}

function readSearchParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  if (params instanceof URLSearchParams) {
    return params.get(key);
  }

  const value = params[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function clampPositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function parseCustomerBookingsSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): CustomerBookingsQuery {
  return {
    page: clampPositiveInt(readSearchParam(params, 'page'), DEFAULT_CUSTOMER_BOOKINGS_QUERY.page, 100000),
    pageSize: clampPositiveInt(
      readSearchParam(params, 'pageSize'),
      DEFAULT_CUSTOMER_BOOKINGS_QUERY.pageSize,
      CUSTOMER_BOOKINGS_MAX_PAGE_SIZE,
    ),
  };
}

export function buildCustomerBookingsEndpoint(query: Partial<CustomerBookingsQuery> = {}): string {
  const nextQuery = { ...DEFAULT_CUSTOMER_BOOKINGS_QUERY, ...query };
  const params = new URLSearchParams();

  if (nextQuery.page !== DEFAULT_CUSTOMER_BOOKINGS_QUERY.page) params.set('page', String(nextQuery.page));
  if (nextQuery.pageSize !== DEFAULT_CUSTOMER_BOOKINGS_QUERY.pageSize) params.set('pageSize', String(nextQuery.pageSize));

  const serialized = params.toString();
  return serialized ? `${CUSTOMER_BOOKINGS_ENDPOINT}?${serialized}` : CUSTOMER_BOOKINGS_ENDPOINT;
}

export function isPastIsoInstant(value: string | null | undefined, referenceDate = new Date()): boolean {
  if (!value) {
    return true;
  }

  return new Date(value).getTime() <= referenceDate.getTime();
}

export function deriveCustomerBookingDisplayStatus(
  booking: DisplayStatusInput,
  referenceDate = new Date(),
): CustomerBookingDisplayStatus {
  if (booking.bookingStatus === 'COMPLETED') {
    return 'COMPLETED';
  }

  if (booking.bookingStatus === 'CONFIRMED') {
    return 'CONFIRMED';
  }

  if (booking.bookingStatus === 'EXPIRED') {
    return 'EXPIRED';
  }

  if (booking.bookingStatus === 'CANCELLED') {
    return booking.payment.paymentStatus === 'REJECTED'
      ? 'PAYMENT_REJECTED'
      : 'EXPIRED';
  }

  if (booking.bookingStatus === 'PENDING' && booking.payment.paymentStatus === 'SUBMITTED') {
    return isPastIsoInstant(booking.payment.reviewExpiresAt, referenceDate)
      ? 'EXPIRED'
      : 'WAITING_ADMIN_VERIFICATION';
  }

  if (booking.bookingStatus === 'PENDING' && !booking.payment.paymentStatus) {
    return isPastIsoInstant(booking.reservationExpiresAt, referenceDate)
      ? 'EXPIRED'
      : 'WAITING_PAYMENT_PROOF';
  }

  return 'EXPIRED';
}

export function canUploadPaymentProofFromDashboard(
  booking: Pick<CustomerDashboardBooking, 'displayStatus'>,
): boolean {
  return booking.displayStatus === 'WAITING_PAYMENT_PROOF';
}

export function canCancelReservationFromDashboard(
  booking: Pick<CustomerDashboardBooking, 'actions' | 'displayStatus'>,
): boolean {
  return booking.displayStatus === 'WAITING_PAYMENT_PROOF' && booking.actions.canCancelReservation;
}

export function getCustomerDisplayStatusLabel(status: CustomerBookingDisplayStatus): string {
  switch (status) {
    case 'WAITING_PAYMENT_PROOF':
      return 'Menunggu Bukti Pembayaran';
    case 'WAITING_ADMIN_VERIFICATION':
      return 'Menunggu Verifikasi Admin';
    case 'CONFIRMED':
      return 'Booking Dikonfirmasi';
    case 'PAYMENT_REJECTED':
      return 'Pembayaran Ditolak';
    case 'EXPIRED':
      return 'Reservasi Kedaluwarsa';
    case 'COMPLETED':
      return 'Selesai';
  }
}

export function getCustomerDisplayStatusBadgeClass(status: CustomerBookingDisplayStatus): string {
  switch (status) {
    case 'WAITING_PAYMENT_PROOF':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/60';
    case 'WAITING_ADMIN_VERIFICATION':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/60';
    case 'CONFIRMED':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60';
    case 'PAYMENT_REJECTED':
    case 'EXPIRED':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/60';
    case 'COMPLETED':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export function getCustomerBookingActionLabel(booking: Pick<CustomerDashboardBooking, 'displayStatus'>): string {
  switch (booking.displayStatus) {
    case 'WAITING_PAYMENT_PROOF':
      return 'Upload Bukti Pembayaran';
    case 'WAITING_ADMIN_VERIFICATION':
      return 'Lihat Status Pembayaran';
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'Lihat Detail Booking';
    case 'PAYMENT_REJECTED':
    case 'EXPIRED':
      return 'Lihat Status';
  }
}

export function buildCustomerBookingPaymentPath(bookingId: string): string {
  return buildBookingPaymentPath(bookingId);
}
