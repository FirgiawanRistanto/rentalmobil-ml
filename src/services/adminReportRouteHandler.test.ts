import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGetAdminReportHandler } from '../app/api/admin/reports/routeHandler';
import type { AdminReportResponse } from '../lib/adminReportUi';
import { PaymentServiceError } from './paymentService';

const admin = { id: 'admin-1', role: 'ADMIN' };
const customer = { id: 'customer-1', role: 'CUSTOMER' };

const responseBody = {
  generatedAt: '2026-06-10T10:00:00.000Z',
  period: { startDate: '2026-06-01', endDate: '2026-06-10' },
  modelLabel: 'Model Harga Dinamis',
  metrics: {
    totalBookings: 1,
    pendingBookings: 0,
    confirmedBookings: 1,
    completedBookings: 0,
    cancelledBookings: 0,
    submittedPayments: 0,
    verifiedPayments: 1,
    rejectedPayments: 0,
    expiredPayments: 0,
    verifiedPaymentTotal: 4623000,
    averageInvoiceValue: 4623000,
    totalQuotes: 1,
    acceptedQuotes: 1,
    averageAdjustmentPercentDisplay: 2.76,
    dynamicPricingFlatTotal: 4500000,
    dynamicPricingDynamicTotal: 4623000,
    dynamicPricingUplift: 123000,
    totalFines: 3,
    verifiedFineTotal: 750000,
    pendingFineTotal: 250000,
    rejectedFineTotal: 100000,
  },
  bookingStatusBreakdown: [],
  paymentStatusBreakdown: [],
  topCars: [],
  topCategories: [],
  recentTransactions: [],
} satisfies AdminReportResponse;

describe('admin report route handler', () => {
  it('maps anonymous and CUSTOMER access safely', async () => {
    const service = {
      async readAdminReport(user: typeof admin | null) {
        if (!user) throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'Login.');
        if (user.role !== 'ADMIN') throw new PaymentServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'Admin only.');
        return responseBody;
      },
    };

    const anonymousHandler = createGetAdminReportHandler({ service, getCurrentUser: async () => null });
    const customerHandler = createGetAdminReportHandler({ service, getCurrentUser: async () => customer });

    const anonymousResponse = await anonymousHandler(new Request('http://localhost/api/admin/reports'));
    const customerResponse = await customerHandler(new Request('http://localhost/api/admin/reports'));

    assert.equal(anonymousResponse.status, 401);
    assert.equal(customerResponse.status, 403);
  });

  it('returns report data for ADMIN users and forwards date filters', async () => {
    let receivedStartDate = '';
    const handler = createGetAdminReportHandler({
      getCurrentUser: async () => admin,
      service: {
        async readAdminReport(user, dependencies) {
          assert.equal(user?.id, admin.id);
          receivedStartDate = dependencies?.query?.get('startDate') ?? '';
          return responseBody;
        },
      },
    });

    const response = await handler(new Request('http://localhost/api/admin/reports?startDate=2026-06-01&endDate=2026-06-10'));
    const body = await response.json() as AdminReportResponse;

    assert.equal(response.status, 200);
    assert.equal(receivedStartDate, '2026-06-01');
    assert.equal(body.metrics.verifiedPaymentTotal, 4623000);
    assert.equal(JSON.stringify(body).includes('proofStorageKey'), false);
  });
});
