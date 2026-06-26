import { Router } from "express";
import { db, supplierCategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/supplier-categories
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(supplierCategoriesTable).orderBy(supplierCategoriesTable.name);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب التصنيفات" });
  }
});

// POST /api/supplier-categories
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "اسم التصنيف مطلوب" });

    const existing = await db.select().from(supplierCategoriesTable).where(eq(supplierCategoriesTable.name, name.trim()));
    if (existing.length > 0) return res.status(409).json({ error: "هذا التصنيف موجود بالفعل" });

    const [cat] = await db.insert(supplierCategoriesTable).values({ name: name.trim() }).returning();
    res.status(201).json(cat);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إضافة التصنيف" });
  }
});

// DELETE /api/supplier-categories/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const deleted = await db.delete(supplierCategoriesTable).where(eq(supplierCategoriesTable.id, id)).returning();
    if (deleted.length === 0) return res.status(404).json({ error: "التصنيف غير موجود" });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في حذف التصنيف" });
  }
});

export default router;
