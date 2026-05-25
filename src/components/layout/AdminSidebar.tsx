'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { href: '/admin', label: 'Overview', icon: '📊' },
  { href: '/admin/transactions', label: 'Transaksi', icon: '💳' },
  { href: '/admin/fleet', label: 'Armada', icon: '🚗' },
  { href: '/admin/drivers', label: 'Supir', icon: '👤' },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-surface-darker border-r border-white/5 p-6 flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-heading text-lg font-800 text-brand-gold">BESAN ADMIN</h2>
        <p className="text-xs text-text-muted mt-1">Control Center</p>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-gold" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto pt-6 border-t border-white/5">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          <span>←</span>
          <span>Kembali ke Site</span>
        </Link>
      </div>
    </aside>
  );
}
