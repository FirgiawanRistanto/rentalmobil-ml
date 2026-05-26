'use client';

import { FormEvent, useMemo, useState } from 'react';
import type { DisplayCar } from '@/lib/data';
import {
  getPricingQuoteErrorMessage,
  getTodayDateOnly,
  MAX_QUOTE_DURATION_DAYS,
  PricingQuoteClientError,
  type PricingQuoteResponse,
  type PricingTripType,
} from '@/lib/pricingQuoteUi';
import { requestPricingQuote } from '@/services/pricingQuoteClient';
import InvoicePreview from './InvoicePreview';

interface DynamicPricingQuoteFormProps {
  car: DisplayCar;
}

export default function DynamicPricingQuoteForm({ car }: DynamicPricingQuoteFormProps) {
  const today = useMemo(() => getTodayDateOnly(), []);
  const [pickupDate, setPickupDate] = useState(today);
  const [durationDays, setDurationDays] = useState(3);
  const [tripType, setTripType] = useState<PricingTripType>('DALAM_KOTA');
  const [quote, setQuote] = useState<PricingQuoteResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [handoffMessage, setHandoffMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isFormInvalid = !car.id || !pickupDate || durationDays < 1 || durationDays > MAX_QUOTE_DURATION_DAYS;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!car.id || isLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setHandoffMessage(null);

    try {
      const pricingQuote = await requestPricingQuote({
        carId: car.id,
        pickupDate,
        durationDays,
        tripType,
      });

      setQuote(pricingQuote);
    } catch (error) {
      const message = error instanceof PricingQuoteClientError
        ? error.message
        : getPricingQuoteErrorMessage('UNKNOWN_PRICING_QUOTE_ERROR');
      setQuote(null);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-xl border-2 border-primary/10 bg-white shadow-lg dark:bg-slate-900">
        <div className="flex items-center gap-3 bg-primary p-4">
          <span className="material-symbols-outlined text-white">request_quote</span>
          <h3 className="font-bold uppercase tracking-tight text-white">Cek Harga Dinamis</h3>
        </div>

        <form className="space-y-5 p-6" onSubmit={handleSubmit}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Harga dasar per hari</p>
            <p className="mt-1 text-2xl font-black text-primary">
              {new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(car.basePrice)}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="pickupDate">
              Tanggal Mulai Sewa
            </label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              id="pickupDate"
              min={today}
              name="pickupDate"
              onChange={(event) => setPickupDate(event.target.value)}
              required
              type="date"
              value={pickupDate}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="durationDays">
              Durasi Sewa
            </label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              id="durationDays"
              max={MAX_QUOTE_DURATION_DAYS}
              min={1}
              name="durationDays"
              onChange={(event) => setDurationDays(Number(event.target.value))}
              required
              type="number"
              value={durationDays}
            />
            <p className="mt-1 text-xs text-slate-500">Maksimal {MAX_QUOTE_DURATION_DAYS} hari untuk cek harga.</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Jenis Perjalanan</label>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {[
                { label: 'Dalam Kota', value: 'DALAM_KOTA' as const },
                { label: 'Luar Kota', value: 'LUAR_KOTA' as const },
              ].map((option) => (
                <button
                  className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                    tripType === option.value
                      ? 'bg-white text-primary shadow-sm dark:bg-primary dark:text-white'
                      : 'text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                  key={option.value}
                  onClick={() => setTripType(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isFormInvalid || isLoading}
            type="submit"
          >
            {isLoading ? 'Menghitung Harga...' : 'Cek Harga'}
            {!isLoading ? <span className="material-symbols-outlined text-lg">bolt</span> : null}
          </button>
        </form>
      </section>

      {quote ? (
        <div>
          <InvoicePreview carName={car.name} carSlug={car.id ?? car.slug} quote={quote} />
          <button
            className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
            onClick={() => setHandoffMessage(`Quote ${quote.quoteId} siap digunakan untuk fase booking final berikutnya.`)}
            type="button"
          >
            Simpan Quote untuk Fase Booking
          </button>
          {handoffMessage ? (
            <p className="mt-2 rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
              {handoffMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
