'use client';

import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminSupirPage() {
  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased">
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto w-full">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 px-8 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Manajemen Supir</h2>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Search Bar */}
            <div className="relative group hidden md:block w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
              <input 
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-primary/20 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm outline-none text-slate-900 dark:text-white" 
                placeholder="Cari nama supir atau ID..." 
                type="text"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative">
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
              </button>
              <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <span className="material-symbols-outlined">settings</span>
              </button>
              
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2 hidden sm:block"></div>
              
              <div className="flex items-center gap-3">
                <div className="text-right hidden lg:block">
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Admin Besan</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Super Admin</p>
                </div>
                <img 
                  className="w-10 h-10 rounded-full object-cover border-2 border-primary/10" 
                  alt="Admin Profile" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBkt-IpHpMumPFSnDv5I7N95WWT9YtCE_OWsNo6pCcJxIKQS55gsS7zlO4NVXP_zre1fmPKZq1kK-L6cHkS0JlXcqmtXzTtg1JDPFVe1cqgfZE4FTjE3R6ekfGeFa86_c7FE0b6zddkX3bcwCCOD7ptJ1T9P3Zj_psnWiATdclZFUgenlKDtP8RJdDvuFr4vGgwQ4rUB-Z6d91DuL88FW3HQGRSW4_VAgBkbvLs20tP4vMlpFWmAe4G7ownOqGzB_6d-wFGCzNuvA"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <div className="p-8 space-y-8 animate-fade-in">
          
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:shadow-md transition-shadow">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Total Supir</p>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white">42</h3>
              </div>
              <div className="bg-primary/10 p-4 rounded-xl text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">groups</span>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:shadow-md transition-shadow">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Tersedia</p>
                <h3 className="text-3xl font-black text-emerald-600">28</h3>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:shadow-md transition-shadow">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Bertugas</p>
                <h3 className="text-3xl font-black text-blue-600">10</h3>
              </div>
              <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">local_taxi</span>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:shadow-md transition-shadow">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Libur</p>
                <h3 className="text-3xl font-black text-slate-500 dark:text-slate-400">4</h3>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">event_busy</span>
              </div>
            </div>
          </div>

          {/* Driver List Table Section */}
          <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
              <h4 className="font-bold text-slate-900 dark:text-white">Daftar Supir Aktif</h4>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined text-sm">filter_list</span>
                  Filter
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined text-sm">download</span>
                  Ekspor
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Supir</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">No. Telepon</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Tipe SIM</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Rating</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Driver 1 */}
                  <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img className="w-10 h-10 rounded-full object-cover" alt="Ahmad Subarjo" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDbA3paFgth57njwMsQzF-LZtu5-7dOB7Etf9zmsb0NVAUlflX3iAE8qUBrrIPxqgHX3bOGQBQIM3WRe4tAn3-RDSHeUZ6PcJ9psb3v1OYl8PknyHP8c2JzeDBH3zXllDkYmIsuRVY7OWRxgme8milLuBOwKDTAatNWpBG7Gif41c1ImHVQEoaf3niYUPkOzZcElcVbyS3Fzgg681KO0Wptosfjmh0Bxf-L7Gp0H1Omwi30_G0EoNun6d7-syayFUR9hVkJ-FLAQ"/>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">Ahmad Subarjo</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">ID: BSN-0012</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-medium">0812-3456-7890</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-md border border-primary/20 uppercase">SIM B1</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full w-fit">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                        <span className="text-xs font-bold">Tersedia</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-amber-400 text-base" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">4.9</span>
                        <span className="text-[10px] text-slate-400 font-medium">(128)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Detail">
                          <span className="material-symbols-outlined text-xl">visibility</span>
                        </button>
                        <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all" title="Edit">
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all" title="Hapus">
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Driver 2 */}
                  <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img className="w-10 h-10 rounded-full object-cover" alt="Sari Rahayu" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCeT2F1do-bPhd0LNejM-iYVl527AUl3MJMYw9pIHbqdWI1gudJW2HZfBGUtcfAqTfmlVrIDhEvenZ04fT6-z_YuVkdDsD5kpk6J41GE2yVrOAQhkJkrrCgDM4bxPINyKsv4H5QrGRCcXD9b26FbW8CubXbYhwIaDTwd4kDveQiGnYXAi2LegG3RJsBp9s7WX8JRf98pW4To9CVsZvkO4rd9lwBvj6TVI32vbb7ei7MtGawd8qDrRH4sQkEU3WMvHysW7Gil16Pdg"/>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">Sari Rahayu</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">ID: BSN-0045</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-medium">0813-8822-1100</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-md border border-primary/20 uppercase">SIM A</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full w-fit">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        <span className="text-xs font-bold">Bertugas</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-amber-400 text-base" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">4.8</span>
                        <span className="text-[10px] text-slate-400 font-medium">(95)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Detail">
                          <span className="material-symbols-outlined text-xl">visibility</span>
                        </button>
                        <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all" title="Edit">
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all" title="Hapus">
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Driver 3 */}
                  <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img className="w-10 h-10 rounded-full object-cover" alt="Budi Santoso" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8zf0qyLgAbqDNk51LaoRedtUUMCscjnBeas0ZsBGaTahf2M4NdFXKtOunXWKiEQXBnb8a2M24W7z8E_eISh0dhehIMjUAK7PEVPUtAVMM5YUq5ztU6GQIv0fzk4kP6yeN1TjSF24ij-TvKjigL6b6UQmPEzsu0sydsZGTSU8x-CF1KHkox3Pf5Kd1_7hIUQj0APkAq142zbKlCAn2jjqBEbbkiHcQuK1qEkFytdZwMElExVi_y2AcouAr8s7WViJK53IZ6945fg"/>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">Budi Santoso</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">ID: BSN-0089</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-medium">0857-1112-2233</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-md border border-primary/20 uppercase">SIM B1</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-full w-fit border border-slate-200 dark:border-slate-700">
                        <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full"></span>
                        <span className="text-xs font-bold">Libur</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-amber-400 text-base" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">4.7</span>
                        <span className="text-[10px] text-slate-400 font-medium">(210)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Detail">
                          <span className="material-symbols-outlined text-xl">visibility</span>
                        </button>
                        <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all" title="Edit">
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all" title="Hapus">
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center flex-wrap gap-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Menampilkan 1-3 dari 42 Supir</p>
              <div className="flex gap-1">
                <button className="p-2 text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button className="w-8 h-8 flex items-center justify-center text-xs font-bold bg-primary text-white rounded-lg">1</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-colors">2</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-colors">3</button>
                <button className="p-2 text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </section>


        </div>
      </main>
    </div>
  );
}
