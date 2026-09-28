import { NextResponse } from 'next/server';
import {
  readAdminTransactionDetail,
  updateAdminBookingStatus,
  type AdminTransactionsUser,
} from '../../../../../services/adminTransactionsService';
import {
  getSessionAdminTransactionUser,
  mapAdminTransactionError,
} from '../routeHandler';

interface AdminTransactionDetailRouteService {
  readAdminTransactionDetail(bookingId: string, user: AdminTransactionsUser | null): Promise<unknown>;
  updateAdminBookingStatus?(bookingId: string, status: unknown, user: AdminTransactionsUser | null): Promise<unknown>;
}

interface AdminTransactionDetailRouteDependencies {
  service?: AdminTransactionDetailRouteService;
  getCurrentUser?: () => Promise<AdminTransactionsUser | null>;
}

interface AdminTransactionParams {
  params: Promise<{ bookingId: string }>;
}

export function createGetAdminTransactionDetailHandler(
  dependencies: AdminTransactionDetailRouteDependencies = {},
) {
  const service = dependencies.service ?? { readAdminTransactionDetail };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionAdminTransactionUser;

  return async function getAdminTransactionDetail(
    _request: Request,
    { params }: AdminTransactionParams,
  ): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const { bookingId } = await params;

      return NextResponse.json(await service.readAdminTransactionDetail(bookingId, user));
    } catch (error) {
      return mapAdminTransactionError(error);
    }
  };
}

export function createPatchAdminBookingStatusHandler(
  dependencies: AdminTransactionDetailRouteDependencies = {},
) {
  const service = dependencies.service ?? { readAdminTransactionDetail, updateAdminBookingStatus };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionAdminTransactionUser;

  return async function patchAdminBookingStatus(
    request: Request,
    { params }: AdminTransactionParams,
  ): Promise<NextResponse> {
    try {
      const [user, { bookingId }, body] = await Promise.all([
        getCurrentUser(),
        params,
        request.json().catch(() => ({})),
      ]);

      if (!service.updateAdminBookingStatus) {
        throw new Error('Status update service is not configured.');
      }

      return NextResponse.json(await service.updateAdminBookingStatus(bookingId, (body as { status?: unknown }).status, user));
    } catch (error) {
      return mapAdminTransactionError(error);
    }
  };
}
