import { NextResponse } from 'next/server';
import {
  PaymentServiceError,
  rejectPaymentSubmission,
  type AuthenticatedPaymentUser,
  type ReviewPaymentResult,
} from '../../../../../../services/paymentService';
import {
  errorResponse,
  getAdminRouteUser,
  mapAdminPaymentError,
  resolveAdminPaymentParams,
  type AdminPaymentRouteContext,
} from '../routeUtils';

interface RejectPaymentRouteService {
  rejectPaymentSubmission(
    paymentId: string,
    reason: unknown,
    user: AuthenticatedPaymentUser | null,
  ): Promise<ReviewPaymentResult>;
}

interface RejectPaymentRouteDependencies {
  service?: RejectPaymentRouteService;
  getCurrentUser?: () => Promise<AuthenticatedPaymentUser | null>;
}

export function createPostRejectPaymentHandler(
  dependencies: RejectPaymentRouteDependencies = {},
) {
  const service = dependencies.service ?? { rejectPaymentSubmission };
  const getCurrentUser = dependencies.getCurrentUser ?? getAdminRouteUser;

  return async function postRejectPayment(
    request: Request,
    context: AdminPaymentRouteContext,
  ): Promise<NextResponse> {
    let body: unknown = {};

    try {
      body = await request.json();
    } catch {
      return errorResponse('INVALID_PAYMENT_REQUEST', 'Request body harus berupa JSON valid.', 400);
    }

    try {
      const [{ paymentId }, user] = await Promise.all([
        resolveAdminPaymentParams(context),
        getCurrentUser(),
      ]);
      const reason = body && typeof body === 'object' && 'reason' in body
        ? (body as { reason?: unknown }).reason
        : undefined;
      const result = await service.rejectPaymentSubmission(paymentId, reason, user);

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return mapAdminPaymentError(error);
      }

      return errorResponse('PAYMENT_SUBMISSION_FAILED', 'Gagal menolak pembayaran.', 500);
    }
  };
}
