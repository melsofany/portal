import { Router } from "express";
import { db } from "@workspace/db";
import { employeePenaltiesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const rows = await db.select().from(employeePenaltiesTable)
      .where(eq(employeePenaltiesTable.employeeId, employeeId))
      .orderBy(desc(employeePenaltiesTable.createdAt));
    res.json(rows);
  } catch { res.status(500).json({ error: "Failed to fetch penalties" }); }
});

router.post("/", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const { penaltyType, amount, reason, penaltyDate, deducted, notes } = req.body;
    const rows = await db.insert(employeePenaltiesTable)
      .values({ employeeId, penaltyType, amount, reason, penaltyDate, deducted: deducted ?? false, notes })
      .returning();
    res.status(201).json(rows[0]);
  } catch { res.status(500).json({ error: "Failed to add penalty" }); }
});

router.put("/:penaltyId", async (req, res) => {
  try {
    const penaltyId = parseInt(req.params.penaltyId);
    const { penaltyType, amount, reason, penaltyDate, deducted, notes } = req.body;
    const rows = await db.update(employeePenaltiesTable)
      .set({ penaltyType, amount, reason, penaltyDate, deducted, notes })
      .where(eq(employeePenaltiesTable.id, penaltyId))
      .returning();
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "Failed to update penalty" }); }
});

router.delete("/:penaltyId", async (req, res) => {
  try {
    const penaltyId = parseInt(req.params.penaltyId);
    await db.delete(employeePenaltiesTable).where(eq(employeePenaltiesTable.id, penaltyId));
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to delete penalty" }); }
});

export default router;
