import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGetAdminPaymentsHandler } from '../app/api/admin/payments/routeHandler';
import { createGetAdminPaymentDetailHandler } from '../app/api/admin/payments/[paymentId]/routeHandler';
import { createGetAdminPaymentProofHandler } from '../app/api/admin/payments/[paymentId]/proof/routeHandler';
import { createPostRejectPaymentHandler } from '../app/api/admin/payments/[paymentId]/reject/routeHandler';
import { createPostVerifyPaymentHandler } from '../app/api/admin/payments/[paymentId]/verify/routeHandler';
import { createGetBookingPaymentHandler } from '../app/api/bookings/[bookingId]/routeHandler';
import { createPostPaymentProofHandler } from '../app/api/bookings/[bookingId]/payment-proof/routeHandler';
import { PaymentServiceError, type SubmitPaymentProofResult } from './paymentService';

const bookingId = '11111111-1111-4111-8111-111111111111';
const paymentId = '22222222-2222-4222-8222-222222222222';
const user = { id: '33333333-3333-4333-8333-333333333333', role: 'CUSTOMER' };
const admin = { id: '44444444-4444-4444-8444-444444444444', role: 'ADMIN' };

const adminPaymentItem = {
  paymentId,
  paymentStatus: 'SUBMITTED' as const,
  paymentMethod: 'BANK_TRANSFER_MANUAL' as const,
  bookingId,
  bookingStatus: 'PENDING' as const,
  amount: 4623000,
  submittedAt: '2026-06-10T10:00:00.000Z',
  reviewExpiresAt: '2026-06-11T10:00:00.000Z',
  canReview: true,
  hasProof: true,
  customer: {
    id: user.id,
    name: 'Customer Name',
    email: 'customer@example.test',
  },
  car: {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Toyota Fortuner',
    category: 'SUV',
  },
  rental: {
    pickupDate: '2026-06-15',
    returnDate: '2026-06-18',
    durationDays: 3,
    tripType: 'LUAR_KOTA' as const,
  },
};

function paymentResult(overrides: Partial<SubmitPaymentProofResult> = {}): SubmitPaymentProofResult {
  return {
    paymentId,
    bookingId,
    paymentMethod: 'BANK_TRANSFER_MANUAL',
    paymentStatus: 'SUBMITTED',
    amount: 4623000,
    submittedAt: '2026-06-10T10:00:00.000Z',
    reviewExpiresAt: '2026-06-11T10:00:00.000Z',
    bookingStatus: 'PENDING',
    reservationExpiresAt: '2026-06-11T10:00:00.000Z',
    nextStep: 'WAITING_ADMIN_VERIFICATION',
    ...overrides,
  };
}

function formRequest(file?: File) {
  const body = new FormData();
  if (file) {
    body.set('proofFile', file);
  }

  return new Request(`http://localhost/api/bookings/${bookingId}/payment-proof`, {
    method: 'POST',
    body,
  });
}

describe('payment proof route handler', () => {
  it('submits multipart proof file for authenticated booking owner', async () => {
    let receivedBookingId = '';
    let receivedUserId = '';
    let receivedFileName = '';
    const handler = createPostPaymentProofHandler({
      getCurrentUser: async () => user,
      service: {
        async submitPaymentProof(input, routeUser) {
          receivedBookingId = input.bookingId;
          receivedUserId = routeUser?.id ?? '';
          receivedFileName = input.proofFile?.name ?? '';
          return paymentResult();
        },
      },
    });

    const response = await handler(
      formRequest(new File(['proof'], 'proof.png', { type: 'image/png' })),
      { params: { bookingId } },
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.paymentStatus, 'SUBMITTED');
    assert.equal(receivedBookingId, bookingId);
    assert.equal(receivedUserId, user.id);
    assert.equal(receivedFileName, 'proof.png');
  });

  it('maps payment upload errors safely', async () => {
    const handler = createPostPaymentProofHandler({
      getCurrentUser: async () => user,
      service: {
        async submitPaymentProof() {
          throw new PaymentServiceError('PAYMENT_PROOF_TOO_LARGE', 'too large');
        },
      },
    });

    const response = await handler(formRequest(), { params: { bookingId } });
    const body = await response.json();

    assert.equal(response.status, 413);
    assert.equal(body.error.code, 'PAYMENT_PROOF_TOO_LARGE');
  });
});

