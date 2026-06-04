import { type DbCar, type DisplayCar, mapDbCarToDisplayCar } from './data';

export function buildFeaturedCars(cars: DbCar[], limit = 3): DisplayCar[] {
  return cars
    .filter((car) => car.isAvailable)
    .slice(0, limit)
    .map(mapDbCarToDisplayCar);
}
