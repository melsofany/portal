import { Router } from "express";
import { db } from "@workspace/db";
import { correspondenceTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

// GET /api/correspondence
router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(correspondenceTable)
      .orderBy(desc(correspondenceTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب الوثائق" });
  }
});

// POST /api/correspondence
router.post("/", async (req, res) => {
  try {
    const {
      docNumber, type, direction, subject, fromTo,
      docDate, dueDate, status, priority, notes,
      attachmentUrl, attachmentName,
    } = req.body;

    if (!docNumber?.trim()) return res.status(400).json({ error: "رقم الوثيقة مطلوب" });
    if (!type) return res.status(400).json({ error: "نوع الوثيقة مطلوب" });
    if (!subject?.trim()) return res.status(400).json({ error: "الموضوع مطلوب" });

    const [row] = await db
      .insert(correspondenceTable)
      .values({
        docNumber: docNumber.trim(),
        type,
        direction: direction ?? null,
        subject: subject.trim(),
        fromTo: fromTo?.trim() ?? null,
        docDate: docDate ?? null,
        dueDate: dueDate ?? null,
        status: status ?? "open",
        priority: priority ?? "normal",
        notes: notes?.trim() ?? null,
        attachmentUrl: attachmentUrl ?? null,
        attachmentName: attachmentName ?? null,
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إضافة الوثيقة" });
  }
});

// PUT /api/correspondence/:id
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      docNumber, type, direction, subject, fromTo,
      docDate, dueDate, status, priority, notes,
      attachmentUrl, attachmentName,
    } = req.body;

    if (!docNumber?.trim()) return res.status(400).json({ error: "رقم الوثيقة مطلوب" });
    if (!type) return res.status(400).json({ error: "نوع الوثيقة مطلوب" });
    if (!subject?.trim()) return res.status(400).json({ error: "الموضوع مطلوب" });

    const [updated] = await db
      .update(correspondenceTable)
      .set({
        docNumber: docNumber.trim(),
        type,
        direction: direction ?? null,
        subject: subject.trim(),
        fromTo: fromTo?.trim() ?? null,
        docDate: docDate ?? null,
        dueDate: dueDate ?? null,
        status: status ?? "open",
        priority: priority ?? "normal",
        notes: notes?.trim() ?? null,
        attachmentUrl: attachmentUrl ?? null,
        attachmentName: attachmentName ?? null,
      })
      .where(eq(correspondenceTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "الوثيقة غير موجودة" });
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في تعديل الوثيقة" });
  }
});

// DELETE /api/correspondence/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(correspondenceTable).where(eq(correspondenceTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في حذف الوثيقة" });
  }
});

export default router;
