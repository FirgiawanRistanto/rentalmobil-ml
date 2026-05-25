'use client';

import { useEffect, useState } from 'react';
import { DbCar, DisplayCar, mapDbCarToDisplayCar } from '@/lib/data';
import CarCard from '@/components/katalog/CarCard';

export default function KatalogPage() {
  const [filter, setFilter] = useState('Semua');
  const [cars, setCars] = useState<DisplayCar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchCars() {
      try {
        const response = await fetch('/api/cars');
        if (!response.ok) {
          throw new Error('Gagal mengambil data armada');
        }

        const data = (await response.json()) as DbCar[];
        setCars(data.map(mapDbCarToDisplayCar));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal mengambil data armada');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCars();
  }, []);

  const filteredCars = filter === 'Semua'
    ? cars
    : cars.filter((car) => car.type === filter);

  return (
    <main className="px-6 md:px-12 lg:px-20 py-10 w-full max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">
            Katalog Armada Kami
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Pilihan kendaraan terbaik untuk perjalanan Anda di Lampung
          </p>
        </div>
        
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
          <button 
            onClick={() => setFilter('Semua')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'Semua' ? 'bg-white dark:bg-primary shadow-sm font-bold text-primary dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700'}`}
          >
            Semua
          </button>
          <button 
            onClick={() => setFilter('MPV')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'MPV' ? 'bg-white dark:bg-primary shadow-sm font-bold text-primary dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700'}`}
          >
            MPV
          </button>
          <button 
            onClick={() => setFilter('SUV')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'SUV' ? 'bg-white dark:bg-primary shadow-sm font-bold text-primary dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700'}`}
          >
            SUV
          </button>
        </div>
      </div>

      {/* Car Grid */}
      {isLoading ? (
        <div className="py-24 text-center text-slate-500 font-medium">Memuat armada dari database...</div>
      ) : error ? (
        <div className="text-center py-24 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40">
          <p className="text-red-600 dark:text-red-300 font-bold">{error}</p>
          <p className="text-slate-500 text-sm mt-2">Pastikan `DATABASE_URL` sudah benar dan database Postgres sedang berjalan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCars.map((car) => (
            <CarCard key={car.id ?? car.slug} car={car} />
          ))}
        </div>
      )}

      {!isLoading && !error && filteredCars.length === 0 && (
        <div className="text-center py-32 rounded-xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 mt-10">
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700 mb-4 block">no_crash</span>
          <p className="text-slate-500 font-medium">Tidak ada armada di database untuk kategori ini.</p>
        </div>
      )}
    </main>
  );
}
