import type { BookingExtensionStatus } from './bookingExtensionUi';
import type { BookingFineStatus } from './bookingFineUi';
import {
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getTripTypeLabel,
  type BookingStatus,
  type PaymentStatus,
  type TripType,
} from './paymentUi';

export const ADMIN_TRANSACTIONS_ROUTE = '/admin/transaksi';

export type AdminTransactionDisplayStatus =
  | 'WAITING_PAYMENT'
  | 'WAITING_VERIFICATION'
  | 'CONFIRMED'
  | 'PAYMENT_REJECTED'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'UNKNOWN';

export type AdminTransactionFilter = 'ALL' | AdminTransactionDisplayStatus;
export type AdminTransactionStatusFilter =
  | 'all'
  | 'unpaid'
  | 'waiting_verification'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'completed'
  | 'cancelled'
  | 'extension';
export type AdminTransactionSort = 'createdAt' | 'startDate' | 'totalInvoice' | 'customerName' | 'carName';
export type AdminTransactionOrder = 'asc' | 'desc';

export interface AdminTransactionsQuery {
  page: number;
  pageSize: number;
  status: AdminTransactionStatusFilter;
  q: string;
  sort: AdminTransactionSort;
  order: AdminTransactionOrder;
}

export interface AdminTransactionListItem {
  bookingId: string;
  bookingCode: string;
  bookingStatus: BookingStatus;
  displayStatus: AdminTransactionDisplayStatus;
  extensionStatus: BookingExtensionStatus | null;
  fineStatus: BookingFineStatus | null;
  createdAt: string;
  reservationExpiresAt: string | null;
  customer: {
    id: string;
    name: string;
    email: string;
  };
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
    dynamicPriceDisplayPerDay: number | null;
    totalInvoiceDisplay: number;
    modelVersion: string | null;
  };
  payment: null | {
    paymentId: string;
    paymentStatus: PaymentStatus;
    amount: number;
    submittedAt: string | null;
    reviewExpiresAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
  };
  actions: {
    detailPath: string;
    paymentReviewPath: string | null;
    proofPath: string | null;
  };
}

export interface AdminTransactionsResponse {
  items: AdminTransactionListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AdminTransactionDetailResponse extends AdminTransactionListItem {
  phoneNumber: string | null;
  pickupAddress: string | null;
  notes: string | null;
  priceSnapshot: {
    basePricePerDay: number | null;
    predictedPriceAdjustmentPct: number | null;
    dynamicPriceRawPerDay: number | null;
    dynamicPriceDisplayPerDay: number | null;
    totalInvoiceDisplay: number | null;
    modelVersion: string | null;
    pricingReasons: unknown;
  };
}

export interface AdminBookingStatusUpdateResponse {
  bookingId: string;
  bookingStatus: BookingStatus;
  updatedAt: string;
}

export class AdminTransactionUiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AdminTransactionUiError';
  }
}

function isPastIso(value: string | null | undefined, referenceDate: Date): boolean {
  return !!value && new Date(value).getTime() <= referenceDate.getTime();
}

export const DEFAULT_ADMIN_TRANSACTIONS_QUERY: AdminTransactionsQuery = {
  page: 1,
  pageSize: 10,
  status: 'all',
  q: '',
  sort: 'createdAt',
  order: 'desc',
};

const ADMIN_TRANSACTION_STATUS_FILTERS = new Set<AdminTransactionStatusFilter>([
  'all',
  'unpaid',
  'waiting_verification',
  'verified',
  'rejected',
  'expired',
  'completed',
  'cancelled',
  'extension',
]);

const ADMIN_TRANSACTION_SORTS = new Set<AdminTransactionSort>([
  'createdAt',
  'startDate',
  'totalInvoice',
  'customerName',
  'carName',
]);

function getFirstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readSearchParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  return params instanceof URLSearchParams ? params.get(key) ?? undefined : getFirstParam(params[key]);
}

function clampPositiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function parseAdminTransactionsSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): AdminTransactionsQuery {
  const status = readSearchParam(params, 'status');
  const sort = readSearchParam(params, 'sort');
  const order = readSearchParam(params, 'order');
  const pageSize = clampPositiveInt(
    readSearchParam(params, 'pageSize'),
    DEFAULT_ADMIN_TRANSACTIONS_QUERY.pageSize,
    50,
  );

  return {
    page: clampPositiveInt(readSearchParam(params, 'page'), DEFAULT_ADMIN_TRANSACTIONS_QUERY.page, 100000),
    pageSize,
    status: ADMIN_TRANSACTION_STATUS_FILTERS.has(status as AdminTransactionStatusFilter)
      ? (status as AdminTransactionStatusFilter)
      : DEFAULT_ADMIN_TRANSACTIONS_QUERY.status,
    q: (readSearchParam(params, 'q') ?? '').trim().slice(0, 120),
    sort: ADMIN_TRANSACTION_SORTS.has(sort as AdminTransactionSort)
      ? (sort as AdminTransactionSort)
      : DEFAULT_ADMIN_TRANSACTIONS_QUERY.sort,
    order: order === 'asc' ? 'asc' : DEFAULT_ADMIN_TRANSACTIONS_QUERY.order,
  };
}

