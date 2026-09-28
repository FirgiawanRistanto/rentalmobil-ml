import { createDeleteAdminCarUnitHandler, createPatchAdminCarUnitHandler } from './routeHandler';

export const PATCH = createPatchAdminCarUnitHandler();
export const DELETE = createDeleteAdminCarUnitHandler();
