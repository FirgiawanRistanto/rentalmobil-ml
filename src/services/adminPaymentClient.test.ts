import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildAdminPaymentDetailEndpoint,
  buildAdminPaymentListEndpoint,
  buildAdminPaymentRejectEndpoint,
  buildAdminPaymentVerifyEndpoint,
} from '../lib/paymentUi';
import {
  listAdminPaymentsClient,
  readAdminPaymentDetailClient,
  rejectAdminPaymentClient,
  verifyAdminPaymentClient,
} from './adminPaymentClient';

const bookingId = '11111111-1111-4111-8111-111111111111';
const paymentId = '22222222-2222-4222-8222-222222222222';

const queueItem = {
  paymentId,
  paymentStatus: 'SUBMITTED',
  paymentMethod: 'BANK_TRANSFER_MANUAL',
  bookingId,
  bookingStatus: 'PENDING',
  amount: 4623000,
  submittedAt: '2026-06-10T10:00:00.000Z',
  reviewExpiresAt: '2026-06-11T10:00:00.000Z',
  canReview: true,
  hasProof: true,
  customer: {
    id: 'user-1',
    name: 'Customer Name',
    email: 'customer@example.test',
  },
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
};

const detailResponse = {
  ...queueItem,
  reviewedAt: null,
  rejectionReason: null,
  reservationExpiresAt: '2026-06-11T10:00:00.000Z',
  priceSnapshot: {
    basePricePerDay: 1500000,
    predictedPriceAdjustmentPct: 0.02757,
    dynamicPriceDisplayPerDay: 1541000,
    totalInvoiceDisplay: 4623000,
    modelVersion: 'rf_adjustment_v4_final',
    pricingReasons: ['Ketersediaan armada pada kategori ini masih tinggi.'],
  },
  proofAvailable: true,
  proofUrl: `/api/admin/payments/${paymentId}/proof`,
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe('admin payment browser client', () => {
  it('lists admin payment queue without requesting proof files', async () => {
    const requestedUrls: string[] = [];
    const result = await listAdminPaymentsClient('SUBMITTED', {
      fetchFn: async (input) => {
        requestedUrls.push(String(input));
        return jsonResponse({ payments: [queueItem] });
      },
    });

    assert.deepEqual(requestedUrls, [buildAdminPaymentListEndpoint('SUBMITTED')]);
    assert.equal(result.payments[0].paymentStatus, 'SUBMITTED');
    assert.equal(requestedUrls.some((url) => url.includes('/proof')), false);
  });

  it('reads admin detail with protected proof URL and no storage key', async () => {
    let requestedUrl = '';
    const detail = await readAdminPaymentDetailClient(paymentId, {
      fetchFn: async (input) => {
        requestedUrl = String(input);
        return jsonResponse(detailResponse);
      },
    });

    assert.equal(requestedUrl, buildAdminPaymentDetailEndpoint(paymentId));
    assert.equal(detail.proofUrl, `/api/admin/payments/${paymentId}/proof`);
    assert.equal(JSON.stringify(detail).includes('proofStorageKey'), false);
  });

  it('verifies and rejects through admin v4 endpoints', async () => {
    const requested: Array<{ url: string; body?: unknown }> = [];
    const verified = await verifyAdminPaymentClient(paymentId, {
      fetchFn: async (input) => {
        requested.push({ url: String(input) });
        return jsonResponse({
          paymentId,
          paymentStatus: 'VERIFIED',
          bookingId,
          bookingStatus: 'CONFIRMED',
          reviewedAt: '2026-06-10T10:00:00.000Z',
          reviewedByAdmin: true,
        });
      },
    });
    const rejected = await rejectAdminPaymentClient(paymentId, ' Bukti tidak valid ', {
      fetchFn: async (input, init) => {
        requested.push({ url: String(input), body: JSON.parse(String(init?.body)) });
        return jsonResponse({
          paymentId,
          paymentStatus: 'REJECTED',
          bookingId,
          bookingStatus: 'CANCELLED',
          reviewedAt: '2026-06-10T10:00:00.000Z',
          reviewedByAdmin: true,
        });
      },
    });

    assert.equal(requested[0].url, buildAdminPaymentVerifyEndpoint(paymentId));
    assert.equal(requested[1].url, buildAdminPaymentRejectEndpoint(paymentId));
    assert.deepEqual(requested[1].body, { reason: 'Bukti tidak valid' });
    assert.equal(verified.bookingStatus, 'CONFIRMED');
    assert.equal(rejected.bookingStatus, 'CANCELLED');
  });

  it('requires rejection reason before calling the reject endpoint', async () => {
    let called = false;
    await assert.rejects(
      () =>
        rejectAdminPaymentClient(paymentId, '   ', {
          fetchFn: async () => {
            called = true;
            return jsonResponse({});
          },
        }),
      /Alasan penolakan wajib diisi/,
    );
    assert.equal(called, false);
  });

  it('keeps admin UI away from legacy payment demo and FastAPI', () => {
    const queueSource = readFileSync('src/components/admin/AdminPaymentQueueClient.tsx', 'utf8');
    const detailSource = readFileSync('src/components/admin/AdminPaymentDetailClient.tsx', 'utf8');

    assert.equal(queueSource.includes('/payment/'), false);
    assert.equal(detailSource.includes('/payment/'), false);
    assert.equal(detailSource.includes('/v1/predict-price'), false);
    assert.equal(detailSource.includes('ML_SERVICE_BASE_URL'), false);
  });
});
