import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../lib/auth-session';
import type { AdminReportResponse } from '../../../../lib/adminReportUi';
import {
  readAdminReport,
  type AdminReportUser,
} from '../../../../services/adminReportService';
import { PaymentServiceError } from '../../../../services/paymentService';

interface AdminReportRouteService {
  readAdminReport(
    user: AdminReportUser | null,
    dependencies?: { query?: URLSearchParams },
  ): Promise<AdminReportResponse>;
}

interface AdminReportRouteDependencies {
  service?: AdminReportRouteService;
  getCurrentUser?: () => Promise<AdminReportUser | null>;
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

async function getSessionUser(): Promise<AdminReportUser | null> {
  const session = await getCurrentAuthSession();

  return session?.user?.id
    ? {
      id: session.user.id,
      role: session.user.role ?? null,
    }
    : null;
}

export function createGetAdminReportHandler(
  dependencies: AdminReportRouteDependencies = {},
) {
  const service = dependencies.service ?? { readAdminReport };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function getAdminReport(request: Request): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const searchParams = new URL(request.url).searchParams;
      const result = await service.readAdminReport(user, { query: searchParams });

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

      return errorResponse('ADMIN_REPORT_READ_FAILED', 'Laporan admin belum dapat dibaca.', 500);
    }
  };
}
