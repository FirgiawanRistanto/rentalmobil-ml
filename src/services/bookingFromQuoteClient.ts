import {
  BOOKING_FROM_QUOTE_ENDPOINT,
  BookingConfirmationClientError,
  getBookingFromQuoteErrorMessage,
  validateBookingConfirmationForm,
  type BookingApiErrorBody,
  type BookingFromQuoteRequest,
  type BookingFromQuoteResponse,
} from '../lib/bookingConfirmationUi';

export interface CreateBookingFromQuoteClientOptions {
  fetchFn?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isBookingFromQuoteResponse(value: unknown): value is BookingFromQuoteResponse {
  if (!isRecord(value)) {
    return false;
  }

  const rental = value.rental;
  const pricing = value.pricing;

  return (
    typeof value.bookingId === 'string' &&
    value.status === 'PENDING' &&
    typeof value.quoteId === 'string' &&
    value.quoteStatus === 'ACCEPTED' &&
    value.carUnitAllocated === true &&
    typeof value.reservationExpiresAt === 'string' &&
    value.nextStep === 'PAYMENT_PENDING' &&
    isRecord(rental) &&
    typeof rental.pickupDate === 'string' &&
    typeof rental.returnDate === 'string' &&
    typeof rental.durationDays === 'number' &&
    typeof rental.tripType === 'string' &&
    isRecord(pricing) &&
    typeof pricing.modelVersion === 'string' &&
    typeof pricing.basePricePerDay === 'number' &&
    typeof pricing.predictedPriceAdjustmentPct === 'number' &&
    typeof pricing.dynamicPriceDisplayPerDay === 'number' &&
    typeof pricing.totalInvoiceDisplay === 'number'
  );
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as BookingApiErrorBody;
    return body.error?.code || 'BOOKING_CREATION_FAILED';
  } catch {
    return 'BOOKING_CREATION_FAILED';
  }
}

export async function createBookingFromQuoteClient(
  input: BookingFromQuoteRequest,
  options: CreateBookingFromQuoteClientOptions = {},
): Promise<BookingFromQuoteResponse> {
  const payload = validateBookingConfirmationForm(input);
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(BOOKING_FROM_QUOTE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const code = await readErrorCode(response);
    throw new BookingConfirmationClientError(code, getBookingFromQuoteErrorMessage(code));
  }

  const booking = await response.json();

  if (!isBookingFromQuoteResponse(booking)) {
    throw new BookingConfirmationClientError(
      'BOOKING_RESPONSE_INVALID',
      'Booking belum berhasil dibuat. Silakan coba kembali.',
    );
  }

  return booking;
}
