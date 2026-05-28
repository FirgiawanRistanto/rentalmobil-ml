import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listCustomerDashboardBookings, type CustomerBookingDashboardRow } from './customerBookingDashboardService';
import { PaymentServiceError } from './paymentService';

const user = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Customer Test',
  email: 'customer@example.test',
};

function row(overrides: Partial<CustomerBookingDashboardRow> = {}): CustomerBookingDashboardRow {
  return {
    bookingId: '11111111-1111-4111-8111-111111111111',
    bookingStatus: 'PENDING',
    reservationExpiresAt: new Date('2026-06-10T10:30:00.000Z'),
    createdAt: new Date('2026-06-10T10:00:00.000Z'),
    carId: 'car-1',
    carBrand: 'Toyota',
    carModel: 'Fortuner',
    carCategory: 'SUV',
    startDate: new Date('2026-06-15T00:00:00.000Z'),
    endDate: new Date('2026-06-18T00:00:00.000Z'),
    tripType: 'LUAR_KOTA',
    totalPrice: 999999,
    snapshotDynamicPriceDisplayPerDay: 1541000,
    snapshotTotalInvoiceDisplay: 4623000,
    snapshotModelVersion: 'rf_adjustment_v4_final',
    paymentStatus: null,
    paymentSubmittedAt: null,
    paymentReviewExpiresAt: null,
    paymentRejectionReason: null,
    ...overrides,
  };
}

describe('listCustomerDashboardBookings', () => {
  it('rejects anonymous access', async () => {
    await assert.rejects(
      () => listCustomerDashboardBookings(null),
      (error) => error instanceof PaymentServiceError && error.code === 'AUTHENTICATION_REQUIRED',
    );
  });

  it('lists only bookings requested for the authenticated user and uses snapshot totals', async () => {
    let requestedUserId = '';
    let expiredAt: Date | undefined;
    const result = await listCustomerDashboardBookings(user, {
      now: () => new Date('2026-06-10T10:00:00.000Z'),
      repository: {
        async expireSubmittedPayments(now) {
          expiredAt = now;
        },
        async listCustomerBookings(userId) {
          requestedUserId = userId;
          return [row()];
        },
      },
    });

    assert.equal(requestedUserId, user.id);
    assert.equal(expiredAt?.toISOString(), '2026-06-10T10:00:00.000Z');
    assert.equal(result.bookings.length, 1);
    assert.equal(result.bookings[0].pricing.totalInvoiceDisplay, 4623000);
    assert.equal(result.bookings[0].pricing.modelVersion, 'rf_adjustment_v4_final');
    assert.equal(result.bookings[0].displayStatus, 'WAITING_PAYMENT_PROOF');
    assert.equal(result.bookings[0].actions.canUploadPaymentProof, true);
    assert.equal(result.bookings[0].actions.paymentPath, `/booking/payment/${result.bookings[0].bookingId}`);
    assert.equal(JSON.stringify(result).includes('proofStorageKey'), false);
  });

  it('maps submitted, verified, rejected, and expired bookings for dashboard presentation', async () => {
    const result = await listCustomerDashboardBookings(user, {
      now: () => new Date('2026-06-10T10:00:00.000Z'),
      repository: {
        async expireSubmittedPayments() {},
        async listCustomerBookings() {
          return [
            row({
              bookingId: '11111111-1111-4111-8111-111111111111',
              paymentStatus: 'SUBMITTED',
              paymentSubmittedAt: new Date('2026-06-10T09:00:00.000Z'),
              paymentReviewExpiresAt: new Date('2026-06-11T09:00:00.000Z'),
            }),
            row({
              bookingId: '22222222-2222-4222-8222-222222222222',
              bookingStatus: 'CONFIRMED',
              paymentStatus: 'VERIFIED',
              paymentSubmittedAt: new Date('2026-06-10T09:00:00.000Z'),
              paymentReviewExpiresAt: new Date('2026-06-11T09:00:00.000Z'),
            }),
            row({
              bookingId: '33333333-3333-4333-8333-333333333333',
              bookingStatus: 'CANCELLED',
              paymentStatus: 'REJECTED',
              paymentRejectionReason: 'Bukti transfer tidak terbaca.',
            }),
            row({
              bookingId: '44444444-4444-4444-8444-444444444444',
              reservationExpiresAt: new Date('2026-06-10T09:59:00.000Z'),
            }),
          ];
        },
      },
    });

    assert.deepEqual(
      result.bookings.map((booking) => booking.displayStatus),
      ['WAITING_ADMIN_VERIFICATION', 'CONFIRMED', 'PAYMENT_REJECTED', 'EXPIRED'],
    );
    assert.equal(result.bookings[2].payment.rejectionReason, 'Bukti transfer tidak terbaca.');
    assert.equal(result.bookings[3].actions.canUploadPaymentProof, false);
  });
});
