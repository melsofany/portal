import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
    import { suppliersTable } from "./suppliers";
    import { customerOrdersTable, customerOrderItemsTable } from "./customer-orders";

    export const supplierOrdersTable = pgTable("supplier_orders", {
      id: serial("id").primaryKey(),
      orderNo: text("order_no").notNull().unique(),
      supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
      supplierName: text("supplier_name").default(""),
      supplierEmail: text("supplier_email").default(""),
      supplierWhatsapp: text("supplier_whatsapp").default(""),
      orderDate: text("order_date").notNull(),
      notes: text("notes").default(""),
      status: text("status").notNull().default("مفتوح"),
      totalAmount: numeric("total_amount", { precision: 14, scale: 3 }).default("0"),
      representativeId: integer("representative_id"),
      representativeName: text("representative_name").default(""),
      representativePhone: text("representative_phone").default(""),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    });

    export const supplierOrderItemsTable = pgTable("supplier_order_items", {
      id: serial("id").primaryKey(),
      orderId: integer("order_id").notNull().references(() => supplierOrdersTable.id, { onDelete: "cascade" }),
      customerOrderId: integer("customer_order_id").references(() => customerOrdersTable.id, { onDelete: "set null" }),
      customerOrderNo: text("customer_order_no").default(""),
      customerOrderItemId: integer("customer_order_item_id").references(() => customerOrderItemsTable.id, { onDelete: "set null" }),
      description: text("description").notNull(),
      partNo: text("part_no").default(""),
      unit: text("unit").default(""),
      quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
      unitPrice: numeric("unit_price", { precision: 14, scale: 3 }).notNull().default("0"),
      totalPrice: numeric("total_price", { precision: 14, scale: 3 }).notNull().default("0"),
      sortOrder: integer("sort_order").notNull().default(0),
    });

    export const supplierPaymentsTable = pgTable("supplier_payments", {
      id: serial("id").primaryKey(),
      paymentNo: text("payment_no").notNull().unique(),
      supplierOrderId: integer("supplier_order_id").notNull().references(() => supplierOrdersTable.id, { onDelete: "restrict" }),
      orderNo: text("order_no").default(""),
      supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
      supplierName: text("supplier_name").default(""),
      amount: numeric("amount", { precision: 14, scale: 3 }).notNull().default("0"),
      paymentDate: text("payment_date").notNull(),
      paymentMethod: text("payment_method").notNull().default("تحويل بنكي"),
      referenceNo: text("reference_no").default(""),
      receiptFileData: text("receipt_file_data").default(""),
      receiptFileName: text("receipt_file_name").default(""),
      receiptFileType: text("receipt_file_type").default(""),
      notes: text("notes").default(""),
      status: text("status").notNull().default("مدفوع"),
      paymentType: text("payment_type").notNull().default("فوري"),
      dueDate: text("due_date").default(""),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    });

    export type SupplierOrder = typeof supplierOrdersTable.$inferSelect;
    export type SupplierOrderItem = typeof supplierOrderItemsTable.$inferSelect;
    export type SupplierPayment = typeof supplierPaymentsTable.$inferSelect;
