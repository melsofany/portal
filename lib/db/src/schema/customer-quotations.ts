import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const customerQuotationsTable = pgTable("customer_quotations", {
  id: serial("id").primaryKey(),
  quotationNo: text("quotation_no").notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "restrict" }),
  responsibleName: text("responsible_name").default(""),
  requestDate: text("request_date").notNull(),
  expiryDate: text("expiry_date").default(""),
  customerOrderNo: text("customer_order_no").default(""),
  status: text("status").notNull().default("مفتوح"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const customerQuotationItemsTable = pgTable("customer_quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull().references(() => customerQuotationsTable.id, { onDelete: "cascade" }),
  customerItemCode: text("customer_item_code").default(""),
  description: text("description").notNull(),
  partNo: text("part_no").default(""),
  unit: text("unit").default(""),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  unitPrice: numeric("unit_price", { precision: 14, scale: 3 }).default("0"),
  customerNotes: text("customer_notes").default(""),
  internalCode: text("internal_code").default(""),
  internalCodeScore: numeric("internal_code_score", { precision: 5, scale: 4 }).default("0"),
});

export type CustomerQuotation = typeof customerQuotationsTable.$inferSelect;
export type CustomerQuotationItem = typeof customerQuotationItemsTable.$inferSelect;
