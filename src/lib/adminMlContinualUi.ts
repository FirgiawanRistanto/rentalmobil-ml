/**
 * Konstanta, kode error, dan helper UI untuk continuous learning
 * (retrain berkala model Random Forest dari data live).
 */

export const BASELINE_MODEL_VERSION = 'rf_adjustment_v4_final';

/** Ambang minimal sampel live baru sejak retrain terakhir sebelum tombol retrain aktif. */
export const MIN_LIVE_SAMPLES_FOR_RETRAIN = 50;

/** Jumlah sampel live terbaru yang ditampilkan admin untuk review label. */
export const RECENT_LIVE_SAMPLE_LIMIT = 10;

/** Bobot sampel live terhadap satu baris dataset dasar saat training digabung. */
export const LIVE_ROW_WEIGHT = 5;

/** Guardrail: MAE test-split tidak boleh memburuk melewati +10% dari baseline. */
export const MAX_MAE_REGRESSION_RATIO = 0.1;

/** Guardrail: R² tidak boleh turun melebihi 0.02 dari baseline. */
export const MIN_R2_DROP = 0.02;

/** Retrain model memakan waktu puluhan detik; timeout sengaja panjang. */
export const ML_RETRAIN_TIMEOUT_MS = 300_000;

/** Batas label manual (persen), identik dengan clamp penarget aturan v4. */
export const MANUAL_TARGET_MIN_PERCENT = -32;
export const MANUAL_TARGET_MAX_PERCENT = 52;

/** Batas baris live per request retrain (kontrak FastAPI `live_rows`). */
export const MAX_LIVE_ROWS_PER_RETRAIN = 5_000;

export type AdminMlContinualErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'ADMIN_AUTHORIZATION_REQUIRED'
  | 'ML_SERVICE_UNAVAILABLE'
  | 'ML_MODEL_NOT_READY'
  | 'ML_DATASET_MISSING'
  | 'ML_RETRAIN_REJECTED'
  | 'ML_RETRAIN_NOT_ELIGIBLE'
  | 'ML_RETRAIN_GUARDRAIL_FAILED'
  | 'ML_RETRAIN_FAILED'
  | 'MODEL_VERSION_NOT_FOUND'
  | 'MODEL_ACTIVATION_FAILED'
  | 'INVALID_LABEL_VALUE'
  | 'LABEL_QUOTE_NOT_FOUND';

const ERROR_MESSAGES: Record<AdminMlContinualErrorCode, string> = {
  AUTHENTICATION_REQUIRED: 'Login admin diperlukan untuk mengelola model machine learning.',
  ADMIN_AUTHORIZATION_REQUIRED: 'Hanya admin yang dapat mengelola model machine learning.',
  ML_SERVICE_UNAVAILABLE: 'ML service tidak tersedia atau timeout. Pastikan FastAPI ml-service berjalan.',
  ML_MODEL_NOT_READY: 'Model ML v4 belum siap digunakan oleh ml-service.',
  ML_DATASET_MISSING:
    'Dataset dasar tidak ditemukan di mesin ml-service, sehingga retrain live tidak dapat dijalankan.',
  ML_RETRAIN_REJECTED: 'ml-service menolak permintaan retrain. Periksa versi model dan baris live yang dikirim.',
  ML_RETRAIN_NOT_ELIGIBLE:
    `Belum cukup sampel live untuk retrain (minimal ${MIN_LIVE_SAMPLES_FOR_RETRAIN} sampel baru sejak retrain terakhir).`,
  ML_RETRAIN_GUARDRAIL_FAILED:
    'Hasil retrain gagal guardrail: metrik baru lebih buruk dari baseline, artefak tidak disimpan dan model tidak berubah.',
  ML_RETRAIN_FAILED: 'Retrain model gagal dijalankan. Coba lagi atau periksa log ml-service.',
  MODEL_VERSION_NOT_FOUND: 'Artefak model versi tersebut tidak ditemukan di ml-service.',
  MODEL_ACTIVATION_FAILED: 'Model baru gagal dimuat ml-service; model aktif lama tetap dipakai.',
  INVALID_LABEL_VALUE: `Label manual harus persentase antara ${MANUAL_TARGET_MIN_PERCENT}% sampai ${MANUAL_TARGET_MAX_PERCENT}%.`,
  LABEL_QUOTE_NOT_FOUND: 'Pricing quote untuk sampel live ini tidak ditemukan.',
};

export function getAdminMlContinualErrorMessage(code: string): string {
  return ERROR_MESSAGES[code as AdminMlContinualErrorCode] ?? 'Permintaan machine learning gagal diproses.';
}

export class AdminMlContinualError extends Error {
  constructor(
    public readonly code: AdminMlContinualErrorCode,
    message: string = getAdminMlContinualErrorMessage(code),
  ) {
    super(message);
    this.name = 'AdminMlContinualError';
  }
}

/** Nama versi unik untuk hasil retrain live (UTC, aman terhadap path traversal). */
export function buildLiveModelVersionName(now: Date = new Date()): string {
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('');

  return `rf_adjustment_v4_live_${stamp}`;
}

export function isLiveModelVersion(version: string): boolean {
  return /^rf_adjustment_v4_live_[0-9]{14}$/.test(version);
}

/**
 * Tombol retrain hanya aktif bila layak + ml-service terjangkau.
 * `minSamples` bisa dioverride dari `pricing_settings` (admin bisa mengubah
 * ambang dari /admin/pengaturan); default memakai konstanta fallback.
 */
export function isRetrainEligible(
  samplesSinceLastRetrain: number,
  serviceReachable: boolean,
  minSamples: number = MIN_LIVE_SAMPLES_FOR_RETRAIN,
): boolean {
  return serviceReachable && samplesSinceLastRetrain >= minSamples;
}

/**
 * Terima input persentase admin (mis. "-12.5") dan kembalikan pecahan desimal
 * (-0.125) sesuai tipe target `price_adjustment_pct`. Melempar
 * AdminMlContinualError('INVALID_LABEL_VALUE') bila tidak valid.
 */
export function parseManualTargetPercent(rawValue: unknown): number {
  const parsed = typeof rawValue === 'string' && rawValue.trim() !== '' ? Number(rawValue) : rawValue;

  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    throw new AdminMlContinualError('INVALID_LABEL_VALUE');
  }

  if (parsed < MANUAL_TARGET_MIN_PERCENT || parsed > MANUAL_TARGET_MAX_PERCENT) {
    throw new AdminMlContinualError('INVALID_LABEL_VALUE');
  }

  return Math.round(parsed * 10_000) / 1_000_000;
}

/** Ubah pecahan adjustment (0.125) menjadi poin persentase (12.5). */
export function toPercentPoints(fraction: number): number {
  return Math.round(fraction * 10_000) / 100;
}
