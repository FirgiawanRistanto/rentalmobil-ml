import { requireAdminSession } from '@/lib/auth-guards';
import type { ReactNode } from 'react';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminSession();

  return children;
}
