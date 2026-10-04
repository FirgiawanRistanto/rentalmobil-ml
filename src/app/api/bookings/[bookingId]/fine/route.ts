import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../../lib/auth-session';
import {
  bookingFineErrorStatus,
  isBookingFineError,
  readBookingFine,
} from '../../../../../services/bookingFineService';

function errorResponse(error: unknown): NextResponse {
  if (isBookingFineError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: bookingFineErrorStatus(error) },
    );
  }

  return NextResponse.json(
    { error: { code: 'UNKNOWN_ERROR', message: 'Denda keterlambatan gagal dibaca.' } },
    { status: 500 },
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;

  try {
    const session = await getCurrentAuthSession();
    const user = session?.user?.id
      ? { id: session.user.id, role: session.user.role ?? null }
      : null;
    const fine = await readBookingFine(bookingId, user);
    return NextResponse.json(fine);
  } catch (error) {
    return errorResponse(error);
  }
}
