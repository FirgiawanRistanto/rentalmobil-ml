import AdminMlRetrainSettingsForm from '@/components/admin/AdminMlRetrainSettingsForm';
import AdminPricingSettingsForm from '@/components/admin/AdminPricingSettingsForm';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { getCurrentAuthSession } from '@/lib/auth-session';
import {
  PricingSettingsError,
  readLateFineDailyRatePct,
  readMlRetrainSettings,
} from '@/services/pricingSettingsService';

export const dynamic = 'force-dynamic';

export default async function AdminPengaturanPage() {
  const session = await getCurrentAuthSession();
  const user = session?.user?.id
    ? { id: session.user.id, role: session.user.role ?? null }
    : null;

  const result = await Promise.all([readLateFineDailyRatePct(user), readMlRetrainSettings(user)]).then(
    ([rate, mlRetrain]) => ({ rate, mlRetrain }),
    (error: unknown) => ({
      errorMessage:
        error instanceof PricingSettingsError
          ? error.message
          : 'Konfigurasi pricing belum dapat dibaca.',
    }),
  );

  return (
    <div className="flex min-h-screen bg-background-light font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <AdminSidebar />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Pengaturan</h1>
          </div>
        </header>

        <div className="w-full max-w-[1500px] space-y-6 p-4 sm:p-6">
          {'errorMessage' in result ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {result.errorMessage}
            </p>
          ) : (
            <>
              <AdminPricingSettingsForm initialValue={result.rate} />
              <AdminMlRetrainSettingsForm initialSettings={result.mlRetrain} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
