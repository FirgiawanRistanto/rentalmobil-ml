import {
  ADMIN_PAYMENTS_ROUTE,
  buildAdminPaymentDetailPath,
  type BookingStatus,
  type PaymentStatus,
  type TripType,
} from './paymentUi';

export const ADMIN_DASHBOARD_ENDPOINT = '/api/admin/dashboard';

export interface AdminDashboardMetrics {
  totalBookings: number;
  activePendingBookings: number;
  awaitingPaymentProof: number;
  awaitingPaymentVerification: number;
  confirmedBookings: number;
  cancelledOrExpiredBookings: number;
  verifiedPaymentTotal: number;
  activeFleetUnits: number;
  availableFleetUnitsNow: number;
}

export interface AdminDashboardRecentPayment {
  paymentId: string;
  paymentStatus: PaymentStatus;
  bookingId: string;
  bookingStatus: BookingStatus;
  amount: number;
  submittedAt: string;
  reviewExpiresAt: string;
  canReview: boolean;
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
}

export interface AdminDashboardRecentBooking {
  bookingId: string;
  bookingStatus: BookingStatus;
  createdAt: string;
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
  totalInvoiceDisplay: number;
  paymentStatus: PaymentStatus | null;
}

export interface AdminDashboardResponse {
  generatedAt: string;
  metrics: AdminDashboardMetrics;
  recentPayments: AdminDashboardRecentPayment[];
  recentBookings: AdminDashboardRecentBooking[];
}

export function buildAdminDashboardEndpoint(): string {
  return ADMIN_DASHBOARD_ENDPOINT;
}

export function getAdminPaymentsRoute(): string {
  return ADMIN_PAYMENTS_ROUTE;
}

export function getAdminPaymentDetailRoute(paymentId: string): string {
  return buildAdminPaymentDetailPath(paymentId);
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function getAdminBookingStatusLabel(
  bookingStatus: BookingStatus,
  paymentStatus?: PaymentStatus | null,
): string {
  if (bookingStatus === 'PENDING' && !paymentStatus) {
    return 'Menunggu Bukti Pembayaran';
  }

  if (bookingStatus === 'PENDING' && paymentStatus === 'SUBMITTED') {
    return 'Menunggu Verifikasi';
  }

  if (bookingStatus === 'CONFIRMED') {
    return 'Dikonfirmasi';
  }

  if (bookingStatus === 'CANCELLED' && paymentStatus === 'REJECTED') {
    return 'Ditolak';
  }

  if (bookingStatus === 'CANCELLED' || paymentStatus === 'EXPIRED') {
    return 'Kedaluwarsa';
  }

  if (bookingStatus === 'COMPLETED') {
    return 'Selesai';
  }

  return bookingStatus;
}

export function getAdminStatusBadgeClass(
  bookingStatus: BookingStatus,
  paymentStatus?: PaymentStatus | null,
): string {
  if (bookingStatus === 'PENDING' && paymentStatus === 'SUBMITTED') {
    return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/60';
  }

  if (bookingStatus === 'PENDING') {
    return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/60';
  }

  if (bookingStatus === 'CONFIRMED') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60';
  }

  if (bookingStatus === 'CANCELLED' || paymentStatus === 'REJECTED' || paymentStatus === 'EXPIRED') {
    return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/60';
  }

  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
}
