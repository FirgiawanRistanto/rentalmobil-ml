'use client';

import Link from 'next/link';
import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from 'react';
import {
  SIMULATED_BANK_TRANSFER_INSTRUCTIONS,
  canUploadPaymentProof,
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getBookingStatusLabel,
  getEffectivePaymentStatus,
  getPaymentStatusBadgeClass,
  getPaymentStatusLabel,
  getTripTypeLabel,
  validatePaymentProofFile,
  PaymentUiError,
  type BookingPaymentReadResponse,
} from '@/lib/paymentUi';
import { formatPricingModelLabel } from '@/lib/pricingQuoteUi';
import { readBookingPaymentClient, uploadPaymentProofClient } from '@/services/paymentClient';

interface CustomerPaymentClientProps {
  bookingId: string;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-bold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function statusDescription(booking: BookingPaymentReadResponse): string {
  const effectiveStatus = getEffectivePaymentStatus(booking);

  if (effectiveStatus === 'SUBMITTED') {
    return 'Bukti pembayaran telah dikirim. Unit masih dicadangkan sementara selama proses verifikasi admin.';
  }

  if (effectiveStatus === 'VERIFIED') {
    return 'Pembayaran terverifikasi dan booking telah dikonfirmasi.';
  }

  if (effectiveStatus === 'REJECTED') {
    return 'Bukti pembayaran ditolak. Booking dibatalkan dan Anda perlu membuat estimasi harga baru.';
  }

  if (effectiveStatus === 'EXPIRED' || effectiveStatus === 'RESERVATION_EXPIRED') {
    return 'Waktu pembayaran atau verifikasi telah kedaluwarsa. Booking tidak lagi aktif.';
  }

  return 'Silakan upload bukti transfer sebelum batas waktu reservasi berakhir.';
}

export default function CustomerPaymentClient({ bookingId }: CustomerPaymentClientProps) {
  const [booking, setBooking] = useState<BookingPaymentReadResponse | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadBooking() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const bookingResponse = await readBookingPaymentClient(bookingId);
      setBooking(bookingResponse);
    } catch (error) {
      setErrorMessage(
        error instanceof PaymentUiError
          ? error.message
          : 'Data pembayaran belum dapat dibaca.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const bookingResponse = await readBookingPaymentClient(bookingId);
        if (mounted) {
          setBooking(bookingResponse);
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(
            error instanceof PaymentUiError
              ? error.message
              : 'Data pembayaran belum dapat dibaca.',
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [bookingId]);

  function selectFile(file: File | null | undefined) {
    try {
      const validFile = validatePaymentProofFile(file);
      setProofFile(validFile);
      setErrorMessage(null);
    } catch (error) {
      setProofFile(null);
      setErrorMessage(
        error instanceof PaymentUiError
          ? error.message
          : 'File bukti pembayaran tidak valid.',
      );
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!booking || isUploading) {
      return;
    }

    if (!canUploadPaymentProof(booking)) {
      setErrorMessage('Booking ini tidak dapat menerima bukti pembayaran.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const payment = await uploadPaymentProofClient(booking.bookingId, proofFile);
      setBooking({
        ...booking,
        bookingStatus: payment.bookingStatus,
        reservationExpiresAt: payment.reservationExpiresAt,
        payment: {
          paymentId: payment.paymentId,
          method: payment.paymentMethod,
          status: payment.paymentStatus,
          amount: payment.amount,
          submittedAt: payment.submittedAt,
          reviewExpiresAt: payment.reviewExpiresAt,
          reviewedAt: null,
          rejectionReason: null,
        },
      });
      setProofFile(null);
    } catch (error) {
      setErrorMessage(
        error instanceof PaymentUiError
          ? error.message
          : 'Bukti pembayaran belum berhasil dikirim. Silakan coba kembali.',
      );
    } finally {
      setIsUploading(false);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-1 flex-col px-4 py-8 md:px-8">
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          Memuat data pembayaran...
        </section>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          <h1 className="text-xl font-black">Data pembayaran tidak tersedia</h1>
          <p className="mt-2 text-sm">{errorMessage ?? 'Silakan coba kembali dari dashboard.'}</p>
          <Link className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white" href="/dashboard">
            Kembali ke Dashboard
          </Link>
        </section>
      </main>
    );
  }

  const effectiveStatus = getEffectivePaymentStatus(booking);
  const uploadAllowed = canUploadPaymentProof(booking);
  const amount = booking.payment?.amount ?? booking.pricing.totalInvoiceDisplay;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Pembayaran Manual</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900 dark:text-white">Upload Bukti Transfer</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Flow ini menggunakan transfer bank manual simulasi. Admin akan memverifikasi bukti pembayaran sebelum booking dikonfirmasi.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getPaymentStatusBadgeClass(effectiveStatus)}`}>
          {getPaymentStatusLabel(effectiveStatus)}
        </span>
      </div>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Ringkasan Booking</h2>
              <p className="mt-1 text-xs text-slate-500">
                Kode booking: <span className="font-mono">{booking.bookingId}</span>
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {getBookingStatusLabel(booking.bookingStatus)}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Kendaraan</p>
              <SummaryRow label="Mobil" value={booking.car.name} />
              <SummaryRow label="Kategori" value={booking.car.category} />
              <SummaryRow label="Model" value={booking.pricing.modelVersion ? formatPricingModelLabel(booking.pricing.modelVersion) : '-'} />
            </div>
            <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Detail Sewa</p>
              <SummaryRow label="Mulai" value={formatDateId(booking.rental.pickupDate)} />
              <SummaryRow label="Kembali" value={formatDateId(booking.rental.returnDate)} />
              <SummaryRow label="Durasi" value={`${booking.rental.durationDays} hari`} />
              <SummaryRow label="Jenis perjalanan" value={getTripTypeLabel(booking.rental.tripType)} />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
            <SummaryRow
              label="Harga dinamis per hari"
              value={booking.pricing.dynamicPriceDisplayPerDay ? formatRupiahId(booking.pricing.dynamicPriceDisplayPerDay) : '-'}
            />
            <div className="mt-4 flex items-end justify-between gap-4 border-t border-primary/20 pt-4">
              <span className="font-bold text-slate-900 dark:text-white">Total pembayaran</span>
              <span className="text-2xl font-black text-primary">{formatRupiahId(amount)}</span>
            </div>
          </div>

          <p className={`mt-4 rounded-lg px-4 py-3 text-sm font-bold ${
            uploadAllowed
              ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
          >
            {booking.payment?.reviewExpiresAt
              ? `Batas review admin: ${formatDateTimeId(booking.payment.reviewExpiresAt)}`
              : booking.reservationExpiresAt
                ? `Upload bukti pembayaran sebelum ${formatDateTimeId(booking.reservationExpiresAt)}`
                : 'Batas waktu reservasi tidak tersedia.'}
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <span className="material-symbols-outlined rounded-lg bg-primary/10 p-2 text-primary">account_balance</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                {SIMULATED_BANK_TRANSFER_INSTRUCTIONS.label}
              </p>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Instruksi Pembayaran</h2>
            </div>
          </div>

          <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
            <SummaryRow label="Bank" value={SIMULATED_BANK_TRANSFER_INSTRUCTIONS.bankName} />
            <SummaryRow label="Nomor rekening" value={SIMULATED_BANK_TRANSFER_INSTRUCTIONS.accountNumber} />
            <SummaryRow label="Atas nama" value={SIMULATED_BANK_TRANSFER_INSTRUCTIONS.accountHolder} />
            <SummaryRow label="Nominal" value={formatRupiahId(amount)} />
            <SummaryRow label="Referensi" value={booking.bookingId} />
          </div>

          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
            {SIMULATED_BANK_TRANSFER_INSTRUCTIONS.notice}
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Status Pembayaran</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{statusDescription(booking)}</p>
          </div>
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
            onClick={loadBooking}
            type="button"
          >
            Refresh Status
          </button>
        </div>

        {booking.payment ? (
          <div className="grid gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60 md:grid-cols-2">
            <SummaryRow label="Payment ID" value={booking.payment.paymentId} />
            <SummaryRow label="Metode" value="Transfer Bank Manual" />
            <SummaryRow label="Dikirim" value={booking.payment.submittedAt ? formatDateTimeId(booking.payment.submittedAt) : '-'} />
            <SummaryRow label="Review sampai" value={booking.payment.reviewExpiresAt ? formatDateTimeId(booking.payment.reviewExpiresAt) : '-'} />
            <SummaryRow label="Status payment" value={getPaymentStatusLabel(effectiveStatus)} />
            <SummaryRow label="Status booking" value={getBookingStatusLabel(booking.bookingStatus)} />
            {booking.payment.rejectionReason ? (
              <div className="md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Alasan penolakan</p>
                <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
                  {booking.payment.rejectionReason}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {uploadAllowed ? (
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label
              className={`block rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : proofFile
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
                    : 'border-slate-300 bg-slate-50 hover:border-primary dark:border-slate-700 dark:bg-slate-800/60'
              }`}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDrop={handleDrop}
            >
              <input
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleFileChange}
                type="file"
              />
              <span className="material-symbols-outlined text-4xl text-primary">
                {proofFile ? 'check_circle' : 'cloud_upload'}
              </span>
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {proofFile ? proofFile.name : 'Klik untuk upload atau drag file bukti transfer'}
              </p>
              <p className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP, atau PDF. Maksimal 5 MB.</p>
            </label>

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isUploading || !proofFile}
              type="submit"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              {isUploading ? 'Mengirim Bukti...' : 'Kirim Bukti Pembayaran'}
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
            {effectiveStatus === 'NONE'
              ? 'Upload bukti tidak tersedia untuk booking ini.'
              : 'Tidak ada aksi pembayaran yang tersedia untuk customer pada status ini.'}
          </div>
        )}
      </section>
    </main>
  );
}
