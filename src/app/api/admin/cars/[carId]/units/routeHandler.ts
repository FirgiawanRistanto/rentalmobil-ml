import { NextResponse } from 'next/server';
import {
  createAdminCarUnit,
  listAdminCarUnits,
  type AdminCarUnitInput,
  type AdminCarsUser,
} from '../../../../../../services/adminCarsService';
import { getSessionUser, mapAdminCarsError, readJsonBody } from '../../routeUtils';

interface AdminCarUnitsRouteService {
  listAdminCarUnits(carId: string, user: AdminCarsUser | null): Promise<unknown>;
  createAdminCarUnit(carId: string, input: AdminCarUnitInput, user: AdminCarsUser | null): Promise<unknown>;
}

interface AdminCarUnitsRouteDependencies {
  service?: AdminCarUnitsRouteService;
  getCurrentUser?: () => Promise<AdminCarsUser | null>;
}

interface AdminCarParams {
  params: Promise<{ carId: string }>;
}

export function createGetAdminCarUnitsHandler(dependencies: AdminCarUnitsRouteDependencies = {}) {
  const service = dependencies.service ?? { listAdminCarUnits, createAdminCarUnit };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function getAdminCarUnits(_request: Request, { params }: AdminCarParams): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const { carId } = await params;
      return NextResponse.json(await service.listAdminCarUnits(carId, user));
    } catch (error) {
      return mapAdminCarsError(error);
    }
  };
}

export function createPostAdminCarUnitsHandler(dependencies: AdminCarUnitsRouteDependencies = {}) {
  const service = dependencies.service ?? { listAdminCarUnits, createAdminCarUnit };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function postAdminCarUnits(request: Request, { params }: AdminCarParams): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const { carId } = await params;
      const body = await readJsonBody(request);
      return NextResponse.json(await service.createAdminCarUnit(carId, body as AdminCarUnitInput, user), { status: 201 });
    } catch (error) {
      return mapAdminCarsError(error);
    }
  };
}
