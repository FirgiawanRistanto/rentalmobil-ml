import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LATE_FINE_RATE_MAX,
  LATE_FINE_RATE_MIN,
  ML_RETRAIN_SETTING_DEFAULTS,
  ML_RETRAIN_SETTING_KEYS,
  getPricingSettingsErrorMessage,
  getMlRetrainSettingBoundsMessage,
  isValidLateFineRatePct,
  isValidMlRetrainSetting,
  resolveMlRetrainSettings,
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

  it('maps ml retrain settings keys to pricing_settings columns', () => {
    assert.deepEqual(ML_RETRAIN_SETTING_KEYS, {
      maxMaeRegressionPct: 'mlMaxMaeRegressionPct',
      minR2DropPp: 'mlMinR2DropPp',
      minLiveSamples: 'mlMinLiveSamples',
    });
  });

  it('defaults the guardrail settings to the original constants', () => {
    assert.deepEqual(ML_RETRAIN_SETTING_DEFAULTS, {
      maxMaeRegressionPct: 10,
      minR2DropPp: 2,
      minLiveSamples: 50,
    });
  });

  it('validates ml retrain settings as integers within per-field bounds', () => {
    assert.equal(isValidMlRetrainSetting('maxMaeRegressionPct', 10), true);
    assert.equal(isValidMlRetrainSetting('maxMaeRegressionPct', 1), true);
    assert.equal(isValidMlRetrainSetting('maxMaeRegressionPct', 0), false);
    assert.equal(isValidMlRetrainSetting('maxMaeRegressionPct', 51), false);
    assert.equal(isValidMlRetrainSetting('maxMaeRegressionPct', 12.5), false);
    assert.equal(isValidMlRetrainSetting('minR2DropPp', 2), true);
    assert.equal(isValidMlRetrainSetting('minR2DropPp', 0), false);
    assert.equal(isValidMlRetrainSetting('minLiveSamples', 50), true);
    assert.equal(isValidMlRetrainSetting('minLiveSamples', 9), false);
    assert.equal(isValidMlRetrainSetting('minLiveSamples', 5001), false);
    assert.equal(isValidMlRetrainSetting('minLiveSamples', '50'), false);
    assert.equal(isValidMlRetrainSetting('minLiveSamples', null), false);
    assert.equal(isValidMlRetrainSetting('minLiveSamples', Number.NaN), false);
  });

  it('resolves raw stored values with fallback to the defaults', () => {
    assert.deepEqual(
      resolveMlRetrainSettings({ maxMaeRegressionPct: 25, minR2DropPp: 5, minLiveSamples: 100 }),
      { maxMaeRegressionPct: 25, minR2DropPp: 5, minLiveSamples: 100 },
    );

    assert.deepEqual(resolveMlRetrainSettings({}), ML_RETRAIN_SETTING_DEFAULTS);
    assert.deepEqual(
      resolveMlRetrainSettings({ maxMaeRegressionPct: null, minR2DropPp: 999, minLiveSamples: 3 }),
      { maxMaeRegressionPct: 10, minR2DropPp: 2, minLiveSamples: 50 },
    );
  });

  it('describes per-field bounds in the error message', () => {
    assert.match(getMlRetrainSettingBoundsMessage('minLiveSamples'), /10 sampai 5000/);
    assert.match(getMlRetrainSettingBoundsMessage('maxMaeRegressionPct'), /1 sampai 50/);
  });
});
