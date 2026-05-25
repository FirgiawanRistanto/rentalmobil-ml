import { PricingDomainError } from './errors';

export type DemandLevel = 'sepi' | 'normal' | 'ramai';

export interface UtilizationContext {
  availabilityRatio: number;
  utilizationRate: number;
  demandLevel: DemandLevel;
}

const RATIO_DECIMAL_PLACES = 4;

function assertFiniteNumber(value: number, code: 'INVALID_UTILIZATION_RATE' | 'INVALID_PRICE', label: string) {
  if (!Number.isFinite(value)) {
    throw new PricingDomainError(code, `${label} harus berupa angka valid.`);
  }
}

export function normalizeRatio(value: number): number {
  assertFiniteNumber(value, 'INVALID_UTILIZATION_RATE', 'Ratio');
  return Math.round(value * 10 ** RATIO_DECIMAL_PLACES) / 10 ** RATIO_DECIMAL_PLACES;
}

export function deriveDemandLevel(utilizationRate: number): DemandLevel {
  assertFiniteNumber(utilizationRate, 'INVALID_UTILIZATION_RATE', 'Utilization rate');

  if (utilizationRate < 0 || utilizationRate > 1) {
    throw new PricingDomainError(
      'INVALID_UTILIZATION_RATE',
      'Utilization rate harus berada pada rentang 0 sampai 1.',
    );
  }

  if (utilizationRate <= 0.3) return 'sepi';
  if (utilizationRate < 0.7) return 'normal';
  return 'ramai';
}

export function calculateUtilization(activeUnits: number, availableUnits: number): UtilizationContext {
  if (!Number.isInteger(activeUnits) || !Number.isInteger(availableUnits)) {
    throw new PricingDomainError('INVALID_UNIT_COUNT', 'Jumlah unit harus berupa bilangan bulat.');
  }

  if (activeUnits <= 0) {
    throw new PricingDomainError('NO_ACTIVE_UNITS', 'Tidak ada armada aktif pada kategori kendaraan tersebut.');
  }

  if (availableUnits < 0) {
    throw new PricingDomainError('INVALID_UNIT_COUNT', 'Jumlah unit tersedia tidak boleh negatif.');
  }

  if (availableUnits > activeUnits) {
    throw new PricingDomainError(
      'INVALID_UNIT_COUNT',
      'Jumlah unit tersedia tidak boleh lebih besar dari jumlah unit aktif.',
    );
  }

  const availabilityRatio = normalizeRatio(availableUnits / activeUnits);
  const utilizationRate = normalizeRatio(1 - availabilityRatio);

  return {
    availabilityRatio,
    utilizationRate,
    demandLevel: deriveDemandLevel(utilizationRate),
  };
}

export function roundPriceForDisplay(rawPrice: number): number {
  assertFiniteNumber(rawPrice, 'INVALID_PRICE', 'Harga');

  if (rawPrice < 0) {
    throw new PricingDomainError('INVALID_PRICE', 'Harga tidak boleh negatif.');
  }

  return Math.round(rawPrice / 1000) * 1000;
}

