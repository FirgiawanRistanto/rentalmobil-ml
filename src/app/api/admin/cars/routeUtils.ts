import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  AdminCarsServiceError,
  normalizeAdminCarSlug,
  type AdminCarInput,
  type AdminCarsUser,
} from '../../../../services/adminCarsService';

const MAX_CAR_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_CAR_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
  };
}

export function errorResponse(code: string, message: string, status: number): NextResponse<ErrorResponseBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function mapAdminCarsError(error: unknown): NextResponse<ErrorResponseBody> {
  if (error instanceof AdminCarsServiceError) {
    return errorResponse(error.code, error.message, error.status);
  }

  return errorResponse('ADMIN_CAR_OPERATION_FAILED', 'Operasi mobil belum berhasil.', 500);
}

export async function getSessionUser(): Promise<AdminCarsUser | null> {
  const { getCurrentAuthSession } = await import('../../../../lib/auth-session');
  const session = await getCurrentAuthSession();
  return session?.user?.id
    ? { id: session.user.id, role: session.user.role ?? null }
    : null;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AdminCarsServiceError('INVALID_ADMIN_CAR_REQUEST', 'Body request tidak valid.');
  }
}

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === 'true' || value === 'active';
}

async function storeCarImageFile(file: File, name: string): Promise<string> {
  if (file.size === 0) {
    return '';
  }

  const extension = ALLOWED_CAR_IMAGE_TYPES.get(file.type);
  if (!extension) {
    throw new AdminCarsServiceError('INVALID_CAR_IMAGE_TYPE', 'Format gambar harus JPG, PNG, atau WEBP.', 422);
  }

  if (file.size > MAX_CAR_IMAGE_BYTES) {
    throw new AdminCarsServiceError('CAR_IMAGE_TOO_LARGE', 'Ukuran gambar maksimal 3 MB.', 413);
  }

  const baseSlug = normalizeAdminCarSlug(name) || 'mobil';
  const fileName = `${baseSlug}-${randomUUID()}.${extension}`;
  const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', 'cars');
  const storagePath = path.join(uploadDirectory, fileName);
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));

  return `/uploads/cars/${fileName}`;
}

export async function readAdminCarRequestBody(request: Request): Promise<AdminCarInput> {
  const contentType = request.headers.get('content-type') ?? '';

  if (!contentType.includes('multipart/form-data')) {
    return await readJsonBody(request) as AdminCarInput;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new AdminCarsServiceError('INVALID_ADMIN_CAR_REQUEST', 'Form mobil tidak valid.');
  }

  const name = formValue(formData, 'name') ?? '';
  const imageFile = formData.get('imageFile');
  const uploadedImagePath = imageFile instanceof File
    ? await storeCarImageFile(imageFile, name)
    : '';
  const initialPlateNumber = formValue(formData, 'initialPlateNumber')?.trim();

  return {
    name,
    slug: formValue(formData, 'slug'),
    category: formValue(formData, 'category'),
    year: formValue(formData, 'year'),
    transmission: formValue(formData, 'transmission'),
    capacitySeats: formValue(formData, 'capacitySeats'),
    basePricePerDay: formValue(formData, 'basePricePerDay'),
    imageUrl: uploadedImagePath || formValue(formData, 'imageUrl') || null,
    isAvailable: parseBoolean(formValue(formData, 'isAvailable')),
    units: initialPlateNumber ? [{ plateNumber: initialPlateNumber, status: 'ACTIVE' }] : [],
  };
}
