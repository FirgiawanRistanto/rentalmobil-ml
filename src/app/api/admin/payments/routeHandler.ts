import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../lib/auth-session';
import {
  listAdminPayments,
  PaymentServiceError,
  type AdminPaymentQueueResult,
  type AuthenticatedPaymentUser,
} from '../../../../services/paymentService';

interface AdminPaymentListRouteService {
  listAdminPayments(
    status: string | null,
    user: AuthenticatedPaymentUser | null,
  ): Promise<AdminPaymentQueueResult>;
}

interface AdminPaymentListRouteDependencies {
  service?: AdminPaymentListRouteService;
  getCurrentUser?: () => Promise<AuthenticatedPaymentUser | null>;
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

function mapAdminListPaymentError(error: PaymentServiceError): NextResponse<ErrorResponseBody> {
  if (error.code === 'AUTHENTICATION_REQUIRED') {
    return errorResponse(error.code, error.message, 401);
  }

  if (error.code === 'ADMIN_AUTHORIZATION_REQUIRED') {
    return errorResponse(error.code, error.message, 403);
  }

  if (error.code === 'INVALID_PAYMENT_REQUEST') {
    return errorResponse(error.code, error.message, 400);
  }

  return errorResponse(error.code, error.message, 400);
}

async function getSessionUser(): Promise<AuthenticatedPaymentUser | null> {
  const session = await getCurrentAuthSession();
  return session?.user?.id
    ? { id: session.user.id, role: session.user.role ?? null }
    : null;
}

export function createGetAdminPaymentsHandler(
  dependencies: AdminPaymentListRouteDependencies = {},
) {
  const service = dependencies.service ?? { listAdminPayments };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function getAdminPayments(request: Request): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const status = new URL(request.url).searchParams.get('status');
      const payments = await service.listAdminPayments(status, user);

      return NextResponse.json(payments);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return mapAdminListPaymentError(error);
      }

      return errorResponse('INVALID_PAYMENT_REQUEST', 'Daftar pembayaran tidak dapat dibaca.', 500);
    }
  };
}
