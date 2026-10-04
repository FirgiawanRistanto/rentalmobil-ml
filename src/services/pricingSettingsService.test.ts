import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PricingSettingsError,
  parseLateFineRatePct,
  pricingSettingsErrorStatus,
  readLateFineDailyRatePct,
  updateLateFineDailyRatePct,
} from './pricingSettingsService';

const admin = { id: 'admin-1', role: 'ADMIN' };
const customer = { id: 'customer-1', role: 'CUSTOMER' };

function repository(stored: number | null = null) {
  const calls = {
    readKeys: [] as string[],
    upserts: [] as Array<{ key: string; value: number; userId: string }>,
  };

  return {
    calls,
    repo: {
      async readValue(key: string) {
        calls.readKeys.push(key);
        return stored;
      },
      async upsertValue(key: string, value: number, updatedByUserId: string) {
        calls.upserts.push({ key, value, userId: updatedByUserId });
      },
    },
  };
}

describe('pricing settings service', () => {
  it('requires an admin session for read and update', async () => {
    await assert.rejects(
      () => readLateFineDailyRatePct(null, { repository: repository().repo }),
      (error) => error instanceof PricingSettingsError && error.code === 'AUTHENTICATION_REQUIRED',
    );

    await assert.rejects(
      () => updateLateFineDailyRatePct(customer, 120, { repository: repository().repo }),
      (error) => error instanceof PricingSettingsError && error.code === 'ADMIN_AUTHORIZATION_REQUIRED',
    );

    assert.equal(pricingSettingsErrorStatus(new PricingSettingsError('AUTHENTICATION_REQUIRED', 'x')), 401);
    assert.equal(pricingSettingsErrorStatus(new PricingSettingsError('ADMIN_AUTHORIZATION_REQUIRED', 'x')), 403);
    assert.equal(pricingSettingsErrorStatus(new PricingSettingsError('INVALID_SETTING_VALUE', 'x')), 400);
  });

  it('reads the stored rate and falls back to the constant when missing or invalid', async () => {
    const storedRepo = repository(150);
    assert.equal(await readLateFineDailyRatePct(admin, { repository: storedRepo.repo }), 150);
    assert.equal(storedRepo.calls.readKeys[0], 'lateFineDailyRatePct');

    const emptyRepo = repository(null);
    assert.equal(await readLateFineDailyRatePct(admin, { repository: emptyRepo.repo }), 100);

    const invalidRepo = repository(9999);
    assert.equal(await readLateFineDailyRatePct(admin, { repository: invalidRepo.repo }), 100);
  });

  it('validates the percentage before it can be stored', () => {
    assert.equal(parseLateFineRatePct(100), 100);
    assert.equal(parseLateFineRatePct('250'), 250);

    for (const invalid of [0, 501, 10.5, 'abc', null, undefined, {}, Number.NaN]) {
      assert.throws(
        () => parseLateFineRatePct(invalid),
        (error) => error instanceof PricingSettingsError && error.code === 'INVALID_SETTING_VALUE',
        `expected ${String(invalid)} to be rejected`,
      );
    }
  });

  it('upserts the configured rate for the admin actor', async () => {
    const store = repository(100);
    const value = await updateLateFineDailyRatePct(admin, 150, { repository: store.repo });

    assert.equal(value, 150);
    assert.deepEqual(store.calls.upserts, [
      { key: 'lateFineDailyRatePct', value: 150, userId: 'admin-1' },
    ]);
  });
});
