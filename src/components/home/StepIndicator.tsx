const steps = [
  { num: 1, icon: '🚗', title: 'Pilih Mobil', desc: 'Pilih armada dan tanggal sewa dari katalog kami.' },
  { num: 2, icon: '📝', title: 'Booking', desc: 'Isi data diri dan detail penjemputan.' },
  { num: 3, icon: '💳', title: 'Bayar', desc: 'Transfer ke rekening dan upload bukti pembayaran.' },
  { num: 4, icon: '✅', title: 'Jalan!', desc: 'Admin verifikasi, mobil siap antar ke lokasi Anda.' },
];

export default function StepIndicator() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-4xl font-800 text-text-primary mb-4">
            Cara <span className="text-brand-gold">Sewa</span>
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            4 langkah mudah untuk menyewa mobil di Besan Rental.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={step.num} className="relative group">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[calc(100%-20%)] h-px bg-gradient-to-r from-brand-gold/40 to-brand-gold/10" />
              )}

              <div className="relative text-center p-6 rounded-2xl bg-surface-card border border-white/5 hover:border-brand-gold/20 transition-all duration-300 hover:-translate-y-1">
                {/* Number badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-brand-gold text-surface-dark text-xs font-bold flex items-center justify-center shadow-lg shadow-brand-gold/30">
                  {step.num}
                </div>

                <div className="text-3xl mb-4 mt-2">{step.icon}</div>
                <h3 className="font-heading text-lg font-700 text-text-primary mb-2">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
