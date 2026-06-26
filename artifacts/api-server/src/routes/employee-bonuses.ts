import { Router } from "express";
import { db } from "@workspace/db";
import { employeeBonusesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const rows = await db.select().from(employeeBonusesTable)
      .where(eq(employeeBonusesTable.employeeId, employeeId))
      .orderBy(desc(employeeBonusesTable.createdAt));
    res.json(rows);
  } catch { res.status(500).json({ error: "Failed to fetch bonuses" }); }
});

router.post("/", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const { bonusType, amount, reason, bonusDate, paid, notes } = req.body;
    const rows = await db.insert(employeeBonusesTable)
      .values({ employeeId, bonusType, amount, reason, bonusDate, paid: paid ?? false, notes })
      .returning();
    res.status(201).json(rows[0]);
  } catch { res.status(500).json({ error: "Failed to add bonus" }); }
});

router.put("/:bonusId", async (req, res) => {
  try {
    const bonusId = parseInt(req.params.bonusId);
    const { bonusType, amount, reason, bonusDate, paid, notes } = req.body;
    const rows = await db.update(employeeBonusesTable)
      .set({ bonusType, amount, reason, bonusDate, paid, paidAt: paid ? new Date() : null, notes })
      .where(eq(employeeBonusesTable.id, bonusId))
      .returning();
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "Failed to update bonus" }); }
});

router.delete("/:bonusId", async (req, res) => {
  try {
    const bonusId = parseInt(req.params.bonusId);
    await db.delete(employeeBonusesTable).where(eq(employeeBonusesTable.id, bonusId));
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to delete bonus" }); }
});

export default router;
