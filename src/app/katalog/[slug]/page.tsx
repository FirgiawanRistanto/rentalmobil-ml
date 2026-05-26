'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DynamicPricingQuoteForm from '@/components/pricing/DynamicPricingQuoteForm';
import { DbCar, DisplayCar, formatRupiah, getCarBySlug, mapDbCarToDisplayCar } from '@/lib/data';

export default function CarDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [car, setCar] = useState<DisplayCar | null>(null);
  const [isCarLoading, setIsCarLoading] = useState(true);

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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">Memuat data mobil dari database...</p>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">Mobil tidak ditemukan</h1>
          <Link href="/katalog" className="text-primary hover:underline">
            Kembali ke Katalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-10">
      <div className="flex items-center gap-2 pb-6">
        <Link className="flex items-center gap-1 font-medium text-primary hover:underline" href="/katalog">
          <span className="material-symbols-outlined text-sm">arrow_back_ios</span>
          Kembali ke Katalog
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
            <div className="relative flex aspect-video w-full items-center justify-center bg-slate-100 bg-cover bg-center bg-no-repeat dark:bg-slate-800">
              <div
                className="h-full w-full bg-cover bg-center transition-transform duration-500 hover:scale-105"
                style={{ backgroundImage: `url('${car.image}')` }}
              />
            </div>
          </div>

          <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{car.name}</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{car.description}</p>
              </div>
              <div className="rounded-xl bg-primary/10 px-4 py-3 text-left md:text-right">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Harga dasar</p>
                <p className="text-lg font-black text-primary">{formatRupiah(car.basePrice)}/hari</p>
              </div>
            </div>

            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <span className="material-symbols-outlined text-primary">settings_suggest</span>
              Spesifikasi Kendaraan
            </h3>

            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Tipe</p>
                <p className="font-semibold">{car.type}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Transmisi</p>
                <p className="font-semibold">{car.transmission}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Kapasitas</p>
                <p className="font-semibold">{car.capacity} Orang</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Status Katalog</p>
                <p className="font-semibold">{car.status === 'available' ? 'Aktif' : 'Tidak tersedia'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-slate-700 dark:text-slate-300">Fasilitas Termasuk:</h4>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <li className="flex items-center gap-3 text-sm">
                  <span className="material-symbols-outlined text-green-500">check_circle</span>
                  Supir Berpengalaman
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="material-symbols-outlined text-green-500">check_circle</span>
                  Layanan Antar Jemput Bandara/Hotel
                </li>
                <li className={`flex items-center gap-3 text-sm ${car.fuelIncluded ? '' : 'text-slate-400 line-through'}`}>
                  <span className={`material-symbols-outlined ${car.fuelIncluded ? 'text-green-500' : ''}`}>
                    {car.fuelIncluded ? 'check_circle' : 'cancel'}
                  </span>
                  Bahan Bakar (BBM) Selama Perjalanan
                </li>
                <li className={`flex items-center gap-3 text-sm ${car.foodIncluded ? '' : 'text-slate-400 line-through'}`}>
                  <span className={`material-symbols-outlined ${car.foodIncluded ? 'text-green-500' : ''}`}>
                    {car.foodIncluded ? 'check_circle' : 'cancel'}
                  </span>
                  Makanan &amp; Minuman
                </li>
              </ul>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-4">
          <DynamicPricingQuoteForm car={car} />

          <div className="group relative h-48 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDnnRr8l5NIACYshqTaJRzbJIAAT48JZRqQ4WpgTkAGvC3GEleqZp-gbPr61rD0VaKuP-5AgNMOJi80KQu6jWmQ4MJPfIHftbp-yevq0SWM88OIhKfHE_Eau9-GUffSBANxOwVDRrg3lLOclFAL-ewaFgRYm4zPlWnQM0DR5qd6LqQEPK6gpzvKjrEoLWdLB7KLSXAam9Sbkgxs2MvQg3Lf9gpNKRy7Io_vPD9R2Lj7_I-cpxo6l-sq4l-yAL8X65QywzRsIOxpyQ')",
              }}
            />
            <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />
            <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold shadow-sm dark:bg-slate-900/90">
              <span className="material-symbols-outlined text-sm text-primary">location_on</span>
              Bandar Lampung
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
