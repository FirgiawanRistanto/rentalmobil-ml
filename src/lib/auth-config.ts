export const AUTH_MODEL_NAMES = {
  user: 'users',
  account: 'accounts',
  session: 'sessions',
  verification: 'verifications',
} as const;

export const AUTH_ROLE_VALUES = ['CUSTOMER', 'ADMIN'] as const;
export const DEFAULT_SIGN_UP_ROLE = 'CUSTOMER';

const KNOWN_INSECURE_SECRETS = new Set([
  'better-auth-secret-123456789',
  'better-auth-secret-12345678901234567890',
]);

export interface BetterAuthEnvironment {
  baseURL: string;
  secret: string;
}

export type BetterAuthEnvironmentVariables = Partial<
  Record<'BETTER_AUTH_URL' | 'BETTER_AUTH_SECRET' | 'AUTH_SECRET', string | undefined>
>;

export function resolveBetterAuthEnvironment(
  env?: BetterAuthEnvironmentVariables,
): BetterAuthEnvironment {
  const source = env ?? (process.env as BetterAuthEnvironmentVariables);
  const baseURL = source.BETTER_AUTH_URL?.trim();
  const secret = (source.BETTER_AUTH_SECRET ?? source.AUTH_SECRET)?.trim();

  if (!baseURL) {
    throw new Error('BETTER_AUTH_URL is required for Better Auth. Example: http://localhost:3000');
  }

  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is required. Generate a secure value for local development and production.');
  }

  if (KNOWN_INSECURE_SECRETS.has(secret)) {
    throw new Error('BETTER_AUTH_SECRET must not use the Better Auth default development secret.');
  }

  if (secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters long.');
  }

  return {
    baseURL,
    secret,
  };
}
