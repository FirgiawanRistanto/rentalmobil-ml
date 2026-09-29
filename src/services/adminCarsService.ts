import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { cars, carUnits } from '../db/schema';

export type AdminCarCategory = 'passenger_car' | 'mpv' | 'suv';
export type AdminCarUnitStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type AdminCarTransmission = 'Otomatis' | 'Manual' | 'Hybrid';

export interface AdminCarsUser {
  id: string;
  role?: string | null;
}

export interface AdminCarUnitSummary {
  id: string;
  plateNumber: string;
  status: AdminCarUnitStatus;
}

export interface AdminCarListItem {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string;
  category: AdminCarCategory;
  year: number;
  transmission: string;
  capacitySeats: number;
  basePricePerDay: number;
  imageUrl: string | null;
  isAvailable: boolean;
  units: AdminCarUnitSummary[];
  unitCounts: Record<AdminCarUnitStatus, number>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCarsSummary {
  totalCars: number;
  totalUnits: number;
  activeUnits: number;
  maintenanceUnits: number;
  inactiveUnits: number;
}

export interface AdminCarsListResponse {
  summary: AdminCarsSummary;
  cars: AdminCarListItem[];
}

export interface AdminCarInput {
  name?: unknown;
  slug?: unknown;
  category?: unknown;
  year?: unknown;
  transmission?: unknown;
  capacitySeats?: unknown;
  basePricePerDay?: unknown;
  imageUrl?: unknown;
  isAvailable?: unknown;
  units?: unknown;
}

export interface AdminCarUnitInput {
  plateNumber?: unknown;
  status?: unknown;
}

export class AdminCarsServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'AdminCarsServiceError';
  }
}

interface AdminCarsRepository {
  listCars(): Promise<AdminCarListItem[]>;
  findCarById(carId: string): Promise<AdminCarListItem | null>;
  findSlug(slug: string, excludeCarId?: string): Promise<boolean>;
  createCar(input: NormalizedCarInput, units: NormalizedUnitInput[]): Promise<AdminCarListItem>;
  updateCar(carId: string, input: NormalizedCarInput): Promise<AdminCarListItem | null>;
  deactivateCar(carId: string): Promise<AdminCarListItem | null>;
  deleteCar(carId: string): Promise<AdminCarListItem | null>;
  listUnits(carId: string): Promise<AdminCarUnitSummary[]>;
  createUnit(carId: string, input: NormalizedUnitInput): Promise<AdminCarUnitSummary>;
  updateUnit(carId: string, unitId: string, input: NormalizedUnitInput): Promise<AdminCarUnitSummary | null>;
  deactivateUnit(carId: string, unitId: string): Promise<AdminCarUnitSummary | null>;
  deleteUnit(carId: string, unitId: string): Promise<AdminCarUnitSummary | null>;
}

interface NormalizedCarInput {
  name: string;
  slug: string;
  brand: string;
  model: string;
  category: AdminCarCategory;
  year: number;
  transmission: AdminCarTransmission;
  capacitySeats: number;
  basePricePerDay: number;
  imageUrl: string | null;
  isAvailable: boolean;
}

interface NormalizedUnitInput {
  plateNumber: string;
  status: AdminCarUnitStatus;
}

function mapRows<T>(result: { rows?: unknown[] } | unknown[]): T[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as T[];
}

function assertAdmin(user: AdminCarsUser | null | undefined) {
  if (!user?.id) {
    throw new AdminCarsServiceError('AUTHENTICATION_REQUIRED', 'Login admin diperlukan.', 401);
  }

  if (user.role !== 'ADMIN') {
    throw new AdminCarsServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'Hanya admin yang dapat mengelola mobil.', 403);
  }
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeAdminCarSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isAdminCarTransmission(value: unknown): value is AdminCarTransmission {
  return value === 'Otomatis' || value === 'Manual' || value === 'Hybrid';
}

