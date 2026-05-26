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
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark antialiased">
      {/* Left Side: Form Section */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-24">
        <div className="mx-auto w-full max-w-md animate-fade-in md:py-10">
          <Link href="/" className="mb-10 flex items-center gap-3 w-fit">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
              <span className="material-symbols-outlined">directions_car</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Besan Rental Mobil</h1>
          </Link>
          
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Daftar Akun</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400 relative z-10">Bergabunglah dengan Besan Rental Mobil Lampung untuk memulai perjalanan Anda.</p>
          </div>
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold leading-6 text-slate-900 dark:text-slate-200" htmlFor="name">Nama Lengkap</label>
              <div className="mt-2">
                <input autoComplete="name" className="block w-full rounded-xl border border-slate-200 py-3 px-4 text-slate-900 shadow-sm placeholder:text-slate-400 focus:ring-1 focus:ring-primary focus:border-primary outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white sm:text-sm sm:leading-6 transition-colors" id="name" name="name" placeholder="Nama Lengkap" required type="text"/>
              </div>
            </div>
            
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold leading-6 text-slate-900 dark:text-slate-200" htmlFor="email">Alamat Email</label>
              <div className="mt-2">
                <input autoComplete="email" className="block w-full rounded-xl border border-slate-200 py-3 px-4 text-slate-900 shadow-sm placeholder:text-slate-400 focus:ring-1 focus:ring-primary focus:border-primary outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white sm:text-sm sm:leading-6 transition-colors" id="email" name="email" placeholder="example@email.com" required type="email"/>
              </div>
            </div>
            
            {/* Password Grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold leading-6 text-slate-900 dark:text-slate-200" htmlFor="password">Kata Sandi</label>
                <div className="mt-2">
                  <input autoComplete="new-password" className="block w-full rounded-xl border border-slate-200 py-3 px-4 text-slate-900 shadow-sm placeholder:text-slate-400 focus:ring-1 focus:ring-primary focus:border-primary outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white sm:text-sm sm:leading-6 transition-colors" id="password" name="password" placeholder="••••••••" required type="password"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold leading-6 text-slate-900 dark:text-slate-200" htmlFor="confirmPassword">Konfirmasi Kata Sandi</label>
                <div className="mt-2">
                  <input autoComplete="new-password" className="block w-full rounded-xl border border-slate-200 py-3 px-4 text-slate-900 shadow-sm placeholder:text-slate-400 focus:ring-1 focus:ring-primary focus:border-primary outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white sm:text-sm sm:leading-6 transition-colors" id="confirmPassword" name="confirmPassword" placeholder="••••••••" required type="password"/>
                </div>
              </div>
            </div>
            
            {errorMessage ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                {errorMessage}
              </p>
            ) : null}
            
            <div className="pt-4">
              <button className="flex w-full justify-center rounded-xl bg-primary px-3 py-3.5 text-sm font-bold leading-6 text-white shadow-sm hover:bg-primary/90 hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 transition-all" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Memproses...' : 'Daftar Sekarang'}
              </button>
            </div>
          </form>
          
          <p className="mt-10 text-center text-sm text-slate-500">
            Sudah punya akun?
            <Link className="font-bold leading-6 text-primary hover:text-primary/80 ml-1 transition-colors" href="/login">Kembali ke Login</Link>
          </p>
        </div>
      </div>

      {/* Right Side: Image/Hero Section */}
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0 h-full w-full bg-slate-900">
          <img alt="Luxury car parked on a scenic road in Lampung" className="absolute inset-0 h-full w-full object-cover opacity-70" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC8_WjSUrUnPLv_AK8psj2yPlC7N5VhdsYXGzvwnH-3EoAnhy5q-C4lWEh0DA1mr6Vp65aEs2CKAqhhieTYvQAIcvcnHpAw_XvdS0P5z4V1ex1dFb8x6m5K9orZPNyOb7mGSPoWWWL-x1AaxGgbnvbXTpJUjc7pN-qkLPsLV4Fv0oHuCx1Z2R44hz2N66DS6zkqVBwS5sDKbWbGJ-Wx8NLB-94HkLlNPwfJplukpaDndjAK7FMh3aWLPa2BIeHslbZwNWxJM0jqGQ"/>
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-20 text-white">
            <h3 className="text-4xl font-black mb-4 leading-tight">Transportasi Terpercaya <br/>untuk Perjalanan Lampung Anda</h3>
            <p className="text-lg text-slate-200 max-w-md">Rasakan layanan rental mobil terbaik dengan berbagai kendaraan terawat untuk semua kebutuhan Anda.</p>
            <div className="mt-8 flex gap-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary bg-white rounded-full p-1 text-sm">support_agent</span>
                <span className="text-sm font-medium">Layanan 24/7</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary bg-white rounded-full p-1 text-sm">time_to_leave</span>
                <span className="text-sm font-medium">Armada Terbaru</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary bg-white rounded-full p-1 text-sm">sell</span>
                <span className="text-sm font-medium">Harga Terbaik</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
