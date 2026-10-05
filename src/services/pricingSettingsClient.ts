import {
  ML_RETRAIN_SETTING_KEYS,
  getPricingSettingsErrorMessage,
  isValidMlRetrainSetting,
  type MlRetrainSettingKey,
  type MlRetrainSettings,
} from '../lib/pricingSettingsUi';

export class PricingSettingsClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PricingSettingsClientError';
  }
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);

  if (!response.ok) {
    let code = 'UNKNOWN_ERROR';
    let serverMessage: string | null = null;
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code || 'UNKNOWN_ERROR';
      serverMessage = body.error?.message || null;
    } catch {
      code = 'UNKNOWN_ERROR';
    }
    throw new PricingSettingsClientError(
      code,
      serverMessage || getPricingSettingsErrorMessage(code),
    );
  }

  return response.json();
}

function parseRate(body: unknown): number {
  const rate = (body as { lateFineDailyRatePct?: unknown } | null)?.lateFineDailyRatePct;
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    throw new PricingSettingsClientError(
      'INVALID_SETTING_VALUE',
      getPricingSettingsErrorMessage('INVALID_SETTING_VALUE'),
    );
  }
  return rate;
}

export async function readPricingSettingsClient(): Promise<number> {
  return parseRate(await requestJson('/api/admin/pricing-settings'));
}

export async function updatePricingSettingsClient(lateFineDailyRatePct: number): Promise<number> {
  const body = await requestJson('/api/admin/pricing-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lateFineDailyRatePct }),
  });
  return parseRate(body);
}

function parseMlRetrainSettings(body: unknown): MlRetrainSettings {
  const record = (body as { mlRetrain?: unknown } | null)?.mlRetrain;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new PricingSettingsClientError(
      'INVALID_SETTING_VALUE',
      getPricingSettingsErrorMessage('INVALID_SETTING_VALUE'),
    );
  }

  const source = record as Record<string, unknown>;
  const parsed: MlRetrainSettings = {
    maxMaeRegressionPct: 0,
    minR2DropPp: 0,
    minLiveSamples: 0,
  };

  for (const key of Object.keys(ML_RETRAIN_SETTING_KEYS) as MlRetrainSettingKey[]) {
    const value = source[key];
    if (!isValidMlRetrainSetting(key, value)) {
      throw new PricingSettingsClientError('INVALID_SETTING_VALUE', getPricingSettingsErrorMessage('INVALID_SETTING_VALUE'));
    }
    parsed[key] = value;
  }

  return parsed;
}

export async function readMlRetrainSettingsClient(): Promise<MlRetrainSettings> {
  return parseMlRetrainSettings(await requestJson('/api/admin/pricing-settings'));
}

export async function updateMlRetrainSettingsClient(
  settings: Partial<MlRetrainSettings>,
): Promise<MlRetrainSettings> {
  const body = await requestJson('/api/admin/pricing-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return parseMlRetrainSettings(body);
}
