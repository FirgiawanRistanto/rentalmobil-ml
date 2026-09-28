export type DisplayCarCategory = 'City Car' | 'MPV' | 'SUV';

function normalizeCategory(category: string): string {
  return category.trim().replace(/[\s-]+/g, '_').toUpperCase();
}

export function getCarCategoryDisplayLabel(category: string): DisplayCarCategory {
  const normalizedCategory = normalizeCategory(category);

  if (
    normalizedCategory === 'PASSENGER_CAR' ||
    normalizedCategory === 'CITY_CAR' ||
    normalizedCategory === 'CITYCAR' ||
    normalizedCategory === 'HATCHBACK' ||
    normalizedCategory === 'SEDAN'
  ) {
    return 'City Car';
  }

  if (normalizedCategory === 'SUV') {
    return 'SUV';
  }

  return 'MPV';
}
