import Link from 'next/link';
import { formatRupiah } from '@/lib/data';
import { buildFeaturedCars } from '@/lib/homeFeaturedCars';
import { carService } from '@/services/carService';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const featuredCars = buildFeaturedCars(await carService.getAllCars());

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
                Lihat Katalog 🚗
              </Link>
              <a href="#about" className="flex items-center justify-center rounded-xl h-14 px-8 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                Hubungi Admin
              </a>
            </div>
          </div>
          <div className="order-1 lg:order-2 w-full">
            <div className="relative w-full overflow-hidden rounded-2xl">
              <div className="absolute -inset-4 bg-primary/20 rounded-xl blur-3xl opacity-30"></div>
              {/* Image spans right seamlessly */}
              <img alt="Besan Rental Hero" className="relative w-full h-auto aspect-video lg:aspect-auto lg:h-[600px] object-cover rounded-2xl shadow-2xl" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAKb5idOE4NZ7BUG8p_fY30EKz6JIR2g51QEHJ7vuSUgWSun1Ui5efUz8IcOolqUxyrWZg-3RpnOz_Y2AxoxI59sxOAFo8J71pB3Ju7bvDsWrI_B0i5JanEum8rXJhifXScCufhZeWGlI4mdcd6G_2peV1K7DxXC-TilxkHGLpgqkD0EVp-_LH1lSSW7_mQBRbKT2OavK2OoxdA0kBZCfSTulxYXehpBVed4A8XhwWYiam74o2fikLiZJ-tLKlMIDq2zfip8HXTmg" />
            </div>
          </div>
        </div>
      </section>

      {/* Keunggulan Section */}
      <section className="bg-white dark:bg-slate-900/50 py-20 px-6 md:px-12 lg:px-20 w-full">
        <div className="w-full">
          <div className="flex flex-col gap-4 mb-12">
            <h2 className="text-slate-900 dark:text-white text-3xl md:text-5xl font-black tracking-tight">
              Mengapa Memilih Besan?
            </h2>
            <div className="h-1.5 w-24 bg-primary rounded-full"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group p-8 rounded-2xl border border-slate-100 dark:border-slate-800 bg-background-light dark:bg-background-dark hover:border-primary/50 transition-all shadow-sm">
              <div className="size-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">precision_manufacturing</span>
              </div>
              <h3 className="text-slate-900 dark:text-white text-xl font-bold mb-3">Harga AI (Dynamic)</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Algoritma cerdas yang memberikan estimasi harga terbaik secara real-time sesuai kebutuhan Anda.</p>
            </div>
            <div className="group p-8 rounded-2xl border border-slate-100 dark:border-slate-800 bg-background-light dark:bg-background-dark hover:border-primary/50 transition-all shadow-sm">
              <div className="size-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">verified_user</span>
              </div>
              <h3 className="text-slate-900 dark:text-white text-xl font-bold mb-3">All-In Price</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Harga sudah termasuk Driver profesional dan BBM. Tidak ada biaya tersembunyi saat di jalan.</p>
            </div>
            <div className="group p-8 rounded-2xl border border-slate-100 dark:border-slate-800 bg-background-light dark:bg-background-dark hover:border-primary/50 transition-all shadow-sm">
              <div className="size-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">bolt</span>
              </div>
              <h3 className="text-slate-900 dark:text-white text-xl font-bold mb-3">Proses Cepat</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Sistem booking instan yang terintegrasi. Konfirmasi pesanan dalam hitungan menit.</p>
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
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Belum ada armada aktif yang tersedia di katalog.
          </div>
        )}
      </section>

      {/* Cara Sewa Section */}
      <section className="bg-primary py-24 px-6 md:px-12 lg:px-20 w-full overflow-hidden">
        <div className="w-full text-center relative max-w-7xl mx-auto">
          <h2 className="text-white text-3xl md:text-5xl font-black tracking-tight mb-20">Cara Mudah Sewa Mobil</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10 w-full">
            <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 border-t-2 border-dashed border-white/30 -z-0"></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="size-24 rounded-full bg-white text-primary flex items-center justify-center text-3xl font-black mb-8 shadow-xl">1</div>
              <h3 className="text-white text-2xl font-bold mb-3">Pilih Mobil</h3>
              <p className="text-white/80 text-base">Pilih unit sesuai kebutuhan perjalanan Anda.</p>
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="size-24 rounded-full bg-white text-primary flex items-center justify-center text-3xl font-black mb-8 shadow-xl">2</div>
              <h3 className="text-white text-2xl font-bold mb-3">Booking Data</h3>
              <p className="text-white/80 text-base">Isi data diri dan tentukan jadwal perjalanan.</p>
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="size-24 rounded-full bg-white text-primary flex items-center justify-center text-3xl font-black mb-8 shadow-xl">3</div>
              <h3 className="text-white text-2xl font-bold mb-3">Bayar Transfer</h3>
              <p className="text-white/80 text-base">Selesaikan pembayaran melalui transfer bank.</p>
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="size-24 rounded-full bg-white text-primary flex items-center justify-center text-3xl font-black mb-8 shadow-xl">4</div>
              <h3 className="text-white text-2xl font-bold mb-3">Jalan!</h3>
              <p className="text-white/80 text-base">Mobil siap menjemput Anda tepat waktu.</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-6 md:px-12 lg:px-20 w-full">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-center w-full">
          <div className="flex-1 w-full max-w-3xl">
            <img alt="About Besan Rental" className="rounded-2xl shadow-xl w-full h-auto object-cover max-h-[600px]" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDc3fKqCcjrbs4TjcBPUYAD29giC7I-qW58FduqOnb-iXph-iHV78YVXsUiHZWop2mEafOcQjDdeQAHgW1JYT_zc4_UyBHuS2LSwOjKMLO1yjWy8lsRlqaLAwkr6UzfNF2Dplu-vL5sD1GNfTsaL96cQs8ax4u6BslgAFgSAHdOiWe6VgqaMfupWYwPFxFUTyOaoxQPBMqmKSMk0SpYNz0N1MS8rEU8oxqQ0qWYglkXccrLx7ny6r9VuTJYFKgLpZjTNrbwbGym4Q" />
          </div>
          <div className="flex-1 flex flex-col gap-8 w-full">
            <h2 className="text-slate-900 dark:text-white text-4xl md:text-5xl font-black tracking-tight leading-[1.1]">Perjalanan Aman &amp; Nyaman di Lampung</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-xl">
              Besan Rental Mobil Lampung hadir sebagai solusi transportasi modern di tanah sang bumi rua jurai. Kami menggabungkan kenyamanan armada konvensional dengan teknologi kecerdasan buatan (AI) untuk menghadirkan efisiensi dalam setiap perjalanan Anda.
            </p>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">
              Visi kami adalah menjadi penyedia jasa transportasi nomor satu di Lampung yang mengedepankan keamanan, kejujuran harga, dan pelayanan yang memanusiakan pelanggan.
            </p>
            <div className="flex flex-wrap gap-12 py-6 border-t border-slate-200 dark:border-slate-800 mt-4">
              <div>
                <p className="text-4xl font-black text-primary">500+</p>
                <p className="text-base text-slate-500 font-bold mt-2">Pelanggan Puas</p>
              </div>
              <div>
                <p className="text-4xl font-black text-primary">15+</p>
                <p className="text-base text-slate-500 font-bold mt-2">Unit Armada</p>
              </div>
              <div>
                <p className="text-4xl font-black text-primary">24/7</p>
                <p className="text-base text-slate-500 font-bold mt-2">Layanan Admin</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
