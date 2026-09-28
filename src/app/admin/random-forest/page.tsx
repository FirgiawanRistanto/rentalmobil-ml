import AdminSidebar from '@/components/admin/AdminSidebar';
import RandomForestModelClient from '@/components/admin/RandomForestModelClient';

export const dynamic = 'force-dynamic';

export default async function AdminRandomForestPage() {
  return (
    <div className="flex min-h-screen bg-background-light font-display text-slate-900 antialiased dark:bg-background-dark dark:text-slate-100">
      <AdminSidebar />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">Random Forest Model</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visualisasi dan informasi model dynamic pricing.
            </p>
          </div>
        </header>

        <div className="w-full max-w-[1500px] space-y-6 p-4 sm:p-6">
          <RandomForestModelClient />
        </div>
      </main>
    </div>
  );
}
