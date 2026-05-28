import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildCustomerBookingPaymentPath,
  canUploadPaymentProofFromDashboard,
  deriveCustomerBookingDisplayStatus,
  getCustomerDisplayStatusLabel,
  type CustomerDashboardBooking,
} from './customerDashboardUi';

const referenceDate = new Date('2026-06-10T10:00:00.000Z');

function displayInput(overrides: Parameters<typeof deriveCustomerBookingDisplayStatus>[0]) {
  return deriveCustomerBookingDisplayStatus(overrides, referenceDate);
}

function dashboardBooking(overrides: Partial<CustomerDashboardBooking> = {}): CustomerDashboardBooking {
  return {
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
    ...overrides,
  };
}

describe('customer dashboard UI helpers', () => {
  it('maps real booking/payment states to customer-friendly dashboard statuses', () => {
    assert.equal(
      displayInput({
        bookingStatus: 'PENDING',
        reservationExpiresAt: '2026-06-10T10:30:00.000Z',
        payment: { paymentStatus: null, reviewExpiresAt: null },
      }),
      'WAITING_PAYMENT_PROOF',
    );
    assert.equal(
      displayInput({
        bookingStatus: 'PENDING',
        reservationExpiresAt: '2026-06-10T10:30:00.000Z',
        payment: { paymentStatus: 'SUBMITTED', reviewExpiresAt: '2026-06-11T10:00:00.000Z' },
      }),
      'WAITING_ADMIN_VERIFICATION',
    );
    assert.equal(
      displayInput({
        bookingStatus: 'CONFIRMED',
        reservationExpiresAt: '2026-06-11T10:00:00.000Z',
        payment: { paymentStatus: 'VERIFIED', reviewExpiresAt: '2026-06-11T10:00:00.000Z' },
      }),
      'CONFIRMED',
    );
    assert.equal(
      displayInput({
        bookingStatus: 'CANCELLED',
        reservationExpiresAt: null,
        payment: { paymentStatus: 'REJECTED', reviewExpiresAt: '2026-06-11T10:00:00.000Z' },
      }),
      'PAYMENT_REJECTED',
    );
    assert.equal(
      displayInput({
        bookingStatus: 'CANCELLED',
        reservationExpiresAt: null,
        payment: { paymentStatus: 'EXPIRED', reviewExpiresAt: '2026-06-10T09:59:00.000Z' },
      }),
      'EXPIRED',
    );
  });

  it('removes upload CTA for expired pending bookings and keeps payment route v4', () => {
    const activeBooking = dashboardBooking();
    const expiredBooking = dashboardBooking({ displayStatus: 'EXPIRED' });

    assert.equal(canUploadPaymentProofFromDashboard(activeBooking), true);
    assert.equal(canUploadPaymentProofFromDashboard(expiredBooking), false);
    assert.equal(buildCustomerBookingPaymentPath(activeBooking.bookingId), `/booking/payment/${activeBooking.bookingId}`);
    assert.equal(buildCustomerBookingPaymentPath(activeBooking.bookingId).startsWith('/payment/'), false);
  });

  it('uses labels for customers instead of raw booking/payment enum names', () => {
    assert.equal(getCustomerDisplayStatusLabel('WAITING_PAYMENT_PROOF'), 'Menunggu Bukti Pembayaran');
    assert.equal(getCustomerDisplayStatusLabel('WAITING_ADMIN_VERIFICATION'), 'Menunggu Verifikasi Admin');
    assert.equal(getCustomerDisplayStatusLabel('PAYMENT_REJECTED'), 'Pembayaran Ditolak');
  });

  it('keeps dashboard source away from legacy routes and hardcoded booking demo data', () => {
    const source = readFileSync('src/app/dashboard/page.tsx', 'utf8');

    assert.equal(source.includes('#BRM-'), false);
    assert.equal(source.includes('BRN-'), false);
    assert.equal(source.includes('/payment/${'), false);
    assert.equal(source.includes('/api/pricing/estimate'), false);
    assert.equal(source.includes('listCustomerDashboardBookingsClient'), true);
    assert.equal(source.includes('/katalog'), true);
  });
});
