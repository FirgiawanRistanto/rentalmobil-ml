import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_PAYMENT_PROOF_SIZE_BYTES,
  PAYMENT_REVIEW_EXPIRY_HOURS,
  PaymentServiceError,
  getAdminPaymentProof,
  listAdminPayments,
  readAdminPaymentDetail,
  rejectPaymentSubmission,
  submitPaymentProof,
  verifyPaymentSubmission,
  type PaymentProofStorage,
  type PaymentRepository,
  type PaymentTransactionRepository,
} from './paymentService';

const bookingId = '11111111-1111-4111-8111-111111111111';
const paymentId = '22222222-2222-4222-8222-222222222222';
const user = { id: '33333333-3333-4333-8333-333333333333', role: 'CUSTOMER' };
const otherUser = { id: '44444444-4444-4444-8444-444444444444', role: 'CUSTOMER' };
const admin = { id: '55555555-5555-4555-8555-555555555555', role: 'ADMIN' };
const now = new Date('2026-06-10T10:00:00.000Z');

function paymentProof(overrides: Partial<{ type: string; size: number; name: string }> = {}) {
  const size = overrides.size ?? 128;

  return {
    name: overrides.name ?? 'proof.png',
    type: overrides.type ?? 'image/png',
    size,
    async arrayBuffer() {
      return new Uint8Array(size).buffer;
    },
  };
}

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: bookingId,
    userId: user.id,
    status: 'PENDING',
    reservationExpiresAt: new Date('2026-06-10T10:30:00.000Z'),
    snapshotTotalInvoiceDisplay: 4623000,
    ...overrides,
  };
}

function reviewPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: paymentId,
    bookingId,
    status: 'SUBMITTED',
    amount: 4623000,
    reviewExpiresAt: new Date('2026-06-11T10:00:00.000Z'),
    bookingStatus: 'PENDING',
    bookingReservationExpiresAt: new Date('2026-06-11T10:00:00.000Z'),
    snapshotTotalInvoiceDisplay: 4623000,
    ...overrides,
  };
}

function fakeStorage(overrides: Partial<PaymentProofStorage> = {}) {
  const savedKeys: string[] = [];
  const deletedKeys: string[] = [];

  return {
    savedKeys,
    deletedKeys,
    storage: {
      async save(file) {
        const storageKey = `stored-${file.name ?? 'proof'}`;
        savedKeys.push(storageKey);
        return {
          storageKey,
          originalName: file.name ?? null,
          mimeType: file.type ?? 'image/png',
          sizeBytes: file.size ?? 0,
        };
      },
      async delete(storageKey) {
        deletedKeys.push(storageKey);
      },
      async read(storageKey) {
        return new TextEncoder().encode(storageKey);
      },
      ...overrides,
    } satisfies PaymentProofStorage,
  };
}

function fakeRepository(options: {
  booking?: Record<string, unknown> | null;
  existingPayment?: Record<string, unknown> | null;
  reviewPayment?: Record<string, unknown> | null;
  adminListRows?: unknown[];
  adminDetailRow?: unknown | null;
  proofMetadata?: unknown | null;
  insertPaymentThrows?: boolean;
} = {}) {
  const state = {
    insertedPaymentAmount: null as number | null,
    extendedReservation: null as Date | null,
    verified: false,
    rejectedReason: null as string | null,
    expired: false,
  };

  const repository = {
    async transaction<T>(callback: (tx: PaymentTransactionRepository) => Promise<T>): Promise<T> {
      const transactionRepository: PaymentTransactionRepository = {
        async lockBookingForPayment() {
          return (options.booking === null
            ? null
            : booking(options.booking)) as Awaited<ReturnType<PaymentTransactionRepository['lockBookingForPayment']>>;
        },
        async findPaymentByBookingId() {
          return options.existingPayment ? { id: paymentId, status: 'SUBMITTED', ...options.existingPayment } : null;
        },
        async insertPayment(input) {
          if (options.insertPaymentThrows) {
            throw new Error('db failed');
          }
          state.insertedPaymentAmount = input.amount;
          return { id: paymentId, status: 'SUBMITTED' };
        },
        async extendBookingReservation(_bookingId, reservationExpiresAt) {
          state.extendedReservation = reservationExpiresAt;
        },
        async lockPaymentForReview() {
          return (options.reviewPayment === null
            ? null
            : reviewPayment(options.reviewPayment)) as Awaited<ReturnType<PaymentTransactionRepository['lockPaymentForReview']>>;
        },
        async markPaymentExpiredAndCancelBooking() {
          state.expired = true;
        },
        async verifyPayment() {
          state.verified = true;
        },
        async rejectPayment(_paymentId, _bookingId, _adminUserId, reason) {
          state.rejectedReason = reason;
        },
      };

      return callback(transactionRepository);
    },
    async findBookingPaymentSummary() {
      return null;
    },
    async expireSubmittedPayments() {
      state.expired = true;
    },
    async listAdminPayments() {
      return (options.adminListRows ?? []) as never;
    },
    async findAdminPaymentDetail() {
      return (options.adminDetailRow === undefined ? null : options.adminDetailRow) as never;
    },
    async findPaymentProofMetadata() {
      return (options.proofMetadata === undefined ? null : options.proofMetadata) as never;
    },
  } satisfies PaymentRepository;

  return { repository, state };
}

