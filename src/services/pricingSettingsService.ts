import { sql } from 'drizzle-orm';
import { db } from '../db';
import { LATE_FINE_DAILY_RATE_PCT } from '../lib/bookingFineUi';
import {
  LATE_FINE_RATE_MAX,
  LATE_FINE_RATE_MIN,
  LATE_FINE_RATE_SETTING_KEY,
  ML_RETRAIN_SETTING_KEYS,
  getMlRetrainSettingBoundsMessage,
  isValidLateFineRatePct,
  isValidMlRetrainSetting,
  resolveMlRetrainSettings,
  type MlRetrainSettingKey,
  type MlRetrainSettings,
} from '../lib/pricingSettingsUi';

export type PricingSettingsErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'ADMIN_AUTHORIZATION_REQUIRED'
  | 'INVALID_SETTING_VALUE';

export class PricingSettingsError extends Error {
  constructor(
    public readonly code: PricingSettingsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PricingSettingsError';
  }
}

export function isPricingSettingsError(error: unknown): error is PricingSettingsError {
  return error instanceof PricingSettingsError;
}

export function pricingSettingsErrorStatus(error: PricingSettingsError): number {
  switch (error.code) {
    case 'AUTHENTICATION_REQUIRED':
      return 401;
    case 'ADMIN_AUTHORIZATION_REQUIRED':
      return 403;
    default:
      return 400;
  }
}

export interface PricingSettingsUser {
  id: string;
  role?: string | null;
}

export interface PricingSettingsRepository {
  readValue(key: string): Promise<number | null>;
  upsertValue(key: string, value: number, updatedByUserId: string): Promise<void>;
}

export interface PricingSettingsDependencies {
  repository?: PricingSettingsRepository;
}

function mapRows<T>(result: { rows?: unknown[] } | unknown[]): T[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as T[];
}

function assertAdminUser(user: PricingSettingsUser | null | undefined): PricingSettingsUser {
  if (!user?.id) {
    throw new PricingSettingsError('AUTHENTICATION_REQUIRED', 'Login admin diperlukan untuk membaca konfigurasi pricing.');
  }

  if (user.role !== 'ADMIN') {
    throw new PricingSettingsError('ADMIN_AUTHORIZATION_REQUIRED', 'Hanya admin yang dapat mengelola konfigurasi pricing.');
  }

  return user;
}

/**
 * Terima number atau string numerik; harus bilangan bulat dalam rentang
 * LATE_FINE_RATE_MIN..LATE_FINE_RATE_MAX. Melempar INVALID_SETTING_VALUE.
 */
export function parseLateFineRatePct(value: unknown): number {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

  if (
    typeof parsed !== 'number' ||
    !Number.isInteger(parsed) ||
    parsed < LATE_FINE_RATE_MIN ||
    parsed > LATE_FINE_RATE_MAX
  ) {
    throw new PricingSettingsError(
      'INVALID_SETTING_VALUE',
      `Persentase denda harus bilangan bulat antara ${LATE_FINE_RATE_MIN} sampai ${LATE_FINE_RATE_MAX}.`,
    );
  }

  return parsed;
}

const defaultRepository: PricingSettingsRepository = {
  async readValue(key) {
    const result = await db.execute(sql`
      select "value"
      from pricing_settings
      where "key" = ${key}
    `);
    const [row] = mapRows<{ value: unknown }>(result);
    const value = Number(row?.value);
    return Number.isFinite(value) ? value : null;
  },

  async upsertValue(key, value, updatedByUserId) {
    await db.execute(sql`
      insert into pricing_settings ("key", "value", "updatedByUserId", "updatedAt")
      values (${key}, ${value}, ${updatedByUserId}::uuid, now())
      on conflict ("key") do update set
        "value" = excluded."value",
        "updatedByUserId" = excluded."updatedByUserId",
        "updatedAt" = now()
    `);
  },
};

