import {
  PaymentUiError,
  buildAdminPaymentDetailEndpoint,
  buildAdminPaymentListEndpoint,
  buildAdminPaymentRejectEndpoint,
  buildAdminPaymentVerifyEndpoint,
  getAdminPaymentErrorMessage,
  type AdminPaymentDetailResponse,
  type AdminPaymentQueueResponse,
  type AdminPaymentReviewResponse,
  type PaymentStatus,
} from '../lib/paymentUi';

export interface AdminPaymentClientOptions {
  fetchFn?: typeof fetch;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isAdminPaymentQueueResponse(value: unknown): value is AdminPaymentQueueResponse {
  if (!isRecord(value) || !Array.isArray(value.payments)) {
    return false;
  }

  return value.payments.every((payment) => {
    if (!isRecord(payment)) {
      return false;
    }

    return (
      typeof payment.paymentId === 'string' &&
      typeof payment.paymentStatus === 'string' &&
      typeof payment.bookingId === 'string' &&
      typeof payment.bookingStatus === 'string' &&
      typeof payment.amount === 'number' &&
      typeof payment.submittedAt === 'string' &&
      typeof payment.reviewExpiresAt === 'string' &&
      typeof payment.canReview === 'boolean' &&
      typeof payment.hasProof === 'boolean' &&
      isRecord(payment.customer) &&
      isRecord(payment.car) &&
      isRecord(payment.rental)
    );
  });
}

function isAdminPaymentDetailResponse(value: unknown): value is AdminPaymentDetailResponse {
  return (
    isRecord(value) &&
    typeof value.paymentId === 'string' &&
    typeof value.paymentStatus === 'string' &&
    typeof value.bookingId === 'string' &&
    typeof value.amount === 'number' &&
    typeof value.canReview === 'boolean' &&
    isRecord(value.customer) &&
    isRecord(value.car) &&
    isRecord(value.rental) &&
    isRecord(value.priceSnapshot) &&
    typeof value.proofAvailable === 'boolean' &&
    typeof value.proofUrl === 'string' &&
    !JSON.stringify(value).includes('proofStorageKey')
  );
}

function isAdminPaymentReviewResponse(value: unknown): value is AdminPaymentReviewResponse {
  return (
    isRecord(value) &&
    typeof value.paymentId === 'string' &&
    (value.paymentStatus === 'VERIFIED' || value.paymentStatus === 'REJECTED') &&
    typeof value.bookingId === 'string' &&
    (value.bookingStatus === 'CONFIRMED' || value.bookingStatus === 'CANCELLED') &&
    typeof value.reviewedAt === 'string' &&
    value.reviewedByAdmin === true
  );
}

async function readErrorCode(response: Response, fallbackCode: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.error?.code || fallbackCode;
  } catch {
    return fallbackCode;
  }
}

export async function listAdminPaymentsClient(
  status: PaymentStatus | 'ALL' = 'SUBMITTED',
  options: AdminPaymentClientOptions = {},
): Promise<AdminPaymentQueueResponse> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildAdminPaymentListEndpoint(status), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const code = await readErrorCode(response, 'PAYMENT_NOT_FOUND');
    throw new PaymentUiError(code, getAdminPaymentErrorMessage(code));
  }

  const payments = await response.json();
  if (!isAdminPaymentQueueResponse(payments)) {
    throw new PaymentUiError('PAYMENT_RESPONSE_INVALID', 'Daftar pembayaran belum dapat dibaca.');
  }

  return payments;
}

export async function readAdminPaymentDetailClient(
  paymentId: string,
  options: AdminPaymentClientOptions = {},
): Promise<AdminPaymentDetailResponse> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildAdminPaymentDetailEndpoint(paymentId), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const code = await readErrorCode(response, 'PAYMENT_NOT_FOUND');
    throw new PaymentUiError(code, getAdminPaymentErrorMessage(code));
  }

  const payment = await response.json();
  if (!isAdminPaymentDetailResponse(payment)) {
    throw new PaymentUiError('PAYMENT_RESPONSE_INVALID', 'Detail pembayaran belum dapat dibaca.');
  }

  return payment;
}

export async function verifyAdminPaymentClient(
  paymentId: string,
  options: AdminPaymentClientOptions = {},
): Promise<AdminPaymentReviewResponse> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildAdminPaymentVerifyEndpoint(paymentId), {
    method: 'POST',
  });

  if (!response.ok) {
    const code = await readErrorCode(response, 'PAYMENT_VERIFICATION_FAILED');
    throw new PaymentUiError(code, getAdminPaymentErrorMessage(code));
  }

  const result = await response.json();
  if (!isAdminPaymentReviewResponse(result) || result.paymentStatus !== 'VERIFIED') {
    throw new PaymentUiError('PAYMENT_RESPONSE_INVALID', 'Verifikasi belum berhasil.');
  }

  return result;
}

export async function rejectAdminPaymentClient(
  paymentId: string,
  reason: string,
  options: AdminPaymentClientOptions = {},
): Promise<AdminPaymentReviewResponse> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new PaymentUiError('INVALID_PAYMENT_REQUEST', 'Alasan penolakan wajib diisi.');
  }

  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildAdminPaymentRejectEndpoint(paymentId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: trimmedReason }),
  });

  if (!response.ok) {
    const code = await readErrorCode(response, 'PAYMENT_REJECTION_FAILED');
    throw new PaymentUiError(code, getAdminPaymentErrorMessage(code));
  }

  const result = await response.json();
  if (!isAdminPaymentReviewResponse(result) || result.paymentStatus !== 'REJECTED') {
    throw new PaymentUiError('PAYMENT_RESPONSE_INVALID', 'Penolakan belum berhasil.');
  }

  return result;
}
