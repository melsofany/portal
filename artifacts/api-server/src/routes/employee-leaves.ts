import { Router } from "express";
import { db } from "@workspace/db";
import { employeeLeavesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const rows = await db.select().from(employeeLeavesTable)
      .where(eq(employeeLeavesTable.employeeId, employeeId))
      .orderBy(desc(employeeLeavesTable.createdAt));
    res.json(rows);
  } catch { res.status(500).json({ error: "Failed to fetch leaves" }); }
});

router.post("/", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const { leaveType, startDate, endDate, totalDays, reason, status, notes } = req.body;
    const rows = await db.insert(employeeLeavesTable)
      .values({ employeeId, leaveType, startDate, endDate, totalDays: parseInt(totalDays) || 1, reason, status: status || "approved", notes })
      .returning();
    res.status(201).json(rows[0]);
  } catch { res.status(500).json({ error: "Failed to add leave" }); }
});

router.put("/:leaveId", async (req, res) => {
  try {
    const leaveId = parseInt(req.params.leaveId);
    const { leaveType, startDate, endDate, totalDays, reason, status, notes } = req.body;
    const rows = await db.update(employeeLeavesTable)
      .set({ leaveType, startDate, endDate, totalDays: parseInt(totalDays) || 1, reason, status, notes })
      .where(eq(employeeLeavesTable.id, leaveId))
      .returning();
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "Failed to update leave" }); }
});

router.delete("/:leaveId", async (req, res) => {
  try {
    const leaveId = parseInt(req.params.leaveId);
    await db.delete(employeeLeavesTable).where(eq(employeeLeavesTable.id, leaveId));
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to delete leave" }); }
});

export default router;
