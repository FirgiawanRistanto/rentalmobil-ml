import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../lib/auth-session';
import { ML_RETRAIN_SETTING_KEYS, type MlRetrainSettingKey } from '../../../../lib/pricingSettingsUi';
import {
  isPricingSettingsError,
  parseLateFineRatePct,
  pricingSettingsErrorStatus,
  readLateFineDailyRatePct,
  readMlRetrainSettings,
  updateLateFineDailyRatePct,
  updateMlRetrainSettings,
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

async function readAllSettings(user: Awaited<ReturnType<typeof currentUser>>) {
  const [lateFineDailyRatePct, mlRetrain] = await Promise.all([
    readLateFineDailyRatePct(user),
    readMlRetrainSettings(user),
  ]);
  return { lateFineDailyRatePct, mlRetrain };
}

export async function GET() {
  try {
    return NextResponse.json(await readAllSettings(await currentUser()));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json(
        { error: { code: 'INVALID_SETTING_VALUE', message: 'Format body permintaan tidak valid.' } },
        { status: 400 },
      );
    }

    const user = await currentUser();
    const mlKeys = (Object.keys(body) as MlRetrainSettingKey[]).filter(
      (key) => key in ML_RETRAIN_SETTING_KEYS,
    );
    const hasLateFine = 'lateFineDailyRatePct' in body;

    if (mlKeys.length === 0 && !hasLateFine) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_SETTING_VALUE',
            message: 'Tidak ada konfigurasi pricing yang dikenal pada permintaan ini.',
          },
        },
        { status: 400 },
      );
    }

    // Validasi semua nilai dulu (tanpa menyimpan) sebelum menulis apa pun,
    // agar form tidak pernah gagal setengah jalan.
    if (hasLateFine) {
      parseLateFineRatePct(body.lateFineDailyRatePct);
    }
    if (mlKeys.length > 0) {
      await updateMlRetrainSettings(
        user,
        Object.fromEntries(mlKeys.map((key) => [key, body[key]])),
      );
    }
    if (hasLateFine) {
      await updateLateFineDailyRatePct(user, body.lateFineDailyRatePct);
    }

    return NextResponse.json(await readAllSettings(user));
  } catch (error) {
    return errorResponse(error);
  }
}
