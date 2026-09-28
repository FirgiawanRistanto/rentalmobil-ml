import { requireDashboardSession } from '@/lib/auth-guards';
import type { ReactNode } from 'react';

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireDashboardSession();

  return children;
}
