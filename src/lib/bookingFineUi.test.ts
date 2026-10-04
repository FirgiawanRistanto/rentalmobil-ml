import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LATE_FINE_DAILY_RATE_PCT,
  computeLateReturnFine,
  daysPastDateOnly,
  getBookingFineBadgeClass,
  getBookingFineErrorMessage,
  getBookingFineStatusLabel,
} from './bookingFineUi';

describe('booking fine ui', () => {
  it('charges one full contracted daily rate per late calendar day', () => {
    assert.equal(LATE_FINE_DAILY_RATE_PCT, 100);
    assert.deepEqual(computeLateReturnFine(500_000, '2026-06-18', '2026-06-21'), {
      lateDays: 3,
      finePerDay: 500_000,
      fineAmount: 1_500_000,
    });
  });

  it('does not charge when returned on time or early', () => {
    assert.deepEqual(computeLateReturnFine(500_000, '2026-06-18', '2026-06-18'), {
      lateDays: 0,
      finePerDay: 500_000,
      fineAmount: 0,
    });
    assert.deepEqual(computeLateReturnFine(500_000, '2026-06-18', '2026-06-15'), {
      lateDays: 0,
      finePerDay: 500_000,
      fineAmount: 0,
    });
  });

  it('applies a configurable daily rate percent when provided', () => {
    assert.deepEqual(computeLateReturnFine(500_000, '2026-06-18', '2026-06-21', 150), {
      lateDays: 3,
      finePerDay: 750_000,
      fineAmount: 2_250_000,
    });
    assert.deepEqual(computeLateReturnFine(500_000, '2026-06-18', '2026-06-19', 50), {
      lateDays: 1,
      finePerDay: 250_000,
      fineAmount: 250_000,
    });
    // Nilai tidak valid jatuh ke default konstanta (100%).
    assert.deepEqual(computeLateReturnFine(500_000, '2026-06-18', '2026-06-19', Number.NaN), {
      lateDays: 1,
      finePerDay: 500_000,
      fineAmount: 500_000,
    });
  });

  it('rounds the per-day fine to whole rupiah', () => {
    assert.deepEqual(computeLateReturnFine(1_250.4, '2026-06-18', '2026-06-19'), {
      lateDays: 1,
      finePerDay: 1_250,
      fineAmount: 1_250,
    });
  });

  it('returns no charge for malformed dates', () => {
    assert.deepEqual(computeLateReturnFine(500_000, 'not-a-date', '2026-06-21'), {
      lateDays: 0,
      finePerDay: 0,
      fineAmount: 0,
    });
    assert.deepEqual(computeLateReturnFine(500_000, '2026-06-18', '21/06/2026'), {
      lateDays: 0,
      finePerDay: 0,
      fineAmount: 0,
    });
  });

  it('counts days past a due date for overdue indicators', () => {
    const reference = new Date(2026, 5, 20);
    assert.equal(daysPastDateOnly('2026-06-18', reference), 2);
    assert.equal(daysPastDateOnly('2026-06-25', reference), -5);
    assert.equal(daysPastDateOnly('invalid', reference), 0);
  });

  it('labels statuses and maps error codes to friendly messages', () => {
    assert.equal(getBookingFineStatusLabel('AWAITING_PAYMENT'), 'Menunggu Pembayaran');
    assert.equal(getBookingFineStatusLabel('VERIFIED'), 'Disetujui — Masuk Tagihan');
    assert.equal(getBookingFineStatusLabel('REJECTED'), 'Dibatalkan');
    assert.match(getBookingFineBadgeClass('SUBMITTED'), /blue/);
    assert.match(getBookingFineBadgeClass('AWAITING_PAYMENT'), /amber/);
    assert.match(getBookingFineErrorMessage('FINE_NOT_FOUND'), /tidak ditemukan/i);
    assert.equal(getBookingFineErrorMessage('UNKNOWN_CODE'), 'Terjadi kesalahan. Silakan coba lagi.');
  });
});
