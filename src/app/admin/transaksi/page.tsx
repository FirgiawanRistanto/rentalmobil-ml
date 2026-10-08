import Link from 'next/link';
import type { ReactNode } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import {
  buildAdminTransactionListPath,
  formatDateId,
  formatRupiahId,
  getAdminTransactionStatusBadgeClass,
  getAdminTransactionStatusLabel,
  parseAdminTransactionsSearchParams,
  type AdminTransactionListItem,
  type AdminTransactionOrder,
  type AdminTransactionSort,
  type AdminTransactionStatusFilter,
  type AdminTransactionsQuery,
} from '@/lib/adminTransactionUi';
import { getCurrentAuthSession } from '@/lib/auth-session';
import {
  getBookingExtensionBadgeClass,
  getBookingExtensionStatusLabel,
  getBookingExtensionTableBadgeLabel,
  isPendingBookingExtensionStatus,
} from '@/lib/bookingExtensionUi';
import {
  getBookingFineBadgeClass,
  getBookingFineStatusLabel,
  getBookingFineTableBadgeLabel,
  isPendingBookingFineStatus,
} from '@/lib/bookingFineUi';
import { PaymentServiceError } from '@/services/paymentService';
import {
  AdminTransactionsServiceError,
  listAdminTransactions,
} from '@/services/adminTransactionsService';

export const dynamic = 'force-dynamic';

const FILTERS: Array<{ value: AdminTransactionStatusFilter; label: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'unpaid', label: 'Belum Bayar' },
  { value: 'waiting_verification', label: 'Menunggu Verifikasi' },
  { value: 'verified', label: 'Terverifikasi' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'expired', label: 'Kedaluwarsa' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
  { value: 'extension', label: 'Perpanjangan' },
];

