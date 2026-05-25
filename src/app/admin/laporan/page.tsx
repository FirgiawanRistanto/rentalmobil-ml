'use client';

import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminLaporanPage() {
  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto w-full">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-8 flex justify-between items-center shadow-sm">
          <div className="flex items-center flex-1 max-w-xl">
            <div className="relative w-full hidden md:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
              <input className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm font-display text-slate-900 dark:text-white outline-none" placeholder="Cari laporan, transaksi, atau armada..." type="text" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors relative">
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">notifications</span>
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>
            <button className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">settings</span>
            </button>
          </div>
        </header>

        {/* Page Body */}
        <div className="p-8 min-h-screen max-w-7xl mx-auto w-full animate-fade-in">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <nav className="flex items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500 mb-2">
                <span>ADMIN</span>
                <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                <span className="text-primary dark:text-blue-400">LAPORAN PERFORMA</span>
              </nav>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Laporan Performa <span className="text-primary dark:text-blue-500 sm:hidden lg:inline">(AI Insight Edition)</span></h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Analisis profitabilitas cerdas berbasis AI untuk operasional Besan Rental.</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 text-sm">
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">description</span>
                Download Excel
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 text-sm">
                <span className="material-symbols-outlined">picture_as_pdf</span>
                Export PDF
              </button>
            </div>
          </div>

          {/* Summary Cards Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Revenue Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 dark:bg-primary/10 rounded-full group-hover:scale-110 transition-transform"></div>
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/40 text-primary dark:text-blue-400 rounded-xl">
                  <span className="material-symbols-outlined">payments</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg text-xs font-bold border border-emerald-100 dark:border-emerald-500/20">
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                  +12.5%
                </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1 uppercase tracking-wider relative z-10">Total Revenue</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white relative z-10">Rp 150.245.000</h3>
            </div>
            
            {/* AI Added Value Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 border-l-4 border-l-purple-500 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl">
                  <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>smart_toy</span>
                </div>
                <span className="text-[10px] bg-purple-600 dark:bg-purple-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm shadow-purple-500/20">AI Driven</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1 uppercase tracking-wider">AI Added Value</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Rp 12.500.000</h3>
              </div>
              <p className="text-[11px] text-purple-600 dark:text-purple-400 font-bold mt-2">Peningkatan profit via Dynamic Pricing</p>
            </div>
            
            {/* Most Rented Car Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>stars</span>
                </div>
                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-1 rounded-lg text-xs font-bold border border-blue-100 dark:border-blue-800">
                  Stable
                </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1 uppercase tracking-wider">Most Rented Car</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Innova Reborn</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">Tersewa 42 kali bulan ini</p>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Perbandingan Harga Flat vs Harga AI</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Visualisasi selisih keuntungan menggunakan model prediksi harga</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Harga Flat</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-primary dark:bg-blue-500"></span>
                  <span className="text-xs font-bold text-primary dark:text-blue-500">Harga AI</span>
                </div>
              </div>
            </div>
            
            {/* Fake Chart Area */}
            <div className="relative h-64 w-full flex items-end justify-between px-4 pb-6 mt-4">
              {/* Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="border-t border-slate-100 dark:border-slate-800 w-full h-0"></div>
                <div className="border-t border-slate-100 dark:border-slate-800 w-full h-0"></div>
                <div className="border-t border-slate-100 dark:border-slate-800 w-full h-0"></div>
                <div className="border-t border-slate-100 dark:border-slate-800 w-full h-0"></div>
                <div className="border-t border-slate-200 dark:border-slate-700 w-full h-0"></div>
              </div>
              
              {/* Chart Visuals (SVG Line Simulation) */}
              <svg className="absolute inset-0 w-full h-full p-4 overflow-visible z-10" preserveAspectRatio="none">
                {/* Flat Price Line */}
                <polyline className="transition-all" fill="none" points="0,180 250,180 500,180 750,180" stroke="currentColor" style={{ color: "var(--color-slate-200)" }} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></polyline>
                {/* AI Price Line */}
                <polyline fill="none" points="0,160 250,140 500,110 750,70" stroke="currentColor" style={{ color: "var(--color-primary)" }} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4"></polyline>
                {/* Callout Week 4 */}
                <circle cx="750" cy="70" fill="currentColor" style={{ color: "var(--color-primary)" }} r="6" stroke="white" strokeWidth="2"></circle>
              </svg>
              
              <div className="absolute right-10 top-4 z-20 hidden sm:block">
                <div className="bg-primary text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg shadow-primary/20 flex items-center gap-1 animate-bounce cursor-default">
                  <span className="material-symbols-outlined text-[12px]">add</span>
                  Rp 1.250.000
                </div>
              </div>
              
              <div className="w-full flex justify-between absolute -bottom-2 px-0 text-[10px] font-bold text-slate-400 dark:text-slate-500 relative z-20">
                <span>WEEK 1</span>
                <span>WEEK 2</span>
                <span>WEEK 3</span>
                <span>WEEK 4</span>
              </div>
            </div>
            
            {/* Dark mode support for hardcoded styles */}
            <style jsx>{`
              .dark svg polyline[stroke="currentColor"]:first-child { color: #334155 !important; }
              .dark svg polyline[stroke="currentColor"]:nth-child(2) { color: #3b82f6 !important; }
              .dark svg circle { color: #3b82f6 !important; stroke: #0f172a !important; }
            `}</style>
          </div>

          {/* Detailed Table Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/20">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">Detail Transaksi &amp; AI Gain</h4>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px] font-bold text-primary dark:text-blue-400 z-10 shadow-sm shadow-blue-500/10">AI</div>
                  <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400">M</div>
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">Filter: All Status</span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">ID Transaksi</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Mobil</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Base Price</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Predicted Price</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Profit Gain</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Status</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-8 py-5 font-bold text-slate-900 dark:text-white text-sm">#TX-99021</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                          <img className="w-full h-full object-cover" alt="Innova Reborn" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzl6DLBrgpl_XW2LUqLzs0rSV-3cPSdXPyWcsBqiog-ZBMeyjw5edc8APuR79DgMOnPVTNnjZ6x5wXtTbBpD3wJIRasIqnSp3lG4ZYcktGCU10pVl3PsUObiSCSG9kROdbvFS2h3EtZKjJ07RV0lGQ4Tnee_FvsE6NQKq5ZXJARSsF5yvOfQmTJp3IU3t3LASqFa1KHoZR-azS45DIGfDFjZmCPb1FbxH9VjKAUdHIY2CRdv7fYL0m4Z6Zsae4CoFN1MhixZ4r4Q" />
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Innova Reborn</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-slate-500 dark:text-slate-400">Rp 500.000</td>
                    <td className="px-8 py-5 text-sm font-bold text-primary dark:text-blue-400">Rp 575.000</td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">+Rp 75.000</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-100 dark:border-emerald-500/20 flex items-center w-fit gap-1.5 shadow-sm shadow-emerald-500/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> SUCCESS
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400">
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                  
                  <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-8 py-5 font-bold text-slate-900 dark:text-white text-sm">#TX-99022</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                          <img className="w-full h-full object-cover" alt="Avanza Veloz" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQ6KpE-VNqUt_W_byXdxgS7PkJxMyhqcq_wsyEBHD_Ak21-p_ZTJQc1jckgxijfdw5bqB8xkeJNq2D-YxaFmPEmQ6pcgZYQwZTPZvk3qO4czVtBWeKt8llGANgSb5d8vz-9nVsIJBozHmxSNV23cbAsXekbNEV3izpeKCZtY1Klqy9-7qVl0TtlYOm3hgLPsrsgDP5HeBGGp7ewsMGB0sOvvIFbTxSx54h3Upjdz1c2zoUGZ4rxaRdgApqIFW2SLvf_oIKHXoXXA" />
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Avanza Veloz</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-slate-500 dark:text-slate-400">Rp 350.000</td>
                    <td className="px-8 py-5 text-sm font-bold text-primary dark:text-blue-400">Rp 385.000</td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">+Rp 35.000</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-2.5 py-1 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-black rounded-lg border border-teal-100 dark:border-teal-500/20 flex items-center w-fit gap-1.5 shadow-sm shadow-teal-500/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span> FINISHED
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400">
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                  
                  <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-8 py-5 font-bold text-slate-900 dark:text-white text-sm">#TX-99025</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                          <img className="w-full h-full object-cover" alt="Pajero Sport" src="https://lh3.googleusercontent.com/aida-public/AB6AXuChOudp7zq3pC7G6yItx9QjD6Y3gesam7T2Z0JH02Qmr-9fU5FqhmqWftLNWoolwWSYIHGSZOIy53aorU_K_sEo8rbLw1img2aT4XcwD6ItY8KpH9gcIiM4EWUALuckQTLAqyNZES8IyGUuqOJPPwVEqCBX2adwMXSeAbQSYWHTEn4FRKSeUGEVVGCNH1iVlk-suKoAcsG2Iz00vSFK_vSVoArDDNCtp2LZwkG-kG1byH93RFyD7BM3Mvys3SS1JBGbbAFsfcy58Q" />
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Pajero Sport</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-slate-500 dark:text-slate-400">Rp 850.000</td>
                    <td className="px-8 py-5 text-sm font-bold text-primary dark:text-blue-400">Rp 975.000</td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">+Rp 125.000</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-100 dark:border-emerald-500/20 flex items-center w-fit gap-1.5 shadow-sm shadow-emerald-500/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> SUCCESS
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400">
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="px-8 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Menampilkan 3 dari 1,245 transaksi</p>
              <div className="flex gap-1.5 md:gap-2">
                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-primary bg-primary text-white font-bold text-xs shadow-sm shadow-primary/20">1</button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold text-xs">2</button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