function normalizeTransmission(value: unknown): AdminCarTransmission {
  if (value === 'Automatic') {
    return 'Otomatis';
  }

  if (isAdminCarTransmission(value)) {
    return value;
  }

  throw new AdminCarsServiceError('INVALID_ADMIN_CAR_TRANSMISSION', 'Transmisi mobil tidak valid.');
}

async function buildUniqueSlug(
  name: string,
  repository: Pick<AdminCarsRepository, 'findSlug'>,
  excludeCarId?: string,
): Promise<string> {
  const baseSlug = normalizeAdminCarSlug(name);
  if (!baseSlug) {
    throw new AdminCarsServiceError('INVALID_ADMIN_CAR_REQUEST', 'Nama mobil belum dapat dijadikan slug.');
  }

  let candidate = baseSlug;
  let suffix = 2;
  while (await repository.findSlug(candidate, excludeCarId)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function parsePositiveInteger(value: unknown, fieldName: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AdminCarsServiceError('INVALID_ADMIN_CAR_REQUEST', `${fieldName} harus berupa angka lebih dari 0.`);
  }
  return parsed;
}

function parseYear(value: unknown): number {
  const year = parsePositiveInteger(value, 'Tahun');
  if (year < 1990 || year > 2100) {
    throw new AdminCarsServiceError('INVALID_ADMIN_CAR_REQUEST', 'Tahun kendaraan tidak valid.');
  }
  return year;
}

function parseCategory(value: unknown): AdminCarCategory {
  if (value === 'passenger_car' || value === 'mpv' || value === 'suv') {
    return value;
  }

  throw new AdminCarsServiceError('INVALID_ADMIN_CAR_CATEGORY', 'Kategori mobil tidak didukung.');
}

function parseUnitStatus(value: unknown): AdminCarUnitStatus {
  if (value === 'ACTIVE' || value === 'MAINTENANCE' || value === 'INACTIVE') {
    return value;
  }

  throw new AdminCarsServiceError('INVALID_ADMIN_UNIT_REQUEST', 'Status unit tidak valid.');
}

function splitName(name: string): { brand: string; model: string } {
  const [brand, ...modelParts] = name.split(/\s+/);
  return {
    brand,
    model: modelParts.join(' ') || brand,
  };
}

function normalizeCarInput(input: AdminCarInput, slug: string): NormalizedCarInput {
  const name = toTrimmedString(input.name);
  if (!name) {
    throw new AdminCarsServiceError('INVALID_ADMIN_CAR_REQUEST', 'Nama mobil wajib diisi.');
  }

  const { brand, model } = splitName(name);
  const imageUrl = toTrimmedString(input.imageUrl);

  return {
    name,
    slug,
    brand,
    model,
    category: parseCategory(input.category),
    year: parseYear(input.year),
    transmission: normalizeTransmission(input.transmission ?? 'Manual'),
    capacitySeats: parsePositiveInteger(input.capacitySeats, 'Kapasitas kursi'),
    basePricePerDay: parsePositiveInteger(input.basePricePerDay, 'Harga dasar'),
    imageUrl: imageUrl || null,
    isAvailable: input.isAvailable === undefined ? true : Boolean(input.isAvailable),
  };
}

function normalizeUnitInput(input: AdminCarUnitInput): NormalizedUnitInput {
  const plateNumber = toTrimmedString(input.plateNumber).toUpperCase();
  if (!plateNumber) {
    throw new AdminCarsServiceError('INVALID_ADMIN_UNIT_REQUEST', 'Nomor plat wajib diisi.');
  }

  return {
    plateNumber,
    status: input.status === undefined ? 'ACTIVE' : parseUnitStatus(input.status),
  };
}

function normalizeInitialUnits(input: unknown): NormalizedUnitInput[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((unit): unit is AdminCarUnitInput => typeof unit === 'object' && unit !== null)
    .map(normalizeUnitInput);
}

function mapCarRow(row: {
  id: string;
  slug: string;
  brand: string;
  model: string;
  category: AdminCarCategory;
  year: number;
  transmission: string;
  capacitySeats: number;
  basePricePerDay: number;
  imageUrl: string | null;
  isAvailable: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  units: AdminCarUnitSummary[] | null;
}): AdminCarListItem {
  const units = row.units ?? [];
  const unitCounts = {
    ACTIVE: units.filter((unit) => unit.status === 'ACTIVE').length,
    MAINTENANCE: units.filter((unit) => unit.status === 'MAINTENANCE').length,
    INACTIVE: units.filter((unit) => unit.status === 'INACTIVE').length,
  };

  return {
    ...row,
    name: `${row.brand} ${row.model}`,
    units,
    unitCounts,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function summarizeCars(items: AdminCarListItem[]): AdminCarsSummary {
  return items.reduce<AdminCarsSummary>((summary, car) => ({
    totalCars: summary.totalCars + 1,
    totalUnits: summary.totalUnits + car.units.length,
    activeUnits: summary.activeUnits + car.unitCounts.ACTIVE,
    maintenanceUnits: summary.maintenanceUnits + car.unitCounts.MAINTENANCE,
    inactiveUnits: summary.inactiveUnits + car.unitCounts.INACTIVE,
  }), {
    totalCars: 0,
    totalUnits: 0,
    activeUnits: 0,
    maintenanceUnits: 0,
    inactiveUnits: 0,
  });
}

function mapDatabaseError(error: unknown): never {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const detail = typeof error === 'object' && error && 'detail' in error ? String(error.detail) : '';

  if (error instanceof AdminCarsServiceError) {
    throw error;
  }

  if (code === '23505' && detail.includes('slug')) {
    throw new AdminCarsServiceError('CAR_SLUG_ALREADY_EXISTS', 'Slug mobil sudah digunakan.', 409);
  }

  if (code === '23505' && detail.includes('plateNumber')) {
    throw new AdminCarsServiceError('CAR_UNIT_PLATE_ALREADY_EXISTS', 'Nomor plat unit sudah digunakan.', 409);
  }

  if (code === '23503') {
    throw new AdminCarsServiceError(
      'CAR_HAS_HISTORY',
      'Mobil sudah memiliki riwayat transaksi, gunakan Nonaktifkan agar data historis tetap aman.',
      409,
    );
  }

  throw new AdminCarsServiceError('ADMIN_CAR_OPERATION_FAILED', 'Data mobil belum berhasil disimpan.', 500);
}

export function createDrizzleAdminCarsRepository(): AdminCarsRepository {
  async function listCarsQuery(whereSql = sql`true`): Promise<AdminCarListItem[]> {
    const result = await db.execute(sql`
      select
        c.id,
        c.slug,
        c.brand,
        c.model,
        c.category,
        c.year,
        c.transmission,
        c."capacitySeats",
        c."basePricePerDay",
        c."imageUrl",
        c."isAvailable",
        c."createdAt",
        c."updatedAt",
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', cu.id,
              'plateNumber', cu."plateNumber",
              'status', cu.status
            )
            order by cu."plateNumber"
          ) filter (where cu.id is not null),
          '[]'::jsonb
        ) as units
      from cars c
      left join car_units cu on cu."carId" = c.id
      where ${whereSql}
      group by c.id
      order by c."createdAt" desc, c.brand asc, c.model asc
    `);

    return mapRows<Parameters<typeof mapCarRow>[0]>(result).map(mapCarRow);
  }

  return {
    async listCars() {
      return listCarsQuery();
    },

    async findCarById(carId) {
      const [car] = await listCarsQuery(sql`c.id = ${carId}::uuid`);
      return car ?? null;
    },

    async findSlug(slug, excludeCarId) {
      const [row] = await db
        .select({ id: cars.id })
        .from(cars)
        .where(excludeCarId
          ? and(eq(cars.slug, slug), sql`${cars.id} <> ${excludeCarId}::uuid`)
          : eq(cars.slug, slug))
        .limit(1);

      return !!row;
    },

    async createCar(input, units) {
      try {
        const createdId = await db.transaction(async (tx) => {
          const [created] = await tx.insert(cars).values({
            slug: input.slug,
            brand: input.brand,
            model: input.model,
            category: input.category,
            year: input.year,
            transmission: input.transmission,
            capacitySeats: input.capacitySeats,
            basePricePerDay: input.basePricePerDay,
            isAvailable: input.isAvailable,
            imageUrl: input.imageUrl,
          }).returning();

          if (units.length > 0) {
            await tx.insert(carUnits).values(units.map((unit) => ({
              carId: created.id,
              plateNumber: unit.plateNumber,
              status: unit.status,
            })));
          }

          return created.id;
        });

        const [car] = await listCarsQuery(sql`c.id = ${createdId}::uuid`);
        return car;
      } catch (error) {
        mapDatabaseError(error);
      }
    },

    async updateCar(carId, input) {
      try {
        const [updated] = await db.update(cars)
          .set({
            slug: input.slug,
            brand: input.brand,
            model: input.model,
            category: input.category,
            year: input.year,
            transmission: input.transmission,
            capacitySeats: input.capacitySeats,
            basePricePerDay: input.basePricePerDay,
            imageUrl: input.imageUrl,
            isAvailable: input.isAvailable,
            updatedAt: new Date(),
          })
          .where(eq(cars.id, carId))
          .returning({ id: cars.id });

        if (!updated) return null;
        return this.findCarById(carId);
      } catch (error) {
        mapDatabaseError(error);
      }
    },

    async deactivateCar(carId) {
      const [updated] = await db.update(cars)
        .set({ isAvailable: false, updatedAt: new Date() })
        .where(eq(cars.id, carId))
        .returning({ id: cars.id });

      if (!updated) return null;
      return this.findCarById(carId);
    },

    async deleteCar(carId) {
      const existing = await this.findCarById(carId);
      if (!existing) return null;

      try {
        await db.transaction(async (tx) => {
          const [locked] = await tx
            .select({ id: cars.id })
            .from(cars)
            .where(eq(cars.id, carId))
            .for('update');

          if (!locked) {
            throw new AdminCarsServiceError('CAR_NOT_FOUND', 'Mobil tidak ditemukan.', 404);
          }

          const result = await tx.execute(sql`
            select exists(
              select 1 from pricing_quotes pq where pq."carId" = ${carId}::uuid
              union all
              select 1 from bookings b where b."carId" = ${carId}::uuid
              union all
              select 1
              from booking_price_snapshots bps
              join bookings b on b.id = bps."bookingId"
              where b."carId" = ${carId}::uuid
              union all
              select 1
              from booking_payments bp
              join bookings b on b.id = bp."bookingId"
              where b."carId" = ${carId}::uuid
            ) as "hasHistory"
          `);
          const [history] = mapRows<{ hasHistory: boolean }>(result);

          if (history?.hasHistory) {
            throw new AdminCarsServiceError(
              'CAR_HAS_HISTORY',
              'Mobil sudah memiliki riwayat transaksi, gunakan Nonaktifkan agar data historis tetap aman.',
              409,
            );
          }

          await tx.delete(carUnits).where(eq(carUnits.carId, carId));
          await tx.delete(cars).where(eq(cars.id, carId));
        });

        return existing;
      } catch (error) {
        mapDatabaseError(error);
      }
    },

    async listUnits(carId) {
      const rows = await db.select({
        id: carUnits.id,
        plateNumber: carUnits.plateNumber,
        status: carUnits.status,
      }).from(carUnits).where(eq(carUnits.carId, carId)).orderBy(carUnits.plateNumber);

      return rows;
    },

    async createUnit(carId, input) {
      try {
        const [created] = await db.insert(carUnits)
          .values({
            carId,
            plateNumber: input.plateNumber,
            status: input.status,
          })
          .returning({
            id: carUnits.id,
            plateNumber: carUnits.plateNumber,
            status: carUnits.status,
          });

        return created;
      } catch (error) {
        mapDatabaseError(error);
      }
    },

    async updateUnit(carId, unitId, input) {
      try {
        const [updated] = await db.update(carUnits)
          .set({
            plateNumber: input.plateNumber,
            status: input.status,
            updatedAt: new Date(),
          })
          .where(and(eq(carUnits.id, unitId), eq(carUnits.carId, carId)))
          .returning({
            id: carUnits.id,
            plateNumber: carUnits.plateNumber,
            status: carUnits.status,
          });

        return updated ?? null;
      } catch (error) {
        mapDatabaseError(error);
      }
    },

    async deactivateUnit(carId, unitId) {
      const [updated] = await db.update(carUnits)
        .set({ status: 'INACTIVE', updatedAt: new Date() })
        .where(and(eq(carUnits.id, unitId), eq(carUnits.carId, carId)))
        .returning({
          id: carUnits.id,
          plateNumber: carUnits.plateNumber,
          status: carUnits.status,
        });

      return updated ?? null;
    },

    async deleteUnit(carId, unitId) {
      const existing = await db.select({
        id: carUnits.id,
        plateNumber: carUnits.plateNumber,
        status: carUnits.status,
      })
        .from(carUnits)
        .where(and(eq(carUnits.id, unitId), eq(carUnits.carId, carId)));

      const unit = existing[0];
      if (!unit) return null;

      try {
        await db.transaction(async (tx) => {
          const [locked] = await tx
            .select({ id: carUnits.id })
            .from(carUnits)
            .where(and(eq(carUnits.id, unitId), eq(carUnits.carId, carId)))
            .for('update');

          if (!locked) {
            throw new AdminCarsServiceError('CAR_UNIT_NOT_FOUND', 'Unit mobil tidak ditemukan.', 404);
          }

          const result = await tx.execute(sql`
            select exists(
              select 1 from bookings b where b."carUnitId" = ${unitId}::uuid
            ) as "hasHistory"
          `);
          const [history] = mapRows<{ hasHistory: boolean }>(result);

          if (history?.hasHistory) {
            throw new AdminCarsServiceError(
              'CAR_UNIT_HAS_HISTORY',
              'Unit sudah memiliki riwayat booking. Ubah status unit menjadi INACTIVE agar data historis tetap aman.',
              409,
            );
          }

          await tx.delete(carUnits).where(and(eq(carUnits.id, unitId), eq(carUnits.carId, carId)));
        });

        return unit;
      } catch (error) {
        mapDatabaseError(error);
      }
    },
  };
}

export const drizzleAdminCarsRepository = createDrizzleAdminCarsRepository();

export async function listAdminCars(
  user: AdminCarsUser | null,
  repository: AdminCarsRepository = drizzleAdminCarsRepository,
): Promise<AdminCarsListResponse> {
  assertAdmin(user);
  const items = await repository.listCars();
  return {
    summary: summarizeCars(items),
    cars: items,
  };
}

export async function readAdminCar(
  carId: string,
  user: AdminCarsUser | null,
  repository: AdminCarsRepository = drizzleAdminCarsRepository,
): Promise<AdminCarListItem> {
  assertAdmin(user);
  const car = await repository.findCarById(carId);
  if (!car) {
    throw new AdminCarsServiceError('CAR_NOT_FOUND', 'Mobil tidak ditemukan.', 404);
  }
  return car;
}

export async function createAdminCar(
  input: AdminCarInput,
  user: AdminCarsUser | null,
  repository: AdminCarsRepository = drizzleAdminCarsRepository,
): Promise<AdminCarListItem> {
  assertAdmin(user);
  const name = toTrimmedString(input.name);
  const slug = await buildUniqueSlug(name, repository);
  const normalizedCar = normalizeCarInput(input, slug);
  const units = normalizeInitialUnits(input.units);
  return repository.createCar(normalizedCar, units);
}

export async function updateAdminCar(
  carId: string,
  input: AdminCarInput,
  user: AdminCarsUser | null,
  repository: AdminCarsRepository = drizzleAdminCarsRepository,
): Promise<AdminCarListItem> {
  assertAdmin(user);
  const existing = await repository.findCarById(carId);
  if (!existing) {
    throw new AdminCarsServiceError('CAR_NOT_FOUND', 'Mobil tidak ditemukan.', 404);
  }
  const requestedSlug = normalizeAdminCarSlug(toTrimmedString(input.slug)) || existing.slug;
  const slug = await repository.findSlug(requestedSlug, carId)
    ? await buildUniqueSlug(requestedSlug, repository, carId)
    : requestedSlug;
  const normalizedCar = normalizeCarInput(input, slug);
  const car = await repository.updateCar(carId, normalizedCar);
  if (!car) {
    throw new AdminCarsServiceError('CAR_NOT_FOUND', 'Mobil tidak ditemukan.', 404);
  }
  return car;
}

export async function deactivateAdminCar(
  carId: string,
  user: AdminCarsUser | null,
  repository: AdminCarsRepository = drizzleAdminCarsRepository,
): Promise<AdminCarListItem> {
  assertAdmin(user);
  const car = await repository.deactivateCar(carId);
  if (!car) {
    throw new AdminCarsServiceError('CAR_NOT_FOUND', 'Mobil tidak ditemukan.', 404);
  }
  return car;
}

export async function deleteAdminCar(
  carId: string,
  user: AdminCarsUser | null,
  repository: AdminCarsRepository = drizzleAdminCarsRepository,
): Promise<AdminCarListItem> {
  assertAdmin(user);
  const car = await repository.deleteCar(carId);
  if (!car) {
    throw new AdminCarsServiceError('CAR_NOT_FOUND', 'Mobil tidak ditemukan.', 404);
  }
  return car;
}

export async function listAdminCarUnits(
  carId: string,
  user: AdminCarsUser | null,
  repository: AdminCarsRepository = drizzleAdminCarsRepository,
): Promise<{ units: AdminCarUnitSummary[] }> {
  assertAdmin(user);
  return { units: await repository.listUnits(carId) };
}

export async function createAdminCarUnit(
  carId: string,
  input: AdminCarUnitInput,
  user: AdminCarsUser | null,
  repository: AdminCarsRepository = drizzleAdminCarsRepository,
): Promise<AdminCarUnitSummary> {
  assertAdmin(user);
  await readAdminCar(carId, user, repository);
  return repository.createUnit(carId, normalizeUnitInput(input));
}

export async function updateAdminCarUnit(
  carId: string,
  unitId: string,
  input: AdminCarUnitInput,
  user: AdminCarsUser | null,
  repository: AdminCarsRepository = drizzleAdminCarsRepository,
): Promise<AdminCarUnitSummary> {
  assertAdmin(user);
  const unit = await repository.updateUnit(carId, unitId, normalizeUnitInput(input));
  if (!unit) {
    throw new AdminCarsServiceError('CAR_UNIT_NOT_FOUND', 'Unit mobil tidak ditemukan.', 404);
  }
  return unit;
}

export async function deactivateAdminCarUnit(
  carId: string,
  unitId: string,
  user: AdminCarsUser | null,
  repository: AdminCarsRepository = drizzleAdminCarsRepository,
): Promise<AdminCarUnitSummary> {
  assertAdmin(user);
  const unit = await repository.deactivateUnit(carId, unitId);
  if (!unit) {
    throw new AdminCarsServiceError('CAR_UNIT_NOT_FOUND', 'Unit mobil tidak ditemukan.', 404);
  }
  return unit;
}

export async function deleteAdminCarUnit(
  carId: string,
  unitId: string,
  user: AdminCarsUser | null,
  repository: AdminCarsRepository = drizzleAdminCarsRepository,
): Promise<AdminCarUnitSummary> {
  assertAdmin(user);
  const unit = await repository.deleteUnit(carId, unitId);
  if (!unit) {
    throw new AdminCarsServiceError('CAR_UNIT_NOT_FOUND', 'Unit mobil tidak ditemukan.', 404);
  }
  return unit;
}
