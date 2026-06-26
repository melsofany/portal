import { Router } from "express";
import { db, suppliersTable, supplierCategoriesTable, supplierCategoryAssignmentsTable } from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";

const router = Router();

// GET /api/suppliers
router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: suppliersTable.id,
        companyName: suppliersTable.companyName,
        contactName: suppliersTable.contactName,
        phone: suppliersTable.phone,
        whatsapp: suppliersTable.whatsapp,
        email: suppliersTable.email,
        address: suppliersTable.address,
        commercialReg: suppliersTable.commercialReg,
        taxReg: suppliersTable.taxReg,
        status: suppliersTable.status,
        createdAt: suppliersTable.createdAt,
      })
      .from(suppliersTable)
      .orderBy(suppliersTable.createdAt);

    // For each supplier, fetch their categories
    const supplierIds = rows.map((r) => r.id);
    let assignments: { supplierId: number; categoryId: number; catName: string; catCreatedAt: Date }[] = [];

    if (supplierIds.length > 0) {
      assignments = await db
        .select({
          supplierId: supplierCategoryAssignmentsTable.supplierId,
          categoryId: supplierCategoriesTable.id,
          catName: supplierCategoriesTable.name,
          catCreatedAt: supplierCategoriesTable.createdAt,
        })
        .from(supplierCategoryAssignmentsTable)
        .innerJoin(supplierCategoriesTable, eq(supplierCategoryAssignmentsTable.categoryId, supplierCategoriesTable.id))
        .where(inArray(supplierCategoryAssignmentsTable.supplierId, supplierIds));
    }

    const result = rows.map((s) => ({
      ...s,
      categories: assignments
        .filter((a) => a.supplierId === s.id)
        .map((a) => ({ id: a.categoryId, name: a.catName, createdAt: a.catCreatedAt })),
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب الموردين" });
  }
});

const PHONE_REGEX = /^\+201\d{9}$/;

function validatePhone(value: string | undefined, fieldName: string): string | null {
  if (value?.trim() && !PHONE_REGEX.test(value.trim())) {
    return `${fieldName} غير صحيح — يجب أن يبدأ بـ +201 ويليه 9 أرقام (مثال: +201022282802)`;
  }
  return null;
}

// POST /api/suppliers
router.post("/", async (req, res) => {
  try {
    const { companyName, contactName, phone, whatsapp, email, address, commercialReg, taxReg, categoryIds } = req.body;

    if (!companyName?.trim()) {
      return res.status(400).json({ error: "اسم الشركة مطلوب" });
    }

    const phoneErr = validatePhone(phone, "رقم الهاتف");
    if (phoneErr) return res.status(400).json({ error: phoneErr });
    const waErr = validatePhone(whatsapp, "رقم الواتساب");
    if (waErr) return res.status(400).json({ error: waErr });

    const conditions = [];
    if (phone?.trim()) conditions.push(eq(suppliersTable.phone, phone.trim()));
    if (whatsapp?.trim()) conditions.push(eq(suppliersTable.whatsapp, whatsapp.trim()));
    if (email?.trim()) conditions.push(eq(suppliersTable.email, email.trim().toLowerCase()));

    if (conditions.length > 0) {
      const existing = await db
        .select({ id: suppliersTable.id, companyName: suppliersTable.companyName, phone: suppliersTable.phone, whatsapp: suppliersTable.whatsapp, email: suppliersTable.email })
        .from(suppliersTable)
        .where(or(...conditions));

      if (existing.length > 0) {
        const dup = existing[0];
        let field = "";
        if (phone?.trim() && dup.phone === phone.trim()) field = "رقم الهاتف";
        else if (whatsapp?.trim() && dup.whatsapp === whatsapp.trim()) field = "رقم الواتساب";
        else if (email?.trim() && dup.email === email.trim().toLowerCase()) field = "البريد الإلكتروني";
        return res.status(409).json({ error: `${field} مستخدم بالفعل للمورد "${dup.companyName}"` });
      }
    }

    const [supplier] = await db
      .insert(suppliersTable)
      .values({
        companyName: companyName.trim(),
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        address: address?.trim() || null,
        commercialReg: commercialReg?.trim() || null,
        taxReg: taxReg?.trim() || null,
        status: "نشط",
      })
      .returning();

    // Insert category assignments
    const ids: number[] = Array.isArray(categoryIds) ? categoryIds.filter((id: unknown) => typeof id === "number") : [];
    if (ids.length > 0) {
      await db.insert(supplierCategoryAssignmentsTable).values(
        ids.map((categoryId) => ({ supplierId: supplier.id, categoryId }))
      );
    }

    // Fetch assigned categories to return
    const assignedCategories = ids.length > 0
      ? await db.select().from(supplierCategoriesTable).where(inArray(supplierCategoriesTable.id, ids))
      : [];

    res.status(201).json({ ...supplier, categories: assignedCategories });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إضافة المورد" });
  }
});

