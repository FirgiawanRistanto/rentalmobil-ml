import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildAdminDashboardEndpoint } from '../lib/adminDashboardUi';
import { readAdminDashboardClient } from './adminDashboardClient';

const dashboardResponse = {
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
  recentPayments: [
    {
      paymentId: '11111111-1111-4111-8111-111111111111',
      paymentStatus: 'SUBMITTED',
      bookingId: '22222222-2222-4222-8222-222222222222',
      bookingStatus: 'PENDING',
      amount: 4623000,
      submittedAt: '2026-06-10T09:00:00.000Z',
      reviewExpiresAt: '2026-06-11T09:00:00.000Z',
      canReview: true,
      customer: {
        id: 'customer-1',
        name: 'Customer Test',
        email: 'customer@example.test',
      },
      car: {
        id: 'car-1',
        name: 'Toyota Fortuner',
        category: 'SUV',
      },
    },
  ],
  recentBookings: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe('admin dashboard browser client', () => {
  it('reads admin dashboard from the v4 dashboard endpoint', async () => {
    let requestedUrl = '';
    const dashboard = await readAdminDashboardClient({
      fetchFn: async (input) => {
        requestedUrl = String(input);
        return jsonResponse(dashboardResponse);
      },
    });

    assert.equal(requestedUrl, buildAdminDashboardEndpoint());
    assert.equal(dashboard.metrics.verifiedPaymentTotal, 4623000);
    assert.equal(JSON.stringify(dashboard).includes('proofStorageKey'), false);
  });

  it('maps dashboard API errors to a safe UI error', async () => {
    await assert.rejects(
      () =>
        readAdminDashboardClient({
          fetchFn: async () => jsonResponse({ error: { code: 'ADMIN_DASHBOARD_READ_FAILED' } }, 500),
        }),
      /Dashboard admin belum dapat dibaca/,
    );
  });
});
