import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGetAdminTransactionsHandler } from '../app/api/admin/transactions/routeHandler';
import {
  createGetAdminTransactionDetailHandler,
  createPatchAdminBookingStatusHandler,
} from '../app/api/admin/transactions/[bookingId]/routeHandler';
import type { AdminTransactionsResponse } from '../lib/adminTransactionUi';
import { PaymentServiceError } from './paymentService';

const admin = { id: 'admin-1', role: 'ADMIN' };
const customer = { id: 'customer-1', role: 'CUSTOMER' };

const responseBody = {
  items: [
    {
      bookingId: 'booking-1',
      bookingCode: 'BRM-BOOKING-',
      bookingStatus: 'PENDING',
      displayStatus: 'WAITING_PAYMENT',
      createdAt: '2026-06-09T10:00:00.000Z',
      reservationExpiresAt: '2026-06-09T10:30:00.000Z',
      customer: { id: 'customer-1', name: 'Customer Test', email: 'customer@example.test' },
      car: { id: 'car-1', name: 'Toyota Fortuner', category: 'suv' },
      rental: { pickupDate: '2026-06-15', returnDate: '2026-06-18', durationDays: 3, tripType: 'LUAR_KOTA' },
      pricing: { dynamicPriceDisplayPerDay: 1541000, totalInvoiceDisplay: 4623000, modelVersion: 'rf_adjustment_v4_final' },
      payment: null,
      actions: { detailPath: '/admin/transaksi/booking-1', paymentReviewPath: null, proofPath: null },
    },
  ],
  page: 1,
  pageSize: 10,
  totalItems: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
} satisfies AdminTransactionsResponse;

describe('admin transactions route handlers', () => {
  it('maps anonymous and CUSTOMER list access safely', async () => {
    const service = {
      async listAdminTransactions(user: typeof admin | null) {
        if (!user) throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'Login.');
        if (user.role !== 'ADMIN') throw new PaymentServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'Admin only.');
        return responseBody;
      },
    };

    const anonymousHandler = createGetAdminTransactionsHandler({ service, getCurrentUser: async () => null });
    const customerHandler = createGetAdminTransactionsHandler({ service, getCurrentUser: async () => customer });

    const anonymousResponse = await anonymousHandler(new Request('http://localhost/api/admin/transactions'));
    const customerResponse = await customerHandler(new Request('http://localhost/api/admin/transactions'));

    assert.equal(anonymousResponse.status, 401);
    assert.equal(customerResponse.status, 403);
  });

  it('returns transaction list for ADMIN users', async () => {
    let receivedUserId = '';
    let receivedPage = '';
    const handler = createGetAdminTransactionsHandler({
      getCurrentUser: async () => admin,
      service: {
        async listAdminTransactions(user, dependencies) {
          receivedUserId = user?.id ?? '';
          receivedPage = dependencies?.query instanceof URLSearchParams
            ? dependencies.query.get('page') ?? ''
            : '';
          return responseBody;
        },
      },
    });

    const response = await handler(new Request('http://localhost/api/admin/transactions?page=2&status=unpaid'));
    const body = await response.json() as AdminTransactionsResponse;

    assert.equal(response.status, 200);
    assert.equal(receivedUserId, admin.id);
    assert.equal(receivedPage, '2');
    assert.equal(body.items[0].customer.email, 'customer@example.test');
    assert.equal(JSON.stringify(body).includes('proofStorageKey'), false);
  });

  it('returns transaction detail for ADMIN users', async () => {
    const handler = createGetAdminTransactionDetailHandler({
      getCurrentUser: async () => admin,
      service: {
        async readAdminTransactionDetail(bookingId, user) {
          assert.equal(bookingId, 'booking-1');
          assert.equal(user?.role, 'ADMIN');
          return { ...responseBody.items[0], priceSnapshot: { modelVersion: 'rf_adjustment_v4_final' } };
        },
      },
    });

    const response = await handler(
      new Request('http://localhost/api/admin/transactions/booking-1'),
      { params: Promise.resolve({ bookingId: 'booking-1' }) },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.bookingId, 'booking-1');
  });

  it('patches booking status for ADMIN users through the lifecycle endpoint', async () => {
    let receivedStatus: unknown = null;
    const handler = createPatchAdminBookingStatusHandler({
      getCurrentUser: async () => admin,
      service: {
        async readAdminTransactionDetail() {
          return responseBody.items[0];
        },
        async updateAdminBookingStatus(bookingId, status, user) {
          assert.equal(bookingId, 'booking-1');
          assert.equal(user?.role, 'ADMIN');
          receivedStatus = status;
          return {
            bookingId,
            bookingStatus: 'COMPLETED',
            updatedAt: '2026-06-09T10:00:00.000Z',
          };
        },
      },
    });

    const response = await handler(
      new Request('http://localhost/api/admin/transactions/booking-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' }),
      }),
      { params: Promise.resolve({ bookingId: 'booking-1' }) },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(receivedStatus, 'COMPLETED');
    assert.equal(body.bookingStatus, 'COMPLETED');
  });
});
