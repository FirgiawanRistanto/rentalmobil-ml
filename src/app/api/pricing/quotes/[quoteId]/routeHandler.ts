import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../../lib/auth-session';
import {
  PricingQuoteReadError,
  readPricingQuoteForBooking,
  type AuthenticatedQuoteReader,
} from '../../../../../services/pricingQuoteReadService';

interface PricingQuoteReadRouteService {
  readPricingQuoteForBooking(input: {
    quoteId: string;
    user: AuthenticatedQuoteReader | null;
  }): Promise<unknown>;
}

interface PricingQuoteReadRouteDependencies {
  service?: PricingQuoteReadRouteService;
  getCurrentUser?: () => Promise<AuthenticatedQuoteReader | null>;
}

interface PricingQuoteRouteContext {
  params: Promise<{ quoteId: string }> | { quoteId: string };
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

function mapReadError(error: PricingQuoteReadError): NextResponse<ErrorResponseBody> {
  if (error.code === 'AUTHENTICATION_REQUIRED') {
    return errorResponse(error.code, error.message, 401);
  }

  if (error.code === 'QUOTE_NOT_FOUND') {
    return errorResponse(error.code, error.message, 404);
  }

  if (error.code === 'QUOTE_NOT_OWNED_BY_USER') {
    return errorResponse(error.code, error.message, 403);
  }

  return errorResponse(error.code, error.message, 400);
}

async function getSessionUser(): Promise<AuthenticatedQuoteReader | null> {
  const session = await getCurrentAuthSession();
  return session?.user?.id ? { id: session.user.id } : null;
}

async function resolveParams(context: PricingQuoteRouteContext): Promise<{ quoteId: string }> {
  return await context.params;
}

export function createGetPricingQuoteForBookingHandler(
  dependencies: PricingQuoteReadRouteDependencies = {},
) {
  const service = dependencies.service ?? { readPricingQuoteForBooking };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function getPricingQuoteForBooking(
    _request: Request,
    context: PricingQuoteRouteContext,
  ): Promise<NextResponse> {
    try {
      const [{ quoteId }, user] = await Promise.all([
        resolveParams(context),
        getCurrentUser(),
      ]);
      const quote = await service.readPricingQuoteForBooking({ quoteId, user });

      return NextResponse.json(quote);
    } catch (error) {
      if (error instanceof PricingQuoteReadError) {
        return mapReadError(error);
      }

      return errorResponse(
        'QUOTE_READ_FAILED',
        'Gagal membaca estimasi harga untuk konfirmasi booking.',
        500,
      );
    }
  };
}
