import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { customerOrdersTable } from "./customer-orders";
import { supplierOrdersTable } from "./supplier-orders";

export const deliveryPermitsTable = pgTable("delivery_permits", {
  id: serial("id").primaryKey(),
  permitNo: text("permit_no").notNull().unique(),
  customerOrderId: integer("customer_order_id").references(() => customerOrdersTable.id, { onDelete: "restrict" }),
  customerOrderNo: text("customer_order_no").default(""),
  customerPoNo: text("customer_po_no").default(""),
  customerName: text("customer_name").default(""),
  supplierOrderId: integer("supplier_order_id").references(() => supplierOrdersTable.id, { onDelete: "restrict" }),
  supplierOrderNo: text("supplier_order_no").default(""),
  supplierName: text("supplier_name").default(""),
  deliveryDate: text("delivery_date").notNull(),
  notes: text("notes").default(""),
  status: text("status").notNull().default("صادر"),
  rejectionReason: text("rejection_reason").default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type DeliveryPermit = typeof deliveryPermitsTable.$inferSelect;
