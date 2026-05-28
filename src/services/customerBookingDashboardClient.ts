import {
  buildCustomerBookingsEndpoint,
  type CustomerBookingsResponse,
  type CustomerDashboardBooking,
} from '../lib/customerDashboardUi';
import { PaymentUiError } from '../lib/paymentUi';

export interface CustomerBookingDashboardClientOptions {
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

function isDashboardBooking(value: unknown): value is CustomerDashboardBooking {
  if (!isRecord(value)) {
    return false;
  }

  const car = value.car;
  const rental = value.rental;
  const pricing = value.pricing;
  const payment = value.payment;
  const actions = value.actions;

  return (
    typeof value.bookingId === 'string' &&
    typeof value.bookingStatus === 'string' &&
    typeof value.displayStatus === 'string' &&
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
    (typeof pricing.modelVersion === 'string' || pricing.modelVersion === null) &&
    (typeof pricing.dynamicPriceDisplayPerDay === 'number' || pricing.dynamicPriceDisplayPerDay === null) &&
    typeof pricing.totalInvoiceDisplay === 'number' &&
    (typeof value.reservationExpiresAt === 'string' || value.reservationExpiresAt === null) &&
    typeof value.createdAt === 'string' &&
    isRecord(payment) &&
    (typeof payment.paymentStatus === 'string' || payment.paymentStatus === null) &&
    isRecord(actions) &&
    typeof actions.canUploadPaymentProof === 'boolean' &&
    typeof actions.paymentPath === 'string'
  );
}

function isCustomerBookingsResponse(value: unknown): value is CustomerBookingsResponse {
  if (!isRecord(value)) {
    return false;
  }

  const customer = value.customer;
  const summary = value.summary;

  return (
    isRecord(customer) &&
    typeof customer.id === 'string' &&
    isRecord(summary) &&
    typeof summary.totalBookings === 'number' &&
    typeof summary.activeBookings === 'number' &&
    typeof summary.completedOrConfirmedBookings === 'number' &&
    Array.isArray(value.bookings) &&
    value.bookings.every(isDashboardBooking)
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

function getCustomerDashboardErrorMessage(code: string): string {
  switch (code) {
    case 'AUTHENTICATION_REQUIRED':
      return 'Silakan login untuk melihat dashboard booking.';
    default:
      return 'Dashboard booking belum dapat dibaca. Silakan coba kembali.';
  }
}

export async function listCustomerDashboardBookingsClient(
  options: CustomerBookingDashboardClientOptions = {},
): Promise<CustomerBookingsResponse> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildCustomerBookingsEndpoint(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const code = await readErrorCode(response, 'CUSTOMER_BOOKINGS_READ_FAILED');
    throw new PaymentUiError(code, getCustomerDashboardErrorMessage(code));
  }

  const body = await response.json();
  if (!isCustomerBookingsResponse(body)) {
    throw new PaymentUiError('CUSTOMER_BOOKINGS_RESPONSE_INVALID', 'Dashboard booking belum dapat dibaca.');
  }

  return body;
}
