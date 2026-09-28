import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPostPricingQuoteHandler } from '../app/api/pricing/quotes/routeHandler';
import type { PricingQuoteResult } from '../services/pricingQuoteService';
import {
  buildLoginRedirect,
  getAdminAccessDecision,
  getDashboardAccessDecision,
} from './auth-guard-rules';

describe('auth route guard rules', () => {
  it('redirects anonymous dashboard access to login with callback', () => {
    assert.deepEqual(getDashboardAccessDecision(null), {
      allowed: false,
      redirectTo: '/login?callbackURL=%2Fdashboard',
    });
  });

  it('allows dashboard access for customer and admin sessions', () => {
    assert.deepEqual(
      getDashboardAccessDecision({ user: { id: 'customer-1', role: 'CUSTOMER' } }),
      { allowed: true },
    );
    assert.deepEqual(
      getDashboardAccessDecision({ user: { id: 'admin-1', role: 'ADMIN' } }),
      { allowed: true },
    );
  });

  it('protects admin routes by session and ADMIN role', () => {
    assert.deepEqual(getAdminAccessDecision(null), {
      allowed: false,
      redirectTo: '/login?callbackURL=%2Fadmin',
    });
    assert.deepEqual(
      getAdminAccessDecision({ user: { id: 'customer-1', role: 'CUSTOMER' } }),
      {
        allowed: false,
        redirectTo: '/dashboard',
      },
    );
    assert.deepEqual(
      getAdminAccessDecision({ user: { id: 'admin-1', role: 'ADMIN' } }),
      { allowed: true },
    );
  });

  it('builds internal login callback redirects', () => {
    assert.equal(buildLoginRedirect('/admin'), '/login?callbackURL=%2Fadmin');
  });

  it('keeps pricing quotes public and detached from session in this phase', async () => {
    const quoteResult: PricingQuoteResult = {
      quoteId: 'quote-6b-public',
      quoteStatus: 'ACTIVE',
      expiresAt: '2026-06-10T10:15:00.000Z',
      car: {
        id: 'car-suv-1',
        category: 'SUV',
        basePricePerDay: 800000,
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
        dynamicPriceRawPerDay: 1541355,
        dynamicPriceDisplayPerDay: 1541000,
        totalInvoiceDisplay: 4623000,
      },
      pricingReasons: [
        'Ketersediaan armada pada kategori ini masih tinggi.',
        'Periode sewa termasuk musim ramai.',
      ],
    };
    let receivedUserId: string | null | undefined = undefined;
    const handler = createPostPricingQuoteHandler({
      async createPricingQuote(input) {
        receivedUserId = input.userId;
        return quoteResult;
      },
    });

    const response = await handler(
      new Request('http://localhost/api/pricing/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carId: 'car-suv-1',
          pickupDate: '2026-06-15',
          durationDays: 3,
          tripType: 'LUAR_KOTA',
        }),
      }),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(receivedUserId, null);
    assert.equal(body.quoteId, 'quote-6b-public');
  });
});
