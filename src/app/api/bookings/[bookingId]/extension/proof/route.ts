import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../../../lib/auth-session';
import {
  bookingExtensionErrorStatus,
  isBookingExtensionError,
  submitBookingExtensionProof,
} from '../../../../../../services/bookingExtensionService';
import { PaymentServiceError } from '../../../../../../services/paymentService';

function errorResponse(error: unknown): NextResponse {
  if (isBookingExtensionError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: bookingExtensionErrorStatus(error) },
    );
  }

  if (error instanceof PaymentServiceError) {
    const status = error.code === 'PAYMENT_PROOF_NOT_FOUND'
      ? 404
      : error.code === 'AUTHENTICATION_REQUIRED'
        ? 401
        : 400;
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
  }

  return NextResponse.json(
    { error: { code: 'UNKNOWN_ERROR', message: 'Upload bukti perpanjangan gagal diproses.' } },
    { status: 500 },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_EXTENSION_REQUEST', message: 'Request harus berupa form-data dengan proofFile.' } },
      { status: 400 },
    );
  }

  try {
    const session = await getCurrentAuthSession();
    const user = session?.user?.id
      ? { id: session.user.id, role: session.user.role ?? null }
      : null;

    const file = formData.get('proofFile');
    const proofFile = file && typeof file === 'object' && 'arrayBuffer' in file
      ? (file as File)
      : null;

    const extension = await submitBookingExtensionProof(bookingId, proofFile, user);
    return NextResponse.json(extension, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
