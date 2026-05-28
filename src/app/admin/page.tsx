'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import {
  getAdminBookingStatusLabel,
  getAdminPaymentDetailRoute,
  getAdminPaymentsRoute,
  getAdminStatusBadgeClass,
  shortId,
  type AdminDashboardResponse,
} from '@/lib/adminDashboardUi';
import {
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getTripTypeLabel,
  PaymentUiError,
} from '@/lib/paymentUi';
import { readAdminDashboardClient } from '@/services/adminDashboardClient';

function MetricCard({
  icon,
  label,
  value,
  helper,
  tone = 'primary',
}: {
  icon: string;
  label: string;
  value: string | number;
  helper?: string;
  tone?: 'primary' | 'emerald' | 'amber' | 'blue' | 'red' | 'slate';
}) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className={`rounded-lg p-2 ${toneClass}`}>
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helper}</p> : null}
    </div>
  );
}

function StatusBadge({
  bookingStatus,
  paymentStatus,
}: {
  bookingStatus: AdminDashboardResponse['recentBookings'][number]['bookingStatus'];
  paymentStatus?: AdminDashboardResponse['recentBookings'][number]['paymentStatus'];
}) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${getAdminStatusBadgeClass(bookingStatus, paymentStatus)}`}>
      {getAdminBookingStatusLabel(bookingStatus, paymentStatus)}
    </span>
  );
}

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await readAdminDashboardClient();
        if (mounted) {
          setDashboard(result);
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(
            error instanceof PaymentUiError
              ? error.message
              : 'Dashboard admin belum dapat dibaca.',
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const metrics = dashboard?.metrics;
  const activeFleetUnits = metrics?.activeFleetUnits ?? 0;
  const availableFleetUnitsNow = metrics?.availableFleetUnitsNow ?? 0;
  const blockedFleetUnitsNow = Math.max(0, activeFleetUnits - availableFleetUnitsNow);

  return (
    <div className="flex min-h-screen bg-background-light font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <AdminSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Dashboard Admin</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ringkasan booking, pembayaran, dan armada dari data transaksi v4.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dashboard ? (
              <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
                Diperbarui {formatDateTimeId(dashboard.generatedAt)}
              </p>
            ) : null}
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
              onClick={() => setRefreshKey((current) => current + 1)}
              type="button"
            >
              Refresh
            </button>
          </div>
        </header>

        <div className="w-full max-w-[1440px] space-y-6 p-4 sm:p-6">
          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          {isLoading && !dashboard ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Memuat dashboard admin...
            </section>
          ) : null}

          {metrics ? (
            <>
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon="receipt_long"
                  label="Total Booking"
                  value={metrics.totalBookings}
                  helper={`${metrics.activePendingBookings} booking pending aktif`}
                  tone="primary"
                />
                <MetricCard
                  icon="upload_file"
                  label="Menunggu Bukti Pembayaran"
                  value={metrics.awaitingPaymentProof}
                  helper="Booking PENDING aktif tanpa payment submission"
                  tone="amber"
                />
                <MetricCard
                  icon="fact_check"
                  label="Menunggu Verifikasi"
                  value={metrics.awaitingPaymentVerification}
                  helper="Payment SUBMITTED dalam window review"
                  tone="blue"
                />
                <MetricCard
                  icon="verified"
                  label="Booking Dikonfirmasi"
                  value={metrics.confirmedBookings}
                  helper={`${metrics.cancelledOrExpiredBookings} booking dibatalkan/kedaluwarsa`}
                  tone="emerald"
                />
                <MetricCard
                  icon="payments"
                  label="Total Pembayaran Terverifikasi"
                  value={formatRupiahId(metrics.verifiedPaymentTotal)}
                  helper="Hanya payment VERIFIED dari snapshot invoice"
                  tone="emerald"
                />
                <MetricCard
                  icon="directions_car"
                  label="Unit Armada Aktif"
                  value={metrics.activeFleetUnits}
                  helper={`${metrics.availableFleetUnitsNow} unit tersedia hari ini`}
                  tone="slate"
                />
                <MetricCard
                  icon="event_busy"
                  label="Unit Terblokir Hari Ini"
                  value={blockedFleetUnitsNow}
                  helper="CONFIRMED atau PENDING aktif pada tanggal hari ini"
                  tone={blockedFleetUnitsNow > 0 ? 'red' : 'emerald'}
                />
                <MetricCard
                  icon="assignment_return"
                  label="Dibatalkan / Kedaluwarsa"
                  value={metrics.cancelledOrExpiredBookings}
                  helper="Booking CANCELLED atau payment EXPIRED"
                  tone="red"
                />
              </section>

              <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800">
                    <div>
                      <h2 className="text-base font-black text-slate-900 dark:text-white">Pembayaran Terbaru</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Prioritas antrean verifikasi manual.</p>
                    </div>
                    <Link
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-primary/90"
                      href={getAdminPaymentsRoute()}
                    >
                      Lihat Semua Pembayaran
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </Link>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                          <th className="px-5 py-4">Customer</th>
                          <th className="px-5 py-4">Booking</th>
                          <th className="px-5 py-4">Mobil</th>
                          <th className="px-5 py-4">Nominal</th>
                          <th className="px-5 py-4">Status</th>
                          <th className="px-5 py-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                        {dashboard.recentPayments.length === 0 ? (
                          <tr>
                            <td className="px-5 py-8 text-slate-500" colSpan={6}>
                              Belum ada submission pembayaran.
                            </td>
                          </tr>
                        ) : (
                          dashboard.recentPayments.map((payment) => (
                            <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50" key={payment.paymentId}>
                              <td className="px-5 py-4">
                                <p className="font-bold text-slate-900 dark:text-white">{payment.customer.name}</p>
                                <p className="text-xs text-slate-500">{payment.customer.email}</p>
                              </td>
                              <td className="px-5 py-4">
                                <p className="font-mono text-xs font-bold text-primary">#{shortId(payment.bookingId)}</p>
                                <p className="mt-1 text-xs text-slate-500">Submit {formatDateTimeId(payment.submittedAt)}</p>
                              </td>
                              <td className="px-5 py-4">
                                <p className="font-semibold text-slate-900 dark:text-white">{payment.car.name}</p>
                                <p className="text-xs text-slate-500">{payment.car.category}</p>
                              </td>
                              <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                                {formatRupiahId(payment.amount)}
                              </td>
                              <td className="px-5 py-4">
                                <StatusBadge bookingStatus={payment.bookingStatus} paymentStatus={payment.paymentStatus} />
                              </td>
                              <td className="px-5 py-4 text-right">
                                <Link
                                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                                  href={getAdminPaymentDetailRoute(payment.paymentId)}
                                >
                                  Detail
                                  <span className="material-symbols-outlined text-base">visibility</span>
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Booking Terbaru</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Harga final diambil dari booking price snapshot.</p>

                  <div className="mt-5 space-y-4">
                    {dashboard.recentBookings.length === 0 ? (
                      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                        Belum ada booking.
                      </p>
                    ) : (
                      dashboard.recentBookings.map((booking) => (
                        <div className="rounded-lg border border-slate-100 p-4 dark:border-slate-800" key={booking.bookingId}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-xs font-bold text-primary">#{shortId(booking.bookingId)}</p>
                              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{booking.car.name}</p>
                              <p className="text-xs text-slate-500">{booking.customer.name}</p>
                            </div>
                            <StatusBadge bookingStatus={booking.bookingStatus} paymentStatus={booking.paymentStatus} />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                            <p>{formatDateId(booking.rental.pickupDate)}</p>
                            <p className="text-right">{booking.rental.durationDays} hari</p>
                            <p>{getTripTypeLabel(booking.rental.tripType)}</p>
                            <p className="text-right font-bold text-slate-900 dark:text-white">{formatRupiahId(booking.totalInvoiceDisplay)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
