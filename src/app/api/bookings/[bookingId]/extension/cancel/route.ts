import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../../../lib/auth-session';
import {
  bookingExtensionErrorStatus,
  cancelBookingExtension,
  isBookingExtensionError,
} from '../../../../../../services/bookingExtensionService';

function errorResponse(error: unknown): NextResponse {
  if (isBookingExtensionError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: bookingExtensionErrorStatus(error) },
    );
  }

  return NextResponse.json(
    { error: { code: 'UNKNOWN_ERROR', message: 'Pembatalan perpanjangan gagal diproses.' } },
    { status: 500 },
  );
}

export async function POST(_request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;

  try {
    const session = await getCurrentAuthSession();
    const user = session?.user?.id
      ? { id: session.user.id, role: session.user.role ?? null }
      : null;
    const extension = await cancelBookingExtension(bookingId, user);
    return NextResponse.json(extension);
  } catch (error) {
    return errorResponse(error);
  }
}
