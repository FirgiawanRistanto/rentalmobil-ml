'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  BOOKING_NOTES_MAX_LENGTH,
  PICKUP_ADDRESS_MAX_LENGTH,
  PHONE_NUMBER_MAX_LENGTH,
  BookingConfirmationClientError,
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  formatSignedPercentId,
  getBookingFromQuoteErrorMessage,
  getDemandDisplayLabel,
  getQuoteReadStatusMessage,
  getTripTypeLabel,
  isBookingReservationExpired,
  type BookingFromQuoteResponse,
  type BookingQuoteReadResponse,
} from '@/lib/bookingConfirmationUi';
import { buildBookingPaymentPath } from '@/lib/paymentUi';
import { createBookingFromQuoteClient } from '@/services/bookingFromQuoteClient';
import { readPricingQuoteForBooking } from '@/services/pricingQuoteReadClient';

interface BookingConfirmationClientProps {
  quoteId: string;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-bold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function QuoteSummary({ quote }: { quote: BookingQuoteReadResponse }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Ringkasan Estimasi Harga</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{quote.car.name}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Quote ID: <span className="font-mono">{quote.quoteId}</span>
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          {quote.quoteStatus}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Kendaraan</p>
          <SummaryRow label="Kategori" value={quote.car.category} />
          <SummaryRow label="Harga dasar per hari" value={formatRupiahId(quote.car.basePricePerDay)} />
          <SummaryRow label="Status permintaan" value={getDemandDisplayLabel(quote.pricingContext.demandLevel)} />
        </div>

        <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Detail Sewa</p>
          <SummaryRow label="Mulai" value={formatDateId(quote.rental.pickupDate)} />
          <SummaryRow label="Kembali" value={formatDateId(quote.rental.returnDate)} />
          <SummaryRow label="Durasi" value={`${quote.rental.durationDays} hari`} />
          <SummaryRow label="Jenis perjalanan" value={getTripTypeLabel(quote.rental.tripType)} />
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <SummaryRow label="Penyesuaian harga" value={formatSignedPercentId(quote.pricing.predictedPriceAdjustmentPercentDisplay)} />
          <SummaryRow label="Harga dinamis per hari" value={formatRupiahId(quote.pricing.dynamicPriceDisplayPerDay)} />
        </div>
        <div className="mt-4 flex items-end justify-between gap-4 border-t border-primary/20 pt-4">
          <span className="font-bold text-slate-900 dark:text-white">Total invoice</span>
          <span className="text-2xl font-black text-primary">
            {formatRupiahId(quote.pricing.totalInvoiceDisplay)}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
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

      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
        Estimasi harga berlaku hingga {formatDateTimeId(quote.expiresAt)}
      </p>
    </section>
  );
}

function PendingBookingSuccess({ booking }: { booking: BookingFromQuoteResponse }) {
  const expired = isBookingReservationExpired(booking.reservationExpiresAt);

  return (
    <section className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm dark:border-emerald-900/60 dark:bg-slate-900">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="material-symbols-outlined">task_alt</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Reservasi PENDING
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
              Unit kendaraan dicadangkan sementara
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Unit kendaraan telah dicadangkan sementara sampai batas waktu reservasi.
              Lanjutkan ke upload bukti transfer manual agar admin dapat memverifikasi pembayaran.
            </p>
          </div>
        </div>

        <div className="grid gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60 md:grid-cols-2">
          <SummaryRow label="Kode booking" value={booking.bookingId} />
          <SummaryRow label="Status" value="Menunggu Pembayaran" />
          <SummaryRow label="Mulai sewa" value={formatDateId(booking.rental.pickupDate)} />
          <SummaryRow label="Durasi" value={`${booking.rental.durationDays} hari`} />
          <SummaryRow label="Harga dinamis per hari" value={formatRupiahId(booking.pricing.dynamicPriceDisplayPerDay)} />
          <SummaryRow label="Total invoice" value={formatRupiahId(booking.pricing.totalInvoiceDisplay)} />
        </div>

        <p className={`rounded-lg px-4 py-3 text-sm font-bold ${
          expired
            ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
            : 'bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300'
        }`}
        >
          {expired
            ? 'Batas waktu reservasi telah berakhir. Silakan membuat estimasi harga dan booking baru.'
            : `Reservasi berlaku hingga ${formatDateTimeId(booking.reservationExpiresAt)}`}
        </p>

        {expired ? (
          <Link
            className="inline-flex w-fit rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white"
            href="/katalog"
          >
            Hitung Ulang Harga
          </Link>
        ) : (
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white"
            href={buildBookingPaymentPath(booking.bookingId)}
          >
            <span className="material-symbols-outlined text-lg">upload_file</span>
            Lanjut Upload Bukti Pembayaran
          </Link>
        )}
      </div>
    </section>
  );
}

