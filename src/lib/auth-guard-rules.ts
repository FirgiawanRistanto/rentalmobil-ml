export const DASHBOARD_ROUTE = '/dashboard';
export const ADMIN_ROUTE = '/admin';

export interface SessionUserLike {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface AuthSessionLike {
  user?: SessionUserLike | null;
}

export interface AccessDecision {
  allowed: boolean;
  redirectTo?: string;
}

export function buildLoginRedirect(callbackPath: string): string {
  return `/login?callbackURL=${encodeURIComponent(callbackPath)}`;
}

export function getDashboardAccessDecision(session: AuthSessionLike | null | undefined): AccessDecision {
  if (!session?.user) {
    return {
      allowed: false,
      redirectTo: buildLoginRedirect(DASHBOARD_ROUTE),
    };
  }

  return { allowed: true };
}

export function getAdminAccessDecision(session: AuthSessionLike | null | undefined): AccessDecision {
  if (!session?.user) {
    return {
      allowed: false,
      redirectTo: buildLoginRedirect(ADMIN_ROUTE),
    };
  }

  if (session.user.role !== 'ADMIN') {
    return {
      allowed: false,
      redirectTo: DASHBOARD_ROUTE,
    };
  }

  return { allowed: true };
}