describe('admin payment review route handlers', () => {
  it('verifies a submitted payment through admin route', async () => {
    const handler = createPostVerifyPaymentHandler({
      getCurrentUser: async () => admin,
      service: {
        async verifyPaymentSubmission(routePaymentId, routeUser) {
          assert.equal(routePaymentId, paymentId);
          assert.equal(routeUser?.role, 'ADMIN');
          return {
            paymentId,
            paymentStatus: 'VERIFIED',
            bookingId,
            bookingStatus: 'CONFIRMED',
            reviewedAt: '2026-06-10T10:00:00.000Z',
            reviewedByAdmin: true,
          };
        },
      },
    });

    const response = await handler(new Request('http://localhost'), { params: { paymentId } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.paymentStatus, 'VERIFIED');
    assert.equal(body.bookingStatus, 'CONFIRMED');
  });

  it('requires rejection reason and maps customer authorization failure to 403', async () => {
    const rejectHandler = createPostRejectPaymentHandler({
      getCurrentUser: async () => admin,
      service: {
        async rejectPaymentSubmission() {
          throw new PaymentServiceError('INVALID_PAYMENT_REQUEST', 'reason required');
        },
      },
    });
    const rejectResponse = await rejectHandler(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify({ reason: '' }) }),
      { params: { paymentId } },
    );
    const rejectBody = await rejectResponse.json();

    assert.equal(rejectResponse.status, 400);
    assert.equal(rejectBody.error.code, 'INVALID_PAYMENT_REQUEST');

    const verifyHandler = createPostVerifyPaymentHandler({
      getCurrentUser: async () => user,
      service: {
        async verifyPaymentSubmission() {
          throw new PaymentServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'admin only');
        },
      },
    });
    const verifyResponse = await verifyHandler(new Request('http://localhost'), { params: { paymentId } });
    const verifyBody = await verifyResponse.json();

    assert.equal(verifyResponse.status, 403);
    assert.equal(verifyBody.error.code, 'ADMIN_AUTHORIZATION_REQUIRED');
  });
});