export default function BookingConfirmationClient({ quoteId }: BookingConfirmationClientProps) {
  const [quote, setQuote] = useState<BookingQuoteReadResponse | null>(null);
  const [booking, setBooking] = useState<BookingFromQuoteResponse | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoadingQuote, setIsLoadingQuote] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadQuote() {
      setIsLoadingQuote(true);
      setErrorMessage(null);

      try {
        const quoteResponse = await readPricingQuoteForBooking(quoteId);
        if (isMounted) {
          setQuote(quoteResponse);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof BookingConfirmationClientError
              ? error.message
              : 'Estimasi harga tidak dapat dibaca. Silakan hitung ulang harga.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingQuote(false);
        }
      }
    }

    loadQuote();

    return () => {
      isMounted = false;
    };
  }, [quoteId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quote || isSubmitting || !quote.canSubmit) {
      return;
    }

    const statusMessage = getQuoteReadStatusMessage(quote);
    if (statusMessage) {
      setErrorMessage(statusMessage);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const bookingResponse = await createBookingFromQuoteClient({
        quoteId: quote.quoteId,
        phoneNumber,
        pickupAddress,
        notes,
      });
      setBooking(bookingResponse);
    } catch (error) {
      setErrorMessage(
        error instanceof BookingConfirmationClientError
          ? error.message
          : getBookingFromQuoteErrorMessage('BOOKING_CREATION_FAILED'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (booking) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
        <PendingBookingSuccess booking={booking} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Konfirmasi Booking</p>
        <h1 className="mt-1 text-3xl font-black text-slate-900 dark:text-white">
          Tinjau estimasi harga dan lengkapi data penjemputan
        </h1>
      </div>

      {isLoadingQuote ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          Memuat estimasi harga...
        </section>
      ) : null}

      {quote ? <QuoteSummary quote={quote} /> : null}

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      {quote && !quote.canSubmit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
          <p className="font-bold">{getQuoteReadStatusMessage(quote)}</p>
          <Link className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white" href="/katalog">
            Hitung Ulang Harga
          </Link>
        </div>
      ) : null}

      {quote?.canSubmit ? (
        <form
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          onSubmit={handleSubmit}
        >
          <div className="mb-5">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Data Penjemputan</h2>
            <p className="mt-1 text-sm text-slate-500">
              Data ini dipakai untuk membuat booking PENDING dari quote yang sudah Anda setujui.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="phoneNumber">
                Nomor HP
              </label>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                id="phoneNumber"
                maxLength={PHONE_NUMBER_MAX_LENGTH}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="081234567890"
                required
                type="tel"
                value={phoneNumber}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="pickupAddress">
                Alamat Penjemputan
              </label>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                id="pickupAddress"
                maxLength={PICKUP_ADDRESS_MAX_LENGTH}
                onChange={(event) => setPickupAddress(event.target.value)}
                placeholder="Bandar Lampung"
                required
                type="text"
                value={pickupAddress}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="notes">
              Catatan Opsional
            </label>
            <textarea
              className="min-h-24 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              id="notes"
              maxLength={BOOKING_NOTES_MAX_LENGTH}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Contoh: jemput di lobi utama."
              value={notes}
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link className="text-sm font-bold text-slate-500 hover:text-primary" href="/katalog">
              Hitung Ulang Harga
            </Link>
            <button
              className="rounded-xl bg-primary px-6 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || !phoneNumber.trim() || !pickupAddress.trim()}
              type="submit"
            >
              {isSubmitting ? 'Membuat Booking...' : 'Konfirmasi Booking'}
            </button>
          </div>
        </form>
      ) : null}
    </main>
  );
}
