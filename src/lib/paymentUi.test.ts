import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  MAX_PAYMENT_PROOF_SIZE_BYTES,
  SIMULATED_BANK_TRANSFER_INSTRUCTIONS,
  buildAdminPaymentDetailPath,
  buildBookingPaymentPath,
  canUploadPaymentProof,
  getAdminPaymentErrorMessage,
  getEffectivePaymentStatus,
  getPaymentErrorMessage,
  validatePaymentProofFile,
  type BookingPaymentReadResponse,
} from './paymentUi';

const bookingId = '11111111-1111-4111-8111-111111111111';

function booking(overrides: Partial<BookingPaymentReadResponse> = {}): BookingPaymentReadResponse {
  return {
    bookingId,
    bookingStatus: 'PENDING',
    reservationExpiresAt: '2026-06-10T10:30:00.000Z',
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
      dynamicPriceDisplayPerDay: 1541000,
      totalInvoiceDisplay: 4623000,
      modelVersion: 'rf_adjustment_v4_final',
    },
    payment: null,
    ...overrides,
  };
}

describe('manual payment UI helpers', () => {
  it('builds v4 payment routes and keeps the legacy payment demo out of the booking handoff', () => {
    assert.equal(buildBookingPaymentPath(bookingId), `/booking/payment/${bookingId}`);
    assert.equal(buildAdminPaymentDetailPath('payment-1'), '/admin/payments/payment-1');
    assert.notEqual(buildBookingPaymentPath(bookingId).startsWith('/payment/'), true);

    const bookingConfirmationSource = readFileSync('src/components/booking/BookingConfirmationClient.tsx', 'utf8');
    const customerPaymentSource = readFileSync('src/components/payment/CustomerPaymentClient.tsx', 'utf8');

    assert.equal(bookingConfirmationSource.includes('buildBookingPaymentPath'), true);
    assert.equal(customerPaymentSource.includes('/payment/[bookingId]'), false);
    assert.equal(customerPaymentSource.includes('/v1/predict-price'), false);
    assert.equal(customerPaymentSource.includes('ML_SERVICE_BASE_URL'), false);
  });

  it('shows explicit simulated bank transfer information instead of a real account', () => {
    assert.equal(SIMULATED_BANK_TRANSFER_INSTRUCTIONS.bankName, 'Bank XYZ');
    assert.equal(SIMULATED_BANK_TRANSFER_INSTRUCTIONS.accountHolder, 'Rental Mobil XYZ');
    assert.match(SIMULATED_BANK_TRANSFER_INSTRUCTIONS.notice, /demonstrasi sistem/i);
  });

  it('validates proof file type and size on the client for UX', () => {
    assert.equal(
      validatePaymentProofFile(new File(['proof'], 'proof.png', { type: 'image/png' })).name,
      'proof.png',
    );
    assert.throws(
      () => validatePaymentProofFile(new File(['proof'], 'proof.txt', { type: 'text/plain' })),
      /Format file tidak didukung/,
    );
    assert.throws(
      () =>
        validatePaymentProofFile(
          new File([new Uint8Array(MAX_PAYMENT_PROOF_SIZE_BYTES + 1)], 'large.png', { type: 'image/png' }),
        ),
      /Ukuran file maksimal 5 MB/,
    );
  });

  it('derives customer payment states without mutating booking data from timers', () => {
    const reference = new Date('2026-06-10T10:00:00.000Z');
    assert.equal(canUploadPaymentProof(booking(), reference), true);
    assert.equal(
      canUploadPaymentProof(booking({ reservationExpiresAt: '2026-06-10T09:59:00.000Z' }), reference),
      false,
    );
    assert.equal(
      getEffectivePaymentStatus(
        booking({
          payment: {
            paymentId: 'payment-1',
            method: 'BANK_TRANSFER_MANUAL',
            status: 'SUBMITTED',
            amount: 4623000,
            submittedAt: '2026-06-10T09:00:00.000Z',
            reviewExpiresAt: '2026-06-10T09:59:00.000Z',
            reviewedAt: null,
            rejectionReason: null,
          },
        }),
        reference,
      ),
      'EXPIRED',
    );
  });

  it('maps customer and admin payment errors to safe UI messages', () => {
    assert.equal(
      getPaymentErrorMessage('PAYMENT_ALREADY_SUBMITTED'),
      'Bukti pembayaran telah dikirim dan sedang diproses.',
    );
    assert.equal(
      getAdminPaymentErrorMessage('PAYMENT_REVIEW_EXPIRED'),
      'Masa verifikasi telah berakhir. Booking dibatalkan.',
    );
  });
});
