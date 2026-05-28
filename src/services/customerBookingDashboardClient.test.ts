import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCustomerBookingsEndpoint } from '../lib/customerDashboardUi';
import { listCustomerDashboardBookingsClient } from './customerBookingDashboardClient';

const dashboardResponse = {
  customer: {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Customer Test',
    email: 'customer@example.test',
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
        paymentPath: '/booking/payment/11111111-1111-4111-8111-111111111111',
      },
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe('customer booking dashboard browser client', () => {
  it('reads customer bookings from the v4 customer dashboard endpoint', async () => {
    let requestedUrl = '';
    const result = await listCustomerDashboardBookingsClient({
      fetchFn: async (input) => {
        requestedUrl = String(input);
        return jsonResponse(dashboardResponse);
      },
    });

    assert.equal(requestedUrl, buildCustomerBookingsEndpoint());
    assert.equal(result.bookings[0].pricing.totalInvoiceDisplay, 4623000);
    assert.equal(result.bookings[0].actions.paymentPath.startsWith('/booking/payment/'), true);
  });

  it('maps auth errors to customer-safe messages', async () => {
    await assert.rejects(
      () =>
        listCustomerDashboardBookingsClient({
          fetchFn: async () =>
            jsonResponse(
              { error: { code: 'AUTHENTICATION_REQUIRED', message: 'internal' } },
              401,
            ),
        }),
      /Silakan login untuk melihat dashboard booking/,
    );
  });

  it('rejects invalid response contracts instead of rendering partial dashboard data', async () => {
    await assert.rejects(
      () =>
        listCustomerDashboardBookingsClient({
          fetchFn: async () => jsonResponse({ bookings: [] }),
        }),
      /Dashboard booking belum dapat dibaca/,
    );
  });
});
