import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../lib/auth-session';
import {
  isPricingSettingsError,
  pricingSettingsErrorStatus,
  readLateFineDailyRatePct,
  updateLateFineDailyRatePct,
} from '../../../../services/pricingSettingsService';

function errorResponse(error: unknown): NextResponse {
  if (isPricingSettingsError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: pricingSettingsErrorStatus(error) },
    );
  }

  return NextResponse.json(
    { error: { code: 'UNKNOWN_ERROR', message: 'Konfigurasi pricing gagal diproses.' } },
    { status: 500 },
  );
}

async function currentUser() {
  const session = await getCurrentAuthSession();
  return session?.user?.id
    ? { id: session.user.id, role: session.user.role ?? null }
    : null;
}

export async function GET() {
  try {
    const lateFineDailyRatePct = await readLateFineDailyRatePct(await currentUser());
    return NextResponse.json({ lateFineDailyRatePct });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { lateFineDailyRatePct?: unknown } | null;
    const lateFineDailyRatePct = await updateLateFineDailyRatePct(
      await currentUser(),
      body?.lateFineDailyRatePct,
    );
    return NextResponse.json({ lateFineDailyRatePct });
  } catch (error) {
    return errorResponse(error);
  }
}
