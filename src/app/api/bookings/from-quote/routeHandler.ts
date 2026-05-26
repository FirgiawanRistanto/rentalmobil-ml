import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../lib/auth-session';
import {
  BookingFromQuoteError,
  createBookingFromQuote,
  type AuthenticatedBookingUser,
  type BookingFromQuoteResult,
} from '../../../../services/bookingFromQuoteService';

interface BookingFromQuoteRouteService {
  createBookingFromQuote(input: unknown, user: AuthenticatedBookingUser | null): Promise<BookingFromQuoteResult>;
}

interface BookingFromQuoteRouteDependencies {
  service?: BookingFromQuoteRouteService;
  getCurrentUser?: () => Promise<AuthenticatedBookingUser | null>;
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

function mapBookingFromQuoteError(error: BookingFromQuoteError): NextResponse<ErrorResponseBody> {
  if (error.code === 'AUTHENTICATION_REQUIRED') {
    return errorResponse(error.code, error.message, 401);
  }

  if (error.code === 'QUOTE_NOT_FOUND') {
    return errorResponse(error.code, error.message, 404);
  }

  if (error.code === 'QUOTE_NOT_OWNED_BY_USER') {
    return errorResponse(error.code, error.message, 403);
  }

  if (
    error.code === 'QUOTE_EXPIRED' ||
    error.code === 'QUOTE_NOT_ACTIVE' ||
    error.code === 'QUOTE_ALREADY_USED' ||
    error.code === 'SELECTED_CAR_UNAVAILABLE' ||
    error.code === 'QUOTE_REPRICE_REQUIRED' ||
    error.code === 'CAR_UNIT_ALLOCATION_FAILED'
  ) {
    return errorResponse(error.code, error.message, 409);
  }

  if (error.code === 'BOOKING_CREATION_FAILED') {
    return errorResponse(error.code, error.message, 500);
  }

  return errorResponse(error.code, error.message, 400);
}

async function getSessionUser(): Promise<AuthenticatedBookingUser | null> {
  const session = await getCurrentAuthSession();
  return session?.user?.id ? { id: session.user.id } : null;
}

export function createPostBookingFromQuoteHandler(
  dependencies: BookingFromQuoteRouteDependencies = {},
) {
  const service = dependencies.service ?? { createBookingFromQuote };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function postBookingFromQuote(request: Request): Promise<NextResponse> {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse('INVALID_BOOKING_REQUEST', 'Request body harus berupa JSON valid.', 400);
    }

    try {
      const user = await getCurrentUser();
      const booking = await service.createBookingFromQuote(body, user);

      return NextResponse.json(booking, { status: 201 });
    } catch (error) {
      if (error instanceof BookingFromQuoteError) {
        return mapBookingFromQuoteError(error);
      }

      return errorResponse('BOOKING_CREATION_FAILED', 'Gagal membuat booking dari pricing quote.', 500);
    }
  };
}
