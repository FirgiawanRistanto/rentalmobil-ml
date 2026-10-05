import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PricingSettingsError,
  parseLateFineRatePct,
  parseMlRetrainSettingValue,
  pricingSettingsErrorStatus,
  readLateFineDailyRatePct,
  readMlRetrainSettings,
  updateLateFineDailyRatePct,
  updateMlRetrainSettings,
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

  it('reads ml retrain settings per key and falls back to the defaults', async () => {
    const values: Record<string, number | null> = {
      mlMaxMaeRegressionPct: 25,
      mlMinR2DropPp: null,
      mlMinLiveSamples: 9999,
    };
    const store = {
      calls: { readKeys: [] as string[], upserts: [] as Array<{ key: string; value: number }> },
      repo: {
        async readValue(key: string) {
          store.calls.readKeys.push(key);
          return values[key] ?? null;
        },
        async upsertValue(key: string, value: number) {
          store.calls.upserts.push({ key, value });
        },
      },
    };

    const settings = await readMlRetrainSettings(admin, { repository: store.repo });
    assert.deepEqual(settings, { maxMaeRegressionPct: 25, minR2DropPp: 2, minLiveSamples: 50 });
    assert.deepEqual(store.calls.readKeys, [
      'mlMaxMaeRegressionPct',
      'mlMinR2DropPp',
      'mlMinLiveSamples',
    ]);

    const empty = repository(null);
    const defaults = await readMlRetrainSettings(admin, { repository: empty.repo });
    assert.deepEqual(defaults, { maxMaeRegressionPct: 10, minR2DropPp: 2, minLiveSamples: 50 });
  });

  it('validates ml retrain values before writing anything', () => {
    assert.equal(parseMlRetrainSettingValue('maxMaeRegressionPct', 25), 25);
    assert.equal(parseMlRetrainSettingValue('minLiveSamples', '120'), 120);

    for (const [key, invalid] of [
      ['maxMaeRegressionPct', 0],
      ['maxMaeRegressionPct', 12.5],
      ['minR2DropPp', 0],
      ['minLiveSamples', 5],
      ['minLiveSamples', 'abc'],
    ] as const) {
      assert.throws(
        () => parseMlRetrainSettingValue(key, invalid),
        (error) => error instanceof PricingSettingsError && error.code === 'INVALID_SETTING_VALUE',
        `expected ${String(invalid)} to be rejected for ${key}`,
      );
    }
  });

  it('rejects the whole ml update when any field is invalid', async () => {
    const store = repository(null);

    await assert.rejects(
      () =>
        updateMlRetrainSettings(
          admin,
          { maxMaeRegressionPct: 25, minLiveSamples: 5 },
          { repository: store.repo },
        ),
      (error) => error instanceof PricingSettingsError && error.code === 'INVALID_SETTING_VALUE',
    );
    assert.deepEqual(store.calls.upserts, [], 'tidak boleh ada tulisan parsial');

    await assert.rejects(
      () => updateMlRetrainSettings(admin, {}, { repository: store.repo }),
      (error) => error instanceof PricingSettingsError && error.code === 'INVALID_SETTING_VALUE',
    );
  });

  it('upserts valid ml settings for the admin actor and returns the full set', async () => {
    const stored: Record<string, number | null> = {};
    const upserts: Array<{ key: string; value: number; userId: string }> = [];
    const store = {
      repo: {
        async readValue(key: string) {
          return stored[key] ?? null;
        },
        async upsertValue(key: string, value: number, userId: string) {
          stored[key] = value;
          upserts.push({ key, value, userId });
        },
      },
    };

    const saved = await updateMlRetrainSettings(
      admin,
      { maxMaeRegressionPct: 20 },
      { repository: store.repo },
    );
    assert.deepEqual(upserts, [{ key: 'mlMaxMaeRegressionPct', value: 20, userId: 'admin-1' }]);
    assert.deepEqual(saved, { maxMaeRegressionPct: 20, minR2DropPp: 2, minLiveSamples: 50 });

    await assert.rejects(
      () =>
        updateMlRetrainSettings(customer, { maxMaeRegressionPct: 20 }, { repository: store.repo }),
      (error) => error instanceof PricingSettingsError && error.code === 'ADMIN_AUTHORIZATION_REQUIRED',
    );
    assert.equal(upserts.length, 1, 'customer tidak boleh menulis apa pun');
  });
});
