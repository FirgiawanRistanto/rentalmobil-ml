import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildFeaturedCars } from './homeFeaturedCars';
import { cars, mapDbCarToDisplayCar, type DbCar } from './data';

function makeCar(overrides: Partial<DbCar>): DbCar {
  return {
    id: overrides.id ?? 'car-1',
    brand: overrides.brand ?? 'Toyota',
    model: overrides.model ?? 'Avanza',
    category: overrides.category ?? 'MPV',
    year: overrides.year ?? 2024,
    basePricePerDay: overrides.basePricePerDay ?? 550000,
    isAvailable: overrides.isAvailable ?? true,
    imageUrl: overrides.imageUrl ?? null,
  };
}

describe('home featured cars', () => {
  it('builds featured cars from database records without static fallback', () => {
    const featured = buildFeaturedCars([
      makeCar({ id: 'available-1', brand: 'Honda', model: 'BR-V', isAvailable: true }),
      makeCar({ id: 'booked-1', brand: 'Toyota', model: 'Fortuner', isAvailable: false }),
      makeCar({ id: 'available-2', brand: 'Toyota', model: 'Hiace', category: 'Van', isAvailable: true }),
    ]);

    assert.deepEqual(
      featured.map((car) => car.slug),
      ['available-1', 'available-2'],
    );
    assert.equal(featured[0].name, 'Honda BR-V');
  });

  it('keeps the homepage Armada Unggulan section away from hardcoded static vehicles', () => {
    const source = readFileSync('src/app/page.tsx', 'utf8');

    assert.equal(source.includes('buildFeaturedCars'), true);
    assert.equal(source.includes('Toyota Fortuner'), false);
    assert.equal(source.includes('/katalog/fortuner'), false);
    assert.equal(source.includes('Rp 1.500.000'), false);
  });

  it('keeps the fallback demo catalog at 8 cars with City Car, MPV, and SUV composition', () => {
    assert.equal(cars.length, 8);
    assert.equal(cars.filter((car) => car.type === 'City Car').length, 2);
    assert.equal(cars.filter((car) => car.type === 'MPV').length, 3);
    assert.equal(cars.filter((car) => car.type === 'SUV').length, 3);
    assert.equal(cars.find((car) => car.name === 'Honda Brio')?.basePrice, 350000);
    assert.equal(cars.find((car) => car.name === 'Toyota Agya')?.basePrice, 325000);
    assert.equal(cars.find((car) => car.name === 'Mitsubishi Pajero Sport')?.basePrice, 1400000);
  });

  it('maps internal passenger_car category to City Car for customer UI labels', () => {
    const displayCar = mapDbCarToDisplayCar(makeCar({
      brand: 'Honda',
      model: 'Brio',
      category: 'passenger_car',
      basePricePerDay: 350000,
    }));

    assert.equal(displayCar.type, 'City Car');
    assert.equal(displayCar.description.includes('passenger_car'), false);
    assert.equal(displayCar.description.includes('City Car'), true);
  });

  it('keeps the active catalog filter on Semua, City Car, MPV, and SUV', () => {
    const source = readFileSync('src/app/katalog/page.tsx', 'utf8');

    assert.equal(source.includes("['Semua', 'City Car', 'MPV', 'SUV']"), true);
    assert.equal(source.includes("setFilter('Van')"), false);
    assert.equal(source.includes("setFilter('Premium')"), false);
  });
});
