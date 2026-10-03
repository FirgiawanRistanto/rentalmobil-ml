import { getCurrentAuthSession } from '../../../../../../../lib/auth-session';
import {
  bookingExtensionErrorStatus,
  getAdminBookingExtensionProof,
  isBookingExtensionError,
} from '../../../../../../../services/bookingExtensionService';
import { PaymentServiceError } from '../../../../../../../services/paymentService';

function buildContentDisposition(filename: string): string {
  const safeFilename = filename.replace(/["\r\n]/g, '_');
  return `inline; filename="${safeFilename}"`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;

  try {
    const session = await getCurrentAuthSession();
    const user = session?.user?.id
      ? { id: session.user.id, role: session.user.role ?? null }
      : null;
    const proof = await getAdminBookingExtensionProof(bookingId, user);

    return new Response(Buffer.from(proof.data), {
      headers: {
        'Content-Type': proof.mimeType,
        'Content-Length': String(proof.sizeBytes),
        'Content-Disposition': buildContentDisposition(proof.filename),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (isBookingExtensionError(error)) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: bookingExtensionErrorStatus(error) },
      );
    }

    if (error instanceof PaymentServiceError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === 'PAYMENT_PROOF_NOT_FOUND' ? 404 : 400 },
      );
    }

    return Response.json(
      { error: { code: 'UNKNOWN_ERROR', message: 'Bukti perpanjangan gagal dibaca.' } },
      { status: 500 },
    );
  }
}
