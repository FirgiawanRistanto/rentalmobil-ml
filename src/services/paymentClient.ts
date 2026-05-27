import {
  PaymentUiError,
  buildBookingPaymentReadEndpoint,
  buildPaymentProofEndpoint,
  getPaymentErrorMessage,
  validatePaymentProofFile,
  type BookingPaymentReadResponse,
  type PaymentProofSubmitResponse,
} from '../lib/paymentUi';

export interface PaymentClientOptions {
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

function isPaymentStatus(value: unknown): boolean {
  return value === 'SUBMITTED' || value === 'VERIFIED' || value === 'REJECTED' || value === 'EXPIRED';
}

function isBookingPaymentReadResponse(value: unknown): value is BookingPaymentReadResponse {
  if (!isRecord(value)) {
    return false;
  }

  const car = value.car;
  const rental = value.rental;
  const pricing = value.pricing;
  const payment = value.payment;

  return (
    typeof value.bookingId === 'string' &&
    typeof value.bookingStatus === 'string' &&
    (typeof value.reservationExpiresAt === 'string' || value.reservationExpiresAt === null) &&
    isRecord(car) &&
    typeof car.id === 'string' &&
    typeof car.name === 'string' &&
    typeof car.category === 'string' &&
    isRecord(rental) &&
    typeof rental.pickupDate === 'string' &&
    typeof rental.returnDate === 'string' &&
    typeof rental.durationDays === 'number' &&
    typeof rental.tripType === 'string' &&
    isRecord(pricing) &&
    (typeof pricing.dynamicPriceDisplayPerDay === 'number' || pricing.dynamicPriceDisplayPerDay === null) &&
    typeof pricing.totalInvoiceDisplay === 'number' &&
    (typeof pricing.modelVersion === 'string' || pricing.modelVersion === null) &&
    (
      payment === null ||
      (
        isRecord(payment) &&
        typeof payment.paymentId === 'string' &&
        payment.method === 'BANK_TRANSFER_MANUAL' &&
        isPaymentStatus(payment.status) &&
        typeof payment.amount === 'number'
      )
    )
  );
}

function isPaymentProofSubmitResponse(value: unknown): value is PaymentProofSubmitResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.paymentId === 'string' &&
    typeof value.bookingId === 'string' &&
    value.paymentMethod === 'BANK_TRANSFER_MANUAL' &&
    value.paymentStatus === 'SUBMITTED' &&
    typeof value.amount === 'number' &&
    typeof value.submittedAt === 'string' &&
    typeof value.reviewExpiresAt === 'string' &&
    value.bookingStatus === 'PENDING' &&
    typeof value.reservationExpiresAt === 'string' &&
    value.nextStep === 'WAITING_ADMIN_VERIFICATION'
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

export async function readBookingPaymentClient(
  bookingId: string,
  options: PaymentClientOptions = {},
): Promise<BookingPaymentReadResponse> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildBookingPaymentReadEndpoint(bookingId), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const code = await readErrorCode(response, 'BOOKING_NOT_FOUND');
    throw new PaymentUiError(code, getPaymentErrorMessage(code));
  }

  const booking = await response.json();
  if (!isBookingPaymentReadResponse(booking)) {
    throw new PaymentUiError('BOOKING_RESPONSE_INVALID', 'Data booking belum dapat dibaca.');
  }

  return booking;
}

export async function uploadPaymentProofClient(
  bookingId: string,
  proofFile: File | null | undefined,
  options: PaymentClientOptions = {},
): Promise<PaymentProofSubmitResponse> {
  const file = validatePaymentProofFile(proofFile);
  const fetchFn = options.fetchFn ?? fetch;
  const formData = new FormData();
  formData.set('proofFile', file);

  const response = await fetchFn(buildPaymentProofEndpoint(bookingId), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const code = await readErrorCode(response, 'PAYMENT_SUBMISSION_FAILED');
    throw new PaymentUiError(code, getPaymentErrorMessage(code));
  }

  const payment = await response.json();
  if (!isPaymentProofSubmitResponse(payment)) {
    throw new PaymentUiError('PAYMENT_RESPONSE_INVALID', 'Bukti pembayaran belum berhasil dikirim. Silakan coba kembali.');
  }

  return payment;
}
