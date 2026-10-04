import { getPricingSettingsErrorMessage } from '../lib/pricingSettingsUi';

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
    try {
      const body = (await response.json()) as { error?: { code?: string } };
      code = body.error?.code || 'UNKNOWN_ERROR';
    } catch {
      code = 'UNKNOWN_ERROR';
    }
    throw new PricingSettingsClientError(code, getPricingSettingsErrorMessage(code));
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
