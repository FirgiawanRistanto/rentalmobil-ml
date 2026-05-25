'use client';

import Link from 'next/link';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminTransaksiPage() {
  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased">
      {/* SideNavBar */}
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto animate-fade-in w-full">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Daftar Transaksi</h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full relative transition-colors">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>
            <button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <span className="material-symbols-outlined">help</span>
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] w-full">
          {/* Filters and Search */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 items-center hide-scroll overflow-x-auto pb-2 sm:pb-0">
              <button className="px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-white shadow-sm shrink-0">Semua</button>
              <button className="px-4 py-1.5 rounded-full text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors shrink-0">Pending</button>
              <button className="px-4 py-1.5 rounded-full text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 shadow-sm transition-colors shrink-0">
                Waiting Verification
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white font-bold">3</span>
              </button>
              <button className="px-4 py-1.5 rounded-full text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors shrink-0">Confirmed</button>
              <button className="px-4 py-1.5 rounded-full text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors shrink-0">Rejected</button>
              <button className="px-4 py-1.5 rounded-full text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors shrink-0">Completed</button>
            </div>
            
            <div className="relative w-full max-w-md text-slate-400 focus-within:text-primary transition-colors">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">search</span>
              <input 
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-transparent outline-none text-slate-900 dark:text-white transition-all shadow-sm" 
                placeholder="Cari ID Transaksi atau Nama Pelanggan..." 
                type="text"
              />
            </div>
          </div>

          {/* Transaction Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">ID Transaksi</th>
                    <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Nama Pelanggan</th>
                    <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Model Mobil</th>
                    <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Tanggal Sewa</th>
                    <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Total Bayar</th>
                    <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Status</th>
                    <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  
                  {/* Waiting Verification Row */}
                  <tr className="bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-primary">#BRM-2401</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">Budi Santoso</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">Toyota Avanza 2023</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">12-14 Okt 2023</td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">Rp 1.200.000</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                        Waiting Verification
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors shadow-sm flex items-center justify-center" title="Lihat Bukti">
                          <span className="material-symbols-outlined text-sm">visibility</span>
                        </button>
                        <button className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-colors flex items-center justify-center" title="Setujui">
                          <span className="material-symbols-outlined text-sm">check</span>
                        </button>
                        <button className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 shadow-sm transition-colors flex items-center justify-center" title="Tolak">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Pending Row */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">#BRM-2402</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">Siti Aminah</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">Honda Brio RS</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">15 Okt 2023</td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">Rp 350.000</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Pending
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors shadow-sm flex items-center justify-center" title="Lihat Detail">
                          <span className="material-symbols-outlined text-sm">visibility</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Confirmed Row */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">#BRM-2403</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">Andi Wijaya</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">Mitsubishi Xpander</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">10-12 Okt 2023</td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">Rp 1.800.000</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                        Confirmed
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors shadow-sm flex items-center justify-center" title="Lihat Detail">
                          <span className="material-symbols-outlined text-sm">visibility</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Completed Row */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">#BRM-2404</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">Rina Kartika</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">Toyota Innova Reborn</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">08-10 Okt 2023</td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">Rp 2.100.000</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                        Completed
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors shadow-sm flex items-center justify-center" title="Lihat Detail">
                          <span className="material-symbols-outlined text-sm">visibility</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Rejected Row */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">#BRM-2405</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">Doni Siregar</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">Toyota Fortuner</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">05-07 Okt 2023</td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">Rp 3.500.000</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                        Rejected
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors shadow-sm flex items-center justify-center" title="Lihat Alasan">
                          <span className="material-symbols-outlined text-sm">info</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                </tbody>
              </table>
            </div>
            
            {/* Pagination Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">Menampilkan <span className="font-bold text-slate-900 dark:text-slate-100">1-5</span> dari <span className="font-bold text-slate-900 dark:text-slate-100">42</span> transaksi</p>
              <div className="flex gap-2">
                <button disabled className="px-3 py-1.5 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-not-allowed">Sebelumnya</button>
                <button className="px-3 py-1.5 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">Selanjutnya</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
