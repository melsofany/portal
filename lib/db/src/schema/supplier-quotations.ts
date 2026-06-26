import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { suppliersTable } from "./suppliers";
import { customerQuotationsTable } from "./customer-quotations";

export const supplierQuotationsTable = pgTable("supplier_quotations", {
  id: serial("id").primaryKey(),
  rfqNo: text("rfq_no").notNull().unique(),
  sourceQuotationId: integer("source_quotation_id").references(() => customerQuotationsTable.id, { onDelete: "set null" }),
  sourceQuotationNo: text("source_quotation_no").default(""),
  customerOrderNo: text("customer_order_no").default(""),
  requestDate: text("request_date").notNull(),
  notes: text("notes").default(""),
  status: text("status").notNull().default("مرسل"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const supplierQuotationItemsTable = pgTable("supplier_quotation_items", {
  id: serial("id").primaryKey(),
  rfqId: integer("rfq_id").notNull().references(() => supplierQuotationsTable.id, { onDelete: "cascade" }),
  customerItemCode: text("customer_item_code").default(""),
  description: text("description").notNull(),
  partNo: text("part_no").default(""),
  unit: text("unit").default(""),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const supplierQuotationSuppliersTable = pgTable("supplier_quotation_suppliers", {
  id: serial("id").primaryKey(),
  rfqId: integer("rfq_id").notNull().references(() => supplierQuotationsTable.id, { onDelete: "cascade" }),
  supplierId: integer("supplier_id").notNull().references(() => suppliersTable.id, { onDelete: "cascade" }),
  sentVia: text("sent_via").default(""),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  token: text("token").default(""),
  responseStatus: text("response_status").notNull().default("pending"),
  responseSubmittedAt: timestamp("response_submitted_at", { withTimezone: true }),
  vatIncluded: text("vat_included").default("no"),
  deliveryDays: integer("delivery_days"),
  responseNotes: text("response_notes").default(""),
  firstOpenedAt: timestamp("first_opened_at", { withTimezone: true }),
});

export const supplierQuotationItemPricesTable = pgTable("supplier_quotation_item_prices", {
  id: serial("id").primaryKey(),
  rfqSupplierId: integer("rfq_supplier_id").notNull().references(() => supplierQuotationSuppliersTable.id, { onDelete: "cascade" }),
  rfqItemId: integer("rfq_item_id").notNull().references(() => supplierQuotationItemsTable.id, { onDelete: "cascade" }),
  unitPrice: numeric("unit_price", { precision: 14, scale: 3 }).notNull().default("0"),
  notes: text("notes").default(""),
  vatIncluded: text("vat_included").default("no"),
  deliveryDays: integer("delivery_days"),
});

export type SupplierQuotation = typeof supplierQuotationsTable.$inferSelect;
export type SupplierQuotationItem = typeof supplierQuotationItemsTable.$inferSelect;
export type SupplierQuotationSupplier = typeof supplierQuotationSuppliersTable.$inferSelect;
export type SupplierQuotationItemPrice = typeof supplierQuotationItemPricesTable.$inferSelect;
