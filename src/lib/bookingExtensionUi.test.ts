import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getBookingExtensionBadgeClass,
  getBookingExtensionStatusLabel,
  getBookingExtensionTableBadgeLabel,
  isPendingBookingExtensionStatus,
} from './bookingExtensionUi';

describe('booking extension UI helpers', () => {
  it('flags only actionable extension states as pending', () => {
    assert.equal(isPendingBookingExtensionStatus('AWAITING_PAYMENT'), true);
    assert.equal(isPendingBookingExtensionStatus('SUBMITTED'), true);
    assert.equal(isPendingBookingExtensionStatus('VERIFIED'), false);
    assert.equal(isPendingBookingExtensionStatus('REJECTED'), false);
    assert.equal(isPendingBookingExtensionStatus('CANCELLED'), false);
    assert.equal(isPendingBookingExtensionStatus(null), false);
    assert.equal(isPendingBookingExtensionStatus(undefined), false);
    assert.equal(isPendingBookingExtensionStatus('BOGUS_STATUS'), false);
  });

  it('maps every extension status to a user-facing label and badge tone', () => {
    assert.equal(getBookingExtensionStatusLabel('AWAITING_PAYMENT'), 'Menunggu Pembayaran');
    assert.equal(getBookingExtensionStatusLabel('SUBMITTED'), 'Menunggu Verifikasi Admin');
    assert.equal(getBookingExtensionStatusLabel('VERIFIED'), 'Disetujui — Terpasang');
    assert.equal(getBookingExtensionStatusLabel('REJECTED'), 'Ditolak');
    assert.equal(getBookingExtensionStatusLabel('CANCELLED'), 'Dibatalkan');

    for (const status of ['AWAITING_PAYMENT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'CANCELLED']) {
      assert.match(getBookingExtensionBadgeClass(status), /bg-/);
    }
  });

  it('keeps table badges short so the action column stays on one line', () => {
    const LONG_LABEL = 'Menunggu Verifikasi Admin';

    assert.equal(getBookingExtensionTableBadgeLabel('AWAITING_PAYMENT'), 'Perpanjangan: Belum Bayar');
    assert.equal(getBookingExtensionTableBadgeLabel('SUBMITTED'), 'Perpanjangan: Verifikasi');

    for (const status of ['AWAITING_PAYMENT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'CANCELLED']) {
      const badge = getBookingExtensionTableBadgeLabel(status);
      assert.ok(badge.length <= 'Perpanjangan: Belum Bayar'.length, `${status} badge too long: ${badge}`);
      assert.ok(!badge.includes(LONG_LABEL), `${status} badge reuses the long label`);
      assert.match(badge, /^Perpanjangan:/);
    }
  });
});
