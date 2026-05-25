import Link from 'next/link';
import { cars, formatRupiah } from '@/lib/data';

// Show 3 "premium" featured cars
const featuredCars = [
  cars.find(c => c.slug === 'fortuner')!,
  cars.find(c => c.slug === 'innova-reborn')!,
  cars.find(c => c.slug === 'toyota-alphard')!,
];

export default function CarCarousel() {
  return (
    <section className="py-24 px-4 bg-surface-darker/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-4xl font-800 text-text-primary mb-4">
            Armada <span className="text-brand-gold">Unggulan</span>
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            Pilihan terbaik untuk perjalanan Anda di Lampung.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuredCars.map((car, i) => (
            <Link
              key={car.slug}
              href={`/katalog/${car.slug}`}
              className="group block"
            >
              <div className="relative rounded-2xl overflow-hidden bg-surface-card border border-white/5 hover:border-brand-gold/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-brand-gold/10">
                {/* Image placeholder */}
                <div className="h-48 bg-gradient-to-br from-brand-blue/30 to-surface-card flex items-center justify-center">
                  <span className="text-6xl opacity-50 group-hover:opacity-80 group-hover:scale-110 transition-all duration-500">🚗</span>
                </div>

                {/* Type Badge */}
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-gold/20 text-brand-gold border border-brand-gold/20">
                    {car.type}
                  </span>
                </div>

                {/* Info */}
                <div className="p-6">
                  <h3 className="font-heading text-lg font-700 text-text-primary mb-1 group-hover:text-brand-gold transition-colors">
                    {car.name}
                  </h3>
                  <p className="text-sm text-text-secondary mb-4">{car.description}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-text-muted">Mulai dari</span>
                      <div className="font-heading text-xl font-700 text-brand-gold">
                        {formatRupiah(car.basePrice)}
                      </div>
                    </div>
                    <span className="text-xs text-text-muted">/hari</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/katalog"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:bg-white/5 hover:border-brand-gold/20 transition-all duration-300"
          >
            Lihat Semua 9 Armada
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
