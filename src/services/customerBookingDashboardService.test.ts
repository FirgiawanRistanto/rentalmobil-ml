import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  listCustomerDashboardBookings,
  type CustomerBookingDashboardRow,
  type CustomerBookingsRange,
  type CustomerBookingSummaryRow,
} from './customerBookingDashboardService';
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
    carUnitPlate: 'B 1234 XYZ',
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

function summaryRow(overrides: Partial<CustomerBookingSummaryRow> = {}): CustomerBookingSummaryRow {
  return {
    bookingStatus: 'PENDING',
    reservationExpiresAt: new Date('2026-06-10T10:30:00.000Z'),
    paymentStatus: null,
    paymentReviewExpiresAt: null,
    ...overrides,
  };
}

function fakeRepository(options: {
  rows?: CustomerBookingDashboardRow[];
  totalItems?: number;
  summaryRows?: CustomerBookingSummaryRow[];
  onList?: (userId: string, range: CustomerBookingsRange) => void;
} = {}) {
  const rows = options.rows ?? [row()];

  return {
    async expireSubmittedPayments() {},
    async listCustomerBookings(userId: string, range: CustomerBookingsRange) {
      options.onList?.(userId, range);
      return { rows, totalItems: options.totalItems ?? rows.length };
    },
    async listCustomerBookingSummaryRows() {
      return options.summaryRows ?? [summaryRow()];
    },
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
          return { rows: [row()], totalItems: 1 };
        },
        async listCustomerBookingSummaryRows() {
          return [summaryRow()];
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
    assert.equal(result.bookings[0].actions.canCancelReservation, true);
    assert.equal(result.bookings[0].actions.paymentPath, `/booking/payment/${result.bookings[0].bookingId}`);
    assert.equal(JSON.stringify(result).includes('proofStorageKey'), false);
  });

  it('defaults to the first page of five cards when no query is sent', async () => {
    let requestedRange: CustomerBookingsRange | undefined;
    const result = await listCustomerDashboardBookings(user, {
      now: () => new Date('2026-06-10T10:00:00.000Z'),
      repository: fakeRepository({
        onList: (_userId, range) => {
          requestedRange = range;
        },
      }),
    });

    assert.deepEqual(requestedRange, { limit: 5, offset: 0 });
    assert.equal(result.page, 1);
    assert.equal(result.pageSize, 5);
    assert.equal(result.totalPages, 1);
    assert.equal(result.hasNextPage, false);
    assert.equal(result.hasPreviousPage, false);
  });

  it('builds the requested page window and page metadata from the query string', async () => {
    const calls: Array<{ userId: string; range: CustomerBookingsRange }> = [];
    const result = await listCustomerDashboardBookings(user, {
      now: () => new Date('2026-06-10T10:00:00.000Z'),
      query: new URLSearchParams('page=2&pageSize=2'),
      repository: fakeRepository({
        rows: [
          row({ bookingId: '22222222-2222-4222-8222-222222222222' }),
          row({ bookingId: '33333333-3333-4333-8333-333333333333' }),
        ],
        totalItems: 5,
        summaryRows: Array.from({ length: 5 }, () => summaryRow()),
        onList: (userId, range) => calls.push({ userId, range }),
      }),
    });

    assert.deepEqual(calls, [{ userId: user.id, range: { limit: 2, offset: 2 } }]);
    assert.equal(result.bookings.length, 2);
    assert.equal(result.page, 2);
    assert.equal(result.pageSize, 2);
    assert.equal(result.totalItems, 5);
    assert.equal(result.totalPages, 3);
    assert.equal(result.hasNextPage, true);
    assert.equal(result.hasPreviousPage, true);
  });

  it('summarizes the whole history instead of only the loaded page', async () => {
    const result = await listCustomerDashboardBookings(user, {
      now: () => new Date('2026-06-10T10:00:00.000Z'),
      query: { page: 2, pageSize: 1 },
      repository: fakeRepository({
        rows: [row({ bookingId: '44444444-4444-4444-8444-444444444444' })],
        totalItems: 3,
        summaryRows: [
          summaryRow({ bookingStatus: 'CONFIRMED', paymentStatus: 'VERIFIED' }),
          summaryRow(),
          summaryRow({ reservationExpiresAt: new Date('2026-06-10T09:59:00.000Z') }),
        ],
      }),
    });

    assert.deepEqual(result.summary, {
      totalBookings: 3,
      activeBookings: 2,
      completedOrConfirmedBookings: 1,
    });
    // Kartu yang dirender hanya satu (halaman 2), tapi metrik tetap menghitung semuanya.
    assert.equal(result.bookings.length, 1);
  });

  it('maps submitted, verified, rejected, and expired bookings for dashboard presentation', async () => {
    const result = await listCustomerDashboardBookings(user, {
      now: () => new Date('2026-06-10T10:00:00.000Z'),
      repository: fakeRepository({
        rows: [
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
        ],
        summaryRows: [],
      }),
    });

    assert.deepEqual(
      result.bookings.map((booking) => booking.displayStatus),
      ['WAITING_ADMIN_VERIFICATION', 'CONFIRMED', 'PAYMENT_REJECTED', 'EXPIRED'],
    );
    assert.equal(result.bookings[2].payment.rejectionReason, 'Bukti transfer tidak terbaca.');
    assert.equal(result.bookings[3].actions.canUploadPaymentProof, false);
    assert.equal(result.bookings[3].actions.canCancelReservation, false);
  });
});
