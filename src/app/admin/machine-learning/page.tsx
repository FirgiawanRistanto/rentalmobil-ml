import Link from 'next/link';
import type { ReactNode } from 'react';
import AdminMachineLearningSplitSelector from '@/components/admin/AdminMachineLearningSplitSelector';
import AdminMlContinualPanel from '@/components/admin/AdminMlContinualPanel';
import AdminSidebar from '@/components/admin/AdminSidebar';
import {
  ADMIN_ML_SPLITS,
  buildAdminMlPath,
  formatAdminMlBooleanFlag,
  formatAdminMlCategory,
  formatAdminMlPctPoint,
  formatAdminMlR2,
  formatAdminMlSignedPercent,
  formatAdminMlTripType,
  formatAdminMlUtilization,
  formatRupiahId,
  getAdminMlSplitLabel,
  type AdminMlQuery,
  type AdminMlSplit,
} from '@/lib/adminMachineLearningUi';
import { getCurrentAuthSession } from '@/lib/auth-session';
import { PaymentServiceError } from '@/services/paymentService';
import {
  readAdminMachineLearning,
  type AdminMlPage,
  type AdminMlTestRow,
  type AdminMlTrainRow,
} from '@/services/adminMachineLearningService';
import {
  readAdminMlContinualStatus,
  type AdminMlContinualStatus,
} from '@/services/adminMlContinualService';

export const dynamic = 'force-dynamic';

interface AdminMachineLearningPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function MetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: string;
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helper}</p>
    </div>
  );
}

function SummaryPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function Pagination({
  page,
  query,
  table,
}: {
  page: AdminMlPage<unknown>;
  query: AdminMlQuery;
  table: 'train' | 'test' | 'prediction';
}) {
  const pageKey = table === 'train' ? 'trainPage' : table === 'test' ? 'testPage' : 'predictionPage';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm dark:border-slate-800">
      <p className="font-semibold text-slate-500 dark:text-slate-400">
        Halaman {page.page} dari {page.totalPages} - {page.totalItems} data
      </p>
      <div className="flex gap-2">
        <Link
          aria-disabled={!page.hasPreviousPage}
          className={`rounded-lg border px-4 py-2 text-xs font-bold transition ${
            page.hasPreviousPage
              ? 'border-slate-200 text-slate-700 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300'
              : 'pointer-events-none border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600'
          }`}
          href={buildAdminMlPath({ ...query, [pageKey]: Math.max(1, page.page - 1) })}
        >
          Sebelumnya
        </Link>
        <Link
          aria-disabled={!page.hasNextPage}
          className={`rounded-lg border px-4 py-2 text-xs font-bold transition ${
            page.hasNextPage
              ? 'border-slate-200 text-slate-700 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300'
              : 'pointer-events-none border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600'
          }`}
          href={buildAdminMlPath({ ...query, [pageKey]: page.page + 1 })}
        >
          Berikutnya
        </Link>
      </div>
    </div>
  );
}

