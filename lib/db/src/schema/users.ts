import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";

  export const usersTable = pgTable("users", {
    id: serial("id").primaryKey(),
    username: text("username").notNull().unique(),
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").default(""),
    role: text("role").notNull().default("user"),
    sessionToken: text("session_token"),
    employeeId: integer("employee_id"),
    permissions: text("permissions").default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  });

  export type User = typeof usersTable.$inferSelect;
  export type InsertUser = typeof usersTable.$inferInsert;
  