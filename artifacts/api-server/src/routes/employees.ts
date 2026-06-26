import { Router } from "express";
import { db } from "@workspace/db";
import {
  employeesTable,
  employeeDocumentsTable,
  salaryRecordsTable,
} from "@workspace/db/schema";
import { eq, desc, ilike, or, sql } from "drizzle-orm";
import leavesRouter from "./employee-leaves";
import attendanceRouter from "./employee-attendance";
import bonusesRouter from "./employee-bonuses";
import penaltiesRouter from "./employee-penalties";

const router = Router();

function generateEmployeeNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `EMP-${year}-${rand}`;
}

router.get("/", async (req, res) => {
  try {
    const { search, status, department } = req.query as Record<string, string>;
    let query = db.select().from(employeesTable);
    const conditions: ReturnType<typeof ilike>[] = [];
    if (search) {
      conditions.push(
        ilike(employeesTable.fullName, `%${search}%`),
        ilike(employeesTable.employeeNumber, `%${search}%`),
        ilike(employeesTable.nationalId, `%${search}%`),
        ilike(employeesTable.phone, `%${search}%`)
      );
    }
    let rows;
    if (conditions.length > 0) {
      rows = await db.select().from(employeesTable).where(or(...conditions)).orderBy(desc(employeesTable.createdAt));
    } else {
      rows = await db.select().from(employeesTable).orderBy(desc(employeesTable.createdAt));
    }
    if (status) rows = rows.filter((r) => r.status === status);
    if (department) rows = rows.filter((r) => r.department === department);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

router.get("/stats", async (_req, res) => {
  try {
    const all = await db.select().from(employeesTable);
    const total = all.length;
    const active = all.filter((e) => e.status === "active").length;
    const inactive = all.filter((e) => e.status === "inactive").length;
    const onLeave = all.filter((e) => e.status === "on_leave").length;
    const totalSalary = all.reduce((sum, e) => sum + parseFloat(e.baseSalary ?? "0"), 0);
    const departments = [...new Set(all.map((e) => e.department).filter(Boolean))];
    res.json({ total, active, inactive, onLeave, totalSalary, departments });
  } catch {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/departments", async (_req, res) => {
  try {
    const rows = await db.selectDistinct({ department: employeesTable.department }).from(employeesTable).where(sql`${employeesTable.department} is not null`);
    res.json(rows.map((r) => r.department).filter(Boolean));
  } catch {
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const rows = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    const docs = await db.select().from(employeeDocumentsTable).where(eq(employeeDocumentsTable.employeeId, id));
    const salaries = await db.select().from(salaryRecordsTable).where(eq(salaryRecordsTable.employeeId, id)).orderBy(desc(salaryRecordsTable.createdAt));
    res.json({ ...rows[0], documents: docs, salaryRecords: salaries });
  } catch {
    res.status(500).json({ error: "Failed to fetch employee" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    let employeeNumber = body.employeeNumber;
    if (!employeeNumber) {
      let unique = false;
      while (!unique) {
        employeeNumber = generateEmployeeNumber();
        const existing = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.employeeNumber, employeeNumber));
        if (existing.length === 0) unique = true;
      }
    }
    const rows = await db.insert(employeesTable).values({
      employeeNumber, fullName: body.fullName, nationalId: body.nationalId, phone: body.phone,
      email: body.email, address: body.address, birthDate: body.birthDate, hireDate: body.hireDate,
      department: body.department, jobTitle: body.jobTitle, baseSalary: body.baseSalary,
      allowances: body.allowances ?? "0", deductions: body.deductions ?? "0",
      bankName: body.bankName, bankAccount: body.bankAccount, status: body.status ?? "active",
      contractType: body.contractType ?? "full-time", notes: body.notes,
      appointmentDocUrl: body.appointmentDocUrl, appointmentDocName: body.appointmentDocName,
      emergencyContactName: body.emergencyContactName, emergencyContactPhone: body.emergencyContactPhone,
      emergencyContactRelation: body.emergencyContactRelation,
    }).returning();
    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err?.message?.includes("unique")) return res.status(409).json({ error: "رقم الموظف موجود مسبقاً" });
    res.status(500).json({ error: "Failed to create employee" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const rows = await db.update(employeesTable).set({
      fullName: body.fullName, nationalId: body.nationalId, phone: body.phone, email: body.email,
      address: body.address, birthDate: body.birthDate, hireDate: body.hireDate,
      department: body.department, jobTitle: body.jobTitle, baseSalary: body.baseSalary,
      allowances: body.allowances, deductions: body.deductions, bankName: body.bankName,
      bankAccount: body.bankAccount, status: body.status, contractType: body.contractType,
      notes: body.notes, appointmentDocUrl: body.appointmentDocUrl, appointmentDocName: body.appointmentDocName,
      emergencyContactName: body.emergencyContactName, emergencyContactPhone: body.emergencyContactPhone,
      emergencyContactRelation: body.emergencyContactRelation,
    }).where(eq(employeesTable.id, id)).returning();
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update employee" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(employeesTable).where(eq(employeesTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete employee" });
  }
});

router.post("/:id/documents", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const { docName, docType, docUrl } = req.body;
    const rows = await db.insert(employeeDocumentsTable).values({ employeeId, docName, docType, docUrl }).returning();
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to add document" });
  }
});

router.delete("/:id/documents/:docId", async (req, res) => {
  try {
    const docId = parseInt(req.params.docId);
    await db.delete(employeeDocumentsTable).where(eq(employeeDocumentsTable.id, docId));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

router.post("/:id/salary-records", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const body = req.body;
    const base = parseFloat(body.baseSalary ?? "0");
    const allowances = parseFloat(body.allowances ?? "0");
    const deductions = parseFloat(body.deductions ?? "0");
    const netSalary = (base + allowances - deductions).toFixed(2);
    const rows = await db.insert(salaryRecordsTable).values({
      employeeId, month: body.month, year: parseInt(body.year), baseSalary: body.baseSalary,
      allowances: body.allowances ?? "0", deductions: body.deductions ?? "0", netSalary,
      paid: body.paid ?? false, notes: body.notes,
    }).returning();
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to create salary record" });
  }
});

router.put("/:id/salary-records/:recordId", async (req, res) => {
  try {
    const recordId = parseInt(req.params.recordId);
    const body = req.body;
    const base = parseFloat(body.baseSalary ?? "0");
    const allowances = parseFloat(body.allowances ?? "0");
    const deductions = parseFloat(body.deductions ?? "0");
    const netSalary = (base + allowances - deductions).toFixed(2);
    const rows = await db.update(salaryRecordsTable).set({
      baseSalary: body.baseSalary, allowances: body.allowances, deductions: body.deductions,
      netSalary, paid: body.paid, paidAt: body.paid ? new Date() : null, notes: body.notes,
    }).where(eq(salaryRecordsTable.id, recordId)).returning();
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update salary record" });
  }
});

router.use("/:id/leaves", leavesRouter);
router.use("/:id/attendance", attendanceRouter);
router.use("/:id/bonuses", bonusesRouter);
router.use("/:id/penalties", penaltiesRouter);

export default router;
