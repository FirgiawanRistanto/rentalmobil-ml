import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../lib/auth-session';
import type { AdminDashboardResponse } from '../../../../lib/adminDashboardUi';
import {
  readAdminDashboard,
  type AdminDashboardUser,
} from '../../../../services/adminDashboardService';
import { PaymentServiceError } from '../../../../services/paymentService';

interface AdminDashboardRouteService {
  readAdminDashboard(user: AdminDashboardUser | null): Promise<AdminDashboardResponse>;
}

interface AdminDashboardRouteDependencies {
  service?: AdminDashboardRouteService;
  getCurrentUser?: () => Promise<AdminDashboardUser | null>;
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

async function getSessionUser(): Promise<AdminDashboardUser | null> {
  const session = await getCurrentAuthSession();

  return session?.user?.id
    ? {
      id: session.user.id,
      role: session.user.role ?? null,
    }
    : null;
}

export function createGetAdminDashboardHandler(
  dependencies: AdminDashboardRouteDependencies = {},
) {
  const service = dependencies.service ?? { readAdminDashboard };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function getAdminDashboard(): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const result = await service.readAdminDashboard(user);

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        if (error.code === 'AUTHENTICATION_REQUIRED') {
          return errorResponse(error.code, error.message, 401);
        }

        if (error.code === 'ADMIN_AUTHORIZATION_REQUIRED') {
          return errorResponse(error.code, error.message, 403);
        }
      }

      return errorResponse('ADMIN_DASHBOARD_READ_FAILED', 'Dashboard admin belum dapat dibaca.', 500);
    }
  };
}
