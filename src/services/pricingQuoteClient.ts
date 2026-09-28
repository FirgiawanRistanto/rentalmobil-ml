import {
  getPricingQuoteErrorMessage,
  PricingQuoteClientError,
  PRICING_QUOTE_ENDPOINT,
  validatePricingQuoteForm,
  type PricingQuoteApiErrorBody,
  type PricingQuoteRequest,
  type PricingQuoteResponse,
} from '../lib/pricingQuoteUi';

export interface RequestPricingQuoteOptions {
  fetchFn?: typeof fetch;
}

function isPricingQuoteResponse(value: unknown): value is PricingQuoteResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const pricing = record.pricing as Record<string, unknown> | undefined;
  const context = record.pricingContext as Record<string, unknown> | undefined;

  return (
    typeof record.quoteId === 'string' &&
    typeof record.quoteStatus === 'string' &&
    typeof record.expiresAt === 'string' &&
    !!record.car &&
    !!record.rental &&
    !!pricing &&
    typeof pricing.modelVersion === 'string' &&
    typeof pricing.predictedPriceAdjustmentPct === 'number' &&
    typeof pricing.predictedPriceAdjustmentPercentDisplay === 'number' &&
    typeof pricing.dynamicPriceRawPerDay === 'number' &&
    typeof pricing.dynamicPriceDisplayPerDay === 'number' &&
    typeof pricing.totalInvoiceDisplay === 'number' &&
    !!context &&
    typeof context.availabilityRatio === 'number' &&
    typeof context.utilizationRate === 'number' &&
    typeof context.demandLevel === 'string' &&
    Array.isArray(record.pricingReasons)
  );
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as PricingQuoteApiErrorBody;
    return body.error?.code || 'UNKNOWN_PRICING_QUOTE_ERROR';
  } catch {
    return 'UNKNOWN_PRICING_QUOTE_ERROR';
  }
}

export async function requestPricingQuote(
  input: PricingQuoteRequest,
  options: RequestPricingQuoteOptions = {},
): Promise<PricingQuoteResponse> {
  validatePricingQuoteForm(input);

  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(PRICING_QUOTE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const code = await readErrorCode(response);
    throw new PricingQuoteClientError(code, getPricingQuoteErrorMessage(code));
  }

  const quote = await response.json();

  if (!isPricingQuoteResponse(quote)) {
    throw new PricingQuoteClientError(
      'PRICING_QUOTE_RESPONSE_INVALID',
      getPricingQuoteErrorMessage('PRICING_QUOTE_RESPONSE_INVALID'),
    );
  }

  return quote;
}
