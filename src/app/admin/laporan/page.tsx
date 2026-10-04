import Link from 'next/link';
import AdminSidebar from '@/components/admin/AdminSidebar';
import {
  formatAdminReportCategory,
  formatDateId,
  formatDateTimeId,
  formatRupiahId,
  getTripTypeLabel,
  parseAdminReportQuery,
  type AdminReportBreakdownItem,
  type AdminReportRecentTransaction,
  type AdminReportResponse,
  type AdminReportTopItem,
} from '@/lib/adminReportUi';
import { getCurrentAuthSession } from '@/lib/auth-session';
import { PaymentServiceError } from '@/services/paymentService';
import { readAdminReport } from '@/services/adminReportService';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

interface AdminLaporanPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  tone = 'primary',
  helperClassName = 'mt-2 text-xs text-slate-500 dark:text-slate-400',
}: {
  icon: string;
  label: string;
  value: string | number;
  helper: ReactNode;
  tone?: 'primary' | 'emerald' | 'amber' | 'blue' | 'purple' | 'slate';
  helperClassName?: string;
}) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`mb-4 inline-flex rounded-lg p-2 ${toneClass}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
      <div className={helperClassName}>{helper}</div>
    </div>
  );
}

function getStatusBadgeClass(status: string): string {
  if (status === 'CONFIRMED' || status === 'VERIFIED' || status === 'COMPLETED') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60';
  }

  if (status === 'PENDING' || status === 'SUBMITTED') {
    return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/60';
  }

  if (status === 'CANCELLED' || status === 'REJECTED' || status === 'EXPIRED') {
    return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/60';
  }

  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
}

function getBookingStatusLabel(status: AdminReportRecentTransaction['bookingStatus']): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'CONFIRMED':
      return 'Dikonfirmasi';
    case 'CANCELLED':
      return 'Dibatalkan';
    case 'COMPLETED':
      return 'Selesai';
    case 'EXPIRED':
      return 'Kedaluwarsa';
  }
}

function getPaymentStatusLabel(status: AdminReportRecentTransaction['paymentStatus']): string {
  if (!status) return 'Belum ada payment';

  switch (status) {
    case 'SUBMITTED':
      return 'Menunggu Verifikasi';
    case 'VERIFIED':
      return 'Terverifikasi';
    case 'REJECTED':
      return 'Ditolak';
    case 'EXPIRED':
      return 'Kedaluwarsa';
  }
}

function BreakdownList({
  title,
  items,
  total,
}: {
  title: string;
  items: AdminReportBreakdownItem[];
  total: number;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-black text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada data pada periode ini.</p>
        ) : items.map((item) => {
          const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;

          return (
            <div key={item.key}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
                <span className="text-slate-500 dark:text-slate-400">{item.count} data</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TopList({
  title,
  items,
}: {
  title: string;
  items: AdminReportTopItem[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-black text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada data pada periode ini.</p>
        ) : items.map((item) => (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60" key={item.id}>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">{item.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatAdminReportCategory(item.category)} - {item.bookingCount} booking
              </p>
            </div>
            <p className="text-sm font-black text-primary">{formatRupiahId(item.totalInvoiceDisplay)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReportContent({ report }: { report: AdminReportResponse }) {
  const metrics = report.metrics;
  const bookingTotal = report.bookingStatusBreakdown.reduce((total, item) => total + item.count, 0);
  const paymentTotal = report.paymentStatusBreakdown.reduce((total, item) => total + item.count, 0);

  return (
    <>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          helper={`${metrics.pendingBookings} pending, ${metrics.completedBookings} selesai`}
          icon="receipt_long"
          label="Total Booking"
          value={metrics.totalBookings}
        />
        <MetricCard
          helper={`Hanya menghitung payment VERIFIED pada periode ini`}
          icon="payments"
          label="Total Pendapatan (Terverifikasi)"
          tone="emerald"
          value={formatRupiahId(metrics.verifiedPaymentTotal)}
        />
        <MetricCard
          helper={(
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span>Total Flat</span>
                <span className="font-black text-slate-900 dark:text-white">{formatRupiahId(metrics.dynamicPricingFlatTotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Total Dinamis</span>
                <span className="font-black text-slate-900 dark:text-white">{formatRupiahId(metrics.dynamicPricingDynamicTotal)}</span>
              </div>
            </div>
          )}
          helperClassName="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300"
          icon="trending_up"
          label="Flat vs Dinamis (Selisih)"
          tone="purple"
          value={formatRupiahId(metrics.dynamicPricingUplift)}
        />
        <MetricCard
          helper={(
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span>Kasus periode ini</span>
                <span className="font-black text-slate-900 dark:text-white">{metrics.totalFines} denda</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Menunggu verifikasi</span>
                <span className="font-black text-slate-900 dark:text-white">{formatRupiahId(metrics.pendingFineTotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Dibatalkan</span>
                <span className="font-black text-slate-900 dark:text-white">{formatRupiahId(metrics.rejectedFineTotal)}</span>
              </div>
            </div>
          )}
          helperClassName="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300"
          icon="assignment_late"
          label="Pendapatan Denda (Terverifikasi)"
          tone="amber"
          value={formatRupiahId(metrics.verifiedFineTotal)}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <BreakdownList items={report.bookingStatusBreakdown} title="Status Booking" total={bookingTotal} />
        <BreakdownList items={report.paymentStatusBreakdown} title="Status Pembayaran" total={paymentTotal} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <TopList items={report.topCars} title="Mobil Paling Sering Dibooking" />
        <TopList items={report.topCategories} title="Kategori Paling Aktif" />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-5 dark:border-slate-800">
          <h2 className="text-base font-black text-slate-900 dark:text-white">Transaksi Terbaru pada Periode Ini</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {report.recentTransactions.length} transaksi terbaru pada periode ini.          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <th className="px-5 py-4">Kode Booking</th>
                <th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4">Mobil</th>
                <th className="px-5 py-4">Tanggal Sewa</th>
                <th className="px-5 py-4">Total Invoice</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {report.recentTransactions.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-slate-500 dark:text-slate-400" colSpan={7}>
                    Belum ada transaksi pada periode ini.
                  </td>
                </tr>
              ) : report.recentTransactions.map((transaction) => (
                <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50" key={transaction.bookingId}>
                  <td className="px-5 py-4 font-mono font-black text-primary">{transaction.bookingCode}</td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-900 dark:text-white">{transaction.customer.name}</p>
                    <p className="text-xs text-slate-500">{transaction.customer.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-700 dark:text-slate-200">{transaction.car.name}</p>
                    <p className="text-xs text-slate-500">{formatAdminReportCategory(transaction.car.category)}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                    {formatDateId(transaction.rental.pickupDate)} - {formatDateId(transaction.rental.returnDate)}
                    <p className="text-xs">{transaction.rental.durationDays} hari, {getTripTypeLabel(transaction.rental.tripType)}</p>
                  </td>
                  <td className="px-5 py-4 font-black text-slate-900 dark:text-white">
                    {formatRupiahId(transaction.totalInvoiceDisplay)}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${getStatusBadgeClass(transaction.paymentStatus ?? transaction.bookingStatus)}`}>
                      {transaction.paymentStatus ? getPaymentStatusLabel(transaction.paymentStatus) : getBookingStatusLabel(transaction.bookingStatus)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      href={transaction.detailPath}
                    >
                      Lihat Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof PaymentServiceError) {
    return error.message;
  }

  return 'Laporan admin belum dapat dibaca.';
}

