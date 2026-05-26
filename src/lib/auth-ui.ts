export const MIN_AUTH_PASSWORD_LENGTH = 8;
export const DEFAULT_AUTH_REDIRECT = '/dashboard';

export interface RegisterFormInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginFormInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthClientResult {
  data?: unknown;
  error?: {
    message?: string;
    code?: string;
    status?: number;
  } | null;
}

export interface AuthClientForRegister {
  signUp: {
    email(input: {
      name: string;
      email: string;
      password: string;
    }): Promise<AuthClientResult>;
  };
}

export interface AuthClientForLogin {
  signIn: {
    email(input: {
      email: string;
      password: string;
      rememberMe?: boolean;
    }): Promise<AuthClientResult>;
  };
}

export interface AuthClientForSignOut {
  signOut(): Promise<AuthClientResult>;
}

export class AuthUiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthUiError';
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getSafeAuthCallbackURL(
  rawCallbackURL: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
): string {
  if (!rawCallbackURL) {
    return fallback;
  }

  if (!rawCallbackURL.startsWith('/') || rawCallbackURL.startsWith('//')) {
    return fallback;
  }

  if (/[\r\n]/.test(rawCallbackURL)) {
    return fallback;
  }

  try {
    const parsed = new URL(rawCallbackURL, 'http://localhost');
    if (parsed.origin !== 'http://localhost') {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function getCallbackURLFromSearch(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return getSafeAuthCallbackURL(params.get('callbackURL'));
}

export function validateRegisterForm(input: RegisterFormInput) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) {
    throw new AuthUiError('Nama lengkap wajib diisi.');
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new AuthUiError('Alamat email tidak valid.');
  }

  if (input.password.length < MIN_AUTH_PASSWORD_LENGTH) {
    throw new AuthUiError(`Kata sandi minimal ${MIN_AUTH_PASSWORD_LENGTH} karakter.`);
  }

  if (input.password !== input.confirmPassword) {
    throw new AuthUiError('Konfirmasi kata sandi tidak sama.');
  }

  return {
    name,
    email,
    password: input.password,
  };
}

export function validateLoginForm(input: LoginFormInput) {
  const email = input.email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new AuthUiError('Alamat email tidak valid.');
  }

  if (!input.password) {
    throw new AuthUiError('Kata sandi wajib diisi.');
  }

  return {
    email,
    password: input.password,
    rememberMe: input.rememberMe,
  };
}

function getFriendlyAuthErrorMessage(message?: string): string {
  if (!message) {
    return 'Autentikasi gagal. Silakan coba lagi.';
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes('invalid') ||
    normalized.includes('password') ||
    normalized.includes('credential')
  ) {
    return 'Email atau kata sandi tidak sesuai.';
  }

  if (normalized.includes('already') || normalized.includes('exists')) {
    return 'Email sudah terdaftar. Silakan masuk menggunakan akun tersebut.';
  }

  return message;
}

function assertAuthClientSuccess(result: AuthClientResult): void {
  if (result.error) {
    throw new AuthUiError(getFriendlyAuthErrorMessage(result.error.message));
  }
}

export async function registerCustomer(
  input: RegisterFormInput,
  client: AuthClientForRegister,
): Promise<void> {
  const payload = validateRegisterForm(input);
  const result = await client.signUp.email(payload);

  assertAuthClientSuccess(result);
}

export async function loginCustomer(
  input: LoginFormInput,
  client: AuthClientForLogin,
): Promise<void> {
  const payload = validateLoginForm(input);
  const result = await client.signIn.email(payload);

  assertAuthClientSuccess(result);
}

export async function signOutCurrentUser(client: AuthClientForSignOut): Promise<void> {
  const result = await client.signOut();

  assertAuthClientSuccess(result);
}
