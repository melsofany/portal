import { Router } from "express";
import { db } from "@workspace/db";
import { employeeAttendanceTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const rows = await db.select().from(employeeAttendanceTable)
      .where(eq(employeeAttendanceTable.employeeId, employeeId))
      .orderBy(desc(employeeAttendanceTable.attendanceDate));
    res.json(rows);
  } catch { res.status(500).json({ error: "Failed to fetch attendance" }); }
});

router.post("/", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const { attendanceDate, checkIn, checkOut, status, hoursWorked, notes } = req.body;
    const rows = await db.insert(employeeAttendanceTable)
      .values({ employeeId, attendanceDate, checkIn, checkOut, status: status || "present", hoursWorked, notes })
      .returning();
    res.status(201).json(rows[0]);
  } catch { res.status(500).json({ error: "Failed to add attendance" }); }
});

router.put("/:attId", async (req, res) => {
  try {
    const attId = parseInt(req.params.attId);
    const { attendanceDate, checkIn, checkOut, status, hoursWorked, notes } = req.body;
    const rows = await db.update(employeeAttendanceTable)
      .set({ attendanceDate, checkIn, checkOut, status, hoursWorked, notes })
      .where(eq(employeeAttendanceTable.id, attId))
      .returning();
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "Failed to update attendance" }); }
});

router.delete("/:attId", async (req, res) => {
  try {
    const attId = parseInt(req.params.attId);
    await db.delete(employeeAttendanceTable).where(eq(employeeAttendanceTable.id, attId));
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to delete attendance" }); }
});

export default router;
