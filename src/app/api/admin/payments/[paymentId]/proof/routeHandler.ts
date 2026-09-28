import {
  getAdminPaymentProof,
  PaymentServiceError,
  type AdminPaymentProofResult,
  type AuthenticatedPaymentUser,
} from '../../../../../../services/paymentService';
import {
  errorResponse,
  getAdminRouteUser,
  mapAdminPaymentError,
  resolveAdminPaymentParams,
  type AdminPaymentRouteContext,
} from '../routeUtils';

interface AdminPaymentProofRouteService {
  getAdminPaymentProof(
    paymentId: string,
    user: AuthenticatedPaymentUser | null,
  ): Promise<AdminPaymentProofResult>;
}

interface AdminPaymentProofRouteDependencies {
  service?: AdminPaymentProofRouteService;
  getCurrentUser?: () => Promise<AuthenticatedPaymentUser | null>;
}

function buildContentDisposition(filename: string): string {
  const safeFilename = filename.replace(/["\r\n]/g, '_');
  return `inline; filename="${safeFilename}"`;
}

export function createGetAdminPaymentProofHandler(
  dependencies: AdminPaymentProofRouteDependencies = {},
) {
  const service = dependencies.service ?? { getAdminPaymentProof };
  const getCurrentUser = dependencies.getCurrentUser ?? getAdminRouteUser;

  return async function getAdminPaymentProofRoute(
    _request: Request,
    context: AdminPaymentRouteContext,
  ): Promise<Response> {
    try {
      const [{ paymentId }, user] = await Promise.all([
        resolveAdminPaymentParams(context),
        getCurrentUser(),
      ]);
      const proof = await service.getAdminPaymentProof(paymentId, user);

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
      if (error instanceof PaymentServiceError) {
        return mapAdminPaymentError(error);
      }

      return errorResponse('PAYMENT_PROOF_NOT_FOUND', 'Bukti pembayaran tidak dapat dibaca.', 500);
    }
  };
}
