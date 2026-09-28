import { NextResponse } from 'next/server';
import { MlPricingClientError } from '../../../../services/mlPricingClient';
import {
  createPricingQuote,
  PricingQuoteError,
  validateCreatePricingQuoteCustomerRequest,
  type CreatePricingQuoteInput,
  type PricingQuoteResult,
} from '../../../../services/pricingQuoteService';

interface PricingQuoteRouteService {
  createPricingQuote(input: CreatePricingQuoteInput): Promise<PricingQuoteResult>;
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

function mapPricingQuoteError(error: PricingQuoteError): NextResponse<ErrorResponseBody> {
  if (error.code === 'CAR_NOT_FOUND') {
    return errorResponse(error.code, error.message, 404);
  }

  if (
    error.code === 'SELECTED_CAR_UNAVAILABLE' ||
    error.code === 'NO_ACTIVE_CATEGORY_UNITS' ||
    error.code === 'UNALLOCATED_BLOCKING_BOOKING_FOUND'
  ) {
    return errorResponse(error.code, error.message, 409);
  }

  if (error.code === 'UNSUPPORTED_MODEL_VEHICLE_CATEGORY') {
    return errorResponse(error.code, error.message, 422);
  }

  if (error.code === 'PRICING_QUOTE_PERSIST_FAILED') {
    return errorResponse(error.code, error.message, 500);
  }

  return errorResponse(error.code, error.message, 400);
}

function mapMlPricingError(error: MlPricingClientError): NextResponse<ErrorResponseBody> {
  if (error.code === 'ML_CONTRACT_MISMATCH') {
    return errorResponse(error.code, error.message, 502);
  }

  return errorResponse(error.code, error.message, 503);
}

export function createPostPricingQuoteHandler(
  service: PricingQuoteRouteService = { createPricingQuote },
) {
  return async function postPricingQuote(request: Request): Promise<NextResponse> {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        'INVALID_PRICING_QUOTE_REQUEST',
        'Request body harus berupa JSON valid.',
        400,
      );
    }

    try {
      const customerInput = validateCreatePricingQuoteCustomerRequest(body);
      const quote = await service.createPricingQuote({
        ...customerInput,
        userId: null,
      });

      return NextResponse.json(quote);
    } catch (error) {
      if (error instanceof PricingQuoteError) {
        return mapPricingQuoteError(error);
      }

      if (error instanceof MlPricingClientError) {
        return mapMlPricingError(error);
      }

      return errorResponse(
        'PRICING_QUOTE_PERSIST_FAILED',
        'Gagal membuat pricing quote.',
        500,
      );
    }
  };
}
