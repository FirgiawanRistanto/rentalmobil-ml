import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGetCustomerBookingsHandler } from '../app/api/customer/bookings/routeHandler';
import type { CustomerBookingsResponse } from '../lib/customerDashboardUi';
import { PaymentServiceError } from './paymentService';

const user = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Customer Test',
  email: 'customer@example.test',
  role: 'CUSTOMER',
};

const responseBody = {
  customer: {
    id: user.id,
    name: user.name,
    email: user.email,
  },
  summary: {
    totalBookings: 1,
    activeBookings: 1,
    completedOrConfirmedBookings: 0,
  },
  bookings: [
    {
      bookingId: '11111111-1111-4111-8111-111111111111',
      bookingStatus: 'PENDING',
      displayStatus: 'WAITING_PAYMENT_PROOF',
      car: {
        id: 'car-1',
        name: 'Toyota Fortuner',
        category: 'SUV',
        unitPlate: 'B 1234 XYZ',
      },
      rental: {
        pickupDate: '2026-06-15',
        returnDate: '2026-06-18',
        durationDays: 3,
        tripType: 'LUAR_KOTA',
      },
      pricing: {
        modelVersion: 'rf_adjustment_v4_final',
        dynamicPriceDisplayPerDay: 1541000,
        totalInvoiceDisplay: 4623000,
      },
      reservationExpiresAt: '2026-06-10T10:30:00.000Z',
      createdAt: '2026-06-10T10:00:00.000Z',
      payment: {
        paymentStatus: null,
        submittedAt: null,
        reviewExpiresAt: null,
        rejectionReason: null,
      },
      actions: {
        canUploadPaymentProof: true,
        canCancelReservation: true,
        paymentPath: '/booking/payment/11111111-1111-4111-8111-111111111111',
      },
    },
  ],
  page: 1,
  pageSize: 5,
  totalItems: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
} satisfies CustomerBookingsResponse;

describe('customer booking dashboard route handler', () => {
  it('returns dashboard bookings for the current session user', async () => {
    let receivedUserId = '';
    const handler = createGetCustomerBookingsHandler({
      getCurrentUser: async () => user,
      service: {
        async listCustomerDashboardBookings(routeUser) {
          receivedUserId = routeUser?.id ?? '';
          return responseBody;
        },
      },
    });

    const response = await handler();
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(receivedUserId, user.id);
    assert.deepEqual(body, responseBody);
    assert.equal(JSON.stringify(body).includes('proofStorageKey'), false);
  });

  it('forwards the booking history page from the query string to the service', async () => {
    let receivedPage: string | null = null;
    const handler = createGetCustomerBookingsHandler({
      getCurrentUser: async () => user,
      service: {
        async listCustomerDashboardBookings(_routeUser, dependencies) {
          receivedPage = dependencies?.query instanceof URLSearchParams
            ? dependencies.query.get('page')
            : null;
          return responseBody;
        },
      },
    });

    const response = await handler(
      new Request('http://localhost:3000/api/customer/bookings?page=3&pageSize=2'),
    );

    assert.equal(response.status, 200);
    assert.equal(receivedPage, '3');
  });

  it('maps anonymous requests to HTTP 401', async () => {
    const handler = createGetCustomerBookingsHandler({
      getCurrentUser: async () => null,
      service: {
        async listCustomerDashboardBookings() {
          throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'Login diperlukan.');
        },
      },
    });

    const response = await handler();
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'AUTHENTICATION_REQUIRED');
  });
});