function SearchForm({
  query,
  table,
  placeholder,
}: {
  query: AdminMlQuery;
  table: 'train' | 'test' | 'prediction';
  placeholder: string;
}) {
  const qName = table === 'train' ? 'trainQ' : table === 'test' ? 'testQ' : 'predictionQ';
  const pageSizeName = table === 'train' ? 'trainPageSize' : table === 'test' ? 'testPageSize' : 'predictionPageSize';
  const qValue = table === 'train' ? query.trainQ : table === 'test' ? query.testQ : query.predictionQ;
  const pageSizeValue = table === 'train' ? query.trainPageSize : table === 'test' ? query.testPageSize : query.predictionPageSize;

  return (
    <form action="/admin/machine-learning" className="flex flex-wrap items-center gap-3" method="GET">
      <input name="split" type="hidden" value={query.split} />
      {query.evaluated ? <input name="evaluated" type="hidden" value="1" /> : null}
      <input name="trainPage" type="hidden" value={table === 'train' ? 1 : query.trainPage} />
      {table !== 'train' ? <input name="trainPageSize" type="hidden" value={query.trainPageSize} /> : null}
      {table !== 'train' ? <input name="trainQ" type="hidden" value={query.trainQ} /> : null}
      <input name="testPage" type="hidden" value={table === 'test' ? 1 : query.testPage} />
      {table !== 'test' ? <input name="testPageSize" type="hidden" value={query.testPageSize} /> : null}
      {table !== 'test' ? <input name="testQ" type="hidden" value={query.testQ} /> : null}
      <input name="predictionPage" type="hidden" value={table === 'prediction' ? 1 : query.predictionPage} />
      {table !== 'prediction' ? <input name="predictionPageSize" type="hidden" value={query.predictionPageSize} /> : null}
      {table !== 'prediction' ? <input name="predictionQ" type="hidden" value={query.predictionQ} /> : null}
      <div className="relative min-w-[260px] flex-1 text-slate-400 focus-within:text-primary">
        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">search</span>
        <input
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          defaultValue={qValue}
          name={qName}
          placeholder={placeholder}
          type="text"
        />
      </div>
      <select
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        defaultValue={pageSizeValue}
        name={pageSizeName}
      >
        {[5, 10, 20, 50].map((size) => (
          <option key={size} value={size}>
            {size} / halaman
          </option>
        ))}
      </select>
      <button
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-primary dark:bg-primary dark:hover:bg-primary/80"
        type="submit"
      >
        Cari
      </button>
    </form>
  );
}

function TableShell({
  title,
  description,
  controls,
  children,
  pagination,
}: {
  title: string;
  description: string;
  controls: ReactNode;
  children: ReactNode;
  pagination: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-4 border-b border-slate-100 p-5 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        {controls}
      </div>
      <div className="overflow-x-auto">{children}</div>
      {pagination}
    </section>
  );
}

