import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGetAdminDashboardHandler } from '../app/api/admin/dashboard/routeHandler';
import type { AdminDashboardResponse } from '../lib/adminDashboardUi';
import { PaymentServiceError } from './paymentService';

const admin = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'ADMIN',
};

const responseBody = {
  generatedAt: '2026-06-10T10:00:00.000Z',
  metrics: {
    totalBookings: 2,
    activePendingBookings: 1,
    awaitingPaymentProof: 1,
    awaitingPaymentVerification: 0,
    confirmedBookings: 1,
    cancelledOrExpiredBookings: 0,
    verifiedPaymentTotal: 4623000,
    activeFleetUnits: 5,
    availableFleetUnitsNow: 4,
  },
  recentPayments: [],
  recentBookings: [],
} satisfies AdminDashboardResponse;

describe('admin dashboard route handler', () => {
  it('returns dashboard summary for admin session users', async () => {
    let receivedUserId = '';
    const handler = createGetAdminDashboardHandler({
      getCurrentUser: async () => admin,
      service: {
        async readAdminDashboard(user) {
          receivedUserId = user?.id ?? '';
          return responseBody;
        },
      },
    });

    const response = await handler();
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(receivedUserId, admin.id);
    assert.deepEqual(body, responseBody);
    assert.equal(JSON.stringify(body).includes('proofStorageKey'), false);
  });

  it('maps anonymous requests to HTTP 401', async () => {
    const handler = createGetAdminDashboardHandler({
      getCurrentUser: async () => null,
      service: {
        async readAdminDashboard() {
          throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'Login diperlukan.');
        },
      },
    });

    const response = await handler();
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'AUTHENTICATION_REQUIRED');
  });

  it('maps customer requests to HTTP 403', async () => {
    const handler = createGetAdminDashboardHandler({
      getCurrentUser: async () => ({ id: 'customer-1', role: 'CUSTOMER' }),
      service: {
        async readAdminDashboard() {
          throw new PaymentServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'Admin only.');
        },
      },
    });

    const response = await handler();
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error.code, 'ADMIN_AUTHORIZATION_REQUIRED');
  });
});
