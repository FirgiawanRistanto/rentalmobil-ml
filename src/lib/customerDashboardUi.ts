import { buildBookingPaymentPath, type BookingStatus, type PaymentStatus, type TripType } from './paymentUi';

export const CUSTOMER_BOOKINGS_ENDPOINT = '/api/customer/bookings';

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
    paymentPath: string;
  };
}

export interface CustomerDashboardSummary {
  totalBookings: number;
  activeBookings: number;
  completedOrConfirmedBookings: number;
}

export interface CustomerBookingsResponse {
  customer: {
    id: string;
    name: string | null;
    email: string | null;
  };
  summary: CustomerDashboardSummary;
  bookings: CustomerDashboardBooking[];
}

export interface DisplayStatusInput {
  bookingStatus: BookingStatus;
  reservationExpiresAt: string | null;
  payment: {
    paymentStatus: PaymentStatus | null;
    reviewExpiresAt: string | null;
  };
}

export function buildCustomerBookingsEndpoint(): string {
  return CUSTOMER_BOOKINGS_ENDPOINT;
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

  if (booking.bookingStatus === 'CONFIRMED' && booking.payment.paymentStatus === 'VERIFIED') {
    return 'CONFIRMED';
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
