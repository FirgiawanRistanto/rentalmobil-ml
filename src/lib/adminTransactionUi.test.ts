import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAdminTransactionCode,
  buildAdminTransactionListPath,
  getAdminBookingStatusTransitionOptions,
  getAdminTransactionDisplayStatus,
  getAdminTransactionStatusLabel,
  parseAdminTransactionsSearchParams,
} from './adminTransactionUi';

const now = new Date('2026-06-09T10:00:00.000Z');
const future = '2026-06-09T10:30:00.000Z';
const past = '2026-06-09T09:59:59.000Z';

describe('admin transaction UI mapping', () => {
  it('maps waiting payment, waiting verification, confirmed, rejected, expired, and completed statuses', () => {
    assert.equal(getAdminTransactionDisplayStatus('PENDING', null, future, null, now), 'WAITING_PAYMENT');
    assert.equal(getAdminTransactionDisplayStatus('PENDING', 'SUBMITTED', future, future, now), 'WAITING_VERIFICATION');
    assert.equal(getAdminTransactionDisplayStatus('CONFIRMED', 'VERIFIED', null, null, now), 'CONFIRMED');
    assert.equal(getAdminTransactionDisplayStatus('CANCELLED', 'REJECTED', null, null, now), 'PAYMENT_REJECTED');
    assert.equal(getAdminTransactionDisplayStatus('CANCELLED', 'EXPIRED', null, past, now), 'EXPIRED');
    assert.equal(getAdminTransactionDisplayStatus('EXPIRED', null, null, null, now), 'EXPIRED');
    assert.equal(getAdminTransactionDisplayStatus('COMPLETED', 'VERIFIED', null, null, now), 'COMPLETED');
  });

  it('treats expired pending holds as Kedaluwarsa without payment mutation from UI', () => {
    const status = getAdminTransactionDisplayStatus('PENDING', null, past, null, now);

    assert.equal(status, 'EXPIRED');
    assert.equal(getAdminTransactionStatusLabel(status), 'Kedaluwarsa');
  });

  it('uses compact transaction status labels for the admin table', () => {
    assert.equal(getAdminTransactionStatusLabel('WAITING_PAYMENT'), 'Belum Bayar');
    assert.equal(getAdminTransactionStatusLabel('WAITING_VERIFICATION'), 'Menunggu Verifikasi');
    assert.equal(getAdminTransactionStatusLabel('CONFIRMED'), 'Terverifikasi');
    assert.equal(getAdminTransactionStatusLabel('PAYMENT_REJECTED'), 'Ditolak');
    assert.equal(getAdminTransactionStatusLabel('COMPLETED'), 'Selesai');
    assert.equal(getAdminTransactionStatusLabel('CANCELLED'), 'Dibatalkan');
  });

  it('exposes only valid admin manual booking status transitions', () => {
    assert.deepEqual(getAdminBookingStatusTransitionOptions('CONFIRMED'), ['COMPLETED']);
    assert.deepEqual(getAdminBookingStatusTransitionOptions('COMPLETED'), []);
    assert.deepEqual(getAdminBookingStatusTransitionOptions('EXPIRED'), []);
  });

  it('builds booking code from real booking id without dummy BRM numbers', () => {
    assert.equal(
      buildAdminTransactionCode('12345678-1234-4234-8234-123456789abc'),
      'BRM-12345678',
    );
  });

  it('parses admin transaction URL query with safe defaults', () => {
    const query = parseAdminTransactionsSearchParams(new URLSearchParams({
      page: '2',
      pageSize: '20',
      status: 'waiting_verification',
      q: 'Toyota',
      sort: 'totalInvoice',
      order: 'asc',
    }));

    assert.deepEqual(query, {
      page: 2,
      pageSize: 20,
      status: 'waiting_verification',
      q: 'Toyota',
      sort: 'totalInvoice',
      order: 'asc',
    });

    const fallback = parseAdminTransactionsSearchParams(new URLSearchParams({
      sort: 'createdAt desc; drop table bookings',
      order: 'bad',
      pageSize: '999',
    }));

    assert.equal(fallback.sort, 'createdAt');
    assert.equal(fallback.order, 'desc');
    assert.equal(fallback.pageSize, 50);

    const extension = parseAdminTransactionsSearchParams(new URLSearchParams({ status: 'extension' }));
    assert.equal(extension.status, 'extension');

    const unknownStatus = parseAdminTransactionsSearchParams(new URLSearchParams({ status: 'not-a-filter' }));
    assert.equal(unknownStatus.status, 'all');
  });

  it('builds list path from query params without legacy payment route', () => {
    assert.equal(
      buildAdminTransactionListPath({ status: 'unpaid', page: 3, q: 'brio' }),
      '/admin/transaksi?page=3&status=unpaid&q=brio',
    );
  });
});
