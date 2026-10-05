import { createAdminMlContinualHandler } from './routeHandler';

const handleAdminMlContinual = createAdminMlContinualHandler();

export async function GET(request: Request) {
  return handleAdminMlContinual(request);
}

export async function POST(request: Request) {
  return handleAdminMlContinual(request);
}
