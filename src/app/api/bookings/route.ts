import { NextResponse } from 'next/server';

function deprecatedBookingResponse() {
  return NextResponse.json(
    {
      error: {
        code: 'LEGACY_BOOKINGS_API_DEPRECATED',
        message: 'Endpoint booking lama tidak lagi digunakan. Gunakan POST /api/bookings/from-quote untuk booking berbasis pricing quote v4.',
      },
    },
    { status: 410 },
  );
}

export async function POST(request: Request) {
  try {
    await request.json();
  } catch {
    // Ignore invalid legacy payloads; this endpoint is intentionally disabled.
  }

  return deprecatedBookingResponse();
}

export async function GET(request: Request) {
  void request;
  return deprecatedBookingResponse();
}
