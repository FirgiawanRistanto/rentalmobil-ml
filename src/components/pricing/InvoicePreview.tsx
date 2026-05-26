'use client';

import {
  buildLoginCallbackForQuote,
  formatDateId,
  formatDateTimeId,
  formatPercentId,
  formatRupiahId,
  formatSignedPercentId,
  getDemandDisplayLabel,
  getTripTypeLabel,
  isQuoteExpired,
  type PricingQuoteResponse,
} from '@/lib/pricingQuoteUi';

interface InvoicePreviewProps {
  carName: string;
  carSlug: string;
  quote: PricingQuoteResponse;
  now?: Date;
}

export default function InvoicePreview({
  carName,
  carSlug,
  quote,
  now = new Date(),
}: InvoicePreviewProps) {
  const expired = isQuoteExpired(quote.expiresAt, now);

  return (
    <section className="rounded-xl border border-primary/20 bg-white p-5 shadow-sm dark:bg-slate-900">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Invoice Preview</p>
          <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white">{carName}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Quote ID: <span className="font-mono text-xs">{quote.quoteId}</span>
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          {quote.quoteStatus}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 text-sm">
        <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Ringkasan Kendaraan</p>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Kategori</span>
            <span className="font-bold text-slate-900 dark:text-white">{quote.car.category}</span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-slate-500">Harga dasar per hari</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatRupiahId(quote.car.basePricePerDay)}</span>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Detail Sewa</p>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Mulai</span>
            <span className="font-semibold text-slate-900 dark:text-white">{formatDateId(quote.rental.pickupDate)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-slate-500">Kembali</span>
            <span className="font-semibold text-slate-900 dark:text-white">{formatDateId(quote.rental.returnDate)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-slate-500">Durasi</span>
            <span className="font-semibold text-slate-900 dark:text-white">{quote.rental.durationDays} hari</span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-slate-500">Jenis perjalanan</span>
            <span className="font-semibold text-slate-900 dark:text-white">{getTripTypeLabel(quote.rental.tripType)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Perhitungan Harga</p>
          <div className="flex justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-300">Harga dasar per hari</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatRupiahId(quote.car.basePricePerDay)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-300">Penyesuaian harga</span>
            <span className="font-bold text-primary">
              {formatSignedPercentId(quote.pricing.predictedPriceAdjustmentPercentDisplay)}
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-300">Harga dinamis per hari</span>
            <span className="font-black text-slate-900 dark:text-white">
              {formatRupiahId(quote.pricing.dynamicPriceDisplayPerDay)}
            </span>
          </div>
          <div className="mt-4 border-t border-primary/20 pt-4">
            <div className="flex items-end justify-between gap-4">
              <span className="font-bold text-slate-900 dark:text-white">Total invoice</span>
              <span className="text-2xl font-black text-primary">
                {formatRupiahId(quote.pricing.totalInvoiceDisplay)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Kondisi Sistem</p>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Status permintaan</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {getDemandDisplayLabel(quote.pricingContext.demandLevel)}
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-slate-500">Ketersediaan kategori</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {formatPercentId(quote.pricingContext.availabilityRatio)} tersedia
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
          <p className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
            Faktor yang dipertimbangkan dalam rekomendasi harga
          </p>
          <ul className="space-y-2">
            {quote.pricingReasons.map((reason) => (
              <li key={reason} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="material-symbols-outlined mt-0.5 text-[16px] text-primary">check_circle</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`rounded-lg border p-4 ${expired ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20' : 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20'}`}>
          <p className={`text-sm font-bold ${expired ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
            {expired
              ? 'Estimasi harga sudah kadaluarsa. Silakan hitung ulang harga.'
              : `Estimasi harga berlaku hingga ${formatDateTimeId(quote.expiresAt)}`}
          </p>
        </div>

        <button
          className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-black text-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-900"
          data-login-callback={buildLoginCallbackForQuote(carSlug, quote.quoteId)}
          data-quote-id={quote.quoteId}
          disabled
          type="button"
        >
          Lanjut Booking
        </button>
        <p className="text-center text-xs leading-relaxed text-slate-500">
          Booking final berbasis quote akan diaktifkan pada fase berikutnya. Quote ini belum membuat booking, snapshot harga,
          pembayaran, atau reservasi unit.
        </p>
      </div>
    </section>
  );
}
