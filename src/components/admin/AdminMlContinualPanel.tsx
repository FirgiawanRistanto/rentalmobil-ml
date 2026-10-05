'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Swal from 'sweetalert2';
import {
  MANUAL_TARGET_MAX_PERCENT,
  MANUAL_TARGET_MIN_PERCENT,
  toPercentPoints,
} from '@/lib/adminMlContinualUi';
import {
  formatAdminMlPctPoint,
  formatAdminMlR2,
  formatAdminMlSignedPercent,
} from '@/lib/adminMachineLearningUi';
import {
  AdminMlContinualClientError,
  activateContinualClient,
  clearLabelContinualClient,
  retrainContinualClient,
  setLabelContinualClient,
} from '@/services/adminMlContinualClient';
import type {
  AdminMlContinualStatus,
  ContinualLiveSample,
} from '@/services/adminMlContinualService';

function errorMessage(error: unknown): string {
  if (error instanceof AdminMlContinualClientError) {
    return error.message;
  }
  return 'Permintaan machine learning gagal diproses.';
}

function formatMetrics(maePctPoint: number, r2: number): string {
  return `${formatAdminMlPctPoint(maePctPoint)} / R² ${formatAdminMlR2(r2 * 100)}`;
}

function StatCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: string;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">{icon}</span>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      </div>
      <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{helper}</p>
    </div>
  );
}