function buildPeriodLabel(transaction: AdminTransactionListItem): string {
  return `${formatDateId(transaction.rental.pickupDate)} - ${formatDateId(transaction.rental.returnDate)}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof PaymentServiceError) {
    return error.message;
  }

  if (error instanceof AdminTransactionsServiceError) {
    return error.message;
  }

  return 'Data transaksi belum dapat dibaca.';
}

function buildSortPath(query: AdminTransactionsQuery, sort: AdminTransactionSort): string {
  const nextOrder: AdminTransactionOrder = query.sort === sort && query.order === 'asc' ? 'desc' : 'asc';
  return buildAdminTransactionListPath({ ...query, page: 1, sort, order: nextOrder });
}

function SortHeader({
  query,
  sort,
  children,
}: {
  query: AdminTransactionsQuery;
  sort: AdminTransactionSort;
  children: ReactNode;
}) {
  const active = query.sort === sort;
  const icon = active ? (query.order === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';

  return (
    <Link
      className="inline-flex items-center gap-1 transition hover:text-primary"
      href={buildSortPath(query, sort)}
    >
      {children}
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
    </Link>
  );
}

interface AdminTransaksiPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminTransaksiPage({ searchParams }: AdminTransaksiPageProps) {
  const rawSearchParams = await searchParams;
  const query = parseAdminTransactionsSearchParams(rawSearchParams);
  const session = await getCurrentAuthSession();
  const user = session?.user?.id
    ? { id: session.user.id, role: session.user.role ?? null }
    : null;
  const result = await listAdminTransactions(user, { query: rawSearchParams }).catch((error: unknown) => ({
    errorMessage: getErrorMessage(error),
    items: [],
    page: query.page,
    pageSize: query.pageSize,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  }));
  const errorMessage = 'errorMessage' in result ? result.errorMessage : '';

  return (
    <div className="flex min-h-screen bg-background-light font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <AdminSidebar />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Manajemen Transaksi</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daftar booking dan status pembayaran real dari database.
            </p>
          </div>
        </header>

        <div className="w-full max-w-[1500px] space-y-6 p-4 sm:p-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => {
                  const active = query.status === item.value;

                  return (
                    <Link
                      className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                        active
                          ? 'border-primary bg-primary text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      href={buildAdminTransactionListPath({ ...query, page: 1, status: item.value })}
                      key={item.value}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              <form action="/admin/transaksi" className="flex flex-wrap items-center gap-3" method="GET">
                <input name="status" type="hidden" value={query.status} />
                <input name="sort" type="hidden" value={query.sort} />
                <input name="order" type="hidden" value={query.order} />
                <div className="relative min-w-[260px] flex-1 text-slate-400 focus-within:text-primary">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">search</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    defaultValue={query.q}
                    name="q"
                    placeholder="Cari kode booking, customer, email, atau mobil..."
                    type="text"
                  />
                </div>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  defaultValue={query.pageSize}
                  name="pageSize"
                >
                  {[10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size} / halaman
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-primary dark:bg-primary dark:hover:bg-primary/80"
                  type="submit"
                >
                  Terapkan
                </button>
              </form>
            </div>
          </section>

          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Menampilkan {result.items.length} dari {result.totalItems} transaksi
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <th className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">Booking</th>
                    <th className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                      <SortHeader query={query} sort="customerName">Customer</SortHeader>
                    </th>
                    <th className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                      <SortHeader query={query} sort="carName">Mobil & Jadwal</SortHeader>
                    </th>
                    <th className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                      <SortHeader query={query} sort="totalInvoice">Total</SortHeader>
                    </th>
                    <th className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">Status</th>
                    <th className="border-b border-slate-200 px-5 py-4 text-right dark:border-slate-800">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {result.items.length === 0 ? (
                    <tr>
                      <td className="px-5 py-10 text-center font-semibold text-slate-500" colSpan={6}>
                        Belum ada transaksi sesuai filter.
                      </td>
                    </tr>
                  ) : result.items.map((transaction) => (
                    <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50" key={transaction.bookingId}>
                      <td className="px-5 py-4 font-mono font-black text-primary">{transaction.bookingCode}</td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900 dark:text-white">{transaction.customer.name}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">{transaction.car.name}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{buildPeriodLabel(transaction)}</p>
                      </td>
                      <td className="px-5 py-4 font-black text-slate-900 dark:text-white">
                        {formatRupiahId(transaction.pricing.totalInvoiceDisplay)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${getAdminTransactionStatusBadgeClass(transaction.displayStatus)}`}>
                          {getAdminTransactionStatusLabel(transaction.displayStatus)}
                        </span>
                        {isPendingBookingExtensionStatus(transaction.extensionStatus) && (
                          <Link
                            className={`mt-1.5 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black transition hover:opacity-75 ${getBookingExtensionBadgeClass(transaction.extensionStatus)}`}
                            href={transaction.actions.detailPath}
                            title={`Perpanjangan: ${getBookingExtensionStatusLabel(transaction.extensionStatus)} — buka detail untuk memproses`}
                          >
                            {getBookingExtensionTableBadgeLabel(transaction.extensionStatus)}
                          </Link>
                        )}
                        {isPendingBookingFineStatus(transaction.fineStatus) && (
                          <Link
                            className={`mt-1.5 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black transition hover:opacity-75 ${getBookingFineBadgeClass(transaction.fineStatus)}`}
                            href={transaction.actions.detailPath}
                            title={`Denda: ${getBookingFineStatusLabel(transaction.fineStatus)} — buka detail untuk memproses`}
                          >
                            {getBookingFineTableBadgeLabel(transaction.fineStatus)}
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <Link
                            className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                            href={transaction.actions.detailPath}
                          >
                            {transaction.displayStatus === 'WAITING_VERIFICATION' ? 'Review' : 'Lihat Detail'}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <nav className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="font-semibold text-slate-500 dark:text-slate-400">
              Halaman {result.page} dari {result.totalPages}
            </p>
            <div className="flex gap-2">
              <Link
                aria-disabled={!result.hasPreviousPage}
                className={`rounded-lg border px-4 py-2 text-xs font-bold transition ${
                  result.hasPreviousPage
                    ? 'border-slate-200 text-slate-700 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300'
                    : 'pointer-events-none border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600'
                }`}
                href={buildAdminTransactionListPath({ ...query, page: Math.max(1, result.page - 1) })}
              >
                Sebelumnya
              </Link>
              <Link
                aria-disabled={!result.hasNextPage}
                className={`rounded-lg border px-4 py-2 text-xs font-bold transition ${
                  result.hasNextPage
                    ? 'border-slate-200 text-slate-700 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300'
                    : 'pointer-events-none border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600'
                }`}
                href={buildAdminTransactionListPath({ ...query, page: result.page + 1 })}
              >
                Berikutnya
              </Link>
            </div>
          </nav>
        </div>
      </main>
    </div>
  );
}