function adminPaymentListRow(overrides: Record<string, unknown> = {}) {
  return {
    paymentId,
    paymentStatus: 'SUBMITTED',
    method: 'BANK_TRANSFER_MANUAL',
    amount: 4623000,
    submittedAt: new Date('2026-06-10T10:00:00.000Z'),
    reviewExpiresAt: new Date('2026-06-11T10:00:00.000Z'),
    reviewedAt: null,
    rejectionReason: null,
    proofStorageKey: 'proof-key.png',
    bookingId,
    bookingStatus: 'PENDING',
    reservationExpiresAt: new Date('2026-06-11T10:00:00.000Z'),
    startDate: new Date('2026-06-15T00:00:00.000Z'),
    endDate: new Date('2026-06-18T00:00:00.000Z'),
    tripType: 'LUAR_KOTA',
    customerId: user.id,
    customerName: 'Customer Name',
    customerEmail: 'customer@example.test',
    carId: '66666666-6666-4666-8666-666666666666',
    carBrand: 'Toyota',
    carModel: 'Fortuner',
    carCategory: 'SUV',
    ...overrides,
  };
}

function adminPaymentDetailRow(overrides: Record<string, unknown> = {}) {
  return {
    ...adminPaymentListRow(),
    basePricePerDay: 1500000,
    predictedPriceAdjustmentPct: '0.027570',
    dynamicPriceDisplayPerDay: 1541000,
    totalInvoiceDisplay: 4623000,
    modelVersion: 'rf_adjustment_v4_final',
    pricingReasons: ['Ketersediaan armada pada kategori ini masih tinggi.'],
    ...overrides,
  };
}