function SampleLabelEditor({ sample }: { sample: ContinualLiveSample }) {
  const router = useRouter();
  const [value, setValue] = useState(
    sample.manualTargetFraction === null ? '' : String(toPercentPoints(sample.manualTargetFraction)),
  );
  const [busy, setBusy] = useState(false);
  const supported = sample.modelCategory !== null && sample.modelTripType !== null;

  async function handleSave() {
    if (busy) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < MANUAL_TARGET_MIN_PERCENT || parsed > MANUAL_TARGET_MAX_PERCENT) {
      await Swal.fire({
        title: 'Label tidak valid',
        text: `Target harus persentase antara ${MANUAL_TARGET_MIN_PERCENT}% sampai ${MANUAL_TARGET_MAX_PERCENT}%.`,
        icon: 'warning',
      });
      return;
    }

    setBusy(true);
    try {
      await setLabelContinualClient(sample.quoteId, parsed);
      await Swal.fire({
        title: 'Label tersimpan',
        text: `Target manual ${formatAdminMlSignedPercent(parsed)} akan menggantikan label aturan saat retrain berikutnya.`,
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
      });
      router.refresh();
    } catch (error) {
      await Swal.fire({ title: 'Label belum tersimpan', text: errorMessage(error), icon: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (busy) return;
    setBusy(true);
    try {
      await clearLabelContinualClient(sample.quoteId);
      router.refresh();
    } catch (error) {
      await Swal.fire({ title: 'Label belum dihapus', text: errorMessage(error), icon: 'error' });
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <span className="text-xs font-semibold text-slate-400">
        Kategori belum didukung model v4
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        aria-label={`Label manual untuk quote ${sample.quoteId}`}
        className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        max={MANUAL_TARGET_MAX_PERCENT}
        min={MANUAL_TARGET_MIN_PERCENT}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Otomatis"
        step={0.01}
        type="number"
        value={value}
      />
      <button
        className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy}
        onClick={() => void handleSave()}
        type="button"
      >
        Simpan
      </button>
      {sample.manualTargetFraction !== null ? (
        <button
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
          disabled={busy}
          onClick={() => void handleClear()}
          type="button"
        >
          Pakai Otomatis
        </button>
      ) : null}
    </div>
  );
}

export default function AdminMlContinualPanel({ status }: { status: AdminMlContinualStatus | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!status) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm dark:border-red-900/60 dark:bg-red-950/30">
        <h2 className="text-base font-black text-red-700 dark:text-red-300">Continual Learning</h2>
        <p className="mt-1 text-sm font-semibold text-red-600 dark:text-red-300">
          Status continual learning belum dapat dimuat. Pastikan database dan ML service
          terjangkau lalu muat ulang halaman.
        </p>
      </section>
    );
  }

  async function handleRetrain() {
    if (busy) return;
    setBusy(true);
    try {
      void Swal.fire({
        title: 'Retrain model berjalan',
        text: 'Model dilatih ulang dari dataset dasar + data live. Proses ini bisa memakan waktu satu sampai dua menit.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const report = await retrainContinualClient();
      Swal.close();
      const summary = await Swal.fire({
        title: 'Retrain berhasil',
        html: [
          `<p class="text-sm">Versi baru <b>${report.version}</b> lolos guardrail.</p>`,
          `<p class="text-sm">Metrik baru: ${formatMetrics(report.metrics.maePctPoint, report.metrics.r2)}</p>`,
          `<p class="text-sm">Baseline: ${formatMetrics(report.baselineMetrics.maePctPoint, report.baselineMetrics.r2)}</p>`,
          `<p class="text-sm">${report.liveRowsUsed} baris live dilatih (${report.liveRowsLabeledManual} label manual).</p>`,
        ].join(''),
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Aktifkan sekarang',
        cancelButtonText: 'Nanti',
      });

      if (summary.isConfirmed) {
        await activateContinualClient(report.versionId);
        await Swal.fire({
          title: 'Model baru aktif',
          text: `Quote berikutnya kini memakai versi ${report.version}.`,
          icon: 'success',
        });
      }

      router.refresh();
    } catch (error) {
      Swal.close();
      await Swal.fire({ title: 'Retrain gagal', text: errorMessage(error), icon: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function handleActivate(versionId: string, version: string) {
    if (busy) return;
    const confirmation = await Swal.fire({
      title: 'Aktifkan versi ini?',
      text: `Quote berikutnya akan memakai model ${version}. Anda tetap bisa kembali ke versi lain kapan pun.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Aktifkan',
      cancelButtonText: 'Batal',
    });
    if (!confirmation.isConfirmed) return;

    setBusy(true);
    try {
      await activateContinualClient(versionId);
      await Swal.fire({
        title: 'Model diaktifkan',
        text: `Versi ${version} kini menjadi model aktif.`,
        icon: 'success',
      });
      router.refresh();
    } catch (error) {
      await Swal.fire({ title: 'Aktivasi gagal', text: errorMessage(error), icon: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const activeVersionRow = status.versions.find((version) => version.version === status.activeVersion);
  const desync = Boolean(status.serviceReachable && status.activeVersion && !status.versionsInSync);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white">Continual Learning</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Model Random Forest dilatih ulang dari data live (quote nyata). Label baris live
            dihitung otomatis dari aturan penarget v4, kecuali Anda menetapkan label manual di
            bawah. Hasil retrain disimpan sebagai versi staging dan hanya aktif setelah Anda
            meninjaunya.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy || !status.eligible}
          onClick={() => void handleRetrain()}
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">school</span>
          {status.eligible ? 'Retrain Model Sekarang' : 'Belum Layak Retrain'}
        </button>
      </div>

      {!status.serviceReachable ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          ML service tidak terjangkau. Nyalakan FastAPI ml-service agar status model dan retrain
          dapat digunakan.
        </p>
      ) : desync ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <span>
            Model aktif di database (<b>{status.activeVersion}</b>) berbeda dengan yang dimuat
            ml-service (<b>{status.loadedVersion}</b>).
          </span>
          {activeVersionRow ? (
            <button
              className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={() => void handleActivate(activeVersionRow.id, activeVersionRow.version)}
              type="button"
            >
              Sinkronkan
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          helper={`${status.samplesSinceLastRetrain} baru sejak retrain terakhir`}
          icon="database"
          label="Sampel Live"
          value={`${status.totalLiveSamples} data`}
        />
        <StatCard
          helper={`Minimal ${status.minSamplesRequired} sampel baru + ml-service aktif`}
          icon="rule"
          label="Kelayakan Retrain"
          value={status.eligible ? 'Layak retrain' : `Belum cukup (${status.samplesSinceLastRetrain}/${status.minSamplesRequired})`}
        />
        <StatCard
          helper={status.versionsInSync ? 'Sesuai dengan yang dimuat ml-service' : 'Tidak sinkron dengan ml-service'}
          icon="deployed_code"
          label="Model Aktif"
          value={status.activeVersion ?? status.baselineVersion}
        />
        <StatCard
          helper={status.activeMetrics ? `R² ${formatAdminMlR2(status.activeMetrics.r2 * 100)}` : 'Metrik aktif belum tersedia'}
          icon="monitoring"
          label="MAE Model Aktif"
          value={status.activeMetrics ? formatAdminMlPctPoint(status.activeMetrics.maePctPoint) : '-'}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <th className="px-5 py-4">Versi Model</th>
              <th className="px-5 py-4">Dilatih Pada</th>
              <th className="px-5 py-4">MAE</th>
              <th className="px-5 py-4">R²</th>
              <th className="px-5 py-4">Sampel Live</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {status.versions.length === 0 ? (
              <tr>
                <td className="px-5 py-6 text-slate-500 dark:text-slate-400" colSpan={7}>
                  Registry model belum tersedia.
                </td>
              </tr>
            ) : status.versions.map((version) => (
              <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50" key={version.id}>
                <td className="px-5 py-4 font-mono text-xs font-black text-primary">{version.version}</td>
                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                  {version.trainedAt ? new Date(version.trainedAt).toLocaleString('id-ID') : '-'}
                </td>
                <td className="px-5 py-4 font-semibold">
                  {version.metrics ? formatAdminMlPctPoint(version.metrics.maePctPoint) : '-'}
                </td>
                <td className="px-5 py-4 font-semibold">
                  {version.metrics ? formatAdminMlR2(version.metrics.r2 * 100) : '-'}
                </td>
                <td className="px-5 py-4">{version.liveRows === null ? '-' : `${version.liveRows} baris`}</td>
                <td className="px-5 py-4">
                  {version.isActive ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Aktif
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {version.isBaseline ? 'Baseline' : 'Arsip'}
                    </span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {version.isActive ? (
                    <span className="text-xs font-semibold text-slate-400">Sedang dipakai</span>
                  ) : (
                    <button
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
                      disabled={busy || !status.serviceReachable}
                      onClick={() => void handleActivate(version.id, version.version)}
                      type="button"
                    >
                      Aktifkan
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-sm font-black text-slate-900 dark:text-white">
          Sampel Live Terbaru &amp; Label
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Kosongkan kolom label untuk memakai label otomatis dari aturan penarget v4.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <th className="px-5 py-4">Quote</th>
                <th className="px-5 py-4">Kategori</th>
                <th className="px-5 py-4">Trip</th>
                <th className="px-5 py-4">Durasi</th>
                <th className="px-5 py-4">Utilisasi</th>
                <th className="px-5 py-4">Prediksi</th>
                <th className="px-5 py-4">Label Manual (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {status.recentSamples.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-slate-500 dark:text-slate-400" colSpan={7}>
                    Belum ada quote pricing yang terekam sebagai sampel live.
                  </td>
                </tr>
              ) : status.recentSamples.map((sample) => (
                <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50" key={sample.quoteId}>
                  <td className="px-5 py-4 font-mono text-xs font-black text-primary">
                    {sample.quoteId.slice(0, 8)}
                  </td>
                  <td className="px-5 py-4">{sample.carCategory}</td>
                  <td className="px-5 py-4">{sample.tripType === 'LUAR_KOTA' ? 'Luar Kota' : 'Dalam Kota'}</td>
                  <td className="px-5 py-4">{sample.durationDays} hari</td>
                  <td className="px-5 py-4">{Math.round(sample.utilizationRate * 100)}%</td>
                  <td className="px-5 py-4 font-bold">
                    {formatAdminMlSignedPercent(toPercentPoints(sample.predictedAdjustmentFraction))}
                  </td>
                  <td className="px-5 py-4">
                    <SampleLabelEditor
                      key={`${sample.quoteId}:${sample.manualTargetFraction ?? 'auto'}`}
                      sample={sample}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
