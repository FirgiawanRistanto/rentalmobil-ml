import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../../lib/auth-session';
import {
  bookingExtensionErrorStatus,
  createBookingExtension,
  isBookingExtensionError,
} from '../../../../../services/bookingExtensionService';

function errorResponse(error: unknown): NextResponse {
  if (isBookingExtensionError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: bookingExtensionErrorStatus(error) },
    );
  }

  return NextResponse.json(
    { error: { code: 'UNKNOWN_ERROR', message: 'Permintaan perpanjangan gagal diproses.' } },
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
    const extension = await createBookingExtension(bookingId, body, user);
    return NextResponse.json(extension, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
