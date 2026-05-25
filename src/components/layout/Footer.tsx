'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/register' || pathname.startsWith('/dashboard')) return null;

  return (
    <footer className="bg-slate-950 text-white py-16 px-6 md:px-12 lg:px-20 w-full">
      <div className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl text-primary font-bold">directions_car</span>
              <h2 className="text-xl font-black tracking-tight">BESAN RENTAL</h2>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Layanan rental mobil terpercaya di Lampung dengan sistem cerdas dan armada kualitas premium.
            </p>
          </div>
          <div>
            <h4 className="text-lg font-bold mb-6">Navigasi</h4>
            <ul className="flex flex-col gap-4 text-slate-400 text-sm">
              <li><Link className="hover:text-primary transition-colors" href="/katalog">Katalog Mobil</Link></li>
              <li><Link className="hover:text-primary transition-colors" href="/#about">Tentang Kami</Link></li>
              <li><Link className="hover:text-primary transition-colors" href="#">Syarat &amp; Ketentuan</Link></li>
              <li><Link className="hover:text-primary transition-colors" href="#">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-bold mb-6">Kontak Kami</h4>
            <ul className="flex flex-col gap-4 text-slate-400 text-sm">
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-xl">location_on</span>
                Bandar Lampung, Lampung, Indonesia
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-xl">call</span>
                +62 812-3456-7890
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-xl">mail</span>
                halo@besanrental.id
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-bold mb-6">Social Media</h4>
            <div className="flex gap-4">
              <a className="size-10 rounded-lg bg-slate-900 flex items-center justify-center hover:bg-primary transition-all" href="#">
                <span className="material-symbols-outlined">public</span>
              </a>
              <a className="size-10 rounded-lg bg-slate-900 flex items-center justify-center hover:bg-primary transition-all" href="#">
                <span className="material-symbols-outlined">camera_enhance</span>
              </a>
              <a className="size-10 rounded-lg bg-slate-900 flex items-center justify-center hover:bg-primary transition-all" href="#">
                <span className="material-symbols-outlined">video_library</span>
              </a>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">© 2026 Besan Rental Mobil Lampung. All rights reserved.</p>
          <div className="flex gap-6 text-slate-500 text-sm">
            <a className="hover:text-white transition-colors" href="#">Privacy Policy</a>
            <a className="hover:text-white transition-colors" href="#">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
