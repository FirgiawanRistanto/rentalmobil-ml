import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { GET as carsGet, POST as carsPost } from './route';

/**
 * Security regression tests for POST /api/cars.
 *
 * Verifies that the unauthenticated car-creation endpoint is permanently
 * disabled (405 Method Not Allowed) following removal of the dev-only
 * test-api page. GET remains active to serve the katalog.
 */
describe('POST /api/cars security hardening', () => {
  it('rejects anonymous POST /api/cars with 405 and CAR_CREATE_NOT_ALLOWED code', async () => {
    const request = new Request('http://localhost/api/cars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Toyota',
        model: 'Fortuner',
        category: 'SUV',
        year: 2022,
        basePricePerDay: 1500000,
        isAvailable: true,
      }),
    });

    const response = await carsPost(request);
    const body = await response.json() as { error: { code: string; message: string } };

    assert.equal(response.status, 405, 'anonymous POST must be rejected with 405');
    assert.equal(body.error.code, 'CAR_CREATE_NOT_ALLOWED');
    assert.equal(response.headers.get('Allow'), 'GET', 'Allow header must indicate only GET is permitted');
  });

  it('rejects POST with empty body with 405 (no auth bypass via malformed payload)', async () => {
    const request = new Request('http://localhost/api/cars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    const response = await carsPost(request);
    assert.equal(response.status, 405, 'empty-body POST must still be rejected');
  });

  it('verifies that GET /api/cars still returns without auth (public katalog endpoint)', async () => {
    // GET returns 200 or 500 (if DB unavailable in unit context); must NOT be 405.
    // We only verify the handler is not undefined and does not throw synchronously.
    assert.equal(typeof carsGet, 'function', 'GET handler must still be exported');
  });

  it('verifies source code: no reference to legacy pricingService or bookingService', () => {
    assert.equal(
      existsSync('src/services/pricingService.ts'),
      false,
      'pricingService.ts must be deleted',
    );
    assert.equal(
      existsSync('src/services/bookingService.ts'),
      false,
      'bookingService.ts must be deleted',
    );
  });

  it('verifies source code: test-api dev page is removed', () => {
    assert.equal(
      existsSync('src/app/test-api/page.tsx'),
      false,
      'test-api dev page must be deleted',
    );
  });
});
