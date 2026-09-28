import { PricingDomainError } from './errors';

export type ModelVehicleCategory = 'passenger_car' | 'mpv' | 'suv' | 'van';
export type PricingTripType = 'DALAM_KOTA' | 'LUAR_KOTA';
export type ModelTripType = 'dalam_kota' | 'luar_kota';

const CATEGORY_ALIASES: Record<string, ModelVehicleCategory> = {
  SUV: 'suv',
  MPV: 'mpv',
  VAN: 'van',
  SEDAN: 'passenger_car',
  CITY_CAR: 'passenger_car',
  CITYCAR: 'passenger_car',
  HATCHBACK: 'passenger_car',
  PASSENGER_CAR: 'passenger_car',
};

function normalizeCategory(category: string): string {
  return category.trim().replace(/[\s-]+/g, '_').toUpperCase();
}

export function mapCarCategoryToModelCategory(category: string): ModelVehicleCategory {
  const modelCategory = CATEGORY_ALIASES[normalizeCategory(category)];

  if (!modelCategory) {
    throw new PricingDomainError(
      'UNSUPPORTED_MODEL_VEHICLE_CATEGORY',
      `Kategori mobil "${category}" belum memiliki mapping ke vehicle_category model v4.`,
    );
  }

  return modelCategory;
}

export function mapTripTypeToModelTripType(tripType: string): ModelTripType {
  if (tripType === 'DALAM_KOTA') return 'dalam_kota';
  if (tripType === 'LUAR_KOTA') return 'luar_kota';

  throw new PricingDomainError('INVALID_TRIP_TYPE', 'Trip type harus DALAM_KOTA atau LUAR_KOTA.');
}
