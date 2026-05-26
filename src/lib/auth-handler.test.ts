import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { eq, like } from 'drizzle-orm';

process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET ??= 'test-only-better-auth-secret-for-fase-6a';

type AuthInstance = typeof import('./auth')['auth'];
type DbInstance = typeof import('../db')['db'];
type UsersTable = typeof import('../db/schema')['users'];

let auth: AuthInstance;
let db: DbInstance;
let users: UsersTable;

const TEST_EMAIL_PATTERN = 'auth-6a-%@example.test';

interface AuthRequestOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
}

async function cleanupAuthTestUsers() {
  await db.delete(users).where(like(users.email, TEST_EMAIL_PATTERN));
}

function extractCookieHeader(response: Response): string {
  const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
  const cookies = getSetCookie ? getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean) as string[];

  return cookies
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function authRequest(path: string, options: AuthRequestOptions = {}) {
  const headers = new Headers({
    origin: 'http://localhost:3000',
  });

  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
  }

  if (options.cookie) {
    headers.set('cookie', options.cookie);
  }

  return auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: options.method ?? 'POST',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  );
}

async function getUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  return user;
}

describe('Better Auth email/password backend', () => {
  before(async () => {
    const [authModule, dbModule, schemaModule] = await Promise.all([
      import('./auth'),
      import('../db'),
      import('../db/schema'),
    ]);

    auth = authModule.auth;
    db = dbModule.db;
    users = schemaModule.users;

    await cleanupAuthTestUsers();
  });

  after(async () => {
    await cleanupAuthTestUsers();
  });

  it('signs up a public user as CUSTOMER', async () => {
    const email = `auth-6a-normal-${Date.now()}@example.test`;
    const response = await authRequest('/sign-up/email', {
      body: {
        name: 'Auth Test Customer',
        email,
        password: 'password-6a-normal',
      },
    });
    const body = await response.json();
    const user = await getUserByEmail(email);

    assert.equal(response.status, 200);
    assert.equal(body.user.email, email);
    assert.equal(body.user.role, 'CUSTOMER');
    assert.equal(user?.role, 'CUSTOMER');
    assert.equal(user?.emailVerified, false);
  });

  it('does not allow a public sign-up payload to create an ADMIN user', async () => {
    const email = `auth-6a-role-${Date.now()}@example.test`;
    const response = await authRequest('/sign-up/email', {
      body: {
        name: 'Auth Test Role Attack',
        email,
        password: 'password-6a-role',
        role: 'ADMIN',
      },
    });
    const body = await response.json();
    const user = await getUserByEmail(email);

    assert.equal(response.status, 200);
    assert.equal(body.user.role, 'CUSTOMER');
    assert.equal(user?.role, 'CUSTOMER');
  });

  it('signs in with valid credentials and rejects an invalid password', async () => {
    const email = `auth-6a-signin-${Date.now()}@example.test`;
    const password = 'password-6a-signin';

    await authRequest('/sign-up/email', {
      body: {
        name: 'Auth Test Sign In',
        email,
        password,
      },
    });

    const validResponse = await authRequest('/sign-in/email', {
      body: {
        email,
        password,
      },
    });
    const validBody = await validResponse.json();

    const invalidResponse = await authRequest('/sign-in/email', {
      body: {
        email,
        password: 'wrong-password-6a',
      },
    });

    assert.equal(validResponse.status, 200);
    assert.equal(validBody.user.email, email);
    assert.equal(validBody.user.role, 'CUSTOMER');
    assert.notEqual(invalidResponse.status, 200);
  });

  it('returns a current session and then clears it on sign-out', async () => {
    const email = `auth-6a-session-${Date.now()}@example.test`;
    const password = 'password-6a-session';

    await authRequest('/sign-up/email', {
      body: {
        name: 'Auth Test Session',
        email,
        password,
      },
    });

    const signInResponse = await authRequest('/sign-in/email', {
      body: {
        email,
        password,
      },
    });
    const cookie = extractCookieHeader(signInResponse);

    const sessionResponse = await authRequest('/get-session', {
      method: 'GET',
      cookie,
    });
    const sessionBody = await sessionResponse.json();

    const signOutResponse = await authRequest('/sign-out', {
      method: 'POST',
      cookie,
    });
    const signOutCookie = extractCookieHeader(signOutResponse);
    const postSignOutResponse = await authRequest('/get-session', {
      method: 'GET',
      cookie: signOutCookie || cookie,
    });
    const postSignOutBody = await postSignOutResponse.json();

    assert.equal(sessionResponse.status, 200);
    assert.equal(sessionBody.user.email, email);
    assert.equal(sessionBody.user.role, 'CUSTOMER');
    assert.equal(Boolean(sessionBody.session.token), true);
    assert.equal(signOutResponse.status, 200);
    assert.equal(postSignOutResponse.status, 200);
    assert.equal(postSignOutBody, null);
  });

  it('does not treat an invalid session cookie as authenticated', async () => {
    const response = await authRequest('/get-session', {
      method: 'GET',
      cookie: 'better-auth.session_token=invalid-token',
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body, null);
  });
});
