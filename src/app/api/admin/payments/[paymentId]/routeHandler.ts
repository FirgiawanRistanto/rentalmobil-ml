import { NextResponse } from 'next/server';
import {
  readAdminPaymentDetail,
  PaymentServiceError,
  type AdminPaymentDetailResult,
  type AuthenticatedPaymentUser,
} from '../../../../../services/paymentService';
import {
  errorResponse,
  getAdminRouteUser,
  mapAdminPaymentError,
  resolveAdminPaymentParams,
  type AdminPaymentRouteContext,
} from './routeUtils';

interface AdminPaymentDetailRouteService {
  readAdminPaymentDetail(
    paymentId: string,
    user: AuthenticatedPaymentUser | null,
  ): Promise<AdminPaymentDetailResult>;
}

interface AdminPaymentDetailRouteDependencies {
  service?: AdminPaymentDetailRouteService;
  getCurrentUser?: () => Promise<AuthenticatedPaymentUser | null>;
}

export function createGetAdminPaymentDetailHandler(
  dependencies: AdminPaymentDetailRouteDependencies = {},
) {
  const service = dependencies.service ?? { readAdminPaymentDetail };
  const getCurrentUser = dependencies.getCurrentUser ?? getAdminRouteUser;

  return async function getAdminPaymentDetail(
    _request: Request,
    context: AdminPaymentRouteContext,
  ): Promise<NextResponse> {
    try {
      const [{ paymentId }, user] = await Promise.all([
        resolveAdminPaymentParams(context),
        getCurrentUser(),
      ]);
      const payment = await service.readAdminPaymentDetail(paymentId, user);

      return NextResponse.json(payment);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return mapAdminPaymentError(error);
      }

      return errorResponse('PAYMENT_NOT_FOUND', 'Payment tidak dapat dibaca.', 500);
    }
  };
}
