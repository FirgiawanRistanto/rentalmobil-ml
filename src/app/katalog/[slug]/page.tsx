'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DbCar, DisplayCar, formatRupiah, getCarBySlug, mapDbCarToDisplayCar } from '@/lib/data';

export default function CarDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [car, setCar] = useState<DisplayCar | null>(null);
  const [isCarLoading, setIsCarLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState(2);
  const [destination, setDestination] = useState('Bandar Lampung');
  const [predictedPrice, setPredictedPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchCar() {
      setIsCarLoading(true);
      try {
        const response = await fetch(`/api/cars/${slug}`);
        if (response.ok) {
          const data = (await response.json()) as DbCar;
          setCar(mapDbCarToDisplayCar(data));
          return;
        }

        const staticCar = getCarBySlug(slug);
        setCar(staticCar ?? null);
      } catch {
        const staticCar = getCarBySlug(slug);
        setCar(staticCar ?? null);
      } finally {
        setIsCarLoading(false);
      }
    }

    fetchCar();
  }, [slug]);

  if (isCarLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Memuat data mobil dari database...</p>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Mobil tidak ditemukan</h1>
          <Link href="/katalog" className="text-primary hover:underline">
            ← Kembali ke Katalog
          </Link>
        </div>
      </div>
    );
  }

  const handleCalculatePrice = async () => {
    setIsLoading(true);
    try {
      if (!car.id) {
        setPredictedPrice(car.basePrice * duration);
        return;
      }

      const response = await fetch('/api/pricing/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carId: car.id,
          days: duration,
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal menghitung harga AI');
      }

      const data = (await response.json()) as { estimated_price: number };
      setPredictedPrice(Math.round(data.estimated_price));
    } catch {
      setPredictedPrice(car.basePrice * duration);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto w-full px-4 md:px-10 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 pb-6">
        <Link className="flex items-center gap-1 text-primary font-medium hover:underline" href="/katalog">
          <span className="material-symbols-outlined text-sm">arrow_back_ios</span>
          Kembali ke Katalog
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Details */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="aspect-video w-full bg-center bg-no-repeat bg-cover flex items-center justify-center bg-slate-100 dark:bg-slate-800 relative">
              <div className="w-full h-full bg-center bg-cover transition-transform duration-500 hover:scale-105" style={{ backgroundImage: `url('${car.image}')` }} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-6">{car.name}</h1>
            
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">settings_suggest</span>
              Spesifikasi Kendaraan
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Tipe</p>
                <p className="font-semibold">{car.type}</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Transmisi</p>
                <p className="font-semibold">{car.transmission}</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Kapasitas</p>
                <p className="font-semibold">{car.capacity} Orang</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Bahan Bakar</p>
                <p className="font-semibold">{car.fuelIncluded ? 'Bensin (Incl)' : 'Tidak Termasuk'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-slate-700 dark:text-slate-300">Fasilitas Termasuk:</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <li className="flex items-center gap-3 text-sm">
                  <span className="material-symbols-outlined text-green-500">check_circle</span>
                  Supir Berpengalaman
                </li>
                
                {car.foodIncluded ? (
                  <li className="flex items-center gap-3 text-sm">
                    <span className="material-symbols-outlined text-green-500">check_circle</span>
                    Makanan &amp; Minuman
                  </li>
                ) : (
                  <li className="flex items-center gap-3 text-sm text-slate-400 line-through">
                    <span className="material-symbols-outlined">cancel</span>
                    Makanan &amp; Minuman
                  </li>
                )}
                
                {car.fuelIncluded ? (
                  <li className="flex items-center gap-3 text-sm">
                    <span className="material-symbols-outlined text-green-500">check_circle</span>
                    Bahan Bakar (BBM) Selama Perjalanan
                  </li>
                ) : (
                  <li className="flex items-center gap-3 text-sm text-slate-400 line-through">
                    <span className="material-symbols-outlined">cancel</span>
                    Bahan Bakar (BBM) Selama Perjalanan
                  </li>
                )}

                <li className="flex items-center gap-3 text-sm">
                  <span className="material-symbols-outlined text-green-500">check_circle</span>
                  Layanan Antar Jemput Bandara/Hotel
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column: AI Calculator */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border-2 border-primary/10 overflow-hidden">
            <div className="bg-primary p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-white">smart_toy</span>
              <h3 className="text-white font-bold tracking-tight uppercase">AI Price Calculator</h3>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tanggal Mulai</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-primary focus:ring-primary text-sm p-3 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Durasi Sewa</label>
                  <select 
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-primary focus:ring-primary text-sm p-3 outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>{d} Hari</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tujuan</label>
                  <select 
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-primary focus:ring-primary text-sm p-3 outline-none"
                  >
                    <option>Bandar Lampung</option>
                    <option>Lampung Selatan</option>
                    <option>Lampung Tengah</option>
                    <option>Luar Kota</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={handleCalculatePrice}
                disabled={!startDate || isLoading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isLoading ? 'Menghitung AI...' : 'Hitung Harga AI'}
                {!isLoading && <span className="material-symbols-outlined text-lg">bolt</span>}
              </button>

              {/* AI Result Box */}
              {predictedPrice !== null && (
                <>
                  <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-5 border border-primary/20 animate-pulse-slow">
                    <div className="text-xs font-bold text-primary mb-1 tracking-widest uppercase">Estimasi AI</div>
                    <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-1">{formatRupiah(predictedPrice)}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">({formatRupiah(predictedPrice / duration)} x {duration} hari)</div>
                    
                    <div className="space-y-2 border-t border-primary/10 pt-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">event_note</span> Holiday Surcharge</span>
                        <span className="text-red-500 font-bold">+40%</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">trending_up</span> Occupancy Rate</span>
                        <span className="text-primary font-bold">78%</span>
                      </div>
                    </div>
                  </div>

                  <Link 
                    href={`/booking/${car.id ?? car.slug}`}
                    className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] transition-transform"
                  >
                    🚀 BOOKING SEKARANG
                  </Link>
                  <p className="text-[10px] text-center text-slate-400 leading-relaxed italic">
                    *Harga di atas adalah estimasi AI berdasarkan fluktuasi pasar dan ketersediaan unit secara real-time.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Map Placeholder */}
          <div className="rounded-xl overflow-hidden h-48 bg-slate-200 dark:bg-slate-800 relative group">
            <div className="absolute inset-0 bg-cover bg-center" style={{backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDnnRr8l5NIACYshqTaJRzbJIAAT48JZRqQ4WpgTkAGvC3GEleqZp-gbPr61rD0VaKuP-5AgNMOJi80KQu6jWmQ4MJPfIHftbp-yevq0SWM88OIhKfHE_Eau9-GUffSBANxOwVDRrg3lLOclFAL-ewaFgRYm4zPlWnQM0DR5qd6LqQEPK6gpzvKjrEoLWdLB7KLSXAam9Sbkgxs2MvQg3Lf9gpNKRy7Io_vPD9R2Lj7_I-cpxo6l-sq4l-yAL8X65QywzRsIOxpyQ')"}}></div>
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
            <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-slate-900/90 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-primary">location_on</span>
              {destination}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
