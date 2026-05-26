'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { signOutCurrentUser } from '@/lib/auth-ui';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = authClient.useSession();
  const user = session.data?.user as { name?: string | null; email?: string | null; role?: string | null } | undefined;
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (pathname === '/login' || pathname === '/register' || pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) return null;

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await signOutCurrentUser(authClient);
      router.push('/');
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md px-6 md:px-12 lg:px-20 py-4">

      <div className="flex items-center justify-between w-full">
        <Link href="/" className="flex items-center gap-3">
          <div className="text-primary">
            <span className="material-symbols-outlined text-3xl font-bold">directions_car</span>
          </div>
          <h2 className="text-primary text-xl font-black leading-tight tracking-tight uppercase">Besan Rental</h2>
        </Link>
        <div className="flex flex-1 justify-end items-center gap-8">
          <nav className="hidden md:flex items-center gap-8">
            <Link className="text-slate-700 dark:text-slate-200 text-sm font-semibold hover:text-primary transition-colors" href="/katalog">Katalog</Link>
            <Link className="text-slate-700 dark:text-slate-200 text-sm font-semibold hover:text-primary transition-colors" href="/#about">Tentang Kami</Link>
          </nav>
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href={user.role === 'ADMIN' ? '/admin' : '/dashboard'}
                className="hidden sm:flex min-w-[100px] cursor-pointer items-center justify-center rounded-lg h-10 px-4 border border-slate-200 bg-white text-slate-700 text-sm font-bold transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {user.name || user.email || 'Akun Saya'}
              </Link>
              <button
                className="flex min-w-[96px] cursor-pointer items-center justify-center rounded-lg h-10 px-5 bg-primary text-white text-sm font-bold transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
                disabled={isSigningOut}
                onClick={handleSignOut}
                type="button"
              >
                {isSigningOut ? 'Keluar...' : 'Logout'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/register" className="hidden sm:flex min-w-[100px] cursor-pointer items-center justify-center rounded-lg h-10 px-5 border border-slate-200 bg-white text-slate-700 text-sm font-bold transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <span>Register</span>
              </Link>
              <Link href="/login" className="flex min-w-[100px] cursor-pointer items-center justify-center rounded-lg h-10 px-6 bg-primary text-white text-sm font-bold transition-transform hover:scale-105 active:scale-95">
                <span>Login</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
