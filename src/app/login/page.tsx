'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import {
  AuthUiError,
  getAuthRedirectForRole,
  getAuthUserRole,
  loginCustomer,
  readAuthenticatedRole,
} from '@/lib/auth-ui';

export default function LoginPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const loginData = await loginCustomer(
        {
          email: String(formData.get('email') ?? ''),
          password: String(formData.get('password') ?? ''),
          rememberMe: formData.get('remember-me') === 'on',
        },
        authClient,
      );

      const role = getAuthUserRole(loginData) ?? (await readAuthenticatedRole(authClient));
      const redirectTo = getAuthRedirectForRole(window.location.search, role);
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof AuthUiError
          ? error.message
          : 'Gagal masuk. Silakan coba lagi.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <div className="w-full max-w-[450px] rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-10">
        <div className="mb-9 text-center">
          <div className="inline-flex flex-col items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">XYZ Rental</span>
            <img
              alt="Logo XYZ Rental"
              className="h-20 w-20 object-contain"
              src="/auth-logo.png"
            />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Selamat datang kembali</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Silakan masuk ke akun Anda</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="email">Alamat Email</label>
            <input
              autoComplete="email"
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              id="email"
              name="email"
              placeholder="name@company.com"
              required
              type="email"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="password">Kata Sandi</label>
            <div className="relative">
              <input
                autoComplete="current-password"
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-3 pr-11 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                id="password"
                name="password"
                placeholder="••••••••"
                required
                type={showPassword ? 'text' : 'password'}
              />
              <button
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          {/* <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300" htmlFor="remember-me">
              <input className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800" id="remember-me" name="remember-me" type="checkbox" />
              Ingat saya selama 30 hari
            </label>
          </div> */}

          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          <button
            className="flex w-full justify-center rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-background-dark"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
          Belum punya akun?
          <Link className="ml-1 font-bold text-primary transition-colors hover:text-primary/80" href="/register">Daftar akun baru</Link>
        </p>
      </div>
    </main>
  );
}
