'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import AdminSidebar from '@/components/admin/AdminSidebar';
import {
  ADMIN_TRANSACTIONS_ROUTE,
  AdminTransactionUiError,
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getAdminBookingStatusTransitionOptions,
  getAdminTransactionStatusBadgeClass,
  getAdminTransactionStatusLabel,
  getTripTypeLabel,
  type AdminTransactionDetailResponse,
} from '@/lib/adminTransactionUi';
import { PaymentUiError } from '@/lib/paymentUi';
import { formatPricingModelLabel } from '@/lib/pricingQuoteUi';
import {
  rejectAdminPaymentClient,
  verifyAdminPaymentClient,
} from '@/services/adminPaymentClient';
import { readAdminTransactionDetailClient, updateAdminBookingStatusClient } from '@/services/adminTransactionsClient';

interface AdminTransactionDetailPageProps {
  params: Promise<{ bookingId: string }>;
}

function Row({ label, value }: { label: string; value: string }) {
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

export default function AdminTransactionDetailPage({ params }: AdminTransactionDetailPageProps) {
  const [bookingId, setBookingId] = useState('');
  const [transaction, setTransaction] = useState<AdminTransactionDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function loadTransaction(bookingIdValue: string) {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const detail = await readAdminTransactionDetailClient(bookingIdValue);
      setTransaction(detail);
    } catch (error) {
      setErrorMessage(
        error instanceof AdminTransactionUiError
          ? error.message
          : 'Detail transaksi belum dapat dibaca.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function resolveAndLoad() {
      const resolved = await params;
      if (!mounted) return;

      setBookingId(resolved.bookingId);
      await loadTransaction(resolved.bookingId);
    }

    void resolveAndLoad();

    return () => {
      mounted = false;
    };
  }, [params]);

  async function handleVerify() {
    if (!transaction?.payment || isReviewing) return;

    const result = await Swal.fire({
      title: 'Verifikasi pembayaran?',
      text: 'Payment akan menjadi VERIFIED dan booking menjadi CONFIRMED.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Verifikasi',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
    });

    if (!result.isConfirmed) return;

    setIsReviewing(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await verifyAdminPaymentClient(transaction.payment.paymentId);
      setSuccessMessage('Pembayaran berhasil diverifikasi. Booking menjadi terkonfirmasi.');
      await loadTransaction(transaction.bookingId);
    } catch (error) {
      setErrorMessage(
        error instanceof PaymentUiError
          ? error.message
          : 'Verifikasi pembayaran belum berhasil.',
      );
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleReject() {
    if (!transaction?.payment || isReviewing) return;

    const result = await Swal.fire({
      title: 'Tolak bukti pembayaran?',
      text: 'Payment akan menjadi REJECTED dan booking menjadi CANCELLED.',
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Alasan penolakan',
      inputPlaceholder: 'Contoh: Bukti transfer tidak terbaca.',
      inputAttributes: {
        maxlength: '500',
      },
      showCancelButton: true,
      confirmButtonText: 'Tolak',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
      inputValidator: (value) => (!value?.trim() ? 'Alasan penolakan wajib diisi.' : null),
    });

    if (!result.isConfirmed) return;

    setIsReviewing(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await rejectAdminPaymentClient(transaction.payment.paymentId, String(result.value ?? ''));
      setSuccessMessage('Bukti pembayaran ditolak. Booking menjadi dibatalkan.');
      await loadTransaction(transaction.bookingId);
    } catch (error) {
      setErrorMessage(
        error instanceof PaymentUiError
          ? error.message
          : 'Penolakan pembayaran belum berhasil.',
      );
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleMarkCompleted() {
    if (!transaction || isUpdatingStatus) return;

    const result = await Swal.fire({
      title: 'Selesaikan booking?',
      text: 'Status booking akan berubah dari CONFIRMED menjadi COMPLETED.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Tandai Selesai',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
    });

    if (!result.isConfirmed) return;

    setIsUpdatingStatus(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await updateAdminBookingStatusClient(transaction.bookingId, 'COMPLETED');
      setSuccessMessage('Booking berhasil ditandai selesai.');
      await loadTransaction(transaction.bookingId);
    } catch (error) {
      setErrorMessage(
        error instanceof AdminTransactionUiError
          ? error.message
          : 'Status booking belum berhasil diperbarui.',
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const reasons = normalizeReasons(transaction?.priceSnapshot.pricingReasons);
  const statusTransitions = transaction ? getAdminBookingStatusTransitionOptions(transaction.bookingStatus) : [];

  return (
    <div className="flex min-h-screen bg-background-light font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <AdminSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Detail Transaksi</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{bookingId || 'Memuat booking...'}</p>
          </div>
          <Link
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
            href={ADMIN_TRANSACTIONS_ROUTE}
          >
            Kembali
          </Link>
        </header>

        <div className="w-full max-w-[1200px] space-y-6 p-4 sm:p-6">
          {isLoading ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              Memuat detail transaksi...
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

          {transaction ? (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">Kode Booking</p>
                    <h2 className="mt-1 font-mono text-2xl font-black text-slate-900 dark:text-white">{transaction.bookingCode}</h2>
                    <p className="mt-1 text-sm text-slate-500">{transaction.bookingId}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getAdminTransactionStatusBadgeClass(transaction.displayStatus)}`}>
                    {getAdminTransactionStatusLabel(transaction.displayStatus)}
                  </span>
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-4 text-lg font-black">Booking dan Customer</h2>
                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <Row label="Customer" value={transaction.customer.name} />
                    <Row label="Email" value={transaction.customer.email} />
                    <Row label="No. HP" value={transaction.phoneNumber || '-'} />
                    <Row label="Alamat jemput" value={transaction.pickupAddress || '-'} />
                    <Row label="Catatan" value={transaction.notes || '-'} />
                    <Row label="Dibuat pada" value={formatDateTimeId(transaction.createdAt)} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-4 text-lg font-black">Mobil dan Sewa</h2>
                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <Row label="Mobil" value={transaction.car.name} />
                    <Row label="Kategori" value={transaction.car.category} />
                    <Row label="Tanggal mulai" value={formatDateId(transaction.rental.pickupDate)} />
                    <Row label="Tanggal kembali" value={formatDateId(transaction.rental.returnDate)} />
                    <Row label="Durasi" value={`${transaction.rental.durationDays} hari`} />
                    <Row label="Jenis perjalanan" value={getTripTypeLabel(transaction.rental.tripType)} />
                  </div>
                </section>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-4 text-lg font-black">Snapshot Harga</h2>
                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <Row label="Harga dasar" value={transaction.priceSnapshot.basePricePerDay ? formatRupiahId(transaction.priceSnapshot.basePricePerDay) : '-'} />
                    <Row label="Harga dinamis / hari" value={transaction.priceSnapshot.dynamicPriceDisplayPerDay ? formatRupiahId(transaction.priceSnapshot.dynamicPriceDisplayPerDay) : '-'} />
                    <Row label="Total invoice" value={transaction.priceSnapshot.totalInvoiceDisplay ? formatRupiahId(transaction.priceSnapshot.totalInvoiceDisplay) : formatRupiahId(transaction.pricing.totalInvoiceDisplay)} />
                    <Row label="Model" value={formatPricingModelLabel(transaction.priceSnapshot.modelVersion, 'admin')} />
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
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-4 text-lg font-black">Status Pembayaran</h2>
                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <Row label="Status booking" value={transaction.bookingStatus} />
                    <Row label="Status pembayaran" value={transaction.payment?.paymentStatus ?? 'Belum upload bukti'} />
                    <Row label="Nominal payment" value={transaction.payment ? formatRupiahId(transaction.payment.amount) : '-'} />
                    <Row label="Submitted" value={transaction.payment?.submittedAt ? formatDateTimeId(transaction.payment.submittedAt) : '-'} />
                    <Row label="Review sampai" value={transaction.payment?.reviewExpiresAt ? formatDateTimeId(transaction.payment.reviewExpiresAt) : '-'} />
                    <Row label="Direview pada" value={transaction.payment?.reviewedAt ? formatDateTimeId(transaction.payment.reviewedAt) : '-'} />
                    <Row label="Alasan penolakan" value={transaction.payment?.rejectionReason || '-'} />
                  </div>
                  {transaction.actions.proofPath ? (
                    <a
                      className="mt-4 inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      href={transaction.actions.proofPath}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Lihat Bukti Pembayaran
                    </a>
                  ) : null}
                  {transaction.payment?.paymentStatus === 'SUBMITTED' ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isReviewing}
                        onClick={handleVerify}
                        type="button"
                      >
                        Verifikasi Pembayaran
                      </button>
                      <button
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
                        disabled={isReviewing}
                        onClick={handleReject}
                        type="button"
                      >
                        Tolak Pembayaran
                      </button>
                    </div>
                  ) : null}
                  {statusTransitions.includes('COMPLETED') ? (
                    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <button
                        className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isUpdatingStatus || isReviewing}
                        onClick={handleMarkCompleted}
                        type="button"
                      >
                        {isUpdatingStatus ? 'Memperbarui...' : 'Tandai Booking Selesai'}
                      </button>
                    </div>
                  ) : null}
                </section>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
