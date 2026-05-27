import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../lib/auth-session';
import {
  PaymentServiceError,
  readBookingPayment,
  type AuthenticatedPaymentUser,
  type ReadBookingPaymentResult,
} from '../../../../services/paymentService';

interface ReadBookingPaymentRouteService {
  readBookingPayment(
    bookingId: string,
    user: AuthenticatedPaymentUser | null,
  ): Promise<ReadBookingPaymentResult>;
}

interface ReadBookingPaymentRouteDependencies {
  service?: ReadBookingPaymentRouteService;
  getCurrentUser?: () => Promise<AuthenticatedPaymentUser | null>;
}

interface ReadBookingPaymentRouteContext {
  params: Promise<{ bookingId: string }> | { bookingId: string };
}

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
  };
}

function errorResponse(code: string, message: string, status: number): NextResponse<ErrorResponseBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

function mapReadBookingPaymentError(error: PaymentServiceError): NextResponse<ErrorResponseBody> {
  if (error.code === 'AUTHENTICATION_REQUIRED') {
    return errorResponse(error.code, error.message, 401);
  }

  if (error.code === 'BOOKING_NOT_FOUND') {
    return errorResponse(error.code, error.message, 404);
  }

  if (error.code === 'BOOKING_NOT_OWNED_BY_USER') {
    return errorResponse(error.code, error.message, 403);
  }

  return errorResponse(error.code, error.message, 400);
}

async function getSessionUser(): Promise<AuthenticatedPaymentUser | null> {
  const session = await getCurrentAuthSession();
  return session?.user?.id
    ? { id: session.user.id, role: session.user.role ?? null }
    : null;
}

async function resolveParams(context: ReadBookingPaymentRouteContext): Promise<{ bookingId: string }> {
  return await context.params;
}

export function createGetBookingPaymentHandler(
  dependencies: ReadBookingPaymentRouteDependencies = {},
) {
  const service = dependencies.service ?? { readBookingPayment };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function getBookingPayment(
    _request: Request,
    context: ReadBookingPaymentRouteContext,
  ): Promise<NextResponse> {
    try {
      const [{ bookingId }, user] = await Promise.all([
        resolveParams(context),
        getCurrentUser(),
      ]);
      const booking = await service.readBookingPayment(bookingId, user);

      return NextResponse.json(booking);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return mapReadBookingPaymentError(error);
      }

      return errorResponse('BOOKING_NOT_FOUND', 'Booking tidak dapat dibaca.', 500);
    }
  };
}
