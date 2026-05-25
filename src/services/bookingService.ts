import { eq } from 'drizzle-orm';
import { db } from '../db';
import { bookings } from '../db/schema';

export const bookingService = {
  async createBooking(data: typeof bookings.$inferInsert) {
    return await db.insert(bookings).values(data).returning();
  },

  async getUserBookings(userId: string) {
    return await db.select().from(bookings).where(eq(bookings.userId, userId));
  },
  
  async getBookingById(id: string) {
    const result = await db.select().from(bookings).where(eq(bookings.id, id));
    return result[0];
  }
};
