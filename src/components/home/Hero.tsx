import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-surface-darker via-surface-dark to-brand-blue/20" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-brand-blue/10 rounded-full blur-3xl" />

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-light text-sm text-text-secondary mb-8 animate-fade-in">
          <span className="w-2 h-2 bg-status-green rounded-full animate-pulse" />
          <span>AI-Powered Dynamic Pricing</span>
        </div>

        {/* Heading */}
        <h1 className="font-heading text-5xl md:text-7xl font-800 leading-tight mb-6 animate-slide-up">
          <span className="text-text-primary">Rental Cerdas</span>
          <br />
          <span className="bg-gradient-to-r from-brand-gold to-brand-gold-light bg-clip-text text-transparent">
            Harga AI
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          Besan Rental Mobil Lampung — Sistem harga dinamis berbasis <span className="text-brand-gold font-medium">Random Forest</span>. 
          All-in termasuk supir &amp; BBM.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <Link
            href="/katalog"
            className="px-8 py-4 bg-brand-gold text-surface-dark font-heading font-700 text-lg rounded-xl hover:bg-brand-gold-light transition-all duration-300 hover:shadow-2xl hover:shadow-brand-gold/30 hover:-translate-y-0.5 animate-pulse-glow"
          >
            🚗 Lihat Katalog
          </Link>
          <Link
            href="/#about"
            className="px-8 py-4 border border-white/10 text-text-secondary font-medium rounded-xl hover:bg-white/5 hover:text-text-primary transition-all duration-300"
          >
            Tentang Kami →
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <Stat value="9" label="Unit Armada" />
          <Stat value="AI" label="Smart Price" />
          <Stat value="24/7" label="Layanan" />
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-heading text-2xl md:text-3xl font-800 text-brand-gold">{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  );
}
