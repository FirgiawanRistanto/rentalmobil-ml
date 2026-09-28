'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/transaksi', label: 'Transaksi', icon: 'receipt_long' },
  { href: '/admin/mobil', label: 'Mobil', icon: 'directions_car' },
  { href: '/admin/laporan', label: 'Laporan', icon: 'analytics' },
  { href: '/admin/machine-learning', label: 'Machine Learning', icon: 'modeling' },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 flex-col border-r border-white/5 bg-surface-darker p-6">
      <div className="mb-8">
        <h2 className="font-heading text-lg font-800 text-brand-gold">BESAN ADMIN</h2>
        <p className="mt-1 text-xs text-text-muted">Control Center</p>
      </div>

      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
                  : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
              }`}
              href={item.href}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-gold" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/5 pt-6">
        <Link
          className="flex items-center gap-2 px-4 py-2 text-sm text-text-muted transition-colors hover:text-text-secondary"
          href="/"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span>Kembali ke Site</span>
        </Link>
      </div>
    </aside>
  );
}
