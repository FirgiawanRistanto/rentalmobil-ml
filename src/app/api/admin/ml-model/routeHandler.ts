import { NextResponse } from 'next/server';
import {
  readAdminMlModelInfo,
  readAdminMlModelTree,
  type AdminMlModelUser,
} from '../../../../services/adminMlModelService';
import { MlModelClientError } from '../../../../services/mlModelClient';
import { PaymentServiceError } from '../../../../services/paymentService';

interface AdminMlModelRouteService {
  readAdminMlModelInfo(user: AdminMlModelUser | null): Promise<unknown>;
  readAdminMlModelTree(treeIndex: number, user: AdminMlModelUser | null): Promise<unknown>;
}

interface AdminMlModelRouteDependencies {
  service?: AdminMlModelRouteService;
  getCurrentUser?: () => Promise<AdminMlModelUser | null>;
}

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
  };
}

interface AdminMlModelTreeParams {
  params: Promise<{ treeIndex: string }>;
}

function errorResponse(code: string, message: string, status: number): NextResponse<ErrorResponseBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function getSessionUser(): Promise<AdminMlModelUser | null> {
  const { getCurrentAuthSession } = await import('../../../../lib/auth-session');
  const session = await getCurrentAuthSession();

  return session?.user?.id
    ? {
      id: session.user.id,
      role: session.user.role ?? null,
    }
    : null;
}

function mapAdminMlModelError(error: unknown): NextResponse<ErrorResponseBody> {
  if (error instanceof PaymentServiceError) {
    if (error.code === 'AUTHENTICATION_REQUIRED') {
      return errorResponse(error.code, error.message, 401);
    }

    if (error.code === 'ADMIN_AUTHORIZATION_REQUIRED') {
      return errorResponse(error.code, error.message, 403);
    }
  }

  if (error instanceof MlModelClientError) {
    if (error.code === 'ML_MODEL_NOT_READY') {
      return errorResponse(error.code, error.message, 503);
    }

    if (error.code === 'ML_TREE_INDEX_INVALID') {
      return errorResponse(error.code, error.message, 400);
    }

    if (error.code === 'ML_CONTRACT_MISMATCH') {
      return errorResponse(error.code, error.message, 502);
    }

    return errorResponse(error.code, error.message, 503);
  }

  return errorResponse('ADMIN_ML_MODEL_READ_FAILED', 'Data model Random Forest belum dapat dibaca.', 500);
}

function parseTreeIndex(rawValue: string): number {
  const treeIndex = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(treeIndex) || String(treeIndex) !== rawValue || treeIndex < 0) {
    throw new MlModelClientError('ML_TREE_INDEX_INVALID', `Tree index tidak valid: ${rawValue}.`);
  }

  return treeIndex;
}

export function createGetAdminMlModelInfoHandler(
  dependencies: AdminMlModelRouteDependencies = {},
) {
  const service = dependencies.service ?? { readAdminMlModelInfo, readAdminMlModelTree };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function getAdminMlModelInfo(): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();

      return NextResponse.json(await service.readAdminMlModelInfo(user));
    } catch (error) {
      return mapAdminMlModelError(error);
    }
  };
}

export function createGetAdminMlModelTreeHandler(
  dependencies: AdminMlModelRouteDependencies = {},
) {
  const service = dependencies.service ?? { readAdminMlModelInfo, readAdminMlModelTree };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function getAdminMlModelTree(
    _request: Request,
    { params }: AdminMlModelTreeParams,
  ): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const { treeIndex: rawTreeIndex } = await params;
      const treeIndex = parseTreeIndex(rawTreeIndex);

      return NextResponse.json(await service.readAdminMlModelTree(treeIndex, user));
    } catch (error) {
      return mapAdminMlModelError(error);
    }
  };
}
