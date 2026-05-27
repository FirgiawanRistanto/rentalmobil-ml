import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../../lib/auth-session';
import {
  PaymentServiceError,
  type AuthenticatedPaymentUser,
} from '../../../../../services/paymentService';

export interface AdminPaymentRouteContext {
  params: Promise<{ paymentId: string }> | { paymentId: string };
}

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
  };
}

export function errorResponse(code: string, message: string, status: number): NextResponse<ErrorResponseBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function mapAdminPaymentError(error: PaymentServiceError): NextResponse<ErrorResponseBody> {
  if (error.code === 'AUTHENTICATION_REQUIRED') {
    return errorResponse(error.code, error.message, 401);
  }

  if (error.code === 'ADMIN_AUTHORIZATION_REQUIRED') {
    return errorResponse(error.code, error.message, 403);
  }

  if (error.code === 'PAYMENT_NOT_FOUND') {
    return errorResponse(error.code, error.message, 404);
  }

  if (error.code === 'PAYMENT_PROOF_NOT_FOUND') {
    return errorResponse(error.code, error.message, 404);
  }

  if (
    error.code === 'PAYMENT_NOT_REVIEWABLE' ||
    error.code === 'PAYMENT_REVIEW_EXPIRED' ||
    error.code === 'PAYMENT_AMOUNT_MISMATCH' ||
    error.code === 'BOOKING_NOT_PAYABLE' ||
    error.code === 'BOOKING_PRICE_SNAPSHOT_NOT_FOUND'
  ) {
    return errorResponse(error.code, error.message, 409);
  }

  if (error.code === 'INVALID_PAYMENT_REQUEST') {
    return errorResponse(error.code, error.message, 400);
  }

  return errorResponse(error.code, error.message, 400);
}

export async function getAdminRouteUser(): Promise<AuthenticatedPaymentUser | null> {
  const session = await getCurrentAuthSession();
  return session?.user?.id
    ? { id: session.user.id, role: session.user.role ?? null }
    : null;
}

export async function resolveAdminPaymentParams(
  context: AdminPaymentRouteContext,
): Promise<{ paymentId: string }> {
  return await context.params;
}
