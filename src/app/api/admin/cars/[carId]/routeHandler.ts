import { NextResponse } from 'next/server';
import {
  deactivateAdminCar,
  deleteAdminCar,
  readAdminCar,
  updateAdminCar,
  type AdminCarInput,
  type AdminCarsUser,
} from '../../../../../services/adminCarsService';
import { getSessionUser, mapAdminCarsError, readAdminCarRequestBody } from '../routeUtils';

interface AdminCarDetailRouteService {
  readAdminCar(carId: string, user: AdminCarsUser | null): Promise<unknown>;
  updateAdminCar(carId: string, input: AdminCarInput, user: AdminCarsUser | null): Promise<unknown>;
  deactivateAdminCar(carId: string, user: AdminCarsUser | null): Promise<unknown>;
  deleteAdminCar(carId: string, user: AdminCarsUser | null): Promise<unknown>;
}

interface AdminCarDetailRouteDependencies {
  service?: AdminCarDetailRouteService;
  getCurrentUser?: () => Promise<AdminCarsUser | null>;
}

interface AdminCarParams {
  params: Promise<{ carId: string }>;
}

export function createGetAdminCarHandler(dependencies: AdminCarDetailRouteDependencies = {}) {
  const service = dependencies.service ?? { readAdminCar, updateAdminCar, deactivateAdminCar, deleteAdminCar };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function getAdminCar(_request: Request, { params }: AdminCarParams): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const { carId } = await params;
      return NextResponse.json(await service.readAdminCar(carId, user));
    } catch (error) {
      return mapAdminCarsError(error);
    }
  };
}

export function createPatchAdminCarHandler(dependencies: AdminCarDetailRouteDependencies = {}) {
  const service = dependencies.service ?? { readAdminCar, updateAdminCar, deactivateAdminCar, deleteAdminCar };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function patchAdminCar(request: Request, { params }: AdminCarParams): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const { carId } = await params;
      const body = await readAdminCarRequestBody(request);
      return NextResponse.json(await service.updateAdminCar(carId, body as AdminCarInput, user));
    } catch (error) {
      return mapAdminCarsError(error);
    }
  };
}

export function createDeleteAdminCarHandler(dependencies: AdminCarDetailRouteDependencies = {}) {
  const service = dependencies.service ?? { readAdminCar, updateAdminCar, deactivateAdminCar, deleteAdminCar };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function deleteAdminCar(_request: Request, { params }: AdminCarParams): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const { carId } = await params;
      return NextResponse.json(await service.deleteAdminCar(carId, user));
    } catch (error) {
      return mapAdminCarsError(error);
    }
  };
}

export function createPostDeactivateAdminCarHandler(dependencies: AdminCarDetailRouteDependencies = {}) {
  const service = dependencies.service ?? { readAdminCar, updateAdminCar, deactivateAdminCar, deleteAdminCar };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function deactivateAdminCarRoute(_request: Request, { params }: AdminCarParams): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const { carId } = await params;
      return NextResponse.json(await service.deactivateAdminCar(carId, user));
    } catch (error) {
      return mapAdminCarsError(error);
    }
  };
}
