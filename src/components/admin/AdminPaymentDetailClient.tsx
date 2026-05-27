'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import {
  ADMIN_PAYMENTS_ROUTE,
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getBookingStatusLabel,
  getPaymentStatusBadgeClass,
  getPaymentStatusLabel,
  getTripTypeLabel,
  PaymentUiError,
  type AdminPaymentDetailResponse,
} from '@/lib/paymentUi';
import {
  readAdminPaymentDetailClient,
  rejectAdminPaymentClient,
  verifyAdminPaymentClient,
} from '@/services/adminPaymentClient';

interface AdminPaymentDetailClientProps {
  paymentId: string;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-bold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function normalizeReasons(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export default function AdminPaymentDetailClient({ paymentId }: AdminPaymentDetailClientProps) {
  const [payment, setPayment] = useState<AdminPaymentDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadPayment() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const detail = await readAdminPaymentDetailClient(paymentId);
      setPayment(detail);
    } catch (error) {
      setErrorMessage(
        error instanceof PaymentUiError
          ? error.message
          : 'Detail pembayaran belum dapat dibaca.',
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
        const detail = await readAdminPaymentDetailClient(paymentId);
        if (mounted) {
          setPayment(detail);
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(
            error instanceof PaymentUiError
              ? error.message
              : 'Detail pembayaran belum dapat dibaca.',
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
  }, [paymentId]);

  async function handleVerify() {
    if (!payment || isReviewing) {
      return;
    }

    const confirmed = window.confirm('Verifikasi pembayaran ini? Booking akan menjadi CONFIRMED.');
    if (!confirmed) {
      return;
    }

    setIsReviewing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await verifyAdminPaymentClient(payment.paymentId);
      setSuccessMessage('Pembayaran berhasil diverifikasi. Booking menjadi CONFIRMED.');
      await loadPayment();
    } catch (error) {
      setErrorMessage(
        error instanceof PaymentUiError
          ? error.message
          : 'Verifikasi belum berhasil.',
      );
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!payment || isReviewing) {
      return;
    }

    const reason = rejectReason.trim();
    if (!reason) {
      setErrorMessage('Alasan penolakan wajib diisi.');
      return;
    }

    const confirmed = window.confirm('Tolak bukti pembayaran ini? Booking akan menjadi CANCELLED.');
    if (!confirmed) {
      return;
    }

    setIsReviewing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await rejectAdminPaymentClient(payment.paymentId, reason);
      setSuccessMessage('Bukti pembayaran ditolak. Booking menjadi CANCELLED.');
      setRejectReason('');
      await loadPayment();
    } catch (error) {
      setErrorMessage(
        error instanceof PaymentUiError
          ? error.message
          : 'Penolakan belum berhasil.',
      );
    } finally {
      setIsReviewing(false);
    }
  }

  const reasons = normalizeReasons(payment?.priceSnapshot.pricingReasons);
  const canReview = !!payment && payment.paymentStatus === 'SUBMITTED' && payment.canReview;

  return (
    <div className="flex min-h-screen bg-background-light font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <AdminSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Detail Verifikasi Pembayaran</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Review bukti transfer manual melalui endpoint proof protected.</p>
          </div>
          <Link className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300" href={ADMIN_PAYMENTS_ROUTE}>
            Kembali
          </Link>
        </header>

        <div className="w-full max-w-[1400px] space-y-6 p-4 sm:p-6">
          {isLoading ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              Memuat detail pembayaran...
            </section>
          ) : null}

          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              {successMessage}
            </p>
          ) : null}

          {payment ? (
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">Payment ID</p>
                      <h2 className="font-mono text-lg font-black text-slate-900 dark:text-white">{payment.paymentId}</h2>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getPaymentStatusBadgeClass(payment.paymentStatus)}`}>
                      {payment.paymentStatus === 'SUBMITTED' && !payment.canReview
                        ? 'Kedaluwarsa'
                        : getPaymentStatusLabel(payment.paymentStatus)}
                    </span>
                  </div>

                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <SummaryRow label="Nominal" value={formatRupiahId(payment.amount)} />
                    <SummaryRow label="Method" value="Transfer Bank Manual" />
                    <SummaryRow label="Submitted" value={formatDateTimeId(payment.submittedAt)} />
                    <SummaryRow label="Review sampai" value={formatDateTimeId(payment.reviewExpiresAt)} />
                    <SummaryRow label="Booking status" value={getBookingStatusLabel(payment.bookingStatus)} />
                    <SummaryRow label="Reservation expires" value={payment.reservationExpiresAt ? formatDateTimeId(payment.reservationExpiresAt) : '-'} />
                    {payment.rejectionReason ? <SummaryRow label="Alasan reject" value={payment.rejectionReason} /> : null}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-4 text-lg font-black text-slate-900 dark:text-white">Customer dan Sewa</h2>
                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <SummaryRow label="Customer" value={payment.customer.name} />
                    <SummaryRow label="Email" value={payment.customer.email} />
                    <SummaryRow label="Mobil" value={payment.car.name} />
                    <SummaryRow label="Kategori" value={payment.car.category} />
                    <SummaryRow label="Tanggal mulai" value={formatDateId(payment.rental.pickupDate)} />
                    <SummaryRow label="Tanggal kembali" value={formatDateId(payment.rental.returnDate)} />
                    <SummaryRow label="Durasi" value={`${payment.rental.durationDays} hari`} />
                    <SummaryRow label="Jenis perjalanan" value={getTripTypeLabel(payment.rental.tripType)} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-4 text-lg font-black text-slate-900 dark:text-white">Snapshot Harga</h2>
                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <SummaryRow label="Harga dasar" value={payment.priceSnapshot.basePricePerDay ? formatRupiahId(payment.priceSnapshot.basePricePerDay) : '-'} />
                    <SummaryRow label="Adjustment" value={payment.priceSnapshot.predictedPriceAdjustmentPct === null ? '-' : `${(payment.priceSnapshot.predictedPriceAdjustmentPct * 100).toFixed(2)}%`} />
                    <SummaryRow label="Harga dinamis / hari" value={payment.priceSnapshot.dynamicPriceDisplayPerDay ? formatRupiahId(payment.priceSnapshot.dynamicPriceDisplayPerDay) : '-'} />
                    <SummaryRow label="Total invoice" value={payment.priceSnapshot.totalInvoiceDisplay ? formatRupiahId(payment.priceSnapshot.totalInvoiceDisplay) : '-'} />
                    <SummaryRow label="Model version" value={payment.priceSnapshot.modelVersion ?? '-'} />
                  </div>
                  {reasons.length > 0 ? (
                    <ul className="mt-4 space-y-2">
                      {reasons.map((reason) => (
                        <li className="flex gap-2 text-sm text-slate-600 dark:text-slate-300" key={reason}>
                          <span className="material-symbols-outlined mt-0.5 text-[16px] text-primary">check_circle</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>

              <section className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Bukti Transfer</h2>
                    {payment.proofAvailable ? (
                      <a className="text-xs font-bold text-primary hover:underline" href={payment.proofUrl} rel="noreferrer" target="_blank">
                        Buka file
                      </a>
                    ) : null}
                  </div>

                  {payment.proofAvailable ? (
                    <iframe
                      className="h-[620px] w-full rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                      src={payment.proofUrl}
                      title="Preview bukti transfer"
                    />
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                      File bukti pembayaran tidak tersedia.
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Aksi Admin</h2>
                  {canReview ? (
                    <div className="mt-4 space-y-4">
                      <button
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isReviewing}
                        onClick={handleVerify}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-lg">verified</span>
                        {isReviewing ? 'Memproses...' : 'Verifikasi Pembayaran'}
                      </button>

                      <form className="space-y-3" onSubmit={handleReject}>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="rejectReason">
                          Alasan Penolakan
                        </label>
                        <textarea
                          className="min-h-28 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          id="rejectReason"
                          maxLength={500}
                          onChange={(event) => setRejectReason(event.target.value)}
                          placeholder="Contoh: Bukti transfer tidak jelas atau tidak sesuai."
                          value={rejectReason}
                        />
                        <button
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-5 py-3 text-sm font-black text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
                          disabled={isReviewing || !rejectReason.trim()}
                          type="submit"
                        >
                          <span className="material-symbols-outlined text-lg">cancel</span>
                          Tolak Bukti
                        </button>
                      </form>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                      Payment ini tidak dapat direview pada status saat ini.
                    </p>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
