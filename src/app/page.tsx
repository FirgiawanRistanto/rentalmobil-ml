import Link from 'next/link';
import { formatRupiah } from '@/lib/data';
import { buildFeaturedCars } from '@/lib/homeFeaturedCars';
import { carService } from '@/services/carService';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let carLoadError = false;
  let featuredCars: ReturnType<typeof buildFeaturedCars> = [];

  try {
    featuredCars = buildFeaturedCars(await carService.getAllCars());
  } catch (error) {
    carLoadError = true;
    console.error('Failed to load featured cars on home page', error);
  }

  return (
    <>
      {/* Hero Section */}
      <section className="px-6 md:px-12 lg:px-20 py-12 md:py-20 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center w-full">
          <div className="flex flex-col gap-8 order-2 lg:order-1">
            <div className="flex flex-col gap-4">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider w-fit">
                <span className="material-symbols-outlined text-sm">smart_toy</span> Terintegrasi AI
              </span>
              <h1 className="text-slate-900 dark:text-white text-4xl md:text-5xl lg:text-7xl font-black leading-[1.1] tracking-tight">
                Rental Cerdas dengan <span className="text-primary">Harga AI</span>
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg md:text-xl leading-relaxed max-w-2xl">
                Sewa mobil di Lampung kini lebih mudah dengan penyesuaian harga dinamis berdasarkan permintaan pasar dan layanan profesional terbaik.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/katalog" className="flex items-center justify-center rounded-xl h-14 px-8 bg-primary text-white text-lg font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all">
                Lihat Katalog
              </Link>
            </div>
          </div>
          <div className="order-1 lg:order-2 w-full">
            <div className="relative w-full overflow-hidden rounded-2xl">
              <div className="absolute -inset-4 bg-primary/20 rounded-xl blur-3xl opacity-30"></div>
              {/* Image spans right seamlessly */}
              <img alt="Besan Rental Hero" className="relative w-full h-auto aspect-video lg:aspect-auto lg:h-[600px] object-cover rounded-2xl shadow-2xl" src="/hero-banner.png" />
            </div>
          </div>
        </div>
      </section>

      {/* Armada Section */}
      <section className="py-20 px-6 md:px-12 lg:px-20 w-full">
        <div className="flex justify-between items-end mb-12">
          <div className="flex flex-col gap-2">
            <h2 className="text-slate-900 dark:text-white text-3xl md:text-5xl font-black tracking-tight">Armada Unggulan</h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg">Pilihan unit terbaru dengan kondisi prima untuk kenyamanan Anda.</p>
          </div>
          <Link className="hidden md:flex items-center gap-2 text-primary font-bold hover:underline text-lg" href="/katalog">
            Lihat Semua <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
        {featuredCars.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredCars.map((car) => (
              <div key={car.slug} className="group bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-md border border-slate-100 dark:border-slate-800 flex flex-col">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img alt={car.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src={car.image} />
                  <div className="absolute top-4 right-4 bg-primary text-white px-3 py-1 rounded-full text-xs font-bold uppercase">{car.type}</div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{car.name}</h3>
                  <p className="text-primary text-xl font-black mb-6">
                    {formatRupiah(car.basePrice)} <span className="text-slate-400 text-sm font-normal">/ Hari</span>
                  </p>
                  <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm mb-8 flex-1">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">person</span> {car.capacity} Kursi</span>
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">settings</span> {car.transmission}</span>
                  </div>
                  <Link href={`/katalog/${car.slug}`} className="block w-full text-center py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold hover:bg-primary dark:hover:bg-primary dark:hover:text-white transition-all mt-auto content-end">Cek Harga</Link>
                </div>
              </div>
            ))}
          </div>
        ) : carLoadError ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Data armada belum dapat dimuat. Silakan coba lagi setelah layanan database aktif.
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Belum ada armada aktif yang tersedia di katalog.
          </div>
        )}
      </section>
    </>
  );
}
