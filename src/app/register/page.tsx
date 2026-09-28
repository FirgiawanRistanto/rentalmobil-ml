'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthUiError, registerCustomer } from '@/lib/auth-ui';

export default function RegisterPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await registerCustomer(
        {
          name: String(formData.get('name') ?? ''),
          email: String(formData.get('email') ?? ''),
          password: String(formData.get('password') ?? ''),
          confirmPassword: String(formData.get('confirmPassword') ?? ''),
        },
        authClient,
      );

      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof AuthUiError
          ? error.message
          : 'Gagal membuat akun. Silakan coba lagi.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <div className="w-full max-w-[450px] rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-10">
        <div className="mb-9 text-center">
          <Link className="inline-flex flex-col items-center gap-2" href="/">
            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">XYZ Rental</span>
            <img
              alt="Logo XYZ Rental"
              className="h-20 w-20 object-contain"
              src="/auth-logo.png"
            />
          </Link>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Buat akun baru</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Daftar untuk mulai menyewa</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="name">Nama Lengkap</label>
            <input
              autoComplete="name"
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              id="name"
              name="name"
              required
              type="text"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="email">Alamat Email</label>
            <input
              autoComplete="email"
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              id="email"
              name="email"
              required
              type="email"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="password">Kata Sandi</label>
            <input
              autoComplete="new-password"
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              id="password"
              name="password"
              required
              type="password"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="confirmPassword">Konfirmasi Kata Sandi</label>
            <input
              autoComplete="new-password"
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              id="confirmPassword"
              name="confirmPassword"
              required
              type="password"
            />
          </div>

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
            {isSubmitting ? 'Memproses...' : 'Daftar Akun'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
          Sudah punya akun?
          <Link className="ml-1 font-bold text-primary transition-colors hover:text-primary/80" href="/login">Masuk</Link>
        </p>
      </div>
    </main>
  );
}