// PUT /api/suppliers/:id
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { companyName, contactName, phone, whatsapp, email, address, commercialReg, taxReg, status, categoryIds } = req.body;

    if (!companyName?.trim()) {
      return res.status(400).json({ error: "اسم الشركة مطلوب" });
    }

    const phoneErr = validatePhone(phone, "رقم الهاتف");
    if (phoneErr) return res.status(400).json({ error: phoneErr });
    const waErr = validatePhone(whatsapp, "رقم الواتساب");
    if (waErr) return res.status(400).json({ error: waErr });

    // Check uniqueness for phone, whatsapp, email (excluding self)
    const conditions = [];
    if (phone?.trim()) conditions.push(eq(suppliersTable.phone, phone.trim()));
    if (whatsapp?.trim()) conditions.push(eq(suppliersTable.whatsapp, whatsapp.trim()));
    if (email?.trim()) conditions.push(eq(suppliersTable.email, email.trim().toLowerCase()));

    if (conditions.length > 0) {
      const existing = await db
        .select({ id: suppliersTable.id, companyName: suppliersTable.companyName, phone: suppliersTable.phone, whatsapp: suppliersTable.whatsapp, email: suppliersTable.email })
        .from(suppliersTable)
        .where(or(...conditions));

      const conflict = existing.find((e) => e.id !== id);
      if (conflict) {
        let field = "";
        if (phone?.trim() && conflict.phone === phone.trim()) field = "رقم الهاتف";
        else if (whatsapp?.trim() && conflict.whatsapp === whatsapp.trim()) field = "رقم الواتساب";
        else if (email?.trim() && conflict.email === email.trim().toLowerCase()) field = "البريد الإلكتروني";
        return res.status(409).json({ error: `${field} مستخدم بالفعل للمورد "${conflict.companyName}"` });
      }
    }

    const [updated] = await db
      .update(suppliersTable)
      .set({
        companyName: companyName.trim(),
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        address: address?.trim() || null,
        commercialReg: commercialReg?.trim() || null,
        taxReg: taxReg?.trim() || null,
        ...(status ? { status } : {}),
      })
      .where(eq(suppliersTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "المورد غير موجود" });

    // Update category assignments: delete existing, insert new
    await db.delete(supplierCategoryAssignmentsTable).where(eq(supplierCategoryAssignmentsTable.supplierId, id));

    const ids: number[] = Array.isArray(categoryIds) ? categoryIds.filter((cid: unknown) => typeof cid === "number") : [];
    if (ids.length > 0) {
      await db.insert(supplierCategoryAssignmentsTable).values(
        ids.map((categoryId) => ({ supplierId: id, categoryId }))
      );
    }

    const assignedCategories = ids.length > 0
      ? await db.select().from(supplierCategoriesTable).where(inArray(supplierCategoriesTable.id, ids))
      : [];

    res.json({ ...updated, categories: assignedCategories });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في تحديث المورد" });
  }
});

// DELETE /api/suppliers/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    // cascade deletes assignments automatically due to FK onDelete: "cascade"
    const deleted = await db.delete(suppliersTable).where(eq(suppliersTable.id, id)).returning();
    if (deleted.length === 0) return res.status(404).json({ error: "المورد غير موجود" });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في حذف المورد" });
  }
});

export default router;