describe('admin payment read/proof route handlers', () => {
  it('lists submitted payment queue for ADMIN without exposing proof storage key', async () => {
    let receivedStatus: string | null = null;
    const handler = createGetAdminPaymentsHandler({
      getCurrentUser: async () => admin,
      service: {
        async listAdminPayments(status, routeUser) {
          receivedStatus = status;
          assert.equal(routeUser?.role, 'ADMIN');
          return { payments: [adminPaymentItem] };
        },
      },
    });

    const response = await handler(new Request('http://localhost/api/admin/payments?status=SUBMITTED'));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(receivedStatus, 'SUBMITTED');
    assert.equal(body.payments[0].paymentStatus, 'SUBMITTED');
    assert.equal(body.payments[0].canReview, true);
    assert.equal(JSON.stringify(body).includes('proofStorageKey'), false);
  });

  it('protects admin list and detail routes from customer sessions', async () => {
    const listHandler = createGetAdminPaymentsHandler({
      getCurrentUser: async () => user,
      service: {
        async listAdminPayments() {
          throw new PaymentServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'admin only');
        },
      },
    });
    const listResponse = await listHandler(new Request('http://localhost/api/admin/payments'));
    const listBody = await listResponse.json();

    assert.equal(listResponse.status, 403);
    assert.equal(listBody.error.code, 'ADMIN_AUTHORIZATION_REQUIRED');

    const detailHandler = createGetAdminPaymentDetailHandler({
      getCurrentUser: async () => null,
      service: {
        async readAdminPaymentDetail() {
          throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'login required');
        },
      },
    });
    const detailResponse = await detailHandler(new Request('http://localhost'), { params: { paymentId } });
    const detailBody = await detailResponse.json();

    assert.equal(detailResponse.status, 401);
    assert.equal(detailBody.error.code, 'AUTHENTICATION_REQUIRED');
  });

  it('returns admin payment detail with snapshot and proof URL only', async () => {
    const handler = createGetAdminPaymentDetailHandler({
      getCurrentUser: async () => admin,
      service: {
        async readAdminPaymentDetail(routePaymentId) {
          assert.equal(routePaymentId, paymentId);
          return {
            ...adminPaymentItem,
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
        },
      },
    });

    const response = await handler(new Request('http://localhost'), { params: { paymentId } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.priceSnapshot.totalInvoiceDisplay, 4623000);
    assert.equal(body.proofUrl, `/api/admin/payments/${paymentId}/proof`);
    assert.equal(JSON.stringify(body).includes('proofStorageKey'), false);
  });

  it('streams protected proof with safe headers for ADMIN', async () => {
    const handler = createGetAdminPaymentProofHandler({
      getCurrentUser: async () => admin,
      service: {
        async getAdminPaymentProof(routePaymentId) {
          assert.equal(routePaymentId, paymentId);
          return {
            paymentId,
            mimeType: 'image/png',
            filename: 'proof.png',
            sizeBytes: 5,
            data: new TextEncoder().encode('proof'),
          };
        },
      },
    });

    const response = await handler(new Request('http://localhost'), { params: { paymentId } });
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/png');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.match(response.headers.get('Content-Disposition') ?? '', /^inline; filename="proof\.png"$/);
    assert.equal(body, 'proof');
  });

  it('maps missing proof to a safe 404 response', async () => {
    const handler = createGetAdminPaymentProofHandler({
      getCurrentUser: async () => admin,
      service: {
        async getAdminPaymentProof() {
          throw new PaymentServiceError('PAYMENT_PROOF_NOT_FOUND', 'missing');
        },
      },
    });

    const response = await handler(new Request('http://localhost/api/admin/payments/x/proof?path=../secret'), {
      params: { paymentId },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'PAYMENT_PROOF_NOT_FOUND');
  });
});

describe('read booking payment route handler', () => {
  it('returns booking payment summary without exposing proof storage path', async () => {
    const handler = createGetBookingPaymentHandler({
      getCurrentUser: async () => user,
      service: {
        async readBookingPayment(routeBookingId, routeUser) {
          assert.equal(routeBookingId, bookingId);
          assert.equal(routeUser?.id, user.id);
          return {
            bookingId,
            bookingStatus: 'PENDING',
            reservationExpiresAt: '2026-06-11T10:00:00.000Z',
            rental: {
              pickupDate: '2026-06-15',
              returnDate: '2026-06-18',
              tripType: 'LUAR_KOTA',
            },
            pricing: {
              dynamicPriceDisplayPerDay: 1541000,
              totalInvoiceDisplay: 4623000,
              modelVersion: 'rf_adjustment_v4_final',
            },
            payment: {
              paymentId,
              method: 'BANK_TRANSFER_MANUAL',
              status: 'SUBMITTED',
              amount: 4623000,
              submittedAt: '2026-06-10T10:00:00.000Z',
              reviewExpiresAt: '2026-06-11T10:00:00.000Z',
              reviewedAt: null,
              rejectionReason: null,
            },
          };
        },
      },
    });

    const response = await handler(new Request('http://localhost'), { params: { bookingId } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.payment.status, 'SUBMITTED');
    assert.equal(JSON.stringify(body).includes('proofStorageKey'), false);
  });
});