export function buildAdminTransactionListPath(query: Partial<AdminTransactionsQuery> = {}): string {
  const nextQuery = { ...DEFAULT_ADMIN_TRANSACTIONS_QUERY, ...query };
  const params = new URLSearchParams();

  if (nextQuery.page !== DEFAULT_ADMIN_TRANSACTIONS_QUERY.page) params.set('page', String(nextQuery.page));
  if (nextQuery.pageSize !== DEFAULT_ADMIN_TRANSACTIONS_QUERY.pageSize) params.set('pageSize', String(nextQuery.pageSize));
  if (nextQuery.status !== DEFAULT_ADMIN_TRANSACTIONS_QUERY.status) params.set('status', nextQuery.status);
  if (nextQuery.q) params.set('q', nextQuery.q);
  if (nextQuery.sort !== DEFAULT_ADMIN_TRANSACTIONS_QUERY.sort) params.set('sort', nextQuery.sort);
  if (nextQuery.order !== DEFAULT_ADMIN_TRANSACTIONS_QUERY.order) params.set('order', nextQuery.order);

  const serialized = params.toString();
  return serialized ? `${ADMIN_TRANSACTIONS_ROUTE}?${serialized}` : ADMIN_TRANSACTIONS_ROUTE;
}

export function buildAdminTransactionCode(bookingId: string): string {
  return `BRM-${bookingId.slice(0, 8).toUpperCase()}`;
}

export function buildAdminTransactionDetailPath(bookingId: string): string {
  return `${ADMIN_TRANSACTIONS_ROUTE}/${encodeURIComponent(bookingId)}`;
}

export function buildAdminTransactionListEndpoint(): string {
  return '/api/admin/transactions';
}

export function buildAdminTransactionDetailEndpoint(bookingId: string): string {
  return `/api/admin/transactions/${encodeURIComponent(bookingId)}`;
}

export function buildAdminBookingStatusUpdateEndpoint(bookingId: string): string {
  return buildAdminTransactionDetailEndpoint(bookingId);
}

export function getAdminBookingStatusTransitionOptions(status: BookingStatus): BookingStatus[] {
  if (status === 'CONFIRMED') {
    return ['COMPLETED'];
  }

  return [];
}

export function getAdminTransactionDisplayStatus(
  bookingStatus: BookingStatus,
  paymentStatus: PaymentStatus | null,
  reservationExpiresAt: string | null,
  reviewExpiresAt: string | null,
  referenceDate = new Date(),
): AdminTransactionDisplayStatus {
  if (bookingStatus === 'COMPLETED') {
    return 'COMPLETED';
  }

  if (bookingStatus === 'EXPIRED') {
    return 'EXPIRED';
  }

  if (bookingStatus === 'CONFIRMED') {
    return 'CONFIRMED';
  }

  if (bookingStatus === 'CANCELLED' && paymentStatus === 'REJECTED') {
    return 'PAYMENT_REJECTED';
  }

  if (bookingStatus === 'CANCELLED' && paymentStatus === 'EXPIRED') {
    return 'EXPIRED';
  }

  if (bookingStatus === 'PENDING' && paymentStatus === 'SUBMITTED') {
    return isPastIso(reviewExpiresAt, referenceDate) ? 'EXPIRED' : 'WAITING_VERIFICATION';
  }

  if (bookingStatus === 'PENDING' && !paymentStatus) {
    return isPastIso(reservationExpiresAt, referenceDate) ? 'EXPIRED' : 'WAITING_PAYMENT';
  }

  if (bookingStatus === 'CANCELLED') {
    return 'CANCELLED';
  }

  return 'UNKNOWN';
}

export function getAdminTransactionStatusLabel(status: AdminTransactionDisplayStatus): string {
  switch (status) {
    case 'WAITING_PAYMENT':
      return 'Belum Bayar';
    case 'WAITING_VERIFICATION':
      return 'Menunggu Verifikasi';
    case 'CONFIRMED':
      return 'Terverifikasi';
    case 'PAYMENT_REJECTED':
      return 'Ditolak';
    case 'EXPIRED':
      return 'Kedaluwarsa';
    case 'COMPLETED':
      return 'Selesai';
    case 'CANCELLED':
      return 'Dibatalkan';
    case 'UNKNOWN':
      return 'Status Tidak Lengkap';
  }
}

export function getAdminTransactionStatusBadgeClass(status: AdminTransactionDisplayStatus): string {
  switch (status) {
    case 'WAITING_PAYMENT':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    case 'WAITING_VERIFICATION':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/60';
    case 'CONFIRMED':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60';
    case 'PAYMENT_REJECTED':
    case 'EXPIRED':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/60';
    case 'COMPLETED':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/60';
    case 'CANCELLED':
      return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
    case 'UNKNOWN':
      return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
  }
}

export function getAdminTransactionErrorMessage(code: string): string {
  switch (code) {
    case 'AUTHENTICATION_REQUIRED':
      return 'Silakan login kembali.';
    case 'ADMIN_AUTHORIZATION_REQUIRED':
      return 'Anda tidak memiliki akses admin.';
    case 'ADMIN_TRANSACTION_NOT_FOUND':
      return 'Data transaksi tidak ditemukan.';
    case 'INVALID_BOOKING_STATUS_TRANSITION':
      return 'Perubahan status booking tidak sesuai lifecycle.';
    case 'BOOKING_STATUS_FINAL':
      return 'Status final tidak dapat diubah dari halaman admin.';
    case 'ADMIN_TRANSACTION_UPDATE_FAILED':
      return 'Status booking belum berhasil diperbarui.';
    case 'INVALID_RETURN_DATE':
      return 'Tanggal kembali aktual tidak valid.';
    case 'EXTENSION_PENDING_VERIFICATION':
      return 'Masih ada perpanjangan yang menunggu verifikasi. Selesaikan dulu perpanjangan tersebut.';
    default:
      return 'Data transaksi belum dapat dibaca.';
  }
}

export {
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getTripTypeLabel,
};
