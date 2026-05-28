import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildAdminDashboardEndpoint,
  getAdminBookingStatusLabel,
  getAdminPaymentDetailRoute,
  getAdminPaymentsRoute,
  shortId,
} from './adminDashboardUi';

describe('admin dashboard UI helpers', () => {
  it('builds admin dashboard and payment v4 routes', () => {
    assert.equal(buildAdminDashboardEndpoint(), '/api/admin/dashboard');
    assert.equal(getAdminPaymentsRoute(), '/admin/payments');
    assert.equal(
      getAdminPaymentDetailRoute('11111111-1111-4111-8111-111111111111'),
      '/admin/payments/11111111-1111-4111-8111-111111111111',
    );
    assert.equal(shortId('11111111-1111-4111-8111-111111111111'), '11111111');
  });

  it('maps admin booking statuses to user-facing labels', () => {
    assert.equal(getAdminBookingStatusLabel('PENDING', null), 'Menunggu Bukti Pembayaran');
    assert.equal(getAdminBookingStatusLabel('PENDING', 'SUBMITTED'), 'Menunggu Verifikasi');
    assert.equal(getAdminBookingStatusLabel('CONFIRMED', 'VERIFIED'), 'Dikonfirmasi');
    assert.equal(getAdminBookingStatusLabel('CANCELLED', 'REJECTED'), 'Ditolak');
    assert.equal(getAdminBookingStatusLabel('CANCELLED', 'EXPIRED'), 'Kedaluwarsa');
  });

  it('keeps the active admin dashboard away from dummy values and legacy routes', () => {
    const source = readFileSync('src/app/admin/page.tsx', 'utf8');

    assert.equal(source.includes('Rp 18.5M'), false);
    assert.equal(source.includes('Rp 2.3M'), false);
    assert.equal(source.includes('#BRM-240'), false);
    assert.equal(source.includes('Ahmad Kurniawan'), false);
    assert.equal(source.includes('Holiday:'), false);
    assert.equal(source.includes('/payment/'), false);
    assert.equal(source.includes('/api/pricing/estimate'), false);
    assert.equal(source.includes('/api/bookings'), false);
    assert.equal(source.includes('/v1/predict-price'), false);
  });
});
