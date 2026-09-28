'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import {
  buildAdminPaymentDetailPath,
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getPaymentStatusBadgeClass,
  getPaymentStatusLabel,
  getTripTypeLabel,
  PaymentUiError,
  type AdminPaymentQueueItem,
  type PaymentStatus,
} from '@/lib/paymentUi';
import { listAdminPaymentsClient } from '@/services/adminPaymentClient';

type PaymentFilter = PaymentStatus | 'ALL';

const FILTERS: Array<{ label: string; value: PaymentFilter }> = [
  { label: 'Menunggu Verifikasi', value: 'SUBMITTED' },
  { label: 'Semua', value: 'ALL' },
  { label: 'Terverifikasi', value: 'VERIFIED' },
  { label: 'Ditolak', value: 'REJECTED' },
  { label: 'Kedaluwarsa', value: 'EXPIRED' },
];

function PaymentStatusBadge({ payment }: { payment: AdminPaymentQueueItem }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${getPaymentStatusBadgeClass(payment.paymentStatus)}`}>
      {payment.paymentStatus === 'SUBMITTED' && !payment.canReview
        ? 'Kedaluwarsa'
        : getPaymentStatusLabel(payment.paymentStatus)}
    </span>
  );
}

export default function AdminPaymentQueueClient() {
  const [payments, setPayments] = useState<AdminPaymentQueueItem[]>([]);
  const [filter, setFilter] = useState<PaymentFilter>('SUBMITTED');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadPayments() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await listAdminPaymentsClient(filter);
        if (mounted) {
          setPayments(result.payments);
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(
            error instanceof PaymentUiError
              ? error.message
              : 'Daftar pembayaran belum dapat dibaca.',
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadPayments();

    return () => {
      mounted = false;
    };
  }, [filter, refreshKey]);

  return (
    <div className="flex min-h-screen bg-background-light font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <AdminSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Verifikasi Pembayaran</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Antrean bukti transfer manual Dynamic Pricing v4.</p>
          </div>
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            Refresh
          </button>
        </header>

        <div className="w-full max-w-[1400px] space-y-6 p-4 sm:p-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => {
                const active = filter === item.value;
                return (
                  <button
                    className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-primary hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                    key={item.value}
                    onClick={() => setFilter(item.value)}
                    type="button"
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>

          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left">
                <thead>
                  <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Booking</th>
                    <th className="px-6 py-4">Mobil</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Submit / Review</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {isLoading ? (
                    <tr>
                      <td className="px-6 py-8 text-slate-500" colSpan={7}>
                        Memuat antrean pembayaran...
                      </td>
                    </tr>
                  ) : payments.length === 0 ? (
                    <tr>
                      <td className="px-6 py-8 text-slate-500" colSpan={7}>
                        Tidak ada payment pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50" key={payment.paymentId}>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 dark:text-white">{payment.customer.name}</p>
                          <p className="text-xs text-slate-500">{payment.customer.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-mono text-xs font-bold text-primary">{payment.bookingId}</p>
                          <p className="mt-1 text-xs text-slate-500">{payment.bookingStatus}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{payment.car.name}</p>
                          <p className="text-xs text-slate-500">
                            {payment.car.category} - {formatDateId(payment.rental.pickupDate)} ({payment.rental.durationDays} hari, {getTripTypeLabel(payment.rental.tripType)})
                          </p>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          {formatRupiahId(payment.amount)}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-slate-500">Submit: {formatDateTimeId(payment.submittedAt)}</p>
                          <p className="mt-1 text-xs text-slate-500">Review: {formatDateTimeId(payment.reviewExpiresAt)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <PaymentStatusBadge payment={payment} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-primary/90"
                            href={buildAdminPaymentDetailPath(payment.paymentId)}
                          >
                            <span className="material-symbols-outlined text-base">visibility</span>
                            Lihat Detail
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