export default async function AdminLaporanPage({ searchParams }: AdminLaporanPageProps) {
  const rawSearchParams = await searchParams;
  const query = parseAdminReportQuery(rawSearchParams);
  const session = await getCurrentAuthSession();
  const user = session?.user?.id
    ? { id: session.user.id, role: session.user.role ?? null }
    : null;
  const report = await readAdminReport(user, { query: rawSearchParams }).catch((error: unknown) => ({
    errorMessage: getErrorMessage(error),
  }));

  return (
    <div className="flex min-h-screen bg-background-light font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <AdminSidebar />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Laporan Operasional</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Laporan booking, pembayaran, dan snapshot dynamic pricing dari data real.
            </p>
          </div>
        </header>

        <div className="w-full max-w-[1500px] space-y-6 p-4 sm:p-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Periode Laporan</p>
                <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                  {formatDateId(query.startDate)} sampai {formatDateId(query.endDate)}
                </p>
              </div>
              <form action="/admin/laporan" className="flex flex-wrap items-end gap-3" method="GET">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Mulai
                  <input
                    className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    defaultValue={query.startDate}
                    name="startDate"
                    type="date"
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Selesai
                  <input
                    className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    defaultValue={query.endDate}
                    name="endDate"
                    type="date"
                  />
                </label>
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90"
                  type="submit"
                >
                  Terapkan Periode
                </button>
              </form>
            </div>
          </section>

          {'errorMessage' in report ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {report.errorMessage}
            </p>
          ) : (
            <>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {report.modelLabel} - Diperbarui {formatDateTimeId(report.generatedAt)}
              </div>
              <ReportContent report={report} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