/**
 * Baca persentase tarif denda harian yang berlaku. Nilai tersimpan divalidasi
 * ulang; baris absen atau rusak jatuh ke default konstanta (100%).
 */
export async function readLateFineDailyRatePct(
  user: PricingSettingsUser | null | undefined,
  dependencies: PricingSettingsDependencies = {},
): Promise<number> {
  assertAdminUser(user);
  const repository = dependencies.repository ?? defaultRepository;
  const stored = await repository.readValue(LATE_FINE_RATE_SETTING_KEY);
  return isValidLateFineRatePct(stored) ? stored : LATE_FINE_DAILY_RATE_PCT;
}

/** Validasi + upsert persentase denda; hanya admin. */
export async function updateLateFineDailyRatePct(
  user: PricingSettingsUser | null | undefined,
  rawValue: unknown,
  dependencies: PricingSettingsDependencies = {},
): Promise<number> {
  const actor = assertAdminUser(user);
  const value = parseLateFineRatePct(rawValue);
  const repository = dependencies.repository ?? defaultRepository;
  await repository.upsertValue(LATE_FINE_RATE_SETTING_KEY, value, actor.id);
  return value;
}

/**
 * Terima number atau string numerik; harus bilangan bulat dalam rentang bounds
 * key tsb. Melempar INVALID_SETTING_VALUE dengan pesan bounds spesifik field.
 */
export function parseMlRetrainSettingValue(key: MlRetrainSettingKey, rawValue: unknown): number {
  const parsed = typeof rawValue === 'string' && rawValue.trim() !== '' ? Number(rawValue) : rawValue;

  if (!isValidMlRetrainSetting(key, parsed)) {
    throw new PricingSettingsError('INVALID_SETTING_VALUE', getMlRetrainSettingBoundsMessage(key));
  }

  return parsed;
}

/**
 * Baca ambang guardrail & kelayakan retrain continuous learning yang berlaku.
 * Baris absen atau rusak jatuh ke default konstanta guardrail.
 */
export async function readMlRetrainSettings(
  user: PricingSettingsUser | null | undefined,
  dependencies: PricingSettingsDependencies = {},
): Promise<MlRetrainSettings> {
  assertAdminUser(user);
  const repository = dependencies.repository ?? defaultRepository;
  const [maxMaeRegressionPct, minR2DropPp, minLiveSamples] = await Promise.all([
    repository.readValue(ML_RETRAIN_SETTING_KEYS.maxMaeRegressionPct),
    repository.readValue(ML_RETRAIN_SETTING_KEYS.minR2DropPp),
    repository.readValue(ML_RETRAIN_SETTING_KEYS.minLiveSamples),
  ]);

  return resolveMlRetrainSettings({ maxMaeRegressionPct, minR2DropPp, minLiveSamples });
}

/**
 * Validasi semua nilai dulu (tanpa menyimpan apa pun bila ada yang salah),
 * lalu upsert baris yang dikenal; hanya admin.
 */
export async function updateMlRetrainSettings(
  user: PricingSettingsUser | null | undefined,
  rawValues: Partial<Record<MlRetrainSettingKey, unknown>>,
  dependencies: PricingSettingsDependencies = {},
): Promise<MlRetrainSettings> {
  const actor = assertAdminUser(user);
  const repository = dependencies.repository ?? defaultRepository;

  const entries = (Object.keys(rawValues) as MlRetrainSettingKey[])
    .filter((key) => key in ML_RETRAIN_SETTING_KEYS)
    .map((key) => [key, parseMlRetrainSettingValue(key, rawValues[key])] as const);

  if (entries.length === 0) {
    throw new PricingSettingsError(
      'INVALID_SETTING_VALUE',
      'Tidak ada konfigurasi continuous learning yang dikenal pada permintaan ini.',
    );
  }

  await Promise.all(
    entries.map(([key, value]) =>
      repository.upsertValue(ML_RETRAIN_SETTING_KEYS[key], value, actor.id),
    ),
  );

  return readMlRetrainSettings(user, dependencies);
}
