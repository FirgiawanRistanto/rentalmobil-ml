import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { cars } from '../db/schema';

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
  }
};
