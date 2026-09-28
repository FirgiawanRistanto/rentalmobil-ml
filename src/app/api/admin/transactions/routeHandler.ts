import { NextResponse } from 'next/server';
import type { AdminTransactionsQuery } from '../../../../lib/adminTransactionUi';
import {
  AdminTransactionsServiceError,
  listAdminTransactions,
  type AdminTransactionsUser,
} from '../../../../services/adminTransactionsService';
import { PaymentServiceError } from '../../../../services/paymentService';

interface AdminTransactionsRouteService {
  listAdminTransactions(
    user: AdminTransactionsUser | null,
    dependencies?: { query?: URLSearchParams | Partial<AdminTransactionsQuery> },
  ): Promise<unknown>;
}

interface AdminTransactionsRouteDependencies {
  service?: AdminTransactionsRouteService;
  getCurrentUser?: () => Promise<AdminTransactionsUser | null>;
}

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
  };
}

export function adminTransactionErrorResponse(
  code: string,
  message: string,
  status: number,
): NextResponse<ErrorResponseBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function mapAdminTransactionError(error: unknown): NextResponse<ErrorResponseBody> {
  if (error instanceof PaymentServiceError) {
    if (error.code === 'AUTHENTICATION_REQUIRED') {
      return adminTransactionErrorResponse(error.code, error.message, 401);
    }

    if (error.code === 'ADMIN_AUTHORIZATION_REQUIRED') {
      return adminTransactionErrorResponse(error.code, error.message, 403);
    }
  }

  if (error instanceof AdminTransactionsServiceError) {
    if (error.code === 'ADMIN_TRANSACTION_NOT_FOUND') {
      return adminTransactionErrorResponse(error.code, error.message, 404);
    }

    if (
      error.code === 'INVALID_BOOKING_STATUS_TRANSITION' ||
      error.code === 'BOOKING_STATUS_FINAL'
    ) {
      return adminTransactionErrorResponse(error.code, error.message, 409);
    }

    if (error.code === 'ADMIN_TRANSACTION_UPDATE_FAILED') {
      return adminTransactionErrorResponse(error.code, error.message, 500);
    }
  }

  return adminTransactionErrorResponse('ADMIN_TRANSACTION_READ_FAILED', 'Data transaksi belum dapat dibaca.', 500);
}

export async function getSessionAdminTransactionUser(): Promise<AdminTransactionsUser | null> {
  const { getCurrentAuthSession } = await import('../../../../lib/auth-session');
  const session = await getCurrentAuthSession();
  return session?.user?.id
    ? { id: session.user.id, role: session.user.role ?? null }
    : null;
}

export function createGetAdminTransactionsHandler(
  dependencies: AdminTransactionsRouteDependencies = {},
) {
  const service = dependencies.service ?? { listAdminTransactions };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionAdminTransactionUser;

  return async function getAdminTransactions(request: Request): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const searchParams = new URL(request.url).searchParams;
      return NextResponse.json(await service.listAdminTransactions(user, { query: searchParams }));
    } catch (error) {
      return mapAdminTransactionError(error);
    }
  };
}