function TrainingTable({ rows }: { rows: AdminMlTrainRow[] }) {
  return (
    <table className="w-full min-w-[980px] text-left text-sm">
      <thead>
        <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <th className="px-5 py-4">ID Data</th>
          <th className="px-5 py-4">Kategori Mobil</th>
          <th className="px-5 py-4">Jenis Perjalanan</th>
          <th className="px-5 py-4">Durasi</th>
          <th className="px-5 py-4">Weekend</th>
          <th className="px-5 py-4">Holiday</th>
          <th className="px-5 py-4">Peak Season</th>
          <th className="px-5 py-4">Utilization</th>
          <th className="px-5 py-4">Target Penyesuaian</th>
          <th className="px-5 py-4">Harga Dinamis / Hari</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.length === 0 ? (
          <tr>
            <td className="px-5 py-8 text-slate-500 dark:text-slate-400" colSpan={10}>
              Tidak ada data training sesuai pencarian.
            </td>
          </tr>
        ) : rows.map((row) => (
          <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50" key={row.idData}>
            <td className="px-5 py-4 font-mono text-xs font-black text-primary">{row.idData}</td>
            <td className="px-5 py-4 font-semibold">{formatAdminMlCategory(row.vehicleCategory)}</td>
            <td className="px-5 py-4">{formatAdminMlTripType(row.tripType)}</td>
            <td className="px-5 py-4">{row.durationDays} hari</td>
            <td className="px-5 py-4">{formatAdminMlBooleanFlag(row.isWeekend)}</td>
            <td className="px-5 py-4">{formatAdminMlBooleanFlag(row.isHoliday)}</td>
            <td className="px-5 py-4">{formatAdminMlBooleanFlag(row.isPeakSeason)}</td>
            <td className="px-5 py-4">{formatAdminMlUtilization(row.utilizationRate)}</td>
            <td className="px-5 py-4 font-bold">{formatAdminMlSignedPercent(row.targetAdjustmentPct)}</td>
            <td className="px-5 py-4 font-black">{formatRupiahId(row.dynamicPriceDisplayPerDay)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TestingTable({ rows }: { rows: AdminMlTestRow[] }) {
  return (
    <table className="w-full min-w-[860px] text-left text-sm">
      <thead>
        <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <th className="px-5 py-4">ID Data</th>
          <th className="px-5 py-4">Kategori Mobil</th>
          <th className="px-5 py-4">Jenis Perjalanan</th>
          <th className="px-5 py-4">Durasi</th>
          <th className="px-5 py-4">Weekend</th>
          <th className="px-5 py-4">Holiday</th>
          <th className="px-5 py-4">Peak Season</th>
          <th className="px-5 py-4">Utilization</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.length === 0 ? (
          <tr>
            <td className="px-5 py-8 text-slate-500 dark:text-slate-400" colSpan={8}>
              Tidak ada data testing input sesuai pencarian.
            </td>
          </tr>
        ) : rows.map((row) => (
          <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50" key={row.idData}>
            <td className="px-5 py-4 font-mono text-xs font-black text-primary">{row.idData}</td>
            <td className="px-5 py-4 font-semibold">{formatAdminMlCategory(row.vehicleCategory)}</td>
            <td className="px-5 py-4">{formatAdminMlTripType(row.tripType)}</td>
            <td className="px-5 py-4">{row.durationDays} hari</td>
            <td className="px-5 py-4">{formatAdminMlBooleanFlag(row.isWeekend)}</td>
            <td className="px-5 py-4">{formatAdminMlBooleanFlag(row.isHoliday)}</td>
            <td className="px-5 py-4">{formatAdminMlBooleanFlag(row.isPeakSeason)}</td>
            <td className="px-5 py-4">{formatAdminMlUtilization(row.utilizationRate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PredictionTable({ rows }: { rows: AdminMlTestRow[] }) {
  return (
    <table className="w-full min-w-[780px] text-left text-sm">
      <thead>
        <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <th className="px-5 py-4">ID Data</th>
          <th className="px-5 py-4">Kategori Mobil</th>
          <th className="px-5 py-4">Jenis Perjalanan</th>
          <th className="px-5 py-4">Durasi</th>
          <th className="px-5 py-4">Aktual</th>
          <th className="px-5 py-4">Prediksi</th>
          <th className="px-5 py-4">Error</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.length === 0 ? (
          <tr>
            <td className="px-5 py-8 text-slate-500 dark:text-slate-400" colSpan={7}>
              Tidak ada hasil prediksi sesuai pencarian.
            </td>
          </tr>
        ) : rows.map((row) => (
          <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50" key={row.idData}>
            <td className="px-5 py-4 font-mono text-xs font-black text-primary">{row.idData}</td>
            <td className="px-5 py-4 font-semibold">{formatAdminMlCategory(row.vehicleCategory)}</td>
            <td className="px-5 py-4">{formatAdminMlTripType(row.tripType)}</td>
            <td className="px-5 py-4">{row.durationDays} hari</td>
            <td className="px-5 py-4 font-bold">{formatAdminMlSignedPercent(row.actualAdjustmentPct)}</td>
            <td className="px-5 py-4 font-bold">{formatAdminMlSignedPercent(row.predictedAdjustmentPct)}</td>
            <td className="px-5 py-4">{formatAdminMlPctPoint(row.absoluteErrorPctPoint)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof PaymentServiceError) {
    return error.message;
  }

  return 'Artifact evaluasi machine learning belum dapat dibaca.';
}

function readSelectedSplit(searchParams: Record<string, string | string[] | undefined>): AdminMlSplit | undefined {
  const rawSplit = searchParams.split;
  const split = Array.isArray(rawSplit) ? rawSplit[0] : rawSplit;
  return ADMIN_ML_SPLITS.some((item) => item.value === split) ? (split as AdminMlSplit) : undefined;
}

export default async function AdminMachineLearningPage({ searchParams }: AdminMachineLearningPageProps) {
  const rawSearchParams = await searchParams;
  const selectedSplit = readSelectedSplit(rawSearchParams);
  const session = await getCurrentAuthSession();
  const user = session?.user?.id
    ? { id: session.user.id, role: session.user.role ?? null }
    : null;
  const result = selectedSplit
    ? await readAdminMachineLearning(user, { query: rawSearchParams }).catch((error: unknown) => ({
      errorMessage: getErrorMessage(error),
    }))
    : null;
  const continualStatus: AdminMlContinualStatus | null = await readAdminMlContinualStatus(user)
    .catch(() => null);

  return (
    <div className="flex min-h-screen bg-background-light font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <AdminSidebar />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Machine Learning</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pembagian dataset dan evaluasi model Random Forest untuk dynamic pricing.
            </p>
          </div>
        </header>

        <div className="w-full max-w-[1500px] space-y-6 p-4 sm:p-6">
          <section className="flex rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <AdminMachineLearningSplitSelector currentSplit={selectedSplit} />
          </section>

          <AdminMlContinualPanel status={continualStatus} />

          {!selectedSplit ? (
            <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Pilih pembagian dataset terlebih dahulu</h2>
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                Preview data training, data testing, dan hasil evaluasi akan muncul setelah pembagian dataset dipilih.
              </p>
            </section>
          ) : result && 'errorMessage' in result ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {result.errorMessage}
            </p>
          ) : result ? (
            <>
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <MetricCard helper={getAdminMlSplitLabel(result.query.split)} icon="database" label="Total Dataset" value={`${result.evaluation.totalRows.toLocaleString('id-ID')} data`} />
                <MetricCard helper={`${Math.round(result.evaluation.trainRatio * 100)}% dari total dataset`} icon="table_rows" label="Jumlah Data Training" value={`${result.evaluation.trainRows.toLocaleString('id-ID')} data`} />
                <MetricCard helper={`${Math.round(result.evaluation.testRatio * 100)}% dari total dataset`} icon="science" label="Jumlah Data Testing" value={`${result.evaluation.testRows.toLocaleString('id-ID')} data`} />
              </section>

              <TableShell
                controls={<SearchForm placeholder="Cari ID data, source vehicle, kategori, atau trip..." query={result.query} table="train" />}
                description="Data training yang dipakai pada split terpilih."
                pagination={<Pagination page={result.training} query={result.query} table="train" />}
                title="Data Training"
              >
                <TrainingTable rows={result.training.items} />
              </TableShell>

              <TableShell
                controls={<SearchForm placeholder="Cari ID data, source vehicle, kategori, atau trip..." query={result.query} table="test" />}
                description="Data input testing pada split terpilih. Hasil aktual, prediksi, dan error akan muncul setelah evaluasi dijalankan."
                pagination={<Pagination page={result.testing} query={result.query} table="test" />}
                title="Data Testing"
              >
                <TestingTable rows={result.testing.items} />
              </TableShell>

              {!result.computedEvaluation ? (
                <section className="rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-sm dark:bg-primary/10">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-white">Muat Hasil Evaluasi Model</h2>
                    </div>
                    <Link
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90"
                      href={buildAdminMlPath({
                        ...result.query,
                        evaluated: true,
                        predictionPage: 1,
                        predictionQ: '',
                      })}
                    >
                      Muat Hasil Evaluasi
                      <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                    </Link>
                  </div>
                </section>
              ) : (
                <>
                  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Hasil Evaluasi Model</h2>
                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                      <SummaryPill label="MAE Penyesuaian Harga" value={formatAdminMlPctPoint(result.computedEvaluation.maePctPoint)} />
                      <SummaryPill label="R² / Kecocokan Model" value={formatAdminMlR2(result.computedEvaluation.r2Percent)} />
                    </div>
                    <p className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                      Hasil evaluasi dihitung dari data testing berdasarkan nilai aktual dan nilai prediksi model.
                    </p>
                  </section>

                  <TableShell
                    controls={<SearchForm placeholder="Cari ID data, source vehicle, kategori, atau trip..." query={result.query} table="prediction" />}
                    description="Hasil prediksi data testing setelah evaluasi dijalankan."
                    pagination={<Pagination page={result.prediction} query={result.query} table="prediction" />}
                    title="Hasil Prediksi Data Testing"
                  >
                    <PredictionTable rows={result.prediction.items} />
                  </TableShell>
                </>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
