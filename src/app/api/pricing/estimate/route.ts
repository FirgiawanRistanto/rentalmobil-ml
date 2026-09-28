import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    await request.json();
  } catch {
    // Ignore invalid legacy payloads; this endpoint is intentionally disabled.
  }

  return NextResponse.json(
    {
      error: {
        code: 'LEGACY_PRICING_ESTIMATE_DEPRECATED',
        message: 'Endpoint pricing lama tidak lagi digunakan. Gunakan POST /api/pricing/quotes untuk Dynamic Pricing v4.',
      },
    },
    { status: 410 },
  );
}
