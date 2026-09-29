import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  AdminCarsServiceError,
  createAdminCar,
  deactivateAdminCar,
  deleteAdminCar,
  listAdminCars,
  updateAdminCar,
  createAdminCarUnit,
  updateAdminCarUnit,
  deleteAdminCarUnit,
  deactivateAdminCarUnit,
  type AdminCarListItem,
} from './adminCarsService';

const admin = { id: 'admin-1', role: 'ADMIN' };
const customer = { id: 'customer-1', role: 'CUSTOMER' };

function car(overrides: Partial<AdminCarListItem> = {}): AdminCarListItem {
  return {
    id: 'car-1',
    slug: 'honda-brio',
    name: 'Honda Brio',
    brand: 'Honda',
    model: 'Brio',
    category: 'passenger_car',
    year: 2024,
    transmission: 'Automatic',
    capacitySeats: 5,
    basePricePerDay: 350000,
    imageUrl: null,
    isAvailable: true,
    units: [{ id: 'unit-1', plateNumber: 'BE 1001 XYZ', status: 'ACTIVE' }],
    unitCounts: { ACTIVE: 1, MAINTENANCE: 0, INACTIVE: 0 },
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('admin cars service', () => {
  it('requires ADMIN role for list and create operations', async () => {
    const repository = {
      async listCars() { return [car()]; },
      async findCarById() { return car(); },
      async findSlug() { return false; },
      async createCar() { return car(); },
      async updateCar() { return car(); },
      async deactivateCar() { return car({ isAvailable: false }); },
      async deleteCar() { return car(); },
      async listUnits() { return []; },
      async createUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async updateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async deactivateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
      async deleteUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
    };

    await assert.rejects(
      () => listAdminCars(null, repository),
      (error) => error instanceof AdminCarsServiceError && error.code === 'AUTHENTICATION_REQUIRED',
    );
    await assert.rejects(
      () => createAdminCar({ name: 'Honda Brio' }, customer, repository),
      (error) => error instanceof AdminCarsServiceError && error.code === 'ADMIN_AUTHORIZATION_REQUIRED',
    );
  });

  it('lets ADMIN list cars and summarizes unit statuses from database rows', async () => {
    const repository = {
      async listCars() {
        return [
          car({
            units: [
              { id: 'unit-1', plateNumber: 'BE 1 A', status: 'ACTIVE' },
              { id: 'unit-2', plateNumber: 'BE 2 A', status: 'MAINTENANCE' },
              { id: 'unit-3', plateNumber: 'BE 3 A', status: 'INACTIVE' },
            ],
            unitCounts: { ACTIVE: 1, MAINTENANCE: 1, INACTIVE: 1 },
          }),
        ];
      },
      async findCarById() { return car(); },
      async findSlug() { return false; },
      async createCar() { return car(); },
      async updateCar() { return car(); },
      async deactivateCar() { return car({ isAvailable: false }); },
      async deleteCar() { return car(); },
      async listUnits() { return []; },
      async createUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async updateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async deactivateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
      async deleteUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
    };

    const result = await listAdminCars(admin, repository);

    assert.equal(result.summary.totalCars, 1);
    assert.equal(result.summary.totalUnits, 3);
    assert.equal(result.summary.activeUnits, 1);
    assert.equal(result.summary.maintenanceUnits, 1);
    assert.equal(result.summary.inactiveUnits, 1);
  });

  it('normalizes valid create payloads and rejects invalid categories', async () => {
    let receivedInput: unknown;
    let receivedUnits: unknown;
    const repository = {
      async listCars() { return []; },
      async findCarById() { return car(); },
      async findSlug() { return false; },
      async createCar(input: unknown, units: unknown) {
        receivedInput = input;
        receivedUnits = units;
        return car({ slug: 'toyota-agya', category: 'passenger_car' });
      },
      async updateCar() { return car(); },
      async deactivateCar() { return car({ isAvailable: false }); },
      async deleteCar() { return car(); },
      async listUnits() { return []; },
      async createUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async updateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async deactivateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
      async deleteUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
    };

    await createAdminCar({
      name: 'Toyota Agya',
      category: 'passenger_car',
      year: 2024,
      transmission: 'Otomatis',
      capacitySeats: 5,
      basePricePerDay: 325000,
      units: [{ plateNumber: ' be 1234 xy ', status: 'ACTIVE' }],
    }, admin, repository);

    assert.deepEqual(receivedInput, {
      name: 'Toyota Agya',
      slug: 'toyota-agya',
      brand: 'Toyota',
      model: 'Agya',
      category: 'passenger_car',
      year: 2024,
      transmission: 'Otomatis',
      capacitySeats: 5,
      basePricePerDay: 325000,
      imageUrl: null,
      isAvailable: true,
    });
    assert.deepEqual(receivedUnits, [{ plateNumber: 'BE 1234 XY', status: 'ACTIVE' }]);

    await assert.rejects(
      () => createAdminCar({
        name: 'Bad Category',
        slug: 'bad-category',
        category: 'city_car',
        year: 2024,
        transmission: 'Manual',
        capacitySeats: 5,
        basePricePerDay: 1,
      }, admin, repository),
      (error) => error instanceof AdminCarsServiceError && error.code === 'INVALID_ADMIN_CAR_CATEGORY',
    );
  });

  it('updates base price for future quotes without touching booking snapshot contracts', async () => {
    let receivedInput: { basePricePerDay?: number } | undefined;
    const repository = {
      async listCars() { return []; },
      async findCarById() { return car(); },
      async findSlug() { return false; },
      async createCar() { return car(); },
      async updateCar(_carId: string, input: { basePricePerDay?: number }) {
        receivedInput = input;
        return car({ basePricePerDay: input.basePricePerDay ?? 0 });
      },
      async deactivateCar() { return car({ isAvailable: false }); },
      async deleteCar() { return car(); },
      async listUnits() { return []; },
      async createUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async updateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async deactivateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
      async deleteUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
    };

    await updateAdminCar('car-1', {
      name: 'Honda Brio',
      slug: 'honda-brio',
      category: 'passenger_car',
      year: 2024,
      transmission: 'Otomatis',
      capacitySeats: 5,
      basePricePerDay: 375000,
    }, admin, repository);

    assert.equal(receivedInput?.basePricePerDay, 375000);
  });

  it('generates a safe suffix when the generated slug already exists', async () => {
    let receivedInput: { slug?: string } | undefined;
    const existingSlugs = new Set(['toyota-avanza']);
    const repository = {
      async listCars() { return []; },
      async findCarById() { return car(); },
      async findSlug(slug: string) { return existingSlugs.has(slug); },
      async createCar(input: { slug?: string }) {
        receivedInput = input;
        return car({ slug: input.slug });
      },
      async updateCar() { return car(); },
      async deactivateCar() { return car({ isAvailable: false }); },
      async deleteCar() { return car(); },
      async listUnits() { return []; },
      async createUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async updateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async deactivateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
      async deleteUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
    };

    await createAdminCar({
      name: 'Toyota Avanza',
      category: 'mpv',
      year: 2024,
      transmission: 'Manual',
      capacitySeats: 7,
      basePricePerDay: 450000,
    }, admin, repository);

    assert.equal(receivedInput?.slug, 'toyota-avanza-2');
  });

  it('soft deactivates cars and manages unit status without hard delete', async () => {
    const repository = {
      async listCars() { return []; },
      async findCarById() { return car(); },
      async findSlug() { return false; },
      async createCar() { return car(); },
      async updateCar() { return car(); },
      async deactivateCar() { return car({ isAvailable: false }); },
      async deleteCar() { return car(); },
      async listUnits() { return []; },
      async createUnit(_carId: string, input: { plateNumber: string; status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' }) {
        return { id: 'unit-2', plateNumber: input.plateNumber, status: input.status };
      },
      async updateUnit(_carId: string, _unitId: string, input: { plateNumber: string; status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' }) {
        return { id: 'unit-2', plateNumber: input.plateNumber, status: input.status };
      },
      async deactivateUnit() { return { id: 'unit-2', plateNumber: 'BE 2 XYZ', status: 'INACTIVE' as const }; },
      async deleteUnit() { return { id: 'unit-2', plateNumber: 'BE 2 XYZ', status: 'INACTIVE' as const }; },
    };

    const inactiveCar = await deactivateAdminCar('car-1', admin, repository);
    const createdUnit = await createAdminCarUnit('car-1', { plateNumber: 'be 2 xyz', status: 'MAINTENANCE' }, admin, repository);
    const updatedUnit = await updateAdminCarUnit('car-1', 'unit-2', { plateNumber: 'BE 2 XYZ', status: 'INACTIVE' }, admin, repository);

    assert.equal(inactiveCar.isAvailable, false);
    assert.equal(createdUnit.plateNumber, 'BE 2 XYZ');
    assert.equal(createdUnit.status, 'MAINTENANCE');
    assert.equal(updatedUnit.status, 'INACTIVE');
  });

  it('hard deletes cars without transaction history and keeps soft deactivate available', async () => {
    let hardDeleteCalled = false;
    const repository = {
      async listCars() { return []; },
      async findCarById() { return car(); },
      async findSlug() { return false; },
      async createCar() { return car(); },
      async updateCar() { return car(); },
      async deactivateCar() { return car({ isAvailable: false }); },
      async deleteCar() {
        hardDeleteCalled = true;
        return car();
      },
      async listUnits() { return []; },
      async createUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async updateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async deactivateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
      async deleteUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
    };

    const deleted = await deleteAdminCar('car-1', admin, repository);

    assert.equal(deleted.id, 'car-1');
    assert.equal(hardDeleteCalled, true);
  });

  it('rejects hard delete when a car has quote or booking history', async () => {
    const repository = {
      async listCars() { return []; },
      async findCarById() { return car(); },
      async findSlug() { return false; },
      async createCar() { return car(); },
      async updateCar() { return car(); },
      async deactivateCar() { return car({ isAvailable: false }); },
      async deleteCar() {
        throw new AdminCarsServiceError(
          'CAR_HAS_HISTORY',
          'Mobil sudah memiliki riwayat transaksi, gunakan Nonaktifkan agar data historis tetap aman.',
          409,
        );
      },
      async listUnits() { return []; },
      async createUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async updateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'ACTIVE' as const }; },
      async deactivateUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
      async deleteUnit() { return { id: 'unit-1', plateNumber: 'BE 1 XYZ', status: 'INACTIVE' as const }; },
    };

    await assert.rejects(
      () => deleteAdminCar('car-1', admin, repository),
      (error) => error instanceof AdminCarsServiceError && error.code === 'CAR_HAS_HISTORY',
    );
  });

  it('guards hard delete with quote, booking, snapshot, payment, and unit cleanup checks', () => {
    const source = readFileSync('src/services/adminCarsService.ts', 'utf8');

    assert.match(source, /from pricing_quotes pq where pq\."carId"/);
    assert.match(source, /from bookings b where b\."carId"/);
    assert.match(source, /from booking_price_snapshots bps/);
    assert.match(source, /from booking_payments bp/);
    assert.match(source, /tx\.delete\(carUnits\)/);
    assert.match(source, /tx\.delete\(cars\)/);
  });

  it('hard deletes units without booking history and keeps deactivate available', async () => {
    let deleteUnitCalled = false;
    const repository = {
      async listCars() { return []; },
      async findCarById() { return car(); },
      async findSlug() { return false; },
      async createCar() { return car(); },
      async updateCar() { return car(); },
      async deactivateCar() { return car({ isAvailable: false }); },
      async deleteCar() { return car(); },
      async listUnits() { return []; },
      async createUnit() { return { id: 'unit-3', plateNumber: 'BE 3 XYZ', status: 'ACTIVE' as const }; },
      async updateUnit() { return { id: 'unit-3', plateNumber: 'BE 3 XYZ', status: 'ACTIVE' as const }; },
      async deactivateUnit() { return { id: 'unit-3', plateNumber: 'BE 3 XYZ', status: 'INACTIVE' as const }; },
      async deleteUnit() {
        deleteUnitCalled = true;
        return { id: 'unit-3', plateNumber: 'BE 3 XYZ', status: 'INACTIVE' as const };
      },
    };

    const deactivated = await deactivateAdminCarUnit('car-1', 'unit-3', admin, repository);
    const deleted = await deleteAdminCarUnit('car-1', 'unit-3', admin, repository);

    assert.equal(deactivated.status, 'INACTIVE');
    assert.equal(deleted.plateNumber, 'BE 3 XYZ');
    assert.equal(deleteUnitCalled, true);
  });

  it('rejects unit hard delete when the unit has booking history', async () => {
    const repository = {
      async listCars() { return []; },
      async findCarById() { return car(); },
      async findSlug() { return false; },
      async createCar() { return car(); },
      async updateCar() { return car(); },
      async deactivateCar() { return car({ isAvailable: false }); },
      async deleteCar() { return car(); },
      async listUnits() { return []; },
      async createUnit() { return { id: 'unit-4', plateNumber: 'BE 4 XYZ', status: 'ACTIVE' as const }; },
      async updateUnit() { return { id: 'unit-4', plateNumber: 'BE 4 XYZ', status: 'ACTIVE' as const }; },
      async deactivateUnit() { return { id: 'unit-4', plateNumber: 'BE 4 XYZ', status: 'INACTIVE' as const }; },
      async deleteUnit() {
        throw new AdminCarsServiceError(
          'CAR_UNIT_HAS_HISTORY',
          'Unit sudah memiliki riwayat booking. Ubah status unit menjadi INACTIVE agar data historis tetap aman.',
          409,
        );
      },
    };

    await assert.rejects(
      () => deleteAdminCarUnit('car-1', 'unit-4', admin, repository),
      (error) => error instanceof AdminCarsServiceError && error.code === 'CAR_UNIT_HAS_HISTORY',
    );
  });

  it('guards unit hard delete with booking history check and row lock', () => {
    const source = readFileSync('src/services/adminCarsService.ts', 'utf8');

    assert.match(source, /select 1 from bookings b where b\."carUnitId" = \$\{unitId\}::uuid/);
    assert.match(source, /CAR_UNIT_HAS_HISTORY/);
    assert.match(source, /\.for\('update'\)/);
  });
});
