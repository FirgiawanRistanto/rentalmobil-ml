import { NextResponse } from 'next/server';
import { getCurrentAuthSession } from '../../../../../lib/auth-session';
import {
  PaymentServiceError,
  submitPaymentProof,
  type AuthenticatedPaymentUser,
  type SubmitPaymentProofResult,
} from '../../../../../services/paymentService';

interface PaymentProofRouteService {
  submitPaymentProof(
    input: {
      bookingId: string;
      proofFile?: {
        name?: string;
        type?: string;
        size?: number;
        arrayBuffer(): Promise<ArrayBuffer>;
      } | null;
    },
    user: AuthenticatedPaymentUser | null,
  ): Promise<SubmitPaymentProofResult>;
}

interface PaymentProofRouteDependencies {
  service?: PaymentProofRouteService;
  getCurrentUser?: () => Promise<AuthenticatedPaymentUser | null>;
}

interface PaymentProofRouteContext {
  params: Promise<{ bookingId: string }> | { bookingId: string };
}

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
  };
}

function errorResponse(code: string, message: string, status: number): NextResponse<ErrorResponseBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

function mapPaymentError(error: PaymentServiceError): NextResponse<ErrorResponseBody> {
  if (error.code === 'AUTHENTICATION_REQUIRED') {
    return errorResponse(error.code, error.message, 401);
  }

  if (error.code === 'BOOKING_NOT_FOUND') {
    return errorResponse(error.code, error.message, 404);
  }

  if (error.code === 'BOOKING_NOT_OWNED_BY_USER') {
    return errorResponse(error.code, error.message, 403);
  }

  if (error.code === 'PAYMENT_PROOF_TOO_LARGE') {
    return errorResponse(error.code, error.message, 413);
  }

  if (error.code === 'INVALID_PAYMENT_PROOF_TYPE') {
    return errorResponse(error.code, error.message, 422);
  }

  if (
    error.code === 'BOOKING_NOT_PAYABLE' ||
    error.code === 'RESERVATION_EXPIRED' ||
    error.code === 'PAYMENT_ALREADY_SUBMITTED' ||
    error.code === 'BOOKING_PRICE_SNAPSHOT_NOT_FOUND'
  ) {
    return errorResponse(error.code, error.message, 409);
  }

  if (
    error.code === 'PAYMENT_PROOF_STORAGE_FAILED' ||
    error.code === 'PAYMENT_SUBMISSION_FAILED'
  ) {
    return errorResponse(error.code, error.message, 500);
  }

  return errorResponse(error.code, error.message, 400);
}

async function getSessionUser(): Promise<AuthenticatedPaymentUser | null> {
  const session = await getCurrentAuthSession();
  return session?.user?.id
    ? { id: session.user.id, role: session.user.role ?? null }
    : null;
}

function isPaymentProofFile(value: FormDataEntryValue | null): value is File {
  return !!value &&
    typeof value === 'object' &&
    'arrayBuffer' in value &&
    'type' in value &&
    'size' in value;
}

async function resolveParams(context: PaymentProofRouteContext): Promise<{ bookingId: string }> {
  return await context.params;
}

export function createPostPaymentProofHandler(
  dependencies: PaymentProofRouteDependencies = {},
) {
  const service = dependencies.service ?? { submitPaymentProof };
  const getCurrentUser = dependencies.getCurrentUser ?? getSessionUser;

  return async function postPaymentProof(
    request: Request,
    context: PaymentProofRouteContext,
  ): Promise<NextResponse> {
    try {
      const [{ bookingId }, user, formData] = await Promise.all([
        resolveParams(context),
        getCurrentUser(),
        request.formData(),
      ]);
      const proofEntry = formData.get('proofFile');
      const proofFile = isPaymentProofFile(proofEntry) ? proofEntry : null;
      const payment = await service.submitPaymentProof({ bookingId, proofFile }, user);

      return NextResponse.json(payment, { status: 201 });
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return mapPaymentError(error);
      }

      return errorResponse(
        'PAYMENT_SUBMISSION_FAILED',
        'Gagal menyimpan submission pembayaran.',
        500,
      );
    }
  };
}
