'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Swal from 'sweetalert2';
import {
  ML_RETRAIN_SETTING_BOUNDS,
  ML_RETRAIN_SETTING_LABELS,
  isValidMlRetrainSetting,
  type MlRetrainSettingKey,
  type MlRetrainSettings,
} from '@/lib/pricingSettingsUi';
import {
  PricingSettingsClientError,
  updateMlRetrainSettingsClient,
} from '@/services/pricingSettingsClient';

const FIELDS: Array<MlRetrainSettingKey> = [
  'maxMaeRegressionPct',
  'minR2DropPp',
  'minLiveSamples',
];

function toInputValue(value: number): string {
  return String(value);
}

export default function AdminMlRetrainSettingsForm({
  initialSettings,
}: {
  initialSettings: MlRetrainSettings;
}) {
  const router = useRouter();
  const [inputs, setInputs] = useState<Record<MlRetrainSettingKey, string>>({
    maxMaeRegressionPct: toInputValue(initialSettings.maxMaeRegressionPct),
    minR2DropPp: toInputValue(initialSettings.minR2DropPp),
    minLiveSamples: toInputValue(initialSettings.minLiveSamples),
  });
  const [isSaving, setIsSaving] = useState(false);

  const parsed: Record<MlRetrainSettingKey, number> = {
    maxMaeRegressionPct: Number(inputs.maxMaeRegressionPct),
    minR2DropPp: Number(inputs.minR2DropPp),
    minLiveSamples: Number(inputs.minLiveSamples),
  };
  const isFieldValid = (key: MlRetrainSettingKey): boolean =>
    inputs[key].trim() !== '' && isValidMlRetrainSetting(key, parsed[key]);
  const allValid = FIELDS.every(isFieldValid);

  async function handleSave() {
    if (isSaving) {
      return;
    }

    if (!allValid) {
      const invalidKey = FIELDS.find((key) => !isFieldValid(key));
      const bounds = invalidKey ? ML_RETRAIN_SETTING_BOUNDS[invalidKey] : null;
      await Swal.fire({
        title: 'Nilai tidak valid',
        text: invalidKey && bounds
          ? `${ML_RETRAIN_SETTING_LABELS[invalidKey]} harus bilangan bulat antara ${bounds.min} sampai ${bounds.max}.`
          : 'Periksa kembali nilai ambang continuous learning.',
        icon: 'warning',
      });
      return;
    }

    setIsSaving(true);
    try {
      const saved = await updateMlRetrainSettingsClient(parsed);
      await Swal.fire({
        title: 'Konfigurasi tersimpan',
        text: `Ambang retrain kini: MAE maks +${saved.maxMaeRegressionPct}%, R² maks turun ${(saved.minR2DropPp / 100).toFixed(2)}, minimal ${saved.minLiveSamples} sampel live.`,
        icon: 'success',
        confirmButtonColor: '#2563eb',
      });
      router.refresh();
    } catch (error) {
      await Swal.fire({
        title: 'Belum tersimpan',
        text: error instanceof PricingSettingsClientError
          ? error.message
          : 'Konfigurasi continuous learning belum dapat disimpan.',
        icon: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-black text-slate-900 dark:text-white">Continuous Learning (Retrain Model)</h2>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        {FIELDS.map((key) => {
          const bounds = ML_RETRAIN_SETTING_BOUNDS[key];
          const valid = isFieldValid(key);

          return (
            <label
              className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              key={key}
            >
              {ML_RETRAIN_SETTING_LABELS[key]} ({bounds.min}–{bounds.max})
              <input
                className={`mt-1 block w-56 rounded-lg border bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:bg-slate-900 dark:text-white ${
                  valid
                    ? 'border-slate-200 dark:border-slate-700'
                    : 'border-red-400 focus:border-red-500 focus:ring-red-200'
                }`}
                max={bounds.max}
                min={bounds.min}
                onChange={(event) =>
                  setInputs((current) => ({ ...current, [key]: event.target.value }))}
                step={1}
                type="number"
                value={inputs[key]}
              />
            </label>
          );
        })}
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving || !allValid}
          onClick={() => void handleSave()}
          type="button"
        >
          {isSaving ? 'Menyimpan...' : 'Simpan Ambang'}
        </button>
      </div>
    </section>
  );
}
