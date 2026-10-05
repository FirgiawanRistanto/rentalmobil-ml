import {
  MAX_MAE_REGRESSION_RATIO,
  MIN_LIVE_SAMPLES_FOR_RETRAIN,
  MIN_R2_DROP,
} from './adminMlContinualUi';

export const LATE_FINE_RATE_SETTING_KEY = 'lateFineDailyRatePct';

/** Batas persentase tarif denda harian yang diterima admin (1–500%). */
export const LATE_FINE_RATE_MIN = 1;
export const LATE_FINE_RATE_MAX = 500;

export function isValidLateFineRatePct(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= LATE_FINE_RATE_MIN &&
    value <= LATE_FINE_RATE_MAX
  );
}

export function getPricingSettingsErrorMessage(code: string): string {
  switch (code) {
    case 'AUTHENTICATION_REQUIRED':
      return 'Silakan login untuk mengelola konfigurasi pricing.';
    case 'ADMIN_AUTHORIZATION_REQUIRED':
      return 'Hanya admin yang dapat mengelola konfigurasi pricing.';
    case 'INVALID_SETTING_VALUE':
      return `Persentase denda harus bilangan bulat antara ${LATE_FINE_RATE_MIN} sampai ${LATE_FINE_RATE_MAX}.`;
    default:
      return 'Konfigurasi pricing belum dapat diproses. Silakan coba lagi.';
  }
}

/**
 * Ambang guardrail & kelayakan retrain continuous learning yang bisa diubah
 * admin dari /admin/pengaturan (tabel `pricing_settings`). Nilai disimpan
 * bilangan bulat: MAE sebagai persen, R² sebagai poin persentase, dan jumlah
 * sampel sebagai count — karena kolom `pricing_settings.value` bertipe integer.
 */
export const ML_RETRAIN_SETTING_KEYS = {
  maxMaeRegressionPct: 'mlMaxMaeRegressionPct',
  minR2DropPp: 'mlMinR2DropPp',
  minLiveSamples: 'mlMinLiveSamples',
} as const;

export type MlRetrainSettingKey = keyof typeof ML_RETRAIN_SETTING_KEYS;
export type MlRetrainSettings = Record<MlRetrainSettingKey, number>;

export const ML_RETRAIN_SETTING_BOUNDS: Record<MlRetrainSettingKey, { min: number; max: number }> = {
  maxMaeRegressionPct: { min: 1, max: 50 },
  minR2DropPp: { min: 1, max: 50 },
  minLiveSamples: { min: 10, max: 5_000 },
};

/** Default mengikuti konstanta guardrail lama dipakai bila baris absen/rusak. */
export const ML_RETRAIN_SETTING_DEFAULTS: MlRetrainSettings = {
  maxMaeRegressionPct: Math.round(MAX_MAE_REGRESSION_RATIO * 100),
  minR2DropPp: Math.round(MIN_R2_DROP * 100),
  minLiveSamples: MIN_LIVE_SAMPLES_FOR_RETRAIN,
};

export const ML_RETRAIN_SETTING_LABELS: Record<MlRetrainSettingKey, string> = {
  maxMaeRegressionPct: 'Guardrail MAE maksimal',
  minR2DropPp: 'Guardrail penurunan R² maksimal',
  minLiveSamples: 'Minimal sampel live untuk retrain',
};

export function isValidMlRetrainSetting(key: MlRetrainSettingKey, value: unknown): value is number {
  const bounds = ML_RETRAIN_SETTING_BOUNDS[key];
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= bounds.min &&
    value <= bounds.max
  );
}

export function getMlRetrainSettingBoundsMessage(key: MlRetrainSettingKey): string {
  const { min, max } = ML_RETRAIN_SETTING_BOUNDS[key];
  return `${ML_RETRAIN_SETTING_LABELS[key]} harus bilangan bulat antara ${min} sampai ${max}.`;
}

/**
 * Normalisasi nilai mentah dari `pricing_settings`: tiap field divalidasi
 * ulang; baris absen atau rusak jatuh ke default konstanta guardrail.
 */
export function resolveMlRetrainSettings(raw: Partial<Record<string, unknown>>): MlRetrainSettings {
  return {
    maxMaeRegressionPct: isValidMlRetrainSetting('maxMaeRegressionPct', raw.maxMaeRegressionPct)
      ? raw.maxMaeRegressionPct
      : ML_RETRAIN_SETTING_DEFAULTS.maxMaeRegressionPct,
    minR2DropPp: isValidMlRetrainSetting('minR2DropPp', raw.minR2DropPp)
      ? raw.minR2DropPp
      : ML_RETRAIN_SETTING_DEFAULTS.minR2DropPp,
    minLiveSamples: isValidMlRetrainSetting('minLiveSamples', raw.minLiveSamples)
      ? raw.minLiveSamples
      : ML_RETRAIN_SETTING_DEFAULTS.minLiveSamples,
  };
}
