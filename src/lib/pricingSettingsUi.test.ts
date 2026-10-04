import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LATE_FINE_RATE_MAX,
  LATE_FINE_RATE_MIN,
  getPricingSettingsErrorMessage,
  isValidLateFineRatePct,
} from './pricingSettingsUi';

describe('pricing settings ui', () => {
  it('accepts only integer percentages within the admin bounds', () => {
    assert.equal(LATE_FINE_RATE_MIN, 1);
    assert.equal(LATE_FINE_RATE_MAX, 500);
    assert.equal(isValidLateFineRatePct(1), true);
    assert.equal(isValidLateFineRatePct(100), true);
    assert.equal(isValidLateFineRatePct(500), true);
    assert.equal(isValidLateFineRatePct(0), false);
    assert.equal(isValidLateFineRatePct(501), false);
    assert.equal(isValidLateFineRatePct(12.5), false);
    assert.equal(isValidLateFineRatePct('100'), false);
    assert.equal(isValidLateFineRatePct(null), false);
    assert.equal(isValidLateFineRatePct(Number.NaN), false);
  });

  it('maps error codes to friendly Indonesian messages', () => {
    assert.match(getPricingSettingsErrorMessage('INVALID_SETTING_VALUE'), /1 sampai 500/);
    assert.match(getPricingSettingsErrorMessage('AUTHENTICATION_REQUIRED'), /login/i);
    assert.match(getPricingSettingsErrorMessage('ADMIN_AUTHORIZATION_REQUIRED'), /admin/i);
    assert.match(getPricingSettingsErrorMessage('UNKNOWN_CODE'), /Konfigurasi pricing/);
  });
});
