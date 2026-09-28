import {
  BookingConfirmationClientError,
  buildQuoteReadEndpoint,
  getBookingFromQuoteErrorMessage,
  type BookingApiErrorBody,
  type BookingQuoteReadResponse,
} from '../lib/bookingConfirmationUi';

export interface ReadPricingQuoteOptions {
  fetchFn?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isBookingQuoteReadResponse(value: unknown): value is BookingQuoteReadResponse {
  if (!isRecord(value)) {
    return false;
  }

  const car = value.car;
  const rental = value.rental;
  const pricing = value.pricing;
  const pricingContext = value.pricingContext;

  return (
    typeof value.quoteId === 'string' &&
    typeof value.quoteStatus === 'string' &&
    typeof value.canSubmit === 'boolean' &&
    typeof value.expiresAt === 'string' &&
    isRecord(car) &&
    typeof car.id === 'string' &&
    typeof car.name === 'string' &&
    typeof car.category === 'string' &&
    typeof car.basePricePerDay === 'number' &&
    isRecord(rental) &&
    typeof rental.pickupDate === 'string' &&
    typeof rental.returnDate === 'string' &&
    typeof rental.durationDays === 'number' &&
    typeof rental.tripType === 'string' &&
    isRecord(pricing) &&
    typeof pricing.modelVersion === 'string' &&
    typeof pricing.predictedPriceAdjustmentPct === 'number' &&
    typeof pricing.predictedPriceAdjustmentPercentDisplay === 'number' &&
    typeof pricing.dynamicPriceRawPerDay === 'number' &&
    typeof pricing.dynamicPriceDisplayPerDay === 'number' &&
    typeof pricing.totalInvoiceDisplay === 'number' &&
    isRecord(pricingContext) &&
    typeof pricingContext.availabilityRatio === 'number' &&
    typeof pricingContext.utilizationRate === 'number' &&
    typeof pricingContext.demandLevel === 'string' &&
    Array.isArray(value.pricingReasons)
  );
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as BookingApiErrorBody;
    return body.error?.code || 'QUOTE_NOT_FOUND';
  } catch {
    return 'QUOTE_NOT_FOUND';
  }
}

export async function readPricingQuoteForBooking(
  quoteId: string,
  options: ReadPricingQuoteOptions = {},
): Promise<BookingQuoteReadResponse> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildQuoteReadEndpoint(quoteId), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const code = await readErrorCode(response);
    throw new BookingConfirmationClientError(code, getBookingFromQuoteErrorMessage(code));
  }

  const quote = await response.json();

  if (!isBookingQuoteReadResponse(quote)) {
    throw new BookingConfirmationClientError(
      'QUOTE_READ_RESPONSE_INVALID',
      'Estimasi harga tidak dapat dibaca. Silakan hitung ulang harga.',
    );
  }

  return quote;
}
