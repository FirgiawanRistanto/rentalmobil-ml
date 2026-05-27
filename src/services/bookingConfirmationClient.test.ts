import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  BOOKING_FROM_QUOTE_ENDPOINT,
  buildBookingConfirmPath,
  buildQuoteReadEndpoint,
  getBookingFromQuoteErrorMessage,
  isBookingReservationExpired,
  validateBookingConfirmationForm,
} from '../lib/bookingConfirmationUi';
import { createBookingFromQuoteClient } from './bookingFromQuoteClient';
import { readPricingQuoteForBooking } from './pricingQuoteReadClient';

const quoteId = '11111111-1111-4111-8111-111111111111';

const quoteResponse = {
  quoteId,
  quoteStatus: 'ACTIVE',
  canSubmit: true,
  expiresAt: '2026-06-10T10:15:00.000Z',
  car: {
    id: 'car-1',
    name: 'Toyota Fortuner',
    category: 'SUV',
    basePricePerDay: 1500000,
  },
  rental: {
    pickupDate: '2026-06-15',
    returnDate: '2026-06-18',
    durationDays: 3,
    tripType: 'LUAR_KOTA',
  },
  pricingContext: {
    availabilityRatio: 1,
    utilizationRate: 0,
    demandLevel: 'sepi',
    isWeekend: 0,
    isHoliday: 0,
    isPeakSeason: 1,
    bookingLeadDays: 20,
  },
  pricing: {
    modelVersion: 'rf_adjustment_v4_final',
    predictedPriceAdjustmentPct: 0.02757,
    predictedPriceAdjustmentPercentDisplay: 2.76,
    dynamicPriceRawPerDay: 1541354,
    dynamicPriceDisplayPerDay: 1541000,
    totalInvoiceDisplay: 4623000,
  },
  pricingReasons: ['Ketersediaan armada pada kategori ini masih tinggi.'],
};

const bookingResponse = {
  bookingId: 'booking-1',
  status: 'PENDING',
  quoteId,
  quoteStatus: 'ACCEPTED',
  carUnitAllocated: true,
  reservationExpiresAt: '2026-06-10T10:30:00.000Z',
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

describe('booking confirmation UI/client helpers', () => {
  it('builds internal quote confirmation paths and read endpoints', () => {
    assert.equal(buildBookingConfirmPath(quoteId), `/booking/confirm?quoteId=${quoteId}`);
    assert.equal(buildQuoteReadEndpoint(quoteId), `/api/pricing/quotes/${quoteId}`);
  });

  it('validates required phone number and pickup address before submit', () => {
    assert.deepEqual(
      validateBookingConfirmationForm({
        quoteId,
        phoneNumber: ' 081234567890 ',
        pickupAddress: ' Bandar Lampung ',
        notes: ' Catatan ',
      }),
      {
        quoteId,
        phoneNumber: '081234567890',
        pickupAddress: 'Bandar Lampung',
        notes: 'Catatan',
      },
    );

    assert.throws(
      () => validateBookingConfirmationForm({ quoteId, phoneNumber: '', pickupAddress: 'Lampung' }),
      /Nomor HP wajib diisi/,
    );
    assert.throws(
      () => validateBookingConfirmationForm({ quoteId, phoneNumber: '0812', pickupAddress: '   ' }),
      /Alamat penjemputan wajib diisi/,
    );
  });

  it('reads quote details from the new read endpoint', async () => {
    let requestedUrl = '';
    const quote = await readPricingQuoteForBooking(quoteId, {
      fetchFn: async (input) => {
        requestedUrl = String(input);
        return Response.json(quoteResponse);
      },
    });

    assert.equal(requestedUrl, `/api/pricing/quotes/${quoteId}`);
    assert.equal(quote.canSubmit, true);
    assert.equal(quote.car.name, 'Toyota Fortuner');
  });

  it('submits only quoteId, phoneNumber, pickupAddress, and notes to booking endpoint', async () => {
    let requestedUrl = '';
    let body: Record<string, unknown> = {};
    const booking = await createBookingFromQuoteClient(
      {
        quoteId,
        phoneNumber: '081234567890',
        pickupAddress: 'Bandar Lampung',
        notes: 'Jemput di lobi',
      },
      {
        fetchFn: async (input, init) => {
          requestedUrl = String(input);
          body = JSON.parse(String(init?.body));
          return Response.json(bookingResponse, { status: 201 });
        },
      },
    );

    assert.equal(requestedUrl, BOOKING_FROM_QUOTE_ENDPOINT);
    assert.deepEqual(Object.keys(body), ['quoteId', 'phoneNumber', 'pickupAddress', 'notes']);
    assert.equal(body.quoteId, quoteId);
    assert.equal(booking.status, 'PENDING');
  });

  it('maps expired and reprice booking errors to customer-friendly text', () => {
    assert.equal(
      getBookingFromQuoteErrorMessage('QUOTE_EXPIRED'),
      'Estimasi harga telah kedaluwarsa. Silakan hitung ulang harga.',
    );
    assert.equal(
      getBookingFromQuoteErrorMessage('QUOTE_REPRICE_REQUIRED'),
      'Ketersediaan atau kondisi harga telah berubah. Silakan hitung ulang harga.',
    );
  });

  it('detects pending reservation expiry as display-only state', () => {
    assert.equal(
      isBookingReservationExpired('2026-06-10T10:30:00.000Z', new Date('2026-06-10T10:31:00.000Z')),
      true,
    );
    assert.equal(
      isBookingReservationExpired('2026-06-10T10:30:00.000Z', new Date('2026-06-10T10:29:00.000Z')),
      false,
    );
  });

  it('keeps the v4 confirmation flow away from legacy payment and booking pages', () => {
    const invoiceSource = readFileSync('src/components/pricing/InvoicePreview.tsx', 'utf8');
    const confirmSource = readFileSync('src/components/booking/BookingConfirmationClient.tsx', 'utf8');

    assert.equal(invoiceSource.includes('/api/pricing/estimate'), false);
    assert.equal(confirmSource.includes('/api/pricing/estimate'), false);
    assert.equal(confirmSource.includes('/payment/'), false);
    assert.equal(confirmSource.includes('BOOKING_FROM_QUOTE_ENDPOINT'), false);
  });
});
