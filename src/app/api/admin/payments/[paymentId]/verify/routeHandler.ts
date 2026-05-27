import { NextResponse } from 'next/server';
import {
  PaymentServiceError,
  verifyPaymentSubmission,
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

interface VerifyPaymentRouteService {
  verifyPaymentSubmission(
    paymentId: string,
    user: AuthenticatedPaymentUser | null,
  ): Promise<ReviewPaymentResult>;
}

interface VerifyPaymentRouteDependencies {
  service?: VerifyPaymentRouteService;
  getCurrentUser?: () => Promise<AuthenticatedPaymentUser | null>;
}

export function createPostVerifyPaymentHandler(
  dependencies: VerifyPaymentRouteDependencies = {},
) {
  const service = dependencies.service ?? { verifyPaymentSubmission };
  const getCurrentUser = dependencies.getCurrentUser ?? getAdminRouteUser;

  return async function postVerifyPayment(
    _request: Request,
    context: AdminPaymentRouteContext,
  ): Promise<NextResponse> {
    try {
      const [{ paymentId }, user] = await Promise.all([
        resolveAdminPaymentParams(context),
        getCurrentUser(),
      ]);
      const result = await service.verifyPaymentSubmission(paymentId, user);

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return mapAdminPaymentError(error);
      }

      return errorResponse('PAYMENT_SUBMISSION_FAILED', 'Gagal memverifikasi pembayaran.', 500);
    }
  };
}
