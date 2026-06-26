import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
  import { customersTable } from "./customers";
  import { customerQuotationsTable, customerQuotationItemsTable } from "./customer-quotations";

  export const customerOrdersTable = pgTable("customer_orders", {
    id: serial("id").primaryKey(),
    orderNo: text("order_no").notNull().unique(),
    customerPoNo: text("customer_po_no").default(""),
    customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
    customerName: text("customer_name").default(""),
    orderDate: text("order_date").notNull(),
    notes: text("notes").default(""),
    status: text("status").notNull().default("مفتوح"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 3 }).default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  });

  export const customerOrderItemsTable = pgTable("customer_order_items", {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => customerOrdersTable.id, { onDelete: "cascade" }),
    quotationId: integer("quotation_id").references(() => customerQuotationsTable.id, { onDelete: "set null" }),
    quotationNo: text("quotation_no").default(""),
    quotationItemId: integer("quotation_item_id").references(() => customerQuotationItemsTable.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    partNo: text("part_no").default(""),
    unit: text("unit").default(""),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
    unitPrice: numeric("unit_price", { precision: 14, scale: 3 }).notNull().default("0"),
    totalPrice: numeric("total_price", { precision: 14, scale: 3 }).notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
  });

  export type CustomerOrder = typeof customerOrdersTable.$inferSelect;
  export type CustomerOrderItem = typeof customerOrderItemsTable.$inferSelect;
  