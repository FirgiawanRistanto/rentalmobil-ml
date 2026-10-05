import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MANUAL_TARGET_MAX_PERCENT,
  buildLiveModelVersionName,
  getAdminMlContinualErrorMessage,
  isLiveModelVersion,
  isRetrainEligible,
  parseManualTargetPercent,
  toPercentPoints,
} from './adminMlContinualUi';

describe('adminMlContinualUi', () => {
  it('builds unique UTC live model version names', () => {
    assert.equal(
      buildLiveModelVersionName(new Date('2026-10-04T12:34:56.000Z')),
      'rf_adjustment_v4_live_20261004123456',
    );
    assert.match(buildLiveModelVersionName(new Date('2026-10-04T12:34:56.000Z')), /^rf_adjustment_v4_live_[0-9]{14}$/);
    assert.notEqual(
      buildLiveModelVersionName(new Date('2026-10-04T12:34:56.000Z')),
      buildLiveModelVersionName(new Date('2026-10-04T12:34:57.000Z')),
    );
  });

  it('validates live version slugs and rejects traversal attempts', () => {
    assert.equal(isLiveModelVersion('rf_adjustment_v4_live_20261004123456'), true);
    assert.equal(isLiveModelVersion('../escape'), false);
    assert.equal(isLiveModelVersion('rf_adjustment_v4_final'), false);
    assert.equal(isLiveModelVersion('rf_adjustment_v4_live_short'), false);
  });

  it('parses manual label percentages into target fractions', () => {
    assert.equal(parseManualTargetPercent('12.5'), 0.125);
    assert.equal(parseManualTargetPercent(12.5), 0.125);
    assert.equal(parseManualTargetPercent(0), 0);
    assert.equal(parseManualTargetPercent(-32), -0.32);
    assert.equal(parseManualTargetPercent(MANUAL_TARGET_MAX_PERCENT), 0.52);
  });

  it('rejects labels outside the dataset clamp range', () => {
    for (const invalid of [MANUAL_TARGET_MAX_PERCENT + 1, -40, 'abc', null, undefined, Number.NaN]) {
      assert.throws(
        () => parseManualTargetPercent(invalid),
        (error: unknown) =>
          typeof error === 'object' &&
          error !== null &&
          (error as { code?: string }).code === 'INVALID_LABEL_VALUE',
        `expected ${String(invalid)} to be rejected`,
      );
    }
  });

  it('requires both the sample threshold and a reachable ml-service', () => {
    assert.equal(isRetrainEligible(50, true), true);
    assert.equal(isRetrainEligible(49, true), false);
    assert.equal(isRetrainEligible(50, false), false);
    assert.equal(isRetrainEligible(0, true), false);
  });

  it('maps error codes to user-facing messages', () => {
    assert.match(getAdminMlContinualErrorMessage('ML_RETRAIN_NOT_ELIGIBLE'), /50/);
    assert.match(getAdminMlContinualErrorMessage('ML_RETRAIN_GUARDRAIL_FAILED'), /guardrail/i);
    assert.equal(
      getAdminMlContinualErrorMessage('SOME_UNKNOWN_CODE'),
      'Permintaan machine learning gagal diproses.',
    );
  });

  it('converts fractions to percent points for display', () => {
    assert.equal(toPercentPoints(0.125), 12.5);
    assert.equal(toPercentPoints(-0.032), -3.2);
    assert.equal(toPercentPoints(0), 0);
  });
});
