import { Router } from "express";
import { db, suppliersTable, supplierPaymentMethodsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router({ mergeParams: true });

const PHONE_REGEX = /^\+201\d{9}$/;

function validatePaymentMethod(body: any): string | null {
  const { type, phone, ownerName, walletType, bankName, accountNumber } = body;

  const validTypes = ["cash", "wallet", "instapay", "bank"];
  if (!type || !validTypes.includes(type)) {
    return "نوع طريقة الدفع غير صحيح";
  }

  if (type === "wallet") {
    if (!walletType?.trim()) return "يجب تحديد نوع المحفظة الإلكترونية";
    if (!ownerName?.trim()) return "اسم صاحب المحفظة مطلوب";
    if (!phone?.trim()) return "رقم الهاتف مطلوب للمحفظة الإلكترونية";
    if (!PHONE_REGEX.test(phone.trim())) {
      return "رقم الهاتف غير صحيح — يجب أن يبدأ بـ +201 ويليه 9 أرقام (مثال: +201022282802)";
    }
  }

  if (type === "instapay") {
    if (!ownerName?.trim()) return "اسم صاحب الحساب مطلوب";
    if (!phone?.trim()) return "رقم التحويل مطلوب";
    if (!PHONE_REGEX.test(phone.trim())) {
      return "رقم التحويل غير صحيح — يجب أن يبدأ بـ +201 ويليه 9 أرقام (مثال: +201022282802)";
    }
  }

  if (type === "bank") {
    if (!bankName?.trim()) return "اسم البنك مطلوب";
    if (!accountNumber?.trim()) return "رقم الحساب مطلوب";
    if (!ownerName?.trim()) return "اسم صاحب الحساب مطلوب";
  }

  return null;
}

// GET /api/suppliers/:id/payment-methods
router.get("/", async (req, res) => {
  try {
    const supplierId = Number(req.params.id);
    const supplier = await db.select({ id: suppliersTable.id }).from(suppliersTable).where(eq(suppliersTable.id, supplierId));
    if (supplier.length === 0) return res.status(404).json({ error: "المورد غير موجود" });

    const methods = await db
      .select()
      .from(supplierPaymentMethodsTable)
      .where(eq(supplierPaymentMethodsTable.supplierId, supplierId))
      .orderBy(supplierPaymentMethodsTable.createdAt);

    res.json(methods);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب بيانات الدفع" });
  }
});

// POST /api/suppliers/:id/payment-methods
router.post("/", async (req, res) => {
  try {
    const supplierId = Number(req.params.id);
    const supplier = await db.select({ id: suppliersTable.id }).from(suppliersTable).where(eq(suppliersTable.id, supplierId));
    if (supplier.length === 0) return res.status(404).json({ error: "المورد غير موجود" });

    const validationError = validatePaymentMethod(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const { type, walletType, ownerName, phone, bankName, accountNumber } = req.body;

    const [method] = await db
      .insert(supplierPaymentMethodsTable)
      .values({
        supplierId,
        type,
        walletType: walletType?.trim() || null,
        ownerName: ownerName?.trim() || null,
        phone: phone?.trim() || null,
        bankName: bankName?.trim() || null,
        accountNumber: accountNumber?.trim() || null,
      })
      .returning();

    res.status(201).json(method);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إضافة طريقة الدفع" });
  }
});

// PUT /api/suppliers/:id/payment-methods/:pmId
router.put("/:pmId", async (req, res) => {
  try {
    const supplierId = Number(req.params.id);
    const pmId = Number(req.params.pmId);

    const validationError = validatePaymentMethod(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const { type, walletType, ownerName, phone, bankName, accountNumber } = req.body;

    const [updated] = await db
      .update(supplierPaymentMethodsTable)
      .set({
        type,
        walletType: walletType?.trim() || null,
        ownerName: ownerName?.trim() || null,
        phone: phone?.trim() || null,
        bankName: bankName?.trim() || null,
        accountNumber: accountNumber?.trim() || null,
      })
      .where(and(eq(supplierPaymentMethodsTable.id, pmId), eq(supplierPaymentMethodsTable.supplierId, supplierId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "طريقة الدفع غير موجودة" });
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في تعديل طريقة الدفع" });
  }
});

// DELETE /api/suppliers/:id/payment-methods/:pmId
router.delete("/:pmId", async (req, res) => {
  try {
    const supplierId = Number(req.params.id);
    const pmId = Number(req.params.pmId);

    const deleted = await db
      .delete(supplierPaymentMethodsTable)
      .where(and(eq(supplierPaymentMethodsTable.id, pmId), eq(supplierPaymentMethodsTable.supplierId, supplierId)))
      .returning();

    if (deleted.length === 0) return res.status(404).json({ error: "طريقة الدفع غير موجودة" });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في حذف طريقة الدفع" });
  }
});

export default router;
