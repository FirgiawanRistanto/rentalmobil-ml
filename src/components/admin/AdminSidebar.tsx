'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { signOutCurrentUser } from '@/lib/auth-ui';

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = authClient.useSession();
  const user = session.data?.user as { name?: string | null; email?: string | null } | undefined;
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = user?.name || 'Admin';
  const displayEmail = user?.email || 'Akun admin';

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

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: 'dashboard' },
    { name: 'Transaksi', href: '/admin/transaksi', icon: 'receipt_long' },
    { name: 'Mobil', href: '/admin/mobil', icon: 'minor_crash' },
    { name: 'Laporan', href: '/admin/laporan', icon: 'analytics' },
    { name: 'Machine Learning', href: '/admin/machine-learning', icon: 'modeling' },
    { name: 'Random Forest', href: '/admin/random-forest', icon: 'device_hub' },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden lg:flex flex-col sticky top-0 h-screen shrink-0 z-20">
      <div className="p-6 flex flex-col pt-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-primary/10 rounded-xl p-2.5 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl">directions_car</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white leading-tight">Besan Rental</h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Admin Panel</p>
          </div>
        </div>
        
        <nav className="flex flex-col gap-1.5 grow">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`));
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-primary text-white shadow-md shadow-primary/20 font-bold' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-100 dark:border-slate-800/50">        
        <div className="flex items-center gap-3 px-4 py-2 mt-2 group">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white dark:border-slate-800 overflow-hidden shadow-sm group-hover:border-primary transition-colors">
            <img alt="Admin Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqUvJnPNDhwoZuxZR-Yzud-32ZKi8QWY7jNAoBbzvrPBXiUBkspvijruhbCFv5BPEnvDEdL7Hk9l4Xj6dswep9Fm9e-MroY34VOtS_Qi3FU20m5xS5GQ1BNLtVRcvEF_1hpc2MTT6DLpYIN_JmTiG0jPj8SEu3cC6oS9p6twmowvAfyhPmPgnleW4vUcAs9sqA5-SPlCtgm8wmnDa4SMvhn3YEjQ2eGVTU6Q5om3FC2lY8NKjaMzmmpO4OPDgRskM_pain9QRH2g"/>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold leading-none text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">{displayName}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">{displayEmail}</p>
          </div>
        </div>
        <button
          className="mt-3 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-70 dark:text-slate-400 dark:hover:bg-slate-800"
          disabled={isSigningOut}
          onClick={handleSignOut}
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          {isSigningOut ? 'Keluar...' : 'Logout'}
        </button>
      </div>
    </aside>
  );
}
