import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";

const router = Router();

const PHONE_REGEX = /^\+201\d{9}$/;

function validatePhone(value: string | undefined, fieldName: string): string | null {
  if (value?.trim() && !PHONE_REGEX.test(value.trim())) {
    return `${fieldName} غير صحيح — يجب أن يبدأ بـ +201 ويليه 9 أرقام (مثال: +201022282802)`;
  }
  return null;
}

// GET /api/customers
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(customersTable).orderBy(customersTable.createdAt);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب العملاء" });
  }
});

// POST /api/customers
router.post("/", async (req, res) => {
  try {
    const { name, phone, whatsapp, email, address, commercialReg, taxReg } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: "اسم العميل مطلوب" });
    }

    const phoneErr = validatePhone(phone, "رقم الهاتف");
    if (phoneErr) return res.status(400).json({ error: phoneErr });
    const waErr = validatePhone(whatsapp, "رقم الواتساب");
    if (waErr) return res.status(400).json({ error: waErr });

    // Uniqueness check
    const conditions = [];
    if (phone?.trim()) conditions.push(eq(customersTable.phone, phone.trim()));
    if (whatsapp?.trim()) conditions.push(eq(customersTable.whatsapp, whatsapp.trim()));
    if (email?.trim()) conditions.push(eq(customersTable.email, email.trim().toLowerCase()));

    if (conditions.length > 0) {
      const existing = await db
        .select({ id: customersTable.id, name: customersTable.name, phone: customersTable.phone, whatsapp: customersTable.whatsapp, email: customersTable.email })
        .from(customersTable)
        .where(or(...conditions));

      if (existing.length > 0) {
        const dup = existing[0];
        let field = "";
        if (phone?.trim() && dup.phone === phone.trim()) field = "رقم الهاتف";
        else if (whatsapp?.trim() && dup.whatsapp === whatsapp.trim()) field = "رقم الواتساب";
        else if (email?.trim() && dup.email === email.trim().toLowerCase()) field = "البريد الإلكتروني";
        return res.status(409).json({ error: `${field} مستخدم بالفعل للعميل "${dup.name}"` });
      }
    }

    const [customer] = await db
      .insert(customersTable)
      .values({
        name: name.trim(),
        phone: phone?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        address: address?.trim() || null,
        commercialReg: commercialReg?.trim() || null,
        taxReg: taxReg?.trim() || null,
        status: "نشط",
      })
      .returning();

    res.status(201).json(customer);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إضافة العميل" });
  }
});

// PUT /api/customers/:id
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, phone, whatsapp, email, address, commercialReg, taxReg, status } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: "اسم العميل مطلوب" });
    }

    const phoneErr = validatePhone(phone, "رقم الهاتف");
    if (phoneErr) return res.status(400).json({ error: phoneErr });
    const waErr = validatePhone(whatsapp, "رقم الواتساب");
    if (waErr) return res.status(400).json({ error: waErr });

    // Uniqueness check excluding self
    const conditions = [];
    if (phone?.trim()) conditions.push(eq(customersTable.phone, phone.trim()));
    if (whatsapp?.trim()) conditions.push(eq(customersTable.whatsapp, whatsapp.trim()));
    if (email?.trim()) conditions.push(eq(customersTable.email, email.trim().toLowerCase()));

    if (conditions.length > 0) {
      const existing = await db
        .select({ id: customersTable.id, name: customersTable.name, phone: customersTable.phone, whatsapp: customersTable.whatsapp, email: customersTable.email })
        .from(customersTable)
        .where(or(...conditions));

      const conflicts = existing.filter((r) => r.id !== id);
      if (conflicts.length > 0) {
        const dup = conflicts[0];
        let field = "";
        if (phone?.trim() && dup.phone === phone.trim()) field = "رقم الهاتف";
        else if (whatsapp?.trim() && dup.whatsapp === whatsapp.trim()) field = "رقم الواتساب";
        else if (email?.trim() && dup.email === email.trim().toLowerCase()) field = "البريد الإلكتروني";
        return res.status(409).json({ error: `${field} مستخدم بالفعل للعميل "${dup.name}"` });
      }
    }

    const [updated] = await db
      .update(customersTable)
      .set({
        name: name.trim(),
        phone: phone?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        address: address?.trim() || null,
        commercialReg: commercialReg?.trim() || null,
        taxReg: taxReg?.trim() || null,
        status: status ?? "نشط",
      })
      .where(eq(customersTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "العميل غير موجود" });
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في تعديل العميل" });
  }
});

// DELETE /api/customers/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(customersTable).where(eq(customersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في حذف العميل" });
  }
});

export default router;
