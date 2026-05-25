'use client';

import Link from 'next/link';
import { useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminDashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Dynamic Occupancy Logic
  const totalUnits = 9;
  const rentedUnits = 7; // Admin bisa ganti nilai ini nanti dari API backend
  const occupancyRate = Math.round((rentedUnits / totalUnits) * 100);

  let occBorderClass = "border-l-emerald-500";
  let occIconBgClass = "bg-emerald-500/10";
  let occIconTextClass = "text-emerald-500";
  let occBadgeBgClass = "bg-emerald-500";

  if (occupancyRate >= 81) { // 81% - 100% Kritis
    occBorderClass = "border-l-red-500";
    occIconBgClass = "bg-red-500/10";
    occIconTextClass = "text-red-500";
    occBadgeBgClass = "bg-red-500";
  } else if (occupancyRate >= 51) { // 51% - 80% Padat
    occBorderClass = "border-l-amber-500";
    occIconBgClass = "bg-amber-500/10";
    occIconTextClass = "text-amber-500";
    occBadgeBgClass = "bg-amber-500";
  }

  return (
    <>
      <div className={`flex min-h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased transition-all duration-300 ${(isModalOpen || isRejectModalOpen) ? 'blur-sm pointer-events-none' : ''}`}>
      {/* Sidebar Navigation */}
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full text-slate-400 focus-within:text-primary">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl pointer-events-none">search</span>
              <input 
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-2 pl-10 pr-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-shadow" 
                placeholder="Search analytics, bookings, or cars..." 
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg relative transition-colors">
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
              </button>
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200 dark:border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-none text-slate-900 dark:text-white">Super Admin</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Administrator</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-primary/20">
                <img alt="Admin Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqUvJnPNDhwoZuxZR-Yzud-32ZKi8QWY7jNAoBbzvrPBXiUBkspvijruhbCFv5BPEnvDEdL7Hk9l4Xj6dswep9Fm9e-MroY34VOtS_Qi3FU20m5xS5GQ1BNLtVRcvEF_1hpc2MTT6DLpYIN_JmTiG0jPj8SEu3cC6oS9p6twmowvAfyhPmPgnleW4vUcAs9sqA5-SPlCtgm8wmnDa4SMvhn3YEjQ2eGVTU6Q5om3FC2lY8NKjaMzmmpO4OPDgRskM_pain9QRH2g"/>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 space-y-8 overflow-y-auto animate-fade-in">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-lg">
                  <span className="material-symbols-outlined">payments</span>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full">+12%</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Revenue</p>
              <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">Rp 18.5M</p>
            </div>
            
            <div className={`bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 ${occBorderClass} hover:shadow-md transition-shadow`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg ${occIconBgClass} ${occIconTextClass}`}>
                  <span className="material-symbols-outlined">analytics</span>
                </div>
                <div className="text-right">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${occIconTextClass}`}>Live Tracking</p>
                </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Tingkat Okupansi</p>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{rentedUnits}/{totalUnits} Unit</p>
                <span className={`px-2 py-0.5 text-white text-[10px] font-bold rounded-full shadow-sm ${occBadgeBgClass}`}>{occupancyRate}%</span>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-lg">
                  <span className="material-symbols-outlined">psychology</span>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full">+12.5%</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Peningkatan Revenue (AI)</p>
              <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">Rp 2.3M</p>
            </div>
            
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-lg">
                  <span className="material-symbols-outlined">target</span>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-full">High</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Akurasi Prediksi AI</p>
              <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">98.2%</p>
            </div>
          </div>

          {/* Main Grid Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Chart Section */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pendapatan 7 Hari Terakhir</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Analisis pendapatan mingguan vs Prediksi AI</p>
                </div>
                <button className="flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors">
                  View Full Report
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                </button>
              </div>
              <div className="h-64 relative">
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                      <stop className="text-primary" offset="0%" stopColor="currentColor" stopOpacity="0.2"></stop>
                      <stop className="text-primary" offset="100%" stopColor="currentColor" stopOpacity="0"></stop>
                    </linearGradient>
                  </defs>
                  <path d="M0,250 Q100,230 200,180 T400,140 T600,190 T800,100 T1000,80 L1000,300 L0,300 Z" fill="url(#chartGradient)"></path>
                  <path className="text-primary" d="M0,250 Q100,230 200,180 T400,140 T600,190 T800,100 T1000,80" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4"></path>
                  <path className="text-slate-300 dark:text-slate-700" d="M0,260 Q100,240 200,190 T400,150 T600,200 T800,110 T1000,90" fill="none" stroke="currentColor" strokeDasharray="8,8" strokeLinecap="round" strokeWidth="2"></path>
                  <circle className="text-primary fill-current stroke-white dark:stroke-slate-900" cx="200" cy="180" r="6" strokeWidth="2"></circle>
                  <circle className="text-primary fill-current stroke-white dark:stroke-slate-900" cx="400" cy="140" r="6" strokeWidth="2"></circle>
                  <circle className="text-primary fill-current stroke-white dark:stroke-slate-900" cx="600" cy="190" r="6" strokeWidth="2"></circle>
                  <circle className="text-primary fill-current stroke-white dark:stroke-slate-900" cx="800" cy="100" r="6" strokeWidth="2"></circle>
                </svg>
                <div className="flex justify-between mt-4 text-xs font-medium text-slate-400 uppercase tracking-tighter">
                  <span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span>
                </div>
              </div>
            </div>

            {/* Fleet Visual Grid */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Status Armada (Visual)</h3>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {/* Visual grid cars mapping */}
                {[
                  { id: 1, type: 'ready' },
                  { id: 2, type: 'rented' },
                  { id: 3, type: 'maintenance' },
                  { id: 4, type: 'ready' },
                  { id: 5, type: 'pending' },
                  { id: 6, type: 'ready' },
                  { id: 7, type: 'rented' },
                  { id: 8, type: 'ready' },
                  { id: 9, type: 'ready' },
                ].map((slot) => (
                  <div 
                    key={slot.id} 
                    className={`aspect-square rounded-lg border-2 flex items-center justify-center relative cursor-pointer hover:scale-105 transition-transform ${
                      slot.type === 'ready' ? 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-500 text-emerald-600' :
                      slot.type === 'rented' ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-500 text-blue-600' :
                      slot.type === 'pending' ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-500 text-amber-600' :
                      'bg-red-100 dark:bg-red-500/20 border-red-500 text-red-600'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {slot.type === 'maintenance' ? 'build' : slot.type === 'pending' ? 'timer' : slot.type === 'rented' ? 'person_pin_circle' : 'directions_car'}
                    </span>
                    {slot.id === 1 && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></div>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-auto">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Ready (5)</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div> On Trip (2)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Pending (1)</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div> Repair (1)</span>
                </div>
              </div>
              <button className="mt-6 w-full py-3 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Manage Fleet
              </button>
            </div>
          </div>

          {/* AI Activity Log & Recent Transactions */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* Recent Transactions Table */}
            <div className="xl:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transaksi Terbaru</h3>
                <div className="flex items-center gap-2">
                  <button className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-xl">filter_list</span>
                  </button>
                  <button className="px-4 py-2 bg-primary hover:bg-primary/90 transition-colors text-white text-sm font-bold rounded-lg shadow-sm">
                    New Booking
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Transaction ID</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Car Model</th>
                      <th className="px-6 py-4">Amount (AI Breakdown)</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {/* Row 1 */}
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 font-bold text-primary">#BRM-2401</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                            <img alt="Ahmad" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAodziFgr2sm4TfqBr8lOaghmPukfF3iZxTVvLKOf0jeva7N-Uxv0VUTECK0Xq4vmCFRFDfzNf5j-JuJiA9pc1cjNRYO0WjYc0gSUqKTShJdxDYMbknZd8Ej2yGL6EyOP13bbnLV1nR-eBTj_XsYAzpPw2bv1KXBq3cyJIcKkEuPcRsEsJbGyj2wUMCUTkyBmvsWMl4sKAhZzqZm49F4lsZZtsx1j02DjZkDijB2PSjEwoFMfLD6TEWvBfmDYEoHzhrNif2bynrlw"/>
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white">Ahmad Kurniawan</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">Toyota Avanza 2023</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">Rp 450.000</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">(Base: 350k + High Occ: 25% + Week: 10%)</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30">Confirmed</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-primary transition-colors p-1"><span className="material-symbols-outlined text-lg">more_vert</span></button>
                      </td>
                    </tr>
                    
                    {/* Row 2 */}
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 font-bold text-primary">#BRM-2402</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                            <img alt="Sarah" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjqa8OQxhPM3LeNaeJPHoaD4opOW0lzFZqo8tzINSNNV48vGORSh4R8JQKlLHtai3YD0QobEAxLzxqaYR38fMP3WG4guIUHvFx2b9YL85ojfHDZMqGgXNTg83uYHU_s2MPQzcKXrPRWwv3h3YuSfIIL5DIPSY2cI0k-dSem1cZcAnCJvrlZAbCV7QuPzWlIOoA5Cs1UOw0AJ7z1ihhKuOK5ZrRAS56FIOn6phnBP6w-4Tc2UnISm7vduTIHapLs-xK6XMLNBbEKw"/>
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white">Sarah Wijaya</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">Honda CR-V Hybrid</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">Rp 1.200.000</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">(Base: 950k + Holiday: 20% + Demand: 5%)</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => setIsModalOpen(true)} className="px-3 py-1 bg-amber-500 text-white text-[11px] font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-sm">Cek Bukti</button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-primary transition-colors p-1"><span className="material-symbols-outlined text-lg">more_vert</span></button>
                      </td>
                    </tr>
                    
                    {/* Row 3 */}
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 font-bold text-primary">#BRM-2403</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                            <img alt="Budi" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCUYQzeqXk9C26Np2wcU7pQsFQHg3xCxsXbilYjqDL7HPPOrrbaV66ROpXQpj8mVO4zSueAcTxj8LXAU6xYnNxSVEreNZLgYsmBnP3EbGYXx919LBAiqjBViSZ1kkuG81GdRTN8iHA6AjCxWwgsAXkiBs258W3ViPmMximswXEAJt1W7XXy8vyGlfSgXWvIAtOGNuYpZ4v3lfKnXIXsLmVGJGrELuVkG8NDGAGz0-HcF5Ayg0Wv7mCVXuAWHoa20vWdOjpWrZL2eg"/>
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white">Budi Santoso</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">Mitsubishi Xpander</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">Rp 550.000</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">(Base: 500k + Supply: 10%)</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30">Confirmed</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-primary transition-colors p-1"><span className="material-symbols-outlined text-lg">more_vert</span></button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI Activity Log */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-lg">history_edu</span>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Log Aktivitas AI</h3>
                </div>
              </div>
              <div className="flex-1 p-6 space-y-6">
                
                <div className="flex gap-4 relative pb-6 border-l-2 border-slate-100 dark:border-slate-800 ml-2 pl-6">
                  <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-emerald-500 border-4 border-white dark:border-slate-900 shadow-sm pointer-events-none"></div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Harga Dinamis Diperbarui</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">Sistem menaikkan harga unit Avanza (+15%) berdasarkan lonjakan permintaan wilayah BSD.</p>
                    <span className="text-[10px] font-bold text-slate-400 mt-2.5 block uppercase tracking-wider">2 menit yang lalu</span>
                  </div>
                </div>

                <div className="flex gap-4 relative pb-6 border-l-2 border-slate-100 dark:border-slate-800 ml-2 pl-6">
                  <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-blue-500 border-4 border-white dark:border-slate-900 shadow-sm pointer-events-none"></div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Prediksi Stok Rendah</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">Prediksi okupansi 100% untuk akhir pekan depan (Akurasi: 98%).</p>
                    <span className="text-[10px] font-bold text-slate-400 mt-2.5 block uppercase tracking-wider">45 menit yang lalu</span>
                  </div>
                </div>

                <div className="flex gap-4 relative ml-2 pl-6">
                  <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-700 border-4 border-white dark:border-slate-900 shadow-sm pointer-events-none"></div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Laporan Mingguan Siap</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">Total peningkatan profit berkat AI minggu ini: 12.5%.</p>
                    <span className="text-[10px] font-bold text-slate-400 mt-2.5 block uppercase tracking-wider">2 jam yang lalu</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 mt-auto border-t border-slate-100 dark:border-slate-800">
                <button className="w-full text-center text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider p-2">Lihat Log Lengkap</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    {/* Verification Modal */}
    {isModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" id="payment-verification-modal">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
        
        {/* Modal Card */}
        <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-fade-in duration-200">
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Verifikasi Pembayaran</h3>
            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-500">close</span>
            </button>
          </div>
          
          {/* Content */}
          <div className="p-5 sm:p-6 space-y-5 sm:space-y-6 flex-1 overflow-y-auto w-full">
            {/* Receipt Preview */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bukti Transfer (Struk)</p>
              <div className="aspect-[3/4] w-full bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden relative">
                <img alt="Bank Receipt" className="w-full h-full object-contain p-4" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnA2uGat_wY54_G7M59Wz7z_Z2t8W5n3_TzF0Y8I_9Z7K9H0J-X5L2p8F3H2Y1G0"/>
              </div>
            </div>
            
            {/* Transaction Details */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Transaction ID</span>
                <span className="text-sm font-bold text-primary">#BRM-2402</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Customer</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Sarah Wijaya</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Car Model</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Honda CR-V</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Total Amount</span>
                <span className="text-lg font-bold text-emerald-600">Rp 1.200.000</span>
              </div>
            </div>
          </div>
          
          {/* Footer Actions */}
          <div className="px-5 sm:px-6 py-5 sm:py-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 shrink-0">
            <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-lg">check_circle</span>
              Konfirmasi Pembayaran
            </button>
            <button onClick={() => { setIsModalOpen(false); setIsRejectModalOpen(true); }} className="flex-1 py-3 border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-lg">cancel</span>
              Tolak / Batalkan
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Rejection Modal */}
    {isRejectModalOpen && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" id="payment-rejection-modal">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsRejectModalOpen(false)}></div>
        
        {/* Modal Card */}
        <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in duration-200">
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tolak Pembayaran</h3>
            <button onClick={() => setIsRejectModalOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-500">close</span>
            </button>
          </div>
          
          {/* Content */}
          <div className="p-5 sm:p-6 space-y-6">
            {/* Context Details */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Transaction ID</span>
                <span className="text-sm font-bold text-primary">#BRM-2402</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Customer</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Sarah Wijaya</span>
              </div>
            </div>
            
            {/* Rejection Reason */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="rejection-reason">Alasan Penolakan</label>
              <textarea 
                id="rejection-reason"
                rows={4}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all resize-none" 
                placeholder="Contoh: Bukti transfer tidak jelas atau nominal tidak sesuai..." 
              ></textarea>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Bukti tidak jelas</button>
                <button type="button" className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Nominal tidak sesuai</button>
                <button type="button" className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Akun bank tidak valid</button>
              </div>
            </div>
          </div>
          
          {/* Footer Actions */}
          <div className="px-5 sm:px-6 py-5 sm:py-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
            <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 text-sm font-bold rounded-xl transition-all">
              Batalkan
            </button>
            <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-lg">dangerous</span>
              Konfirmasi Penolakan
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
