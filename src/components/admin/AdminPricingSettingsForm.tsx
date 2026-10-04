'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Swal from 'sweetalert2';
import { formatRupiahId } from '@/lib/paymentUi';
import { LATE_FINE_RATE_MAX, LATE_FINE_RATE_MIN } from '@/lib/pricingSettingsUi';
import {
  PricingSettingsClientError,
  updatePricingSettingsClient,
} from '@/services/pricingSettingsClient';

const SAMPLE_DAILY_RATE = 500_000;

export default function AdminPricingSettingsForm({ initialValue }: { initialValue: number }) {
  const router = useRouter();
  const [rateInput, setRateInput] = useState(String(initialValue));
  const [isSaving, setIsSaving] = useState(false);

  const parsedRate = Number(rateInput);
  const isValid =
    rateInput.trim() !== '' &&
    Number.isInteger(parsedRate) &&
    parsedRate >= LATE_FINE_RATE_MIN &&
    parsedRate <= LATE_FINE_RATE_MAX;
  const sampleFine = isValid ? Math.round((SAMPLE_DAILY_RATE * parsedRate) / 100) : null;

  async function handleSave() {
    if (isSaving) {
      return;
    }

    if (!isValid) {
      await Swal.fire({
        title: 'Nilai tidak valid',
        text: `Persentase denda harus bilangan bulat antara ${LATE_FINE_RATE_MIN} sampai ${LATE_FINE_RATE_MAX}.`,
        icon: 'warning',
      });
      return;
    }

    setIsSaving(true);
    try {
      const saved = await updatePricingSettingsClient(parsedRate);
      await Swal.fire({
        title: 'Konfigurasi tersimpan',
        text: `Tarif denda kini ${saved}% dari tarif harian per hari telat. Berlaku untuk denda baru.`,
        icon: 'success',
        confirmButtonColor: '#2563eb',
      });
      router.refresh();
    } catch (error) {
      await Swal.fire({
        title: 'Belum tersimpan',
        text: error instanceof PricingSettingsClientError
          ? error.message
          : 'Konfigurasi pricing belum dapat disimpan.',
        icon: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-black text-slate-900 dark:text-white">Denda Keterlambatan Pengembalian</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Persentase tarif harian tersnap (harga yang disepakati customer) yang dikenakan per hari
        keterlambatan. Contoh: 100% berarti denda per hari setara satu hari sewa. Perubahan hanya
        berlaku untuk denda baru — denda yang sudah dinilai tidak berubah.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Tarif denda per hari (%)
          <input
            className={`mt-1 block w-44 rounded-lg border bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-slate-900 dark:text-white ${
              isValid
                ? 'border-slate-200 dark:border-slate-700'
                : 'border-red-400 focus:border-red-500 focus:ring-red-200'
            }`}
            max={LATE_FINE_RATE_MAX}
            min={LATE_FINE_RATE_MIN}
            onChange={(event) => setRateInput(event.target.value)}
            step={1}
            type="number"
            value={rateInput}
          />
        </label>
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving || !isValid}
          onClick={() => void handleSave()}
          type="button"
        >
          {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
        </button>
      </div>

      {sampleFine !== null ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
          Contoh: tarif harian {formatRupiahId(SAMPLE_DAILY_RATE)} → denda{' '}
          {formatRupiahId(sampleFine)} per hari telat ({parsedRate}% dari tarif harian).
        </p>
      ) : (
        <p className="mt-4 text-sm font-semibold text-red-600">
          Nilai harus bilangan bulat antara {LATE_FINE_RATE_MIN} sampai {LATE_FINE_RATE_MAX}.
        </p>
      )}
    </section>
  );
}
