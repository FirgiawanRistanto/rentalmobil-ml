const features = [
  {
    icon: '🤖',
    title: 'Harga AI',
    description: 'Dynamic pricing berbasis model Random Forest. Harga berubah real-time berdasarkan tanggal, okupansi, dan hari libur.',
    gradient: 'from-blue-500/20 to-purple-500/20',
  },
  {
    icon: '🔒',
    title: 'All-In Price',
    description: 'Harga sudah termasuk supir profesional dan BBM. Tidak ada biaya tersembunyi.',
    gradient: 'from-green-500/20 to-emerald-500/20',
  },
  {
    icon: '⚡',
    title: 'Proses Cepat',
    description: 'Booking online 24/7 dengan konfirmasi cepat. Upload bukti transfer, admin verifikasi, langsung jalan!',
    gradient: 'from-amber-500/20 to-orange-500/20',
  },
];

export default function FeatureCards() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-4xl font-800 text-text-primary mb-4">
            Kenapa <span className="text-brand-gold">Besan Rental</span>?
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            Bukan rental biasa — sistem kami menggunakan AI untuk menentukan harga terbaik secara real-time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="group relative p-8 rounded-2xl bg-surface-card border border-white/5 hover:border-brand-gold/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-gold/5"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {/* Glow background */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="font-heading text-xl font-700 text-text-primary mb-3">
                  {feature.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
