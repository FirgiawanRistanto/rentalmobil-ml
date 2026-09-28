import {
  requestMlModelInfo,
  requestMlModelTree,
  type MlModelClientOptions,
  type MlModelInfo,
  type MlModelTreeStructure,
} from './mlModelClient';
import { PaymentServiceError } from './paymentService';

export interface AdminMlModelUser {
  id: string;
  role?: string | null;
}

type AdminMlModelDependencies = MlModelClientOptions;

function assertAdminUser(user: AdminMlModelUser | null | undefined): void {
  if (!user?.id) {
    throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'Login admin diperlukan untuk membaca model Random Forest.');
  }

  if (user.role !== 'ADMIN') {
    throw new PaymentServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'Hanya admin yang dapat membaca model Random Forest.');
  }
}

export async function readAdminMlModelInfo(
  user: AdminMlModelUser | null | undefined,
  dependencies: AdminMlModelDependencies = {},
): Promise<MlModelInfo> {
  assertAdminUser(user);

  return requestMlModelInfo(dependencies);
}

export async function readAdminMlModelTree(
  treeIndex: number,
  user: AdminMlModelUser | null | undefined,
  dependencies: AdminMlModelDependencies = {},
): Promise<MlModelTreeStructure> {
  assertAdminUser(user);

  return requestMlModelTree(treeIndex, dependencies);
}
