import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../../../../lib/auth-session';
import {
  bookingFineErrorStatus,
  isBookingFineError,
  rejectBookingFine,
} from '../../../../../../../services/bookingFineService';

function errorResponse(error: unknown): NextResponse {
  if (isBookingFineError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: bookingFineErrorStatus(error) },
    );
  }

  return NextResponse.json(
    { error: { code: 'UNKNOWN_ERROR', message: 'Penolakan denda gagal diproses.' } },
    { status: 500 },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  try {
    const session = await getCurrentAuthSession();
    const user = session?.user?.id
      ? { id: session.user.id, role: session.user.role ?? null }
      : null;
    const reason = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).rejectionReason
      : undefined;
    const fine = await rejectBookingFine(bookingId, reason, user);
    return NextResponse.json(fine);
  } catch (error) {
    return errorResponse(error);
  }
}
