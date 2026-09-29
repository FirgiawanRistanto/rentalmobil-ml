import { NextResponse } from 'next/server';
import {
  deleteAdminCarUnit,
  updateAdminCarUnit,
  type AdminCarUnitInput,
  type AdminCarsUser,
} from '../../../../../../../services/adminCarsService';
import { getSessionUser, mapAdminCarsError, readJsonBody } from '../../../routeUtils';

interface AdminCarUnitRouteService {
  updateAdminCarUnit(
    carId: string,
    unitId: string,
    data: AdminCarUnitInput,
    user: AdminCarsUser | null,
  ): Promise<unknown>;
  deleteAdminCarUnit(carId: string, unitId: string, user: AdminCarsUser | null): Promise<unknown>;
}

interface AdminCarUnitRouteDependencies {
  service?: AdminCarUnitRouteService;
  getCurrentUser?: () => Promise<AdminCarsUser | null>;
}

interface AdminCarUnitParams {
  params: Promise<{ carId: string; unitId: string }>;
}

export function createPatchAdminCarUnitHandler(dependencies: AdminCarUnitRouteDependencies = {}) {
  const service = dependencies.service ?? { updateAdminCarUnit, deleteAdminCarUnit };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function patchAdminCarUnit(request: Request, { params }: AdminCarUnitParams): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const { carId, unitId } = await params;
      const body = await readJsonBody(request);
      return NextResponse.json(await service.updateAdminCarUnit(carId, unitId, body as AdminCarUnitInput, user));
    } catch (error) {
      return mapAdminCarsError(error);
    }
  };
}

export function createDeleteAdminCarUnitHandler(dependencies: AdminCarUnitRouteDependencies = {}) {
  const service = dependencies.service ?? { updateAdminCarUnit, deleteAdminCarUnit };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function deleteAdminCarUnit(_request: Request, { params }: AdminCarUnitParams): Promise<NextResponse> {
    try {
      const user = await getCurrentUser();
      const { carId, unitId } = await params;
      return NextResponse.json(await service.deleteAdminCarUnit(carId, unitId, user));
    } catch (error) {
      return mapAdminCarsError(error);
    }
  };
}
