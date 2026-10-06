import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getTableName } from 'drizzle-orm';
import { accounts, bookings, sessions, users, verifications } from '../db/schema';
import {
  AUTH_MODEL_NAMES,
  AUTH_ROLE_VALUES,
  DEFAULT_SIGN_UP_ROLE,
  resolveBetterAuthEnvironment,
} from './auth-config';

describe('Better Auth configuration foundation', () => {
  it('maps Better Auth models to the existing plural repository tables', () => {
    assert.deepEqual(AUTH_MODEL_NAMES, {
      user: 'users',
      account: 'accounts',
      session: 'sessions',
      verification: 'verifications',
    });
    assert.equal(getTableName(users), 'users');
    assert.equal(getTableName(accounts), 'accounts');
    assert.equal(getTableName(sessions), 'sessions');
    assert.equal(getTableName(verifications), 'verifications');
  });

  it('keeps bookings mapped to the existing users table relation owner', () => {
    assert.equal(getTableName(bookings), 'bookings');
    assert.equal(getTableName(users), 'users');
  });

  it('uses CUSTOMER as the only public sign-up default role', () => {
    assert.deepEqual(AUTH_ROLE_VALUES, ['CUSTOMER', 'ADMIN']);
    assert.equal(DEFAULT_SIGN_UP_ROLE, 'CUSTOMER');
  });

  it('requires explicit Better Auth URL and secret instead of defaulting silently', () => {
    assert.throws(
      () => resolveBetterAuthEnvironment({}),
      /BETTER_AUTH_URL is required/,
    );
    assert.throws(
      () => resolveBetterAuthEnvironment({ BETTER_AUTH_URL: 'http://localhost:3000' }),
      /BETTER_AUTH_SECRET is required/,
    );
    assert.throws(
      () => resolveBetterAuthEnvironment({
        BETTER_AUTH_URL: 'http://localhost:3000',
        BETTER_AUTH_SECRET: 'better-auth-secret-12345678901234567890',
      }),
      /must not use the Better Auth default/,
    );
    assert.throws(
      () => resolveBetterAuthEnvironment({
        BETTER_AUTH_URL: 'http://localhost:3000',
        BETTER_AUTH_SECRET: 'short',
      }),
      /at least 32 characters/,
    );
  });

  it('trusts any loopback origin in development so dev-server ports other than BETTER_AUTH_URL keep working', () => {
    const resolved = resolveBetterAuthEnvironment({
      BETTER_AUTH_URL: 'http://localhost:3000',
      BETTER_AUTH_SECRET: 'a'.repeat(40),
      NODE_ENV: 'development',
    });

    assert.deepEqual(resolved.trustedOrigins, [
      'http://localhost:*',
      'http://127.0.0.1:*',
    ]);
  });

  it('keeps production origins strict unless AUTH_TRUSTED_ORIGINS is configured', () => {
    const strict = resolveBetterAuthEnvironment({
      BETTER_AUTH_URL: 'https://rental.example.com',
      BETTER_AUTH_SECRET: 'a'.repeat(40),
      NODE_ENV: 'production',
    });

    assert.deepEqual(strict.trustedOrigins, []);

    const withExtras = resolveBetterAuthEnvironment({
      BETTER_AUTH_URL: 'https://rental.example.com',
      BETTER_AUTH_SECRET: 'a'.repeat(40),
      NODE_ENV: 'production',
      AUTH_TRUSTED_ORIGINS: 'https://app.example.com, http://localhost:3001 ,',
    });

    assert.deepEqual(withExtras.trustedOrigins, [
      'https://app.example.com',
      'http://localhost:3001',
    ]);
  });
});
