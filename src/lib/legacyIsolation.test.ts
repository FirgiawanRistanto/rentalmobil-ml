import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { GET as legacyBookingsGet, POST as legacyBookingsPost } from '../app/api/bookings/route';
import { POST as legacyPricingEstimatePost } from '../app/api/pricing/estimate/route';

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('legacy route isolation for Dynamic Pricing v4 flow', () => {
  it('deprecates legacy pricing and raw booking API routes with controlled 410 responses', async () => {
    const pricingResponse = await legacyPricingEstimatePost(
      jsonRequest('http://localhost/api/pricing/estimate', { carId: 'car-1', days: 3 }),
    );
    const pricingBody = await pricingResponse.json();
    const bookingPostResponse = await legacyBookingsPost(
      jsonRequest('http://localhost/api/bookings', { userId: 'user-1', totalPrice: 1 }),
    );
    const bookingPostBody = await bookingPostResponse.json();
    const bookingGetResponse = await legacyBookingsGet(new Request('http://localhost/api/bookings?userId=user-1'));
    const bookingGetBody = await bookingGetResponse.json();

    assert.equal(pricingResponse.status, 410);
    assert.equal(pricingBody.error.code, 'LEGACY_PRICING_ESTIMATE_DEPRECATED');
    assert.equal(bookingPostResponse.status, 410);
    assert.equal(bookingPostBody.error.code, 'LEGACY_BOOKINGS_API_DEPRECATED');
    assert.equal(bookingGetResponse.status, 410);
    assert.equal(bookingGetBody.error.code, 'LEGACY_BOOKINGS_API_DEPRECATED');
  });

  it('keeps normal customer navigation on v4 catalog, quote, booking, and payment routes', () => {
    const homeSource = readFileSync('src/app/page.tsx', 'utf8');
    const dashboardSource = readFileSync('src/app/dashboard/page.tsx', 'utf8');
    const bookingLegacySource = readFileSync('src/app/booking/[slug]/page.tsx', 'utf8');
    const paymentLegacySource = readFileSync('src/app/payment/[bookingId]/page.tsx', 'utf8');
    const quoteFormSource = readFileSync('src/components/pricing/DynamicPricingQuoteForm.tsx', 'utf8');
    const pricingQuoteClientSource = readFileSync('src/services/pricingQuoteClient.ts', 'utf8');
    const pricingQuoteUiSource = readFileSync('src/lib/pricingQuoteUi.ts', 'utf8');
    const bookingConfirmSource = readFileSync('src/components/booking/BookingConfirmationClient.tsx', 'utf8');
    const bookingFromQuoteClientSource = readFileSync('src/services/bookingFromQuoteClient.ts', 'utf8');
    const bookingConfirmationUiSource = readFileSync('src/lib/bookingConfirmationUi.ts', 'utf8');
    const paymentClientSource = readFileSync('src/components/payment/CustomerPaymentClient.tsx', 'utf8');
    const paymentUiSource = readFileSync('src/lib/paymentUi.ts', 'utf8');
    const adminSidebarSource = readFileSync('src/components/admin/AdminSidebar.tsx', 'utf8');

    assert.equal(homeSource.includes('href="/booking/'), false);
    assert.equal(homeSource.includes('buildFeaturedCars'), true);
    assert.equal(homeSource.includes('href={`/katalog/${car.slug}`}'), true);
    assert.equal(dashboardSource.includes('window.location.href = `/payment/'), false);
    assert.equal(bookingLegacySource.includes('redirect(`/katalog/'), true);
    assert.equal(paymentLegacySource.includes('redirect(`/booking/payment/'), true);
    assert.equal(quoteFormSource.includes('/api/pricing/estimate'), false);
    assert.equal(pricingQuoteClientSource.includes('PRICING_QUOTE_ENDPOINT'), true);
    assert.equal(pricingQuoteClientSource.includes('/api/pricing/estimate'), false);
    assert.equal(pricingQuoteUiSource.includes("PRICING_QUOTE_ENDPOINT = '/api/pricing/quotes'"), true);
    assert.equal(bookingConfirmationUiSource.includes("BOOKING_FROM_QUOTE_ENDPOINT = '/api/bookings/from-quote'"), true);
    assert.equal(bookingConfirmSource.includes('createBookingFromQuoteClient'), true);
    assert.equal(bookingFromQuoteClientSource.includes('BOOKING_FROM_QUOTE_ENDPOINT'), true);
    assert.equal(paymentClientSource.includes('uploadPaymentProofClient'), true);
    assert.equal(paymentUiSource.includes("BOOKING_PAYMENT_ROUTE_PREFIX = '/booking/payment'"), true);
    assert.equal(paymentUiSource.includes('payment-proof'), true);
    assert.equal(adminSidebarSource.includes("href: '/admin/payments'"), true);
  });
});
