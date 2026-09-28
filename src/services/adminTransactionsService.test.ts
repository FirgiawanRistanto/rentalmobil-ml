import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  AdminTransactionsServiceError,
  listAdminTransactions,
  readAdminTransactionDetail,
  updateAdminBookingStatus,
} from './adminTransactionsService';
import { PaymentServiceError } from './paymentService';

const admin = { id: 'admin-1', role: 'ADMIN' };
const customer = { id: 'customer-1', role: 'CUSTOMER' };
const now = new Date('2026-06-09T10:00:00.000Z');
const bookingId = '11111111-1111-4111-8111-111111111111';

function row(overrides: Record<string, unknown> = {}) {
  return {
    bookingId,
    bookingStatus: 'PENDING',
    createdAt: new Date('2026-06-09T09:00:00.000Z'),
    reservationExpiresAt: new Date('2026-06-09T10:30:00.000Z'),
    startDate: new Date('2026-06-15T00:00:00.000Z'),
    endDate: new Date('2026-06-18T00:00:00.000Z'),
    tripType: 'LUAR_KOTA',
    totalPrice: 4623000,
    phoneNumber: '08123456789',
    pickupAddress: 'Bandar Lampung',
    notes: null,
    customerId: 'customer-1',
    customerName: 'Customer Test',
    customerEmail: 'customer@example.test',
    carId: 'car-1',
    carBrand: 'Toyota',
    carModel: 'Fortuner',
    carCategory: 'suv',
    snapshotBasePricePerDay: 1500000,
    snapshotPredictedPriceAdjustmentPct: '0.027570',
    snapshotDynamicPriceRawPerDay: 1541354,
    snapshotDynamicPriceDisplayPerDay: 1541000,
    snapshotTotalInvoiceDisplay: 4623000,
    snapshotModelVersion: 'rf_adjustment_v4_final',
    snapshotPricingReasons: ['Periode sewa termasuk musim ramai.'],
    paymentId: null,
    paymentStatus: null,
    paymentAmount: null,
    paymentSubmittedAt: null,
    paymentReviewExpiresAt: null,
    paymentReviewedAt: null,
    paymentRejectionReason: null,
    ...overrides,
  };
}

function repository(rows: unknown[]) {
  return {
    expiredWith: null as Date | null,
    receivedQuery: null as unknown,
    updatedStatus: null as string | null,
    async expireSubmittedPayments(date: Date) {
      this.expiredWith = date;
    },
    async transaction<T>(callback: (tx: {
      lockBooking(): Promise<{ bookingId: string; bookingStatus: string } | null>;
      updateBookingStatus(bookingIdValue: string, status: string): Promise<void>;
    }) => Promise<T>): Promise<T> {
      return callback({
        lockBooking: async () => rows[0]
          ? {
            bookingId: (rows[0] as { bookingId: string }).bookingId,
            bookingStatus: (rows[0] as { bookingStatus: string }).bookingStatus,
          }
          : null,
        updateBookingStatus: async (_bookingIdValue, status) => {
          this.updatedStatus = status;
        },
      });
    },
    async listTransactions(query: unknown) {
      this.receivedQuery = query;
      return { rows, totalItems: rows.length };
    },
    async findTransaction() {
      return rows[0] ?? null;
    },
  };
}

function typedRepository(rows: unknown[]) {
  return repository(rows) as never;
}

