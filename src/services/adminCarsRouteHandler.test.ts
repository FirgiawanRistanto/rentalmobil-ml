import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { createGetAdminCarsHandler, createPostAdminCarsHandler } from '../app/api/admin/cars/routeHandler';
import {
  createDeleteAdminCarHandler,
  createPatchAdminCarHandler,
  createPostDeactivateAdminCarHandler,
} from '../app/api/admin/cars/[carId]/routeHandler';
import { createPostAdminCarUnitsHandler } from '../app/api/admin/cars/[carId]/units/routeHandler';
import { createPatchAdminCarUnitHandler } from '../app/api/admin/cars/[carId]/units/[unitId]/routeHandler';
import { AdminCarsServiceError, type AdminCarsUser } from './adminCarsService';

const admin = { id: 'admin-1', role: 'ADMIN' };
const customer = { id: 'customer-1', role: 'CUSTOMER' };

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function multipartRequest(url: string, fields: Record<string, string>, file?: File) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  if (file) {
    formData.set('imageFile', file);
  }
  return new Request(url, {
    method: 'POST',
    body: formData,
  });
}

describe('admin cars route handlers', () => {
  it('maps anonymous and customer access to safe auth errors', async () => {
    const service = {
      async listAdminCars(user: AdminCarsUser | null) {
        if (!user) throw new AdminCarsServiceError('AUTHENTICATION_REQUIRED', 'login', 401);
        if (user.role !== 'ADMIN') throw new AdminCarsServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'admin only', 403);
        return { summary: {}, cars: [] };
      },
      async createAdminCar() { return {}; },
    };

    const anonymousHandler = createGetAdminCarsHandler({
      service,
      getCurrentUser: async () => null,
    });
    const customerHandler = createGetAdminCarsHandler({
      service,
      getCurrentUser: async () => customer,
    });

    const anonymousResponse = await anonymousHandler();
    const customerResponse = await customerHandler();
    const anonymousBody = await anonymousResponse.json() as { error: { code: string } };
    const customerBody = await customerResponse.json() as { error: { code: string } };

    assert.equal(anonymousResponse.status, 401);
    assert.equal(anonymousBody.error.code, 'AUTHENTICATION_REQUIRED');
    assert.equal(customerResponse.status, 403);
    assert.equal(customerBody.error.code, 'ADMIN_AUTHORIZATION_REQUIRED');
  });

  it('allows ADMIN to create and update cars through admin-only handlers', async () => {
    let createdPayload: unknown;
    let updatedPayload: unknown;
    const service = {
      async listAdminCars() { return { summary: {}, cars: [] }; },
      async createAdminCar(input: unknown, user: AdminCarsUser | null) {
        assert.equal(user?.role, 'ADMIN');
        createdPayload = input;
        return { id: 'car-1', slug: 'honda-brio' };
      },
      async readAdminCar() { return { id: 'car-1' }; },
      async updateAdminCar(_carId: string, input: unknown, user: AdminCarsUser | null) {
        assert.equal(user?.role, 'ADMIN');
        updatedPayload = input;
        return { id: 'car-1', slug: 'honda-brio-edit' };
      },
      async deactivateAdminCar() { return { id: 'car-1', isAvailable: false }; },
      async deleteAdminCar() { return { id: 'car-1' }; },
    };

    const createHandler = createPostAdminCarsHandler({ service, getCurrentUser: async () => admin });
    const patchHandler = createPatchAdminCarHandler({ service, getCurrentUser: async () => admin });

    const createResponse = await createHandler(jsonRequest('http://localhost/api/admin/cars', { name: 'Honda Brio' }));
    const patchResponse = await patchHandler(
      jsonRequest('http://localhost/api/admin/cars/car-1', { name: 'Honda Brio Edit' }),
      { params: Promise.resolve({ carId: 'car-1' }) },
    );

    assert.equal(createResponse.status, 201);
    assert.equal(patchResponse.status, 200);
    assert.deepEqual(createdPayload, { name: 'Honda Brio' });
    assert.deepEqual(updatedPayload, { name: 'Honda Brio Edit' });
  });

  it('parses multipart create payloads and stores uploaded image as a relative public path', async () => {
    let createdPayload: { imageUrl?: string } | undefined;
    const service = {
      async listAdminCars() { return { summary: {}, cars: [] }; },
      async createAdminCar(input: { imageUrl?: string }, user: AdminCarsUser | null) {
        assert.equal(user?.role, 'ADMIN');
        createdPayload = input;
        return { id: 'car-1', slug: 'honda-brio', imageUrl: input.imageUrl };
      },
    };
    const handler = createPostAdminCarsHandler({ service, getCurrentUser: async () => admin });
    const response = await handler(multipartRequest('http://localhost/api/admin/cars', {
      name: 'Honda Brio',
      category: 'passenger_car',
      year: '2024',
      transmission: 'Otomatis',
      capacitySeats: '5',
      basePricePerDay: '350000',
      isAvailable: 'true',
    }, new File([new Uint8Array([1, 2, 3])], 'brio.png', { type: 'image/png' })));

    assert.equal(response.status, 201);
    assert.match(createdPayload?.imageUrl ?? '', /^\/uploads\/cars\/honda-brio-[\w-]+\.png$/);
    assert.doesNotMatch(createdPayload?.imageUrl ?? '', /^[A-Za-z]:\\/);
    assert.doesNotMatch(createdPayload?.imageUrl ?? '', /\\/);

    if (createdPayload?.imageUrl) {
      await rm(path.join(process.cwd(), 'public', createdPayload.imageUrl), { force: true });
    }
  });

  it('rejects unsupported image uploads safely', async () => {
    const service = {
      async listAdminCars() { return { summary: {}, cars: [] }; },
      async createAdminCar() { return { id: 'car-1' }; },
    };
    const handler = createPostAdminCarsHandler({ service, getCurrentUser: async () => admin });
    const response = await handler(multipartRequest('http://localhost/api/admin/cars', {
      name: 'Honda Brio',
      category: 'passenger_car',
      year: '2024',
      transmission: 'Otomatis',
      capacitySeats: '5',
      basePricePerDay: '350000',
      isAvailable: 'true',
    }, new File(['not image'], 'brio.txt', { type: 'text/plain' })));
    const body = await response.json() as { error: { code: string } };

    assert.equal(response.status, 422);
    assert.equal(body.error.code, 'INVALID_CAR_IMAGE_TYPE');
  });

  it('rejects oversized image uploads safely', async () => {
    const service = {
      async listAdminCars() { return { summary: {}, cars: [] }; },
      async createAdminCar() { return { id: 'car-1' }; },
    };
    const handler = createPostAdminCarsHandler({ service, getCurrentUser: async () => admin });
    const response = await handler(multipartRequest('http://localhost/api/admin/cars', {
      name: 'Honda Brio',
      category: 'passenger_car',
      year: '2024',
      transmission: 'Otomatis',
      capacitySeats: '5',
      basePricePerDay: '350000',
      isAvailable: 'true',
    }, new File([new Uint8Array((3 * 1024 * 1024) + 1)], 'brio.png', { type: 'image/png' })));
    const body = await response.json() as { error: { code: string } };

    assert.equal(response.status, 413);
    assert.equal(body.error.code, 'CAR_IMAGE_TOO_LARGE');
  });

  it('protects hard delete from anonymous and CUSTOMER sessions', async () => {
    const service = {
      async readAdminCar() { return { id: 'car-1' }; },
      async updateAdminCar() { return { id: 'car-1' }; },
      async deactivateAdminCar() { return { id: 'car-1', isAvailable: false }; },
      async deleteAdminCar(_carId: string, user: AdminCarsUser | null) {
        if (!user) throw new AdminCarsServiceError('AUTHENTICATION_REQUIRED', 'login', 401);
        if (user.role !== 'ADMIN') throw new AdminCarsServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'admin only', 403);
        return { id: 'car-1' };
      },
    };

    const anonymousHandler = createDeleteAdminCarHandler({ service, getCurrentUser: async () => null });
    const customerHandler = createDeleteAdminCarHandler({ service, getCurrentUser: async () => customer });

    const anonymousResponse = await anonymousHandler(
      new Request('http://localhost/api/admin/cars/car-1'),
      { params: Promise.resolve({ carId: 'car-1' }) },
    );
    const customerResponse = await customerHandler(
      new Request('http://localhost/api/admin/cars/car-1'),
      { params: Promise.resolve({ carId: 'car-1' }) },
    );

    assert.equal(anonymousResponse.status, 401);
    assert.equal(customerResponse.status, 403);
  });

  it('allows ADMIN to hard delete cars, deactivate cars, and create/update car units', async () => {
    const service = {
      async readAdminCar() { return { id: 'car-1' }; },
      async updateAdminCar() { return { id: 'car-1' }; },
      async deactivateAdminCar(_carId: string, user: AdminCarsUser | null) {
        assert.equal(user?.role, 'ADMIN');
        return { id: 'car-1', isAvailable: false };
      },
      async deleteAdminCar(_carId: string, user: AdminCarsUser | null) {
        assert.equal(user?.role, 'ADMIN');
        return { id: 'car-1', deleted: true };
      },
      async listAdminCarUnits() { return { units: [] }; },
      async createAdminCarUnit(_carId: string, input: unknown, user: AdminCarsUser | null) {
        assert.equal(user?.role, 'ADMIN');
        return { id: 'unit-1', ...input as object };
      },
      async updateAdminCarUnit(_carId: string, _unitId: string, input: unknown, user: AdminCarsUser | null) {
        assert.equal(user?.role, 'ADMIN');
        return { id: 'unit-1', ...input as object };
      },
      async deactivateAdminCarUnit() {
        return { id: 'unit-1', status: 'INACTIVE' };
      },
    };

    const deleteCarHandler = createDeleteAdminCarHandler({ service, getCurrentUser: async () => admin });
    const deactivateCarHandler = createPostDeactivateAdminCarHandler({ service, getCurrentUser: async () => admin });
    const createUnitHandler = createPostAdminCarUnitsHandler({ service, getCurrentUser: async () => admin });
    const updateUnitHandler = createPatchAdminCarUnitHandler({ service, getCurrentUser: async () => admin });

    const deleteResponse = await deleteCarHandler(
      new Request('http://localhost/api/admin/cars/car-1'),
      { params: Promise.resolve({ carId: 'car-1' }) },
    );
    const deactivateResponse = await deactivateCarHandler(
      new Request('http://localhost/api/admin/cars/car-1/deactivate', { method: 'POST' }),
      { params: Promise.resolve({ carId: 'car-1' }) },
    );
    const createUnitResponse = await createUnitHandler(
      jsonRequest('http://localhost/api/admin/cars/car-1/units', { plateNumber: 'BE 1 XYZ', status: 'ACTIVE' }),
      { params: Promise.resolve({ carId: 'car-1' }) },
    );
    const updateUnitResponse = await updateUnitHandler(
      jsonRequest('http://localhost/api/admin/cars/car-1/units/unit-1', { plateNumber: 'BE 1 XYZ', status: 'MAINTENANCE' }),
      { params: Promise.resolve({ carId: 'car-1', unitId: 'unit-1' }) },
    );

    assert.equal(deleteResponse.status, 200);
    assert.equal(deactivateResponse.status, 200);
    assert.equal(createUnitResponse.status, 201);
    assert.equal(updateUnitResponse.status, 200);
  });

  it('maps CAR_HAS_HISTORY to a safe controlled delete error', async () => {
    const service = {
      async readAdminCar() { return { id: 'car-1' }; },
      async updateAdminCar() { return { id: 'car-1' }; },
      async deactivateAdminCar() { return { id: 'car-1', isAvailable: false }; },
      async deleteAdminCar() {
        throw new AdminCarsServiceError(
          'CAR_HAS_HISTORY',
          'Mobil sudah memiliki riwayat transaksi, gunakan Nonaktifkan agar data historis tetap aman.',
          409,
        );
      },
    };
    const handler = createDeleteAdminCarHandler({ service, getCurrentUser: async () => admin });
    const response = await handler(
      new Request('http://localhost/api/admin/cars/car-1'),
      { params: Promise.resolve({ carId: 'car-1' }) },
    );
    const body = await response.json() as { error: { code: string; message: string } };

    assert.equal(response.status, 409);
    assert.equal(body.error.code, 'CAR_HAS_HISTORY');
    assert.match(body.error.message, /Nonaktifkan/);
  });
});
