import { createGetAdminTransactionDetailHandler, createPatchAdminBookingStatusHandler } from './routeHandler';

export const GET = createGetAdminTransactionDetailHandler();
export const PATCH = createPatchAdminBookingStatusHandler();
