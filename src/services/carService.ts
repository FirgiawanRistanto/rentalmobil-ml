import { eq } from 'drizzle-orm';
import { db } from '../db';
import { cars } from '../db/schema';

export const carService = {
  async getAllCars() {
    return await db.select().from(cars);
  },

  async getCarById(id: string) {
    const result = await db.select().from(cars).where(eq(cars.id, id));
    return result[0];
  },
  
  async createCar(data: typeof cars.$inferInsert) {
    return await db.insert(cars).values(data).returning();
  }
};
