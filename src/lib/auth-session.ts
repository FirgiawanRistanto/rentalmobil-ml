import { headers } from 'next/headers';
import { auth } from './auth';

export class AuthRequiredError extends Error {
  constructor(message = 'Authenticated session is required.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export async function getCurrentAuthSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getCurrentUser() {
  const session = await getCurrentAuthSession();
  return session?.user ?? null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthRequiredError();
  }

  return user;
}
