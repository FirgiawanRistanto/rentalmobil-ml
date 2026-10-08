import { NextResponse } from 'next/server';
import type { CustomerBookingsQuery, CustomerBookingsResponse } from '../../../../lib/customerDashboardUi';
import { PaymentServiceError } from '../../../../services/paymentService';
import { listCustomerDashboardBookings } from '../../../../services/customerBookingDashboardService';

interface CustomerBookingsRouteUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

interface CustomerBookingsRouteService {
  listCustomerDashboardBookings(
    user: CustomerBookingsRouteUser | null,
    dependencies?: { query?: URLSearchParams | Partial<CustomerBookingsQuery> },
  ): Promise<CustomerBookingsResponse>;
}

interface CustomerBookingsRouteDependencies {
  service?: CustomerBookingsRouteService;
  getCurrentUser?: () => Promise<CustomerBookingsRouteUser | null>;
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

async function getSessionUser(): Promise<CustomerBookingsRouteUser | null> {
  const { getCurrentAuthSession } = await import('../../../../lib/auth-session');
  const session = await getCurrentAuthSession();

  return session?.user?.id
    ? {
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      role: session.user.role ?? null,
    }
    : null;
}

export function createGetCustomerBookingsHandler(
  dependencies: CustomerBookingsRouteDependencies = {},
) {
  const service = dependencies.service ?? { listCustomerDashboardBookings };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function getCustomerBookings(request?: Request): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      // Halaman riwayat booking dibaca dari query string (?page=&pageSize=).
      const query = request ? new URL(request.url).searchParams : undefined;
      const result = await service.listCustomerDashboardBookings(user, { query });

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof PaymentServiceError && error.code === 'AUTHENTICATION_REQUIRED') {
        return errorResponse(error.code, error.message, 401);
      }

      return errorResponse('CUSTOMER_BOOKINGS_READ_FAILED', 'Dashboard booking belum dapat dibaca.', 500);
    }
  };
}