describe('submitPaymentProof', () => {
  it('creates SUBMITTED payment from snapshot amount and extends reservation by 24 hours', async () => {
    const { repository, state } = fakeRepository();
    const { storage } = fakeStorage();

    const result = await submitPaymentProof(
      { bookingId, proofFile: paymentProof() },
      user,
      { repository, storage, now: () => now },
    );

    assert.equal(result.paymentStatus, 'SUBMITTED');
    assert.equal(result.amount, 4623000);
    assert.equal(result.bookingStatus, 'PENDING');
    assert.equal(result.nextStep, 'WAITING_ADMIN_VERIFICATION');
    assert.equal(state.insertedPaymentAmount, 4623000);
    assert.equal(
      state.extendedReservation?.toISOString(),
      new Date(now.getTime() + PAYMENT_REVIEW_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
    );
  });

  it('rejects anonymous, wrong owner, expired booking, duplicate payment, and missing snapshot', async () => {
    const { repository } = fakeRepository();
    await assert.rejects(
      () => submitPaymentProof({ bookingId, proofFile: paymentProof() }, null, { repository, now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'AUTHENTICATION_REQUIRED',
    );

    await assert.rejects(
      () =>
        submitPaymentProof(
          { bookingId, proofFile: paymentProof() },
          user,
          { repository: fakeRepository({ booking: { userId: otherUser.id } }).repository, now: () => now },
        ),
      (error) => error instanceof PaymentServiceError && error.code === 'BOOKING_NOT_OWNED_BY_USER',
    );

    await assert.rejects(
      () =>
        submitPaymentProof(
          { bookingId, proofFile: paymentProof() },
          user,
          { repository: fakeRepository({ booking: { reservationExpiresAt: new Date('2026-06-10T09:59:00.000Z') } }).repository, now: () => now },
        ),
      (error) => error instanceof PaymentServiceError && error.code === 'RESERVATION_EXPIRED',
    );

    await assert.rejects(
      () =>
        submitPaymentProof(
          { bookingId, proofFile: paymentProof() },
          user,
          { repository: fakeRepository({ existingPayment: { id: paymentId } }).repository, now: () => now },
        ),
      (error) => error instanceof PaymentServiceError && error.code === 'PAYMENT_ALREADY_SUBMITTED',
    );

    await assert.rejects(
      () =>
        submitPaymentProof(
          { bookingId, proofFile: paymentProof() },
          user,
          { repository: fakeRepository({ booking: { snapshotTotalInvoiceDisplay: null } }).repository, now: () => now },
        ),
      (error) => error instanceof PaymentServiceError && error.code === 'BOOKING_PRICE_SNAPSHOT_NOT_FOUND',
    );
  });

  it('validates proof file type and size before storage', async () => {
    const { repository } = fakeRepository();
    await assert.rejects(
      () => submitPaymentProof({ bookingId, proofFile: null }, user, { repository, now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'PAYMENT_PROOF_REQUIRED',
    );
    await assert.rejects(
      () => submitPaymentProof({ bookingId, proofFile: paymentProof({ type: 'text/plain' }) }, user, { repository, now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'INVALID_PAYMENT_PROOF_TYPE',
    );
    await assert.rejects(
      () => submitPaymentProof({ bookingId, proofFile: paymentProof({ size: MAX_PAYMENT_PROOF_SIZE_BYTES + 1 }) }, user, { repository, now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'PAYMENT_PROOF_TOO_LARGE',
    );
  });

  it('cleans up stored proof when database insert fails', async () => {
    const { repository } = fakeRepository({ insertPaymentThrows: true });
    const storage = fakeStorage();

    await assert.rejects(
      () => submitPaymentProof({ bookingId, proofFile: paymentProof() }, user, { repository, storage: storage.storage, now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'PAYMENT_SUBMISSION_FAILED',
    );

    assert.deepEqual(storage.savedKeys, ['stored-proof.png']);
    assert.deepEqual(storage.deletedKeys, ['stored-proof.png']);
  });
});

describe('admin payment review', () => {
  it('allows ADMIN to verify submitted payment and confirm booking', async () => {
    const { repository, state } = fakeRepository();
    const result = await verifyPaymentSubmission(paymentId, admin, { repository, now: () => now });

    assert.equal(result.paymentStatus, 'VERIFIED');
    assert.equal(result.bookingStatus, 'CONFIRMED');
    assert.equal(state.verified, true);
  });

  it('rejects customer review, amount mismatch, and expired review windows', async () => {
    await assert.rejects(
      () => verifyPaymentSubmission(paymentId, user, { repository: fakeRepository().repository, now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'ADMIN_AUTHORIZATION_REQUIRED',
    );

    await assert.rejects(
      () =>
        verifyPaymentSubmission(
          paymentId,
          admin,
          { repository: fakeRepository({ reviewPayment: { amount: 1 } }).repository, now: () => now },
        ),
      (error) => error instanceof PaymentServiceError && error.code === 'PAYMENT_AMOUNT_MISMATCH',
    );

    const expired = fakeRepository({
      reviewPayment: { reviewExpiresAt: new Date('2026-06-10T09:00:00.000Z') },
    });
    await assert.rejects(
      () => verifyPaymentSubmission(paymentId, admin, { repository: expired.repository, now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'PAYMENT_REVIEW_EXPIRED',
    );
    assert.equal(expired.state.expired, true);

    await assert.rejects(
      () =>
        verifyPaymentSubmission(
          paymentId,
          admin,
          { repository: fakeRepository({ reviewPayment: { status: 'EXPIRED' } }).repository, now: () => now },
        ),
      (error) => error instanceof PaymentServiceError && error.code === 'PAYMENT_REVIEW_EXPIRED',
    );
  });

  it('requires rejection reason and cancels booking when rejected', async () => {
    await assert.rejects(
      () => rejectPaymentSubmission(paymentId, '   ', admin, { repository: fakeRepository().repository, now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'INVALID_PAYMENT_REQUEST',
    );

    const { repository, state } = fakeRepository();
    const result = await rejectPaymentSubmission(paymentId, 'Bukti pembayaran tidak valid', admin, {
      repository,
      now: () => now,
    });

    assert.equal(result.paymentStatus, 'REJECTED');
    assert.equal(result.bookingStatus, 'CANCELLED');
    assert.equal(state.rejectedReason, 'Bukti pembayaran tidak valid');
  });
});

describe('admin payment queue/detail/proof', () => {
  it('lists submitted payments for ADMIN with reviewability and no proof storage path', async () => {
    const { repository, state } = fakeRepository({
      adminListRows: [adminPaymentListRow()],
    });

    const result = await listAdminPayments('SUBMITTED', admin, { repository, now: () => now });

    assert.equal(state.expired, true);
    assert.equal(result.payments.length, 1);
    assert.equal(result.payments[0].paymentStatus, 'SUBMITTED');
    assert.equal(result.payments[0].canReview, true);
    assert.equal(result.payments[0].hasProof, true);
    assert.equal(result.payments[0].customer.email, 'customer@example.test');
    assert.equal(result.payments[0].car.name, 'Toyota Fortuner');
    assert.equal(result.payments[0].rental.durationDays, 3);
    assert.equal(JSON.stringify(result).includes('proofStorageKey'), false);
  });

  it('rejects non-admin list access and invalid status filters', async () => {
    const { repository } = fakeRepository();

    await assert.rejects(
      () => listAdminPayments('SUBMITTED', user, { repository, now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'ADMIN_AUTHORIZATION_REQUIRED',
    );
    await assert.rejects(
      () => listAdminPayments('UNKNOWN', admin, { repository, now: () => now }),
      (error) => error instanceof PaymentServiceError && error.code === 'INVALID_PAYMENT_REQUEST',
    );
  });

  it('returns payment detail with snapshot and protected proof URL', async () => {
    const { repository } = fakeRepository({
      adminDetailRow: adminPaymentDetailRow(),
    });

    const result = await readAdminPaymentDetail(paymentId, admin, { repository, now: () => now });

    assert.equal(result.paymentId, paymentId);
    assert.equal(result.priceSnapshot.basePricePerDay, 1500000);
    assert.equal(result.priceSnapshot.predictedPriceAdjustmentPct, 0.02757);
    assert.equal(result.priceSnapshot.totalInvoiceDisplay, 4623000);
    assert.equal(result.proofAvailable, true);
    assert.equal(result.proofUrl, `/api/admin/payments/${paymentId}/proof`);
    assert.equal(JSON.stringify(result).includes('proofStorageKey'), false);
  });

  it('shows expired submitted payments as not reviewable after lazy expiry', async () => {
    const { repository, state } = fakeRepository({
      adminDetailRow: adminPaymentDetailRow({
        paymentStatus: 'EXPIRED',
        bookingStatus: 'CANCELLED',
        reviewExpiresAt: new Date('2026-06-10T09:00:00.000Z'),
        reservationExpiresAt: new Date('2026-06-10T09:00:00.000Z'),
      }),
    });

    const result = await readAdminPaymentDetail(paymentId, admin, { repository, now: () => now });

    assert.equal(state.expired, true);
    assert.equal(result.paymentStatus, 'EXPIRED');
    assert.equal(result.bookingStatus, 'CANCELLED');
    assert.equal(result.canReview, false);
    assert.equal(result.priceSnapshot.totalInvoiceDisplay, 4623000);
  });

  it('reads proof through storage metadata and maps missing proof safely', async () => {
    const storage = fakeStorage({
      async read(storageKey) {
        return new TextEncoder().encode(`read:${storageKey}`);
      },
    });
    const { repository } = fakeRepository({
      proofMetadata: {
        id: paymentId,
        status: 'SUBMITTED',
        proofStorageKey: 'proof-key.png',
        proofOriginalName: '../../transfer.png',
        proofMimeType: 'image/png',
        proofSizeBytes: 11,
      },
    });

    const result = await getAdminPaymentProof(paymentId, admin, {
      repository,
      storage: storage.storage,
    });

    assert.equal(result.mimeType, 'image/png');
    assert.equal(result.filename.includes('/'), false);
    assert.equal(new TextDecoder().decode(result.data), 'read:proof-key.png');

    await assert.rejects(
      () =>
        getAdminPaymentProof(paymentId, admin, {
          repository,
          storage: { ...storage.storage, read: undefined },
        }),
      (error) => error instanceof PaymentServiceError && error.code === 'PAYMENT_PROOF_NOT_FOUND',
    );
  });
});
