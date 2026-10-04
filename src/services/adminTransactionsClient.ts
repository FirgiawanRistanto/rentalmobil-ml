import {
  AdminTransactionUiError,
  buildAdminBookingStatusUpdateEndpoint,
  buildAdminTransactionDetailEndpoint,
  buildAdminTransactionListEndpoint,
  getAdminTransactionErrorMessage,
  type AdminBookingStatusUpdateResponse,
  type AdminTransactionDetailResponse,
  type AdminTransactionsResponse,
} from '../lib/adminTransactionUi';
import type { BookingStatus } from '../lib/paymentUi';

interface AdminTransactionsClientOptions {
  fetchFn?: typeof fetch;
}

interface ApiErrorBody {
  error?: {
    code?: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isTransaction(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.bookingId === 'string' &&
    typeof value.bookingCode === 'string' &&
    typeof value.bookingStatus === 'string' &&
    typeof value.displayStatus === 'string' &&
    typeof value.createdAt === 'string' &&
    isRecord(value.customer) &&
    isRecord(value.car) &&
    isRecord(value.rental) &&
    isRecord(value.pricing) &&
    isRecord(value.actions) &&
    !JSON.stringify(value).includes('proofStorageKey')
  );
}

function isTransactionsResponse(value: unknown): value is AdminTransactionsResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isTransaction) &&
    typeof value.page === 'number' &&
    typeof value.pageSize === 'number' &&
    typeof value.totalItems === 'number' &&
    typeof value.totalPages === 'number' &&
    typeof value.hasNextPage === 'boolean' &&
    typeof value.hasPreviousPage === 'boolean'
  );
}

function isTransactionDetailResponse(value: unknown): value is AdminTransactionDetailResponse {
  return isTransaction(value) && isRecord(value) && isRecord(value.priceSnapshot);
}

function isBookingStatusUpdateResponse(value: unknown): value is AdminBookingStatusUpdateResponse {
  return (
    isRecord(value) &&
    typeof value.bookingId === 'string' &&
    typeof value.bookingStatus === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

async function readErrorCode(response: Response, fallbackCode: string): Promise<string> {
  try {
    const body = await response.json() as ApiErrorBody;
    return body.error?.code || fallbackCode;
  } catch {
    return fallbackCode;
  }
}

export async function listAdminTransactionsClient(
  options: AdminTransactionsClientOptions = {},
): Promise<AdminTransactionsResponse> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildAdminTransactionListEndpoint(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const code = await readErrorCode(response, 'ADMIN_TRANSACTION_READ_FAILED');
    throw new AdminTransactionUiError(code, getAdminTransactionErrorMessage(code));
  }

  const body = await response.json();
  if (!isTransactionsResponse(body)) {
    throw new AdminTransactionUiError('ADMIN_TRANSACTION_RESPONSE_INVALID', 'Data transaksi belum dapat dibaca.');
  }

  return body;
}

export async function readAdminTransactionDetailClient(
  bookingId: string,
  options: AdminTransactionsClientOptions = {},
): Promise<AdminTransactionDetailResponse> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildAdminTransactionDetailEndpoint(bookingId), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const code = await readErrorCode(response, 'ADMIN_TRANSACTION_NOT_FOUND');
    throw new AdminTransactionUiError(code, getAdminTransactionErrorMessage(code));
  }

  const body = await response.json();
  if (!isTransactionDetailResponse(body)) {
    throw new AdminTransactionUiError('ADMIN_TRANSACTION_RESPONSE_INVALID', 'Detail transaksi belum dapat dibaca.');
  }

  return body;
}

export async function updateAdminBookingStatusClient(
  bookingId: string,
  nextStatus: BookingStatus,
  options: AdminTransactionsClientOptions = {},
  actualReturnDate?: string,
): Promise<AdminBookingStatusUpdateResponse> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildAdminBookingStatusUpdateEndpoint(bookingId), {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(actualReturnDate ? { status: nextStatus, actualReturnDate } : { status: nextStatus }),
  });

  if (!response.ok) {
    const code = await readErrorCode(response, 'ADMIN_TRANSACTION_UPDATE_FAILED');
    throw new AdminTransactionUiError(code, getAdminTransactionErrorMessage(code));
  }

  const body = await response.json();
  if (!isBookingStatusUpdateResponse(body)) {
    throw new AdminTransactionUiError('ADMIN_TRANSACTION_RESPONSE_INVALID', 'Status booking belum dapat diperbarui.');
  }

  return body;
}
