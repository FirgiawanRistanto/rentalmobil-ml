import {
  createDeleteAdminCarHandler,
  createGetAdminCarHandler,
  createPatchAdminCarHandler,
} from './routeHandler';

export const GET = createGetAdminCarHandler();
export const PATCH = createPatchAdminCarHandler();
export const DELETE = createDeleteAdminCarHandler();
