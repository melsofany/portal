import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeNumber: text("employee_number").notNull().unique(),
  fullName: text("full_name").notNull(),
  nationalId: text("national_id"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  birthDate: text("birth_date"),
  hireDate: text("hire_date"),
  department: text("department"),
  jobTitle: text("job_title"),
  baseSalary: numeric("base_salary", { precision: 12, scale: 2 }),
  allowances: numeric("allowances", { precision: 12, scale: 2 }).default("0"),
  deductions: numeric("deductions", { precision: 12, scale: 2 }).default("0"),
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  status: text("status").notNull().default("active"),
  contractType: text("contract_type").default("full-time"),
  notes: text("notes"),
  appointmentDocUrl: text("appointment_doc_url"),
  appointmentDocName: text("appointment_doc_name"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Employee = typeof employeesTable.$inferSelect;
export type InsertEmployee = typeof employeesTable.$inferInsert;

export const employeeDocumentsTable = pgTable("employee_documents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  docName: text("doc_name").notNull(),
  docType: text("doc_type").notNull(),
  docUrl: text("doc_url").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmployeeDocument = typeof employeeDocumentsTable.$inferSelect;
export type InsertEmployeeDocument = typeof employeeDocumentsTable.$inferInsert;

export const salaryRecordsTable = pgTable("salary_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  baseSalary: numeric("base_salary", { precision: 12, scale: 2 }).notNull(),
  allowances: numeric("allowances", { precision: 12, scale: 2 }).default("0"),
  deductions: numeric("deductions", { precision: 12, scale: 2 }).default("0"),
  netSalary: numeric("net_salary", { precision: 12, scale: 2 }).notNull(),
  paid: boolean("paid").notNull().default(false),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SalaryRecord = typeof salaryRecordsTable.$inferSelect;
export type InsertSalaryRecord = typeof salaryRecordsTable.$inferInsert;
