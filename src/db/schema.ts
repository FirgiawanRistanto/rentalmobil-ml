import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['CUSTOMER', 'ADMIN']);
export const bookingStatusEnum = pgEnum('booking_status', ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  role: roleEnum('role').default('CUSTOMER').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const cars = pgTable('cars', {
  id: uuid('id').primaryKey().defaultRandom(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  category: text('category').notNull(),
  year: integer('year').notNull(),
  basePricePerDay: integer('basePricePerDay').notNull(),
  isAvailable: boolean('isAvailable').default(true).notNull(),
  imageUrl: text('imageUrl'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('userId').references(() => users.id).notNull(),
  carId: uuid('carId').references(() => cars.id).notNull(),
  startDate: timestamp('startDate', { mode: 'date' }).notNull(),
  endDate: timestamp('endDate', { mode: 'date' }).notNull(),
  totalPrice: integer('totalPrice').notNull(),
  status: bookingStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});
