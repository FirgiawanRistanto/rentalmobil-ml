import Link from 'next/link';

const serviceAdvantages = [
  {
    title: 'Armada Terawat',
    description:
      'Setiap unit kendaraan dirawat secara berkala untuk memastikan kenyamanan dan keamanan perjalanan Anda.',
    icon: 'directions_car',
  },
  {
    title: 'Harga Transparan',
    description:
      'Biaya sewa ditampilkan secara jelas sesuai durasi dan kebutuhan perjalanan tanpa biaya tersembunyi.',
    icon: 'payments',
  },
  {
    title: 'Proses Pemesanan Mudah',
    description:
      'Pilih kendaraan, tentukan tanggal sewa, dan selesaikan pemesanan sepenuhnya secara online.',
    icon: 'bolt',
  },
  {
    title: 'Layanan Pelanggan',
    description:
      'Tim kami siap membantu menjawab pertanyaan dan kebutuhan Anda selama proses penyewaan.',
    icon: 'support_agent',
  },
];

export const metadata = {
  title: 'Tentang Kami — XYZ Rental Mobil Lampung',
  description:
    'Profil singkat XYZ Rental, layanan rental mobil di Lampung untuk perjalanan dalam kota maupun luar kota.',
};

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-6 py-14 md:px-12 md:py-20 lg:px-20">
      {/* Profil Perusahaan */}
      <section className="flex flex-col gap-4 max-w-3xl">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider w-fit">
          <span className="material-symbols-outlined text-sm">business</span> Tentang Kami
        </span>
        <h1 className="text-slate-900 dark:text-white text-4xl md:text-5xl font-black leading-[1.1] tracking-tight">
          Profil Perusahaan
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
          XYZ Rental adalah penyedia layanan rental mobil yang melayani kebutuhan transportasi di
          wilayah Lampung. Kami menghadirkan armada terawat dengan proses pemesanan yang praktis
          untuk mendukung perjalanan dalam kota maupun luar kota Anda.
        </p>
      </section>

      {/* Keunggulan Layanan */}
      <section className="flex flex-col gap-8">
        <h2 className="text-slate-900 dark:text-white text-2xl md:text-3xl font-black tracking-tight">
          Keunggulan Layanan
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {serviceAdvantages.map((item) => (
            <article
              key={item.title}
              className="group rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1"
            >
              <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <span className="material-symbols-outlined">{item.icon}</span>
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Area Layanan */}
      <section className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 md:p-10 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 max-w-2xl">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined">location_on</span>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                Area Layanan
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Layanan XYZ Rental tersedia untuk perjalanan dalam kota maupun luar kota di seluruh
              wilayah Lampung, dengan penyesuaian kebutuhan sesuai jenis perjalanan Anda.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary">
              <span className="material-symbols-outlined text-base">location_city</span>
              Dalam Kota
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary">
              <span className="material-symbols-outlined text-base">drive_eta</span>
              Luar Kota
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
