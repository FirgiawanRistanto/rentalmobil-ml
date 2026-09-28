'use client';

import Link from 'next/link';
import {
  buildInvoicePricingReasons,
  buildLoginCallbackForQuote,
  buildSafeBookingHandoffPath,
  formatDateTimeId,
  formatPricingModelLabel,
  formatRupiahId,
  formatSignedPercentId,
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
  const confirmPath = buildSafeBookingHandoffPath(carSlug, quote.quoteId);
  const pricingReasons = buildInvoicePricingReasons(quote);

  return (
    <section className="rounded-xl border border-primary/20 bg-white p-5 shadow-sm dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">INVOICE PREVIEW</p>
          <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">{carName}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Quote ID: <span className="font-mono text-xs">{quote.quoteId}</span>
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          {quote.quoteStatus}
        </span>
      </div>

      <div className="space-y-4 text-sm">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Total invoice</p>
              <p className="mt-1 text-3xl font-black leading-tight text-primary">
                {formatRupiahId(quote.pricing.totalInvoiceDisplay)}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {formatPricingModelLabel(quote.pricing.modelVersion)}
              </p>
            </div>

            <div className="space-y-2 border-t border-primary/20 pt-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-300">Harga per hari</span>
                <span className="font-black text-slate-900 dark:text-white">
                  {formatRupiahId(quote.pricing.dynamicPriceDisplayPerDay)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-300">Penyesuaian harga</span>
                <span className="font-bold text-primary">
                  {formatSignedPercentId(quote.pricing.predictedPriceAdjustmentPercentDisplay)}
                </span>
              </div>
              <details className="rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-900/50">
                <summary className="cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200">
                  Lihat faktor harga
                </summary>
                <ul className="mt-3 space-y-2">
                  {pricingReasons.map((reason) => (
                    <li key={reason} className="flex gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      <span className="material-symbols-outlined mt-0.5 text-[15px] text-primary">check_circle</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        </div>

        {expired ? (
          <button
            className="w-full cursor-not-allowed rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-black text-white opacity-60 shadow-lg dark:bg-white dark:text-slate-900"
            disabled
            type="button"
          >
            Lanjut Booking
          </button>
        ) : (
          <Link
            className="block w-full rounded-xl bg-slate-900 px-4 py-3.5 text-center text-sm font-black text-white shadow-lg transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            data-confirm-path={confirmPath}
            data-login-callback={buildLoginCallbackForQuote(carSlug, quote.quoteId)}
            data-quote-id={quote.quoteId}
            href={confirmPath}
          >
            Lanjut Booking
          </Link>
        )}

        <p className="text-center text-xs leading-relaxed text-slate-500">
          Booking akan dibuat setelah Anda login, meninjau ulang estimasi harga, dan mengisi data penjemputan.
          Tombol ini belum mengarah ke pembayaran.
        </p>

        <div className={`rounded-lg border px-4 py-3 ${expired ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20' : 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20'}`}>
          <p className={`text-sm font-bold ${expired ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
            {expired
              ? 'Estimasi harga kedaluwarsa. Silakan hitung ulang.'
              : `Berlaku hingga ${formatDateTimeId(quote.expiresAt)}`}
          </p>
        </div>
      </div>
    </section>
  );
}
