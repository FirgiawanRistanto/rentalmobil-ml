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