describe('admin transactions service', () => {
  it('requires ADMIN role before listing transactions', async () => {
    await assert.rejects(
      () => listAdminTransactions(null, { repository: typedRepository([]), now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'AUTHENTICATION_REQUIRED',
    );
    await assert.rejects(
      () => listAdminTransactions(customer, { repository: typedRepository([]), now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'ADMIN_AUTHORIZATION_REQUIRED',
    );
  });

  it('lists real booking rows with snapshot totals and waiting payment status', async () => {
    const repo = repository([row()]);
    const result = await listAdminTransactions(admin, { repository: repo as never, now: () => now });

    assert.equal(result.items.length, 1);
    assert.equal(result.page, 1);
    assert.equal(result.pageSize, 10);
    assert.equal(result.totalItems, 1);
    assert.equal(result.items[0].customer.email, 'customer@example.test');
    assert.equal(result.items[0].car.name, 'Toyota Fortuner');
    assert.equal(result.items[0].pricing.totalInvoiceDisplay, 4623000);
    assert.equal(result.items[0].displayStatus, 'WAITING_PAYMENT');
    assert.equal(result.items[0].actions.detailPath.startsWith('/admin/transaksi/'), true);
    assert.equal(result.items[0].actions.paymentReviewPath, null);
    assert.equal(repo.expiredWith?.toISOString(), now.toISOString());
  });

  it('passes server-side pagination, search, filter, and safe sort query to repository', async () => {
    const repo = repository([row()]);
    await listAdminTransactions(admin, {
      repository: repo as never,
      now: () => now,
      query: {
        page: '2',
        pageSize: '20',
        q: 'fortuner',
        status: 'waiting_verification',
        sort: 'totalInvoice',
        order: 'asc',
      },
    });

    assert.deepEqual(repo.receivedQuery, {
      page: 2,
      pageSize: 20,
      q: 'fortuner',
      status: 'waiting_verification',
      sort: 'totalInvoice',
      order: 'asc',
    });
  });

  it('falls back to safe sort and order values for invalid query input', async () => {
    const repo = repository([row()]);
    await listAdminTransactions(admin, {
      repository: repo as never,
      now: () => now,
      query: {
        sort: 'b."createdAt"; drop table bookings',
        order: 'sideways',
      },
    });

    assert.equal((repo.receivedQuery as { sort: string }).sort, 'createdAt');
    assert.equal((repo.receivedQuery as { order: string }).order, 'desc');
  });

  it('maps submitted payments to waiting verification with protected proof action', async () => {
    const result = await listAdminTransactions(admin, {
      repository: typedRepository([
        row({
          paymentId: 'payment-1',
          paymentStatus: 'SUBMITTED',
          paymentAmount: 4623000,
          paymentSubmittedAt: new Date('2026-06-09T09:15:00.000Z'),
          paymentReviewExpiresAt: new Date('2026-06-10T09:15:00.000Z'),
        }),
      ]),
      now: () => now,
    });

    assert.equal(result.items[0].displayStatus, 'WAITING_VERIFICATION');
    assert.equal(result.items[0].actions.paymentReviewPath, null);
    assert.equal(result.items[0].actions.proofPath, '/api/admin/payments/payment-1/proof');
  });

  it('maps confirmed, rejected, expired, and completed transaction states', async () => {
    const result = await listAdminTransactions(admin, {
      repository: typedRepository([
        row({ bookingId: 'confirmed', bookingStatus: 'CONFIRMED', paymentStatus: 'VERIFIED', paymentId: 'p1' }),
        row({ bookingId: 'rejected', bookingStatus: 'CANCELLED', paymentStatus: 'REJECTED', paymentId: 'p2' }),
        row({ bookingId: 'expired', bookingStatus: 'CANCELLED', paymentStatus: 'EXPIRED', paymentId: 'p3' }),
        row({ bookingId: 'completed', bookingStatus: 'COMPLETED', paymentStatus: 'VERIFIED', paymentId: 'p4' }),
      ]),
      now: () => now,
    });

    assert.deepEqual(
      result.items.map((item) => item.displayStatus),
      ['CONFIRMED', 'PAYMENT_REJECTED', 'EXPIRED', 'COMPLETED'],
    );
  });

  it('does not expose proof storage path in list response', async () => {
    const result = await listAdminTransactions(admin, {
      repository: typedRepository([
        row({
          paymentId: 'payment-1',
          paymentStatus: 'SUBMITTED',
          paymentReviewExpiresAt: new Date('2026-06-10T09:15:00.000Z'),
          proofStorageKey: 'storage/payment-proofs/proof.png',
        }),
      ]),
      now: () => now,
    });

    assert.equal(JSON.stringify(result).includes('proofStorageKey'), false);
    assert.equal(JSON.stringify(result).includes('storage/payment-proofs'), false);
  });

  it('uses database pagination instead of loading the whole transaction list', () => {
    const source = readFileSync('src/services/adminTransactionsService.ts', 'utf8');

    assert.match(source, /limit \$\{limit\}/);
    assert.match(source, /offset \$\{offset\}/);
    assert.doesNotMatch(source, /limit 200/);
  });

  it('reads detail without exposing proof storage paths and keeps raw model version in data only', async () => {
    const result = await readAdminTransactionDetail(bookingId, admin, {
      repository: typedRepository([row({ paymentId: 'payment-1', paymentStatus: 'SUBMITTED' })]),
      now: () => now,
    });

    assert.equal(result.priceSnapshot.modelVersion, 'rf_adjustment_v4_final');
    assert.equal(JSON.stringify(result).includes('proofStorageKey'), false);
  });

  it('updates booking status only through valid admin lifecycle transitions', async () => {
    const repo = repository([row({ bookingStatus: 'CONFIRMED' })]);

    const result = await updateAdminBookingStatus(bookingId, 'COMPLETED', admin, {
      repository: repo as never,
      now: () => now,
    });

    assert.equal(result.bookingStatus, 'COMPLETED');
    assert.equal(result.updatedAt, now.toISOString());
    assert.equal(repo.updatedStatus, 'COMPLETED');

    await assert.rejects(
      () =>
        updateAdminBookingStatus(bookingId, 'PENDING', admin, {
          repository: repository([row({ bookingStatus: 'COMPLETED' })]) as never,
          now: () => now,
        }),
      (error) => error instanceof AdminTransactionsServiceError && error.code === 'BOOKING_STATUS_FINAL',
    );

    await assert.rejects(
      () =>
        updateAdminBookingStatus(bookingId, 'CONFIRMED', admin, {
          repository: repository([row({ bookingStatus: 'PENDING' })]) as never,
          now: () => now,
        }),
      (error) => error instanceof AdminTransactionsServiceError && error.code === 'INVALID_BOOKING_STATUS_TRANSITION',
    );
  });
});
