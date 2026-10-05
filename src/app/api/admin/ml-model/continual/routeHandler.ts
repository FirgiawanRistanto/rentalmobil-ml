import { NextResponse } from 'next/server';
import { AdminMlContinualError } from '../../../../../lib/adminMlContinualUi';
import {
  activateAdminMlModelVersion,
  adminMlContinualErrorStatus,
  clearLiveSampleLabel,
  readAdminMlContinualStatus,
  retrainAdminMlModel,
  setLiveSampleLabel,
  type AdminMlContinualUser,
} from '../../../../../services/adminMlContinualService';

interface AdminMlContinualRouteService {
  readStatus(user: AdminMlContinualUser | null): Promise<unknown>;
  retrain(user: AdminMlContinualUser | null): Promise<unknown>;
  activate(user: AdminMlContinualUser | null, versionId: unknown): Promise<unknown>;
  setLabel(user: AdminMlContinualUser | null, quoteId: unknown, targetPercent: unknown): Promise<unknown>;
  clearLabel(user: AdminMlContinualUser | null, quoteId: unknown): Promise<unknown>;
}

interface AdminMlContinualRouteDependencies {
  service?: AdminMlContinualRouteService;
  getCurrentUser?: () => Promise<AdminMlContinualUser | null>;
}

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
  };
}

const defaultService: AdminMlContinualRouteService = {
  readStatus: (user) => readAdminMlContinualStatus(user),
  retrain: (user) => retrainAdminMlModel(user),
  activate: (user, versionId) => activateAdminMlModelVersion(user, versionId),
  setLabel: (user, quoteId, targetPercent) => setLiveSampleLabel(user, quoteId, targetPercent),
  clearLabel: (user, quoteId) => clearLiveSampleLabel(user, quoteId),
};

function errorResponse(code: string, message: string, status: number): NextResponse<ErrorResponseBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function getSessionUser(): Promise<AdminMlContinualUser | null> {
  const { getCurrentAuthSession } = await import('../../../../../lib/auth-session');
  const session = await getCurrentAuthSession();

  return session?.user?.id
    ? {
      id: session.user.id,
      role: session.user.role ?? null,
    }
    : null;
}

function mapContinualError(error: unknown): NextResponse<ErrorResponseBody> {
  if (error instanceof AdminMlContinualError) {
    return errorResponse(error.code, error.message, adminMlContinualErrorStatus(error));
  }

  return errorResponse(
    'ML_RETRAIN_FAILED',
    'Permintaan machine learning belum dapat diproses.',
    500,
  );
}

export function createAdminMlContinualHandler(
  dependencies: AdminMlContinualRouteDependencies = {},
) {
  const service = dependencies.service ?? defaultService;
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function handleAdminMlContinual(request: Request): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();

      if (request.method.toUpperCase() === 'GET') {
        return NextResponse.json({ status: await service.readStatus(user) });
      }

      const body = (await request.json().catch(() => null)) as {
        action?: unknown;
        versionId?: unknown;
        quoteId?: unknown;
        targetPercent?: unknown;
      } | null;
      const action = typeof body?.action === 'string' ? body.action : '';

      switch (action) {
        case 'retrain':
          return NextResponse.json({ report: await service.retrain(user) });
        case 'activate':
          return NextResponse.json(await service.activate(user, body?.versionId));
        case 'label':
          if (body?.targetPercent === null || body?.targetPercent === undefined) {
            return NextResponse.json(await service.clearLabel(user, body?.quoteId));
          }
          return NextResponse.json(
            await service.setLabel(user, body?.quoteId, body?.targetPercent),
          );
        default:
          return errorResponse('UNKNOWN_ACTION', 'Aksi continual learning tidak dikenal.', 400);
      }
    } catch (error) {
      return mapContinualError(error);
    }
  };
}
