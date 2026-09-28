import { NextResponse } from 'next/server';
import {
  createAdminCar,
  listAdminCars,
  type AdminCarInput,
  type AdminCarsUser,
} from '../../../../services/adminCarsService';
import { getSessionUser, mapAdminCarsError, readAdminCarRequestBody } from './routeUtils';

interface AdminCarsRouteService {
  listAdminCars(user: AdminCarsUser | null): Promise<unknown>;
  createAdminCar(input: AdminCarInput, user: AdminCarsUser | null): Promise<unknown>;
}

interface AdminCarsRouteDependencies {
  service?: AdminCarsRouteService;
  getCurrentUser?: () => Promise<AdminCarsUser | null>;
}

export function createGetAdminCarsHandler(dependencies: AdminCarsRouteDependencies = {}) {
  const service = dependencies.service ?? { listAdminCars, createAdminCar };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function getAdminCars(): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      return NextResponse.json(await service.listAdminCars(user));
    } catch (error) {
      return mapAdminCarsError(error);
    }
  };
}

export function createPostAdminCarsHandler(dependencies: AdminCarsRouteDependencies = {}) {
  const service = dependencies.service ?? { listAdminCars, createAdminCar };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function postAdminCars(request: Request): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const body = await readAdminCarRequestBody(request);
      return NextResponse.json(await service.createAdminCar(body as AdminCarInput, user), { status: 201 });
    } catch (error) {
      return mapAdminCarsError(error);
    }
  };
}
