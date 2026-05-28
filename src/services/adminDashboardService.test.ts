import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readAdminDashboard, type AdminDashboardRecentBookingRow, type AdminDashboardRecentPaymentRow } from './adminDashboardService';
import { PaymentServiceError } from './paymentService';

const admin = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'ADMIN',
};

const customer = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'CUSTOMER',
};

const now = new Date('2026-06-10T10:00:00.000Z');

function paymentRow(overrides: Partial<AdminDashboardRecentPaymentRow> = {}): AdminDashboardRecentPaymentRow {
  return {
    paymentId: '33333333-3333-4333-8333-333333333333',
    paymentStatus: 'SUBMITTED',
    amount: 4623000,
    submittedAt: new Date('2026-06-10T09:00:00.000Z'),
    reviewExpiresAt: new Date('2026-06-11T09:00:00.000Z'),
    bookingId: '44444444-4444-4444-8444-444444444444',
    bookingStatus: 'PENDING',
    reservationExpiresAt: new Date('2026-06-11T09:00:00.000Z'),
    customerId: customer.id,
    customerName: 'Customer Test',
    customerEmail: 'customer@example.test',
    carId: 'car-1',
    carBrand: 'Toyota',
    carModel: 'Fortuner',
    carCategory: 'SUV',
    ...overrides,
  };
}

function bookingRow(overrides: Partial<AdminDashboardRecentBookingRow> = {}): AdminDashboardRecentBookingRow {
  return {
    bookingId: '44444444-4444-4444-8444-444444444444',
    bookingStatus: 'PENDING',
    createdAt: new Date('2026-06-10T08:30:00.000Z'),
    reservationExpiresAt: new Date('2026-06-10T10:30:00.000Z'),
    startDate: new Date('2026-06-15T00:00:00.000Z'),
    endDate: new Date('2026-06-18T00:00:00.000Z'),
    tripType: 'LUAR_KOTA',
    totalPrice: 999999,
    customerId: customer.id,
    customerName: 'Customer Test',
    customerEmail: 'customer@example.test',
    carId: 'car-1',
    carBrand: 'Toyota',
    carModel: 'Fortuner',
    carCategory: 'SUV',
    snapshotTotalInvoiceDisplay: 4623000,
    paymentStatus: null,
    ...overrides,
  };
}

describe('readAdminDashboard', () => {
  it('rejects anonymous and non-admin users', async () => {
    await assert.rejects(
      () => readAdminDashboard(null),
      (error) => error instanceof PaymentServiceError && error.code === 'AUTHENTICATION_REQUIRED',
    );

    await assert.rejects(
      () => readAdminDashboard(customer),
      (error) => error instanceof PaymentServiceError && error.code === 'ADMIN_AUTHORIZATION_REQUIRED',
    );
  });

  it('returns real-data metrics and recent rows for admin users', async () => {
    let expiredAt: Date | undefined;
    let metricsReference: { now?: Date; today?: string } = {};
    const result = await readAdminDashboard(admin, {
      now: () => now,
      repository: {
        async expireSubmittedPayments(referenceTime) {
          expiredAt = referenceTime;
        },
        async getMetrics(referenceTime, today) {
          metricsReference = { now: referenceTime, today };
          return {
            totalBookings: 4,
            activePendingBookings: 2,
            awaitingPaymentProof: 1,
            awaitingPaymentVerification: 1,
            confirmedBookings: 1,
            cancelledOrExpiredBookings: 1,
            verifiedPaymentTotal: 4623000,
            activeFleetUnits: 5,
            availableFleetUnitsNow: 4,
          };
        },
        async listRecentPayments(limit) {
          assert.equal(limit, 5);
          return [paymentRow()];
        },
        async listRecentBookings(limit) {
          assert.equal(limit, 5);
          return [bookingRow()];
        },
      },
    });

    assert.equal(expiredAt?.toISOString(), now.toISOString());
    assert.equal(metricsReference.now?.toISOString(), now.toISOString());
    assert.equal(metricsReference.today, '2026-06-10');
    assert.equal(result.metrics.awaitingPaymentProof, 1);
    assert.equal(result.metrics.awaitingPaymentVerification, 1);
    assert.equal(result.metrics.verifiedPaymentTotal, 4623000);
    assert.equal(result.recentPayments[0].canReview, true);
    assert.equal(result.recentBookings[0].totalInvoiceDisplay, 4623000);
    assert.equal(JSON.stringify(result).includes('proofStorageKey'), false);
  });

  it('does not present expired submitted payments as reviewable', async () => {
    const result = await readAdminDashboard(admin, {
      now: () => now,
      repository: {
        async expireSubmittedPayments() {},
        async getMetrics() {
          return {
            totalBookings: 1,
            activePendingBookings: 0,
            awaitingPaymentProof: 0,
            awaitingPaymentVerification: 0,
            confirmedBookings: 0,
            cancelledOrExpiredBookings: 1,
            verifiedPaymentTotal: 0,
            activeFleetUnits: 1,
            availableFleetUnitsNow: 1,
          };
        },
        async listRecentPayments() {
          return [paymentRow({ reviewExpiresAt: new Date('2026-06-10T09:59:59.000Z') })];
        },
        async listRecentBookings() {
          return [bookingRow({ snapshotTotalInvoiceDisplay: null })];
        },
      },
    });

    assert.equal(result.recentPayments[0].canReview, false);
    assert.equal(result.recentBookings[0].totalInvoiceDisplay, 999999);
  });
});
