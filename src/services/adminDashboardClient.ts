import {
  buildAdminDashboardEndpoint,
  type AdminDashboardResponse,
} from '../lib/adminDashboardUi';
import { PaymentUiError, getAdminPaymentErrorMessage } from '../lib/paymentUi';

export interface AdminDashboardClientOptions {
  fetchFn?: typeof fetch;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasMetricShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return [
    'totalBookings',
    'activePendingBookings',
    'awaitingPaymentProof',
    'awaitingPaymentVerification',
    'confirmedBookings',
    'cancelledOrExpiredBookings',
    'verifiedPaymentTotal',
    'activeFleetUnits',
    'availableFleetUnitsNow',
  ].every((key) => typeof value[key] === 'number');
}

function isAdminDashboardResponse(value: unknown): value is AdminDashboardResponse {
  return isRecord(value) &&
    typeof value.generatedAt === 'string' &&
    hasMetricShape(value.metrics) &&
    Array.isArray(value.recentPayments) &&
    Array.isArray(value.recentBookings) &&
    !JSON.stringify(value).includes('proofStorageKey');
}

async function readErrorCode(response: Response, fallbackCode: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.error?.code || fallbackCode;
  } catch {
    return fallbackCode;
  }
}

export async function readAdminDashboardClient(
  options: AdminDashboardClientOptions = {},
): Promise<AdminDashboardResponse> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(buildAdminDashboardEndpoint(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const code = await readErrorCode(response, 'ADMIN_DASHBOARD_READ_FAILED');
    throw new PaymentUiError(code, getAdminPaymentErrorMessage(code));
  }

  const dashboard = await response.json();
  if (!isAdminDashboardResponse(dashboard)) {
    throw new PaymentUiError('ADMIN_DASHBOARD_RESPONSE_INVALID', 'Dashboard admin belum dapat dibaca.');
  }

  return dashboard;
}
