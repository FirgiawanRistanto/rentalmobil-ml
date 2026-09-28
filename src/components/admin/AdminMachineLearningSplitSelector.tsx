'use client';

import { useRouter } from 'next/navigation';
import {
  ADMIN_ML_SPLITS,
  buildAdminMlPath,
  type AdminMlSplit,
} from '@/lib/adminMachineLearningUi';

export default function AdminMachineLearningSplitSelector({
  currentSplit,
}: {
  currentSplit?: AdminMlSplit;
}) {
  const router = useRouter();

  return (
    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      Pilih Pembagian Dataset
      <select
        className="mt-1 block min-w-[260px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        onChange={(event) => {
          if (!event.target.value) {
            return;
          }

          router.push(buildAdminMlPath({
            split: event.target.value as AdminMlSplit,
            evaluated: false,
            trainPage: 1,
            testPage: 1,
            predictionPage: 1,
            predictionQ: '',
          }));
        }}
        value={currentSplit ?? ''}
      >
        <option value="">Pilih pembagian dataset</option>
        {ADMIN_ML_SPLITS.map((split) => (
          <option key={split.value} value={split.value}>
            {split.label}
          </option>
        ))}
      </select>
    </label>
  );
}
