import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const supplierCategoriesTable = pgTable("supplier_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSupplierCategorySchema = createInsertSchema(supplierCategoriesTable).omit({ id: true, createdAt: true });
export type InsertSupplierCategory = z.infer<typeof insertSupplierCategorySchema>;
export type SupplierCategory = typeof supplierCategoriesTable.$inferSelect;

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone").unique(),
  whatsapp: text("whatsapp").unique(),
  email: text("email").unique(),
  address: text("address"),
  commercialReg: text("commercial_reg"),
  taxReg: text("tax_reg"),
  status: text("status").notNull().default("نشط"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const supplierCategoryAssignmentsTable = pgTable("supplier_category_assignments", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => suppliersTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => supplierCategoriesTable.id, { onDelete: "cascade" }),
});

export const supplierPaymentMethodsTable = pgTable("supplier_payment_methods", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => suppliersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'cash' | 'wallet' | 'instapay' | 'bank'
  walletType: text("wallet_type"), // e.g. "فودافون كاش", "أورانج كاش" — for wallet only
  ownerName: text("owner_name"), // for wallet, instapay, bank
  phone: text("phone"), // for wallet and instapay
  bankName: text("bank_name"), // for bank only
  accountNumber: text("account_number"), // for bank only
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
export type SupplierPaymentMethod = typeof supplierPaymentMethodsTable.$inferSelect;
