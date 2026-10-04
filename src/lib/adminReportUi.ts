import { getCarCategoryDisplayLabel } from './carCategoryUi';
import {
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getTripTypeLabel,
  type BookingStatus,
  type PaymentStatus,
  type TripType,
} from './paymentUi';
import { formatSignedPercentId } from './pricingQuoteUi';

export const ADMIN_REPORT_ENDPOINT = '/api/admin/reports';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface AdminReportQuery {
  startDate: string;
  endDate: string;
}

export interface AdminReportMetrics {
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  submittedPayments: number;
  verifiedPayments: number;
  rejectedPayments: number;
  expiredPayments: number;
  verifiedPaymentTotal: number;
  averageInvoiceValue: number;
  totalQuotes: number;
  acceptedQuotes: number;
  averageAdjustmentPercentDisplay: number;
  dynamicPricingFlatTotal: number;
  dynamicPricingDynamicTotal: number;
  dynamicPricingUplift: number;
  totalFines: number;
  verifiedFineTotal: number;
  pendingFineTotal: number;
  rejectedFineTotal: number;
}

export interface AdminReportBreakdownItem {
  key: string;
  label: string;
  count: number;
}

export interface AdminReportTopItem {
  id: string;
  label: string;
  category: string | null;
  bookingCount: number;
  totalInvoiceDisplay: number;
}

export interface AdminReportRecentTransaction {
  bookingId: string;
  bookingCode: string;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus | null;
  createdAt: string;
  customer: {
    name: string;
    email: string;
  };
  car: {
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
  detailPath: string;
}

export interface AdminReportResponse {
  generatedAt: string;
  period: AdminReportQuery;
  modelLabel: 'Model Harga Dinamis';
  metrics: AdminReportMetrics;
  bookingStatusBreakdown: AdminReportBreakdownItem[];
  paymentStatusBreakdown: AdminReportBreakdownItem[];
  topCars: AdminReportTopItem[];
  topCategories: AdminReportTopItem[];
  recentTransactions: AdminReportRecentTransaction[];
}

export function buildAdminReportEndpoint(query?: Partial<AdminReportQuery>): string {
  const params = new URLSearchParams();
  if (query?.startDate) params.set('startDate', query.startDate);
  if (query?.endDate) params.set('endDate', query.endDate);
  const serialized = params.toString();
  return serialized ? `${ADMIN_REPORT_ENDPOINT}?${serialized}` : ADMIN_REPORT_ENDPOINT;
}

export function toLocalDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDefaultAdminReportQuery(referenceDate = new Date()): AdminReportQuery {
  const end = new Date(referenceDate);
  const start = new Date(referenceDate);
  start.setDate(start.getDate() - 29);

  return {
    startDate: toLocalDateOnly(start),
    endDate: toLocalDateOnly(end),
  };
}

function readParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params instanceof URLSearchParams ? params.get(key) ?? undefined : params[key];
  return Array.isArray(value) ? value[0] : value;
}

function isValidDateOnly(value: string | undefined): value is string {
  return !!value && DATE_ONLY_PATTERN.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

export function parseAdminReportQuery(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  referenceDate = new Date(),
): AdminReportQuery {
  const fallback = getDefaultAdminReportQuery(referenceDate);
  const startDate = readParam(params, 'startDate');
  const endDate = readParam(params, 'endDate');

  if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate) || startDate > endDate) {
    return fallback;
  }

  return { startDate, endDate };
}

export function buildAdminReportCode(bookingId: string): string {
  return `BRM-${bookingId.slice(0, 8).toUpperCase()}`;
}

export function formatAdminReportCategory(category: string | null): string {
  return category ? getCarCategoryDisplayLabel(category) : '-';
}

export {
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  formatSignedPercentId,
  getTripTypeLabel,
};
