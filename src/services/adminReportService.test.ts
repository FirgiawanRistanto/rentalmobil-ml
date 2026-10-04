import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readAdminReport } from './adminReportService';
import { PaymentServiceError } from './paymentService';

const admin = { id: 'admin-1', role: 'ADMIN' };
const customer = { id: 'customer-1', role: 'CUSTOMER' };
const now = new Date('2026-06-10T10:00:00.000Z');

function repository() {
  return {
    expiredWith: null as Date | null,
    metricsRange: null as null | { startDate: string; endDate: string },
    async expireSubmittedPayments(date: Date) {
      this.expiredWith = date;
    },
    async getMetrics(range: { startDate: string; endDate: string }) {
      this.metricsRange = { startDate: range.startDate, endDate: range.endDate };
      return {
        totalBookings: 4,
        pendingBookings: 1,
        confirmedBookings: 1,
        completedBookings: 1,
        cancelledBookings: 1,
        submittedPayments: 1,
        verifiedPayments: 1,
        rejectedPayments: 1,
        expiredPayments: 1,
        verifiedPaymentTotal: 4623000,
        averageInvoiceValue: 2500000,
        totalQuotes: 5,
        acceptedQuotes: 2,
        averageAdjustmentPercentDisplay: 2.76,
        dynamicPricingFlatTotal: 4500000,
        dynamicPricingDynamicTotal: 4623000,
        dynamicPricingUplift: 123000,
        totalFines: 3,
        verifiedFineTotal: 750000,
        pendingFineTotal: 250000,
        rejectedFineTotal: 100000,
      };
    },
    async getBookingStatusBreakdown() {
      return [
        { key: 'PENDING', count: 1 },
        { key: 'CONFIRMED', count: 1 },
        { key: 'EXPIRED', count: 1 },
      ];
    },
    async getPaymentStatusBreakdown() {
      return [
        { key: 'SUBMITTED', count: 1 },
        { key: 'VERIFIED', count: 1 },
      ];
    },
    async listTopCars() {
      return [
        {
          id: 'car-1',
          label: 'Toyota Fortuner',
          category: 'suv',
          bookingCount: 2,
          totalInvoiceDisplay: 9246000,
        },
      ];
    },
    async listTopCategories() {
      return [
        {
          id: 'suv',
          label: 'suv',
          category: 'suv',
          bookingCount: 2,
          totalInvoiceDisplay: 9246000,
        },
      ];
    },
    async listRecentTransactions() {
      return [
        {
          bookingId: '11111111-1111-4111-8111-111111111111',
          bookingStatus: 'CONFIRMED',
          createdAt: new Date('2026-06-10T09:00:00.000Z'),
          startDate: new Date('2026-06-15T00:00:00.000Z'),
          endDate: new Date('2026-06-18T00:00:00.000Z'),
          tripType: 'LUAR_KOTA',
          totalPrice: 999999,
          customerName: 'Customer Test',
          customerEmail: 'customer@example.test',
          carBrand: 'Toyota',
          carModel: 'Fortuner',
          carCategory: 'suv',
          snapshotTotalInvoiceDisplay: 4623000,
          paymentStatus: 'VERIFIED',
        },
      ];
    },
  };
}

describe('readAdminReport', () => {
  it('rejects anonymous and CUSTOMER users', async () => {
    await assert.rejects(
      () => readAdminReport(null, { repository: repository() as never, now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'AUTHENTICATION_REQUIRED',
    );

    await assert.rejects(
      () => readAdminReport(customer, { repository: repository() as never, now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'ADMIN_AUTHORIZATION_REQUIRED',
    );
  });

  it('returns real report metrics from snapshot-oriented repository data', async () => {
    const repo = repository();
    const result = await readAdminReport(admin, {
      repository: repo as never,
      now: () => now,
      query: { startDate: '2026-06-01', endDate: '2026-06-10' },
    });

    assert.equal(repo.expiredWith?.toISOString(), now.toISOString());
    assert.deepEqual(repo.metricsRange, { startDate: '2026-06-01', endDate: '2026-06-10' });
    assert.equal(result.period.startDate, '2026-06-01');
    assert.equal(result.period.endDate, '2026-06-10');
    assert.equal(result.metrics.verifiedPaymentTotal, 4623000);
    assert.equal(result.metrics.submittedPayments, 1);
    assert.equal(result.metrics.rejectedPayments, 1);
    assert.equal(result.metrics.expiredPayments, 1);
    assert.equal(result.metrics.dynamicPricingUplift, 123000);
    assert.equal(result.metrics.totalFines, 3);
    assert.equal(result.metrics.verifiedFineTotal, 750000);
    assert.equal(result.metrics.pendingFineTotal, 250000);
    assert.equal(result.metrics.rejectedFineTotal, 100000);
    assert.equal(result.metrics.averageAdjustmentPercentDisplay, 2.76);
    assert.equal(result.modelLabel, 'Model Harga Dinamis');
    assert.deepEqual(result.bookingStatusBreakdown.at(-1), {
      key: 'EXPIRED',
      label: 'Kedaluwarsa',
      count: 1,
    });
    assert.equal(result.recentTransactions[0].totalInvoiceDisplay, 4623000);
    assert.equal(JSON.stringify(result).includes('proofStorageKey'), false);
    assert.equal(JSON.stringify(result).includes('rf_adjustment_v4_final'), false);
  });

  it('defaults to the last 30 calendar days when query is empty or invalid', async () => {
    const repo = repository();
    const result = await readAdminReport(admin, {
      repository: repo as never,
      now: () => now,
      query: { startDate: '2026-06-15', endDate: '2026-06-01' },
    });

    assert.equal(result.period.startDate, '2026-05-12');
    assert.equal(result.period.endDate, '2026-06-10');
  });
});
