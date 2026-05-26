import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AuthUiError,
  getCallbackURLFromSearch,
  getSafeAuthCallbackURL,
  loginCustomer,
  registerCustomer,
  signOutCurrentUser,
  validateRegisterForm,
} from './auth-ui';

describe('auth UI helpers', () => {
  it('registers a customer with name, email, and password only', async () => {
    let receivedPayload: unknown;
    const client = {
      signUp: {
        async email(payload: unknown) {
          receivedPayload = payload;
          return { data: { user: { id: 'user-1' } }, error: null };
        },
      },
    };

    await registerCustomer(
      {
        name: ' Customer Test ',
        email: 'CUSTOMER@example.test ',
        password: 'password-6b',
        confirmPassword: 'password-6b',
      },
      client,
    );

    assert.deepEqual(receivedPayload, {
      name: 'Customer Test',
      email: 'customer@example.test',
      password: 'password-6b',
    });
    assert.equal(Object.prototype.hasOwnProperty.call(receivedPayload, 'role'), false);
  });

  it('rejects password confirmation mismatch before calling Better Auth', async () => {
    assert.throws(
      () =>
        validateRegisterForm({
          name: 'Customer Test',
          email: 'customer@example.test',
          password: 'password-6b',
          confirmPassword: 'password-lain',
        }),
      /Konfirmasi kata sandi tidak sama/,
    );
  });

  it('surfaces register errors as user-friendly messages', async () => {
    const client = {
      signUp: {
        async email() {
          return { data: null, error: { message: 'User already exists' } };
        },
      },
    };

    await assert.rejects(
      () =>
        registerCustomer(
          {
            name: 'Customer Test',
            email: 'customer@example.test',
            password: 'password-6b',
            confirmPassword: 'password-6b',
          },
          client,
        ),
      (error) =>
        error instanceof AuthUiError &&
        error.message === 'Email sudah terdaftar. Silakan masuk menggunakan akun tersebut.',
    );
  });

  it('signs in with email/password and maps invalid credential errors', async () => {
    let receivedPayload: unknown;
    const successClient = {
      signIn: {
        async email(payload: unknown) {
          receivedPayload = payload;
          return { data: { user: { id: 'user-1' } }, error: null };
        },
      },
    };
    const failingClient = {
      signIn: {
        async email() {
          return { data: null, error: { message: 'Invalid password' } };
        },
      },
    };

    await loginCustomer(
      {
        email: ' CUSTOMER@example.test ',
        password: 'password-6b',
        rememberMe: true,
      },
      successClient,
    );

    assert.deepEqual(receivedPayload, {
      email: 'customer@example.test',
      password: 'password-6b',
      rememberMe: true,
    });

    await assert.rejects(
      () =>
        loginCustomer(
          {
            email: 'customer@example.test',
            password: 'wrong-password',
          },
          failingClient,
        ),
      (error) =>
        error instanceof AuthUiError &&
        error.message === 'Email atau kata sandi tidak sesuai.',
    );
  });

  it('allows only internal callback URLs', () => {
    assert.equal(getSafeAuthCallbackURL('/dashboard'), '/dashboard');
    assert.equal(
      getSafeAuthCallbackURL('/katalog/avanza?promo=1#detail'),
      '/katalog/avanza?promo=1#detail',
    );
    assert.equal(getSafeAuthCallbackURL('https://evil.example'), '/dashboard');
    assert.equal(getSafeAuthCallbackURL('//evil.example'), '/dashboard');
    assert.equal(getSafeAuthCallbackURL('/dashboard\r\nLocation:https://evil.example'), '/dashboard');
    assert.equal(
      getCallbackURLFromSearch('?callbackURL=%2Fadmin'),
      '/admin',
    );
  });

  it('signs out through Better Auth client', async () => {
    let called = false;
    const client = {
      async signOut() {
        called = true;
        return { data: true, error: null };
      },
    };

    await signOutCurrentUser(client);

    assert.equal(called, true);
  });
});
