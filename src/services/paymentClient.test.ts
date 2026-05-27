import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBookingPaymentReadEndpoint,
  buildPaymentProofEndpoint,
} from '../lib/paymentUi';
import { readBookingPaymentClient, uploadPaymentProofClient } from './paymentClient';

const bookingId = '11111111-1111-4111-8111-111111111111';

const bookingResponse = {
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
};

const paymentSubmitResponse = {
  paymentId: '22222222-2222-4222-8222-222222222222',
  bookingId,
  paymentMethod: 'BANK_TRANSFER_MANUAL',
  paymentStatus: 'SUBMITTED',
  amount: 4623000,
  submittedAt: '2026-06-10T10:00:00.000Z',
  reviewExpiresAt: '2026-06-11T10:00:00.000Z',
  bookingStatus: 'PENDING',
  reservationExpiresAt: '2026-06-11T10:00:00.000Z',
  nextStep: 'WAITING_ADMIN_VERIFICATION',
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe('payment browser client', () => {
  it('reads customer booking/payment status from the v4 booking endpoint', async () => {
    let requestedUrl = '';
    const booking = await readBookingPaymentClient(bookingId, {
      fetchFn: async (input) => {
        requestedUrl = String(input);
        return jsonResponse(bookingResponse);
      },
    });

    assert.equal(requestedUrl, buildBookingPaymentReadEndpoint(bookingId));
    assert.equal(booking.car.name, 'Toyota Fortuner');
    assert.equal(booking.pricing.totalInvoiceDisplay, 4623000);
  });

  it('uploads multipart proof to the v4 endpoint and does not send amount from the client', async () => {
    let requestedUrl = '';
    let formKeys: string[] = [];
    const payment = await uploadPaymentProofClient(
      bookingId,
      new File(['proof'], 'proof.png', { type: 'image/png' }),
      {
        fetchFn: async (input, init) => {
          requestedUrl = String(input);
          const formData = init?.body as FormData;
          formKeys = Array.from(formData.keys());
          return jsonResponse(paymentSubmitResponse, 201);
        },
      },
    );

    assert.equal(requestedUrl, buildPaymentProofEndpoint(bookingId));
    assert.deepEqual(formKeys, ['proofFile']);
    assert.equal(payment.amount, 4623000);
  });

  it('rejects invalid file type before making a request', async () => {
    let called = false;
    await assert.rejects(
      () =>
        uploadPaymentProofClient(
          bookingId,
          new File(['proof'], 'proof.txt', { type: 'text/plain' }),
          {
            fetchFn: async () => {
              called = true;
              return jsonResponse({});
            },
          },
        ),
      /Format file tidak didukung/,
    );
    assert.equal(called, false);
  });

  it('maps backend payment errors to customer-safe messages', async () => {
    await assert.rejects(
      () =>
        uploadPaymentProofClient(
          bookingId,
          new File(['proof'], 'proof.png', { type: 'image/png' }),
          {
            fetchFn: async () =>
              jsonResponse(
                { error: { code: 'RESERVATION_EXPIRED', message: 'internal' } },
                409,
              ),
          },
        ),
      /Batas waktu reservasi telah berakhir/,
    );
  });
});
