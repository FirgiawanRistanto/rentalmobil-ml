import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPostBookingFromQuoteHandler } from '../app/api/bookings/from-quote/routeHandler';
import { BookingFromQuoteError, type BookingFromQuoteResult } from './bookingFromQuoteService';

const quoteId = '11111111-1111-4111-8111-111111111111';

const bookingResult: BookingFromQuoteResult = {
  bookingId: 'booking-1',
  status: 'PENDING',
  quoteId,
  quoteStatus: 'ACCEPTED',
  carUnitAllocated: true,
  rental: {
    pickupDate: '2026-06-15',
    returnDate: '2026-06-18',
    durationDays: 3,
    tripType: 'LUAR_KOTA',
  },
  pricing: {
    modelVersion: 'rf_adjustment_v4_final',
    basePricePerDay: 1500000,
    predictedPriceAdjustmentPct: 0.02757,
    dynamicPriceDisplayPerDay: 1541000,
    totalInvoiceDisplay: 4623000,
  },
  nextStep: 'PAYMENT_PENDING',
};

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/bookings/from-quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('booking from quote route handler', () => {
  it('returns booking contract for authenticated quote acceptance', async () => {
    let receivedInput: unknown;
    let receivedUserId: string | null | undefined;
    const handler = createPostBookingFromQuoteHandler({
      getCurrentUser: async () => ({ id: '44444444-4444-4444-8444-444444444444' }),
      service: {
        async createBookingFromQuote(input, user) {
          receivedInput = input;
          receivedUserId = user?.id ?? null;
          return bookingResult;
        },
      },
    });

    const response = await handler(jsonRequest({ quoteId, phoneNumber: '081234567890' }));
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(body, bookingResult);
    assert.deepEqual(receivedInput, { quoteId, phoneNumber: '081234567890' });
    assert.equal(receivedUserId, '44444444-4444-4444-8444-444444444444');
    assert.equal(body.status, 'PENDING');
    assert.equal(body.quoteStatus, 'ACCEPTED');
    assert.equal(body.nextStep, 'PAYMENT_PENDING');
  });

  it('maps anonymous requests to HTTP 401', async () => {
    const handler = createPostBookingFromQuoteHandler({
      getCurrentUser: async () => null,
      service: {
        async createBookingFromQuote() {
          throw new BookingFromQuoteError('AUTHENTICATION_REQUIRED', 'Login diperlukan untuk membuat booking.');
        },
      },
    });

    const response = await handler(jsonRequest({ quoteId }));
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'AUTHENTICATION_REQUIRED');
  });

  it('maps quote ownership errors to HTTP 403', async () => {
    const handler = createPostBookingFromQuoteHandler({
      getCurrentUser: async () => ({ id: '44444444-4444-4444-8444-444444444444' }),
      service: {
        async createBookingFromQuote() {
          throw new BookingFromQuoteError('QUOTE_NOT_OWNED_BY_USER', 'Pricing quote bukan milik user ini.');
        },
      },
    });

    const response = await handler(jsonRequest({ quoteId }));
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error.code, 'QUOTE_NOT_OWNED_BY_USER');
  });

  it('maps quote not found to HTTP 404', async () => {
    const handler = createPostBookingFromQuoteHandler({
      getCurrentUser: async () => ({ id: '44444444-4444-4444-8444-444444444444' }),
      service: {
        async createBookingFromQuote() {
          throw new BookingFromQuoteError('QUOTE_NOT_FOUND', 'Pricing quote tidak ditemukan.');
        },
      },
    });

    const response = await handler(jsonRequest({ quoteId }));
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'QUOTE_NOT_FOUND');
  });

  it('maps inactive, expired, unavailable, reprice, and allocation errors to HTTP 409', async () => {
    for (const code of [
      'QUOTE_EXPIRED',
      'QUOTE_NOT_ACTIVE',
      'SELECTED_CAR_UNAVAILABLE',
      'QUOTE_REPRICE_REQUIRED',
      'CAR_UNIT_ALLOCATION_FAILED',
    ] as const) {
      const handler = createPostBookingFromQuoteHandler({
        getCurrentUser: async () => ({ id: '44444444-4444-4444-8444-444444444444' }),
        service: {
          async createBookingFromQuote() {
            throw new BookingFromQuoteError(code, code);
          },
        },
      });

      const response = await handler(jsonRequest({ quoteId }));
      const body = await response.json();

      assert.equal(response.status, 409);
      assert.equal(body.error.code, code);
    }
  });

  it('rejects invalid JSON as an invalid booking request', async () => {
    const handler = createPostBookingFromQuoteHandler({
      getCurrentUser: async () => ({ id: '44444444-4444-4444-8444-444444444444' }),
    });

    const response = await handler(new Request('http://localhost/api/bookings/from-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    }));
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_BOOKING_REQUEST');
  });

  it('maps unexpected creation failures to HTTP 500', async () => {
    const handler = createPostBookingFromQuoteHandler({
      getCurrentUser: async () => ({ id: '44444444-4444-4444-8444-444444444444' }),
      service: {
        async createBookingFromQuote() {
          throw new BookingFromQuoteError('BOOKING_CREATION_FAILED', 'Gagal membuat booking dari pricing quote.');
        },
      },
    });

    const response = await handler(jsonRequest({ quoteId }));
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.error.code, 'BOOKING_CREATION_FAILED');
  });
});
