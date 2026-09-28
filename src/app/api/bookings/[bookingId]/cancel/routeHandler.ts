import { NextResponse } from 'next/server';
import {
  PaymentServiceError,
  cancelBookingReservation,
  type AuthenticatedPaymentUser,
  type CancelBookingReservationResult,
} from '../../../../../services/paymentService';

interface CancelBookingRouteService {
  cancelBookingReservation(
    bookingId: string,
    user: AuthenticatedPaymentUser | null,
  ): Promise<CancelBookingReservationResult>;
}

interface CancelBookingRouteDependencies {
  service?: CancelBookingRouteService;
  getCurrentUser?: () => Promise<AuthenticatedPaymentUser | null>;
}

interface CancelBookingRouteContext {
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

function mapCancelBookingError(error: PaymentServiceError): NextResponse<ErrorResponseBody> {
  if (error.code === 'AUTHENTICATION_REQUIRED') {
    return errorResponse(error.code, error.message, 401);
  }

  if (error.code === 'BOOKING_NOT_FOUND') {
    return errorResponse(error.code, error.message, 404);
  }

  if (error.code === 'BOOKING_NOT_OWNED_BY_USER') {
    return errorResponse(error.code, error.message, 403);
  }

  if (error.code === 'BOOKING_CANNOT_BE_CANCELLED' || error.code === 'RESERVATION_EXPIRED') {
    return errorResponse(error.code, error.message, 409);
  }

  return errorResponse(error.code, error.message, 400);
}

async function getSessionUser(): Promise<AuthenticatedPaymentUser | null> {
  const { getCurrentAuthSession } = await import('../../../../../lib/auth-session');
  const session = await getCurrentAuthSession();
  return session?.user?.id
    ? { id: session.user.id, role: session.user.role ?? null }
    : null;
}

async function resolveParams(context: CancelBookingRouteContext): Promise<{ bookingId: string }> {
  return await context.params;
}

export function createPostCancelBookingHandler(
  dependencies: CancelBookingRouteDependencies = {},
) {
  const service = dependencies.service ?? { cancelBookingReservation };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function postCancelBooking(
    _request: Request,
    context: CancelBookingRouteContext,
  ): Promise<NextResponse> {
    try {
      const [{ bookingId }, user] = await Promise.all([
        resolveParams(context),
        getCurrentUser(),
      ]);
      const result = await service.cancelBookingReservation(bookingId, user);

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return mapCancelBookingError(error);
      }

      return errorResponse('BOOKING_CANCEL_FAILED', 'Reservasi belum berhasil dibatalkan.', 500);
    }
  };
}
