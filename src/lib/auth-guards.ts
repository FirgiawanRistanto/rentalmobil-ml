import { redirect } from 'next/navigation';
import { getCurrentAuthSession } from './auth-session';
import { getAdminAccessDecision, getDashboardAccessDecision } from './auth-guard-rules';

export async function requireDashboardSession() {
  const session = await getCurrentAuthSession();
  const decision = getDashboardAccessDecision(session);

  if (!decision.allowed) {
    redirect(decision.redirectTo ?? '/login');
  }

  return session;
}

export async function requireAdminSession() {
  const session = await getCurrentAuthSession();
  const decision = getAdminAccessDecision(session);

  if (!decision.allowed) {
    redirect(decision.redirectTo ?? '/login');
  }

  return session;
}
