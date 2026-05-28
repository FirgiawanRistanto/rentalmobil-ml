'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { signOutCurrentUser } from '@/lib/auth-ui';

export default function UserDashboard() {
  const router = useRouter();
  const session = authClient.useSession();
  const user = session.data?.user as { name?: string | null; email?: string | null } | undefined;
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = user?.name || user?.email || 'Customer';

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
    <div className="layout-container flex h-full grow flex-col font-display text-slate-900 dark:text-slate-100 min-h-screen bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 lg:px-40">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 text-primary">
            <div className="size-8 flex items-center justify-center bg-primary/10 rounded-lg">
              <span className="material-symbols-outlined text-primary">directions_car</span>
            </div>
            <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight">Besan Rental</h2>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link className="text-primary text-sm font-semibold leading-normal" href="/dashboard">Dashboard</Link>
            <Link className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-normal hover:text-primary transition-colors" href="/katalog">Armada</Link>
            <Link className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-normal hover:text-primary transition-colors" href="#">Booking</Link>
            <Link className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-normal hover:text-primary transition-colors" href="#">Bantuan</Link>
          </nav>
        </div>
        <div className="flex flex-1 justify-end gap-4 items-center">
          <label className="hidden sm:flex flex-col min-w-40 h-10 max-w-64">
            <div className="flex w-full flex-1 items-stretch rounded-xl h-full">
              <div className="text-slate-400 flex border-none bg-slate-100 dark:bg-slate-800 items-center justify-center pl-4 rounded-l-xl">
                <span className="material-symbols-outlined text-xl">search</span>
              </div>
              <input className="form-input flex w-full min-w-0 flex-1 border-none bg-slate-100 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 h-full placeholder:text-slate-500 px-4 rounded-r-xl text-sm outline-none" placeholder="Cari pemesanan..." defaultValue="" />
            </div>
          </label>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col justify-center">
              <p className="text-sm font-bold leading-none">{displayName}</p>
              {user?.email ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
              ) : null}
            </div>
            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-primary/10" data-alt="User profile avatar" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBKtetH9kdRGYYg_p5FgiN9EEhy4qoPa-tISCDNhgWCB3jH8eFJLDQWcHbIUZucRxzPj-iYndH4z91mXD3xBz7OFRuR5kmWi7lqCJnyqJ3cJUJRpj2CEAaOVg3AozE_upZsxZwYEJM0eryX4knwmb-XYwa809F-Lg-GYbVCpEGF22mKgxK2hYo2jvf_hVCoJ8u_8A_p3BG85OfHZOBR6gV3togtJ9m-5Bv6njXOvx0ypMccxyLfwwYZ2X0xk1Ld_qrQ-S7EFKYIeQ")' }}></div>
            <button
              className="hidden sm:flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:text-slate-300"
              disabled={isSigningOut}
              onClick={handleSignOut}
              type="button"
            >
              {isSigningOut ? 'Keluar...' : 'Logout'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 justify-center py-8 px-6 lg:px-40">
        <div className="layout-content-container flex flex-col max-w-[1200px] flex-1 gap-8">
          <section className="flex flex-wrap justify-between items-start gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-slate-900 dark:text-white text-3xl font-black leading-tight tracking-tight">Selamat datang, {displayName}</h1>
              <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">Kelola penyewaan mobil Anda dengan mudah di dashboard Besan Rental Mobil Lampung.</p>
            </div>
            <Link href="/katalog" className="flex min-w-[160px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl h-12 px-6 bg-primary text-white text-sm font-bold transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 hover:-translate-y-0.5 active:scale-95">
              <span className="material-symbols-outlined text-lg">add_circle</span>
              <span>Sewa Mobil Baru</span>
            </Link>
          </section>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-3 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">calendar_today</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full">+20%</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Bookings</p>
              <p className="text-slate-900 dark:text-white text-3xl font-bold">12</p>
            </div>
            <div className="flex flex-col gap-3 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-blue-500 bg-blue-500/10 p-2 rounded-lg">key</span>
                <span className="text-slate-500 text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">Tetap</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Active Rentals</p>
              <p className="text-slate-900 dark:text-white text-3xl font-bold">1</p>
            </div>
            <div className="flex flex-col gap-3 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-purple-500 bg-purple-500/10 p-2 rounded-lg">task_alt</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full">+10%</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Completed Trips</p>
              <p className="text-slate-900 dark:text-white text-3xl font-bold">10</p>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight">Riwayat Pemesanan</h2>
                <div className="flex flex-wrap items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
                  <span className="material-symbols-outlined text-[16px] text-blue-600 dark:text-blue-400">smart_toy</span>
                  <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Harga diprediksi oleh AI</span>
                </div>
              </div>
              <Link className="text-primary text-sm font-semibold hover:underline" href="/katalog">Booking Baru</Link>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">ID</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Tanggal</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Mobil</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Durasi</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Total</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    { id: '#BRM-005', date: '22 Okt 2023', car: 'Toyota Innova Zenix', duration: '2 Hari', total: 'Rp 1.200.000', status: 'Rejected', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dotClass: 'bg-red-600', icon: '🔴', routeId: 'BRN-005' },
                    { id: '#BRM-004', date: '20 Okt 2023', car: 'Suzuki Ertiga Hybrid', duration: '4 Hari', total: 'Rp 1.400.000', status: 'Pending', badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800', dotClass: 'bg-amber-600', icon: '🟡', routeId: 'BRN-004' },
                    { id: '#BRM-003', date: '18 Okt 2023', car: 'Honda Brio RS', duration: '1 Hari', total: 'Rp 350.000', status: 'Waiting Verification', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800', dotClass: 'bg-blue-600', icon: '🔵', routeId: 'BRN-003' },
                    { id: '#BRM-002', date: '15 Okt 2023', car: 'Mitsubishi Xpander Ultimate', duration: '2 Hari', total: 'Rp 900.000', status: 'Confirmed', badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800', dotClass: 'bg-emerald-600', icon: '🟢', hasDriver: true, routeId: 'BRN-002' },
                    { id: '#BRM-001', date: '12 Okt 2023', car: 'Toyota Avanza Veloz', duration: '3 Hari', total: 'Rp 1.050.000', status: 'Completed', badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700', iconClass: 'check_circle', icon: '✅', routeId: 'BRN-001' },
                  ].map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4 text-sm font-semibold text-primary">{item.id}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{item.date}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-col">
                          <span className="text-slate-900 dark:text-white font-medium group-hover:text-primary transition-colors">{item.car}</span>
                          {item.hasDriver && (
                            <div className="mt-1 flex items-center gap-2 group/driver relative w-fit">
                              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                                <span className="material-symbols-outlined text-[14px] text-emerald-600">person</span>
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">Info Driver</span>
                              </div>
                              <div className="invisible group-hover/driver:visible absolute left-0 top-full mt-2 z-20 w-48 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Kontak Driver</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Budi Santoso</p>
                                <a className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1 mt-1 hover:underline" href="https://wa.me/628123456789" onClick={(e) => e.stopPropagation()}>
                                  <span className="material-symbols-outlined text-sm">chat</span> +62 812-3456-789
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{item.duration}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{item.total}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${item.badgeClass}`}>
                          {item.iconClass ? (
                            <span className="material-symbols-outlined text-[14px]">{item.iconClass}</span>
                          ) : (
                            <span className={`size-1.5 rounded-full ${item.dotClass}`}></span>
                          )}
                          {item.icon} {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-8 mt-4 mb-10">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex items-center gap-6 shadow-sm">
              <div className="size-20 md:size-24 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-primary">support_agent</span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Butuh Bantuan?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">Tim support kami siap membantu perjalanan Anda 24/7 di seluruh area Lampung.</p>
                <Link className="mt-2 text-primary text-sm font-bold inline-flex items-center gap-1 hover:underline" href="#">
                  Hubungi Kami <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 px-6 lg:px-40 mt-auto">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">© 2023 Besan Rental Mobil Lampung. Semua hak dilindungi.</p>
          <div className="flex gap-6">
            <Link className="text-slate-500 hover:text-primary text-sm transition-colors" href="#">Syarat &amp; Ketentuan</Link>
            <Link className="text-slate-500 hover:text-primary text-sm transition-colors" href="#">Kebijakan Privasi</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
