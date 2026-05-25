'use client';

import Link from 'next/link';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminArmadaPage() {
  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 px-4 py-8 md:p-8 animate-fade-in w-full overflow-x-hidden">
        {/* Header Section */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Monitoring Armada</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Pantau status dan kondisi kendaraan secara real-time.</p>
          </div>
          <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all">
            <span className="material-symbols-outlined text-sm">add</span>
            <span>Tambah Armada</span>
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Total Fleet</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">9</p>
            <div className="mt-2 text-xs text-slate-400">Semua unit terdaftar</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Ready</p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">5</p>
            <div className="mt-2 text-xs text-emerald-500/80">Tersedia untuk disewa</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">On Trip</p>
            <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">2</p>
            <div className="mt-2 text-xs text-rose-500/80">Sedang dalam perjalanan</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Maintenance</p>
            <p className="text-3xl font-bold text-amber-500">2</p>
            <div className="mt-2 text-xs text-amber-500/80">Perawatan berkala</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8 overflow-hidden">
          <div className="p-4 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative text-slate-400 focus-within:text-primary transition-colors">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2">search</span>
              <input 
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-white outline-none" 
                placeholder="Cari nama mobil atau plat nomor..." 
                type="text"
              />
            </div>
            <div className="flex border-l border-slate-100 dark:border-slate-800 pl-4 space-x-1 overflow-x-auto pb-2 md:pb-0 hide-scroll">
              <button className="px-4 py-2 text-sm font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg shrink-0">Semua</button>
              <button className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0">Ready</button>
              <button className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0">On Trip</button>
              <button className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0">Maintenance</button>
            </div>
          </div>
        </div>

        {/* Vehicle Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          
          {/* Card 1: Ready */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
            <div className="relative h-48 overflow-hidden">
              <img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAKbqX4nwb-GFQEZONaZOSHo5hJ4fCKkbHtud5M9OHdsAndChiZFfpA8ZBKQTS9qzOvrturKnxU4JSvJk4CINXLd6kSVDA-bcClgDzgk28Yl4UNouEBSXREULOv7y5VER4aG9kj5GGBfaosCHeim1-5ZK-HsbGxUha81VOKgnay-m6xTnnSMZ-NbQPzT7-0QOsO-Q_8zeqovVjS0Tfqn8DlScts86Fx9i2lx8OV0wnwTz1sma5O5QXA3YOWFKu6v9U3wk5UCMqK9g" alt="Toyota Avanza" />
              <div className="absolute top-3 right-3">
                <span className="px-3 py-1 bg-emerald-100/90 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm backdrop-blur-md">Ready</span>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Toyota Avanza 2023</h3>
                <p className="text-sm text-slate-500 font-mono tracking-wide mt-1">BE 1234 ABC</p>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button className="flex-1 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">Edit Detail</button>
                <button className="px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                  <span className="material-symbols-outlined text-sm align-middle">history</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: On Trip */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
            <div className="relative h-48 overflow-hidden">
              <img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC4uljfGU00cYtnXVP61Wjiafu40HfJfPPSUZbFnxnRbCf7YRWfw0qlFz8mQQP4Y789-DPEsT-sIFEBZOlOUCj_6P__UxDuvqasjnsZreWb_eZm_egOPMQAf09m0bYtNUgzp2XOSw3XMlXeCqD0ptKI-y2o5rSbZ8yEoTW_dRS1rsCDQwLDiO1LwNamGWI3HZ9HBsrqGk2rJylkeMs6rcl1FihzcKAdMSgvU_-FHdyHlLJwS0KJ0ww25VBVGmY-wdJ-400nz2wHIw" alt="Mitsubishi Xpander" />
              <div className="absolute top-3 right-3">
                <span className="px-3 py-1 bg-rose-100/90 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm backdrop-blur-md">On Trip</span>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <div className="mb-3">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mitsubishi Xpander 2022</h3>
                <p className="text-sm text-slate-500 font-mono tracking-wide mt-1">BE 4567 XYZ</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg mb-4">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tenant</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Return Date</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Budi Santoso</p>
                  <p className="text-xs font-bold text-rose-500">24 Oct, 18:00</p>
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button className="flex-1 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">Edit Detail</button>
                <button className="px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                  <span className="material-symbols-outlined text-sm align-middle">history</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Maintenance */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
            <div className="relative h-48 overflow-hidden">
              <img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB6xxWKU_Qt2HgghNEce5wZCJv-vMPslddIllQvZpdfBYmYQW4GmvHeQUbo9AC7u4lF6Pht4bweJPeehNNzoFMQLBsDGYxQ4bjIwlkD97UYTBnt0XPyDIixrs-y5Y1q4nj_Jq4JM-ClmWL4x-eUut-HdDsvTOW31WntorSq2xHY_3SKoaZDuMwiDcXl0FKS2K9GfEGnauHCbvf6Np7KX2BqVBaxvLVsE_lY8Nh4Ot3JdTqlvivLfj4A64zNSQWfBNGql4G31mMqqA" alt="Toyota Yaris" />
              <div className="absolute top-3 right-3">
                <span className="px-3 py-1 bg-amber-100/90 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm backdrop-blur-md">Maintenance</span>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Toyota Yaris GR 2021</h3>
                <p className="text-sm text-slate-500 font-mono tracking-wide mt-1">BE 8899 DED</p>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button className="flex-1 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">Edit Detail</button>
                <button className="px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                  <span className="material-symbols-outlined text-sm align-middle">history</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 4: Ready */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
            <div className="relative h-48 overflow-hidden">
              <img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDTXakYm7aIB45D_bca7g5QML_PAkuiXOsJfDaeiKoNu0NpTIqwIbpnPxZDuN2Lyr0C8KatNU1sv1RuWy1rGiQzGMmRbmoxGJOm8Ef_qn_QykRMv37LRagXFMiy7-ZnMbiWjAVzcAssRoO510UZAHCgPPT_y0mY27GoorziOXtVR2RHMEz-GKW5O48WAGUAgZks0J8_gA83t9c65WJkK_MD8a5yFtbmFAo9JOPFF5jt2gwZTTgwvdrcRt7KUBAFhp94NFqovY1YpQ" alt="Daihatsu Rocky" />
              <div className="absolute top-3 right-3">
                <span className="px-3 py-1 bg-emerald-100/90 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm backdrop-blur-md">Ready</span>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Daihatsu Rocky 2023</h3>
                <p className="text-sm text-slate-500 font-mono tracking-wide mt-1">BE 2211 LL</p>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button className="flex-1 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">Edit Detail</button>
                <button className="px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                  <span className="material-symbols-outlined text-sm align-middle">history</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 5: On Trip */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
            <div className="relative h-48 overflow-hidden">
              <img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVJt7n8UCsHb96m4kzf1l6ebe3qWRRJpTJXg_CHfUK6SrX10XJhtvMLNjS0I73lVjmPP8xfiZXh2zDAfLCpY2sApI9Juo8i2D_KjuhLCg7O5fofQGrbz8-zdar2I6MbH6YG-orEwngETUHqbzKQz0_lI83hZWXIFlldks58yBXpO6tI3YYNvbSC62qrGNFqdO4S0VB8bPzL3K0Bh-65gA4JjMm9Oo76qpFgJxToLXtnVPb68QaPgBlpnP8cyGSMIe5gll5QvpAbA" alt="Hyundai Palisade" />
              <div className="absolute top-3 right-3">
                <span className="px-3 py-1 bg-rose-100/90 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm backdrop-blur-md">On Trip</span>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <div className="mb-3">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Hyundai Palisade 2024</h3>
                <p className="text-sm text-slate-500 font-mono tracking-wide mt-1">BE 1 BOSS</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg mb-4">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tenant</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Return Date</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Agus Prayogo</p>
                  <p className="text-xs font-bold text-rose-500">25 Oct, 09:00</p>
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button className="flex-1 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">Edit Detail</button>
                <button className="px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                  <span className="material-symbols-outlined text-sm align-middle">history</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 6: Ready */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
            <div className="relative h-48 overflow-hidden">
              <img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_1m4Bv0m614VcCFYxuvEn_22oM3VK6RUIux2ey43Wt5cHuFAnkMW0mcYetHX1LjmCYw0QyRxOmw4X7zzytGh1zMq52aRNS580Y3gxrBVXt2BVaBi-eR9GgbSyW21W3ivSvS9AjAxEAFMhD6xTFozmJxaRd0BRE4zu4cnFtL0UKHFj-8_ATmbhCYIgytzGGF-Xfuk8GAWBM9mlxW3oHU09VF6iR_GkcdD-rdNGIxNVJZfTi0aQ-5k-fiPsD_3-oBU8AscyZAALYw" alt="Honda Brio" />
              <div className="absolute top-3 right-3">
                <span className="px-3 py-1 bg-emerald-100/90 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm backdrop-blur-md">Ready</span>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Honda Brio RS 2022</h3>
                <p className="text-sm text-slate-500 font-mono tracking-wide mt-1">BE 5544 JKT</p>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button className="flex-1 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">Edit Detail</button>
                <button className="px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                  <span className="material-symbols-outlined text-sm align-middle">history</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Pagination / Load More */}
        <div className="mt-12 flex justify-center pb-8">
          <button className="flex items-center gap-2 px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all shadow-sm">
            Tampilkan Lebih Banyak
            <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
          </button>
        </div>

      </main>
    </div>
  );
}
