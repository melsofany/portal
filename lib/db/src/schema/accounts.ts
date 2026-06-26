import { pgTable, serial, text, integer, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
  import { customerOrdersTable } from "./customer-orders";
  import { supplierOrdersTable } from "./supplier-orders";

  // تكاليف أمر الشراء
  export const orderCostsTable = pgTable("order_costs", {
    id: serial("id").primaryKey(),
    customerOrderId: integer("customer_order_id").notNull().references(() => customerOrdersTable.id, { onDelete: "cascade" }),
    costType: text("cost_type").notNull(), // 'shipping' | 'customs' | 'transport' | 'inspection' | 'other'
    description: text("description").notNull(),
    supplierOrderId: integer("supplier_order_id").references(() => supplierOrdersTable.id, { onDelete: "set null" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("14"),
    vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    insuranceRate: numeric("insurance_rate", { precision: 5, scale: 2 }).notNull().default("3"),
    insuranceAmount: numeric("insurance_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    referenceNo: text("reference_no").default(""),
    notes: text("notes").default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  });

  // الفواتير
  export const invoicesTable = pgTable("invoices", {
    id: serial("id").primaryKey(),
    invoiceNo: text("invoice_no").notNull().unique(),
    customerOrderId: integer("customer_order_id").notNull().references(() => customerOrdersTable.id, { onDelete: "restrict" }),
    customerOrderNo: text("customer_order_no").default(""),
    customerPoNo: text("customer_po_no").default(""),
    customerName: text("customer_name").default(""),
    invoiceDate: text("invoice_date").notNull(),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("14"),
    vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalCosts: numeric("total_costs", { precision: 14, scale: 2 }).notNull().default("0"),
    netProfit: numeric("net_profit", { precision: 14, scale: 2 }).notNull().default("0"),
    status: text("status").notNull().default("مسودة"), // 'مسودة' | 'صادرة' | 'مدفوعة' | 'ملغاة'
    notes: text("notes").default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  });

  // المصاريف العامة للشركة (مستقلة عن أوامر الشراء)
  export const companyExpensesTable = pgTable("company_expenses", {
    id: serial("id").primaryKey(),
    expenseType: text("expense_type").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
    expenseDate: text("expense_date").notNull(),
    referenceNo: text("reference_no").default(""),
    notes: text("notes").default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  });

  export type OrderCost = typeof orderCostsTable.$inferSelect;
  export type Invoice = typeof invoicesTable.$inferSelect;
  export type CompanyExpense = typeof companyExpensesTable.$inferSelect;
