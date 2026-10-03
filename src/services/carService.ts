import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { cars } from '../db/schema';

export interface CarUnitOption {
  id: string;
  plateNumber: string;
  status: string;
  available: boolean;
}

export const carService = {
  async getAllCars() {
    return await db.select().from(cars).where(eq(cars.isAvailable, true));
  },

  async getCarById(id: string) {
    const result = await db
      .select()
      .from(cars)
      .where(and(
        eq(cars.isAvailable, true),
        or(eq(cars.slug, id), sql`${cars.id}::text = ${id}`),
      ));
    return result[0];
  },
  
  async createCar(data: typeof cars.$inferInsert) {
    return await db.insert(cars).values(data).returning();
  },

  /**
   * Daftar unit (nopol) aktif milik sebuah mobil, opsional dengan cek
   * ketersediaan untuk periode sewa (tanpa bentrok booking CONFIRMED /
   * PENDING yang masih berlaku) — dipakai halaman detail katalog dan
   * pemilih unit di konfirmasi booking.
   */
  async listCarUnits(
    carId: string,
    period: { pickupDate: Date; returnDate: Date } | null = null,
  ): Promise<CarUnitOption[]> {
    const availability = period
      ? sql`not exists (
          select 1 from bookings b
          where b."carUnitId" = cu.id
            and (
              b.status = 'CONFIRMED'
              or (
                b.status = 'PENDING'
                and (
                  b."reservationExpiresAt" is null
                  or b."reservationExpiresAt" > now()
                )
              )
            )
            and b."startDate" < ${period.returnDate}
            and b."endDate" > ${period.pickupDate}
        )`
      : sql`true`;

    const result = await db.execute(sql`
      select
        cu.id,
        cu."plateNumber",
        cu.status,
        ${availability} as available
      from car_units cu
      where cu."carId" = ${carId}::uuid
        and cu.status = 'ACTIVE'
      order by cu."createdAt", cu.id
    `);

    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
      id: string;
      plateNumber: string;
      status: string;
      available: boolean | string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      plateNumber: row.plateNumber,
      status: row.status,
      available: row.available === true || row.available === 't' || row.available === 'true',
    }));
  },
};
