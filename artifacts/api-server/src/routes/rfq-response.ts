import { Router } from "express";
import { db } from "@workspace/db";
import {
  supplierQuotationSuppliersTable,
  supplierQuotationsTable,
  supplierQuotationItemsTable,
  supplierQuotationItemPricesTable,
  suppliersTable,
  companySettingsTable,
  customerQuotationsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

async function getCompanySettings() {
  const rows = await db.select().from(companySettingsTable).limit(1);
  if (rows.length === 0) {
    const inserted = await db.insert(companySettingsTable).values({}).returning();
    return inserted[0];
  }
  return rows[0];
}

// GET /api/rfq/:token — public (no auth required)
router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 10) return res.status(400).json({ error: "رابط غير صحيح" });

    const [rfqSupplier] = await db
      .select()
      .from(supplierQuotationSuppliersTable)
      .where(eq(supplierQuotationSuppliersTable.token, token));

    if (!rfqSupplier) return res.status(404).json({ error: "الرابط غير صحيح أو منتهي الصلاحية" });

    // Track first open
    if (!rfqSupplier.firstOpenedAt) {
      await db.update(supplierQuotationSuppliersTable)
        .set({ firstOpenedAt: new Date() })
        .where(eq(supplierQuotationSuppliersTable.id, rfqSupplier.id));
    }

    const [rfq] = await db
      .select()
      .from(supplierQuotationsTable)
      .where(eq(supplierQuotationsTable.id, rfqSupplier.rfqId));

    if (!rfq) return res.status(404).json({ error: "طلب التسعير غير موجود" });

    const [supplier] = await db
      .select({ companyName: suppliersTable.companyName })
      .from(suppliersTable)
      .where(eq(suppliersTable.id, rfqSupplier.supplierId));

    const items = await db
      .select()
      .from(supplierQuotationItemsTable)
      .where(eq(supplierQuotationItemsTable.rfqId, rfqSupplier.rfqId))
      .orderBy(supplierQuotationItemsTable.sortOrder);

    const prices = await db
      .select()
      .from(supplierQuotationItemPricesTable)
      .where(eq(supplierQuotationItemPricesTable.rfqSupplierId, rfqSupplier.id));

    const company = await getCompanySettings();

    res.json({
      rfqSupplierId: rfqSupplier.id,
      rfqNo: rfq.rfqNo,
      deadlineDate: rfq.requestDate,
      notes: rfq.notes,
      supplierName: supplier?.companyName ?? "",
      responseStatus: rfqSupplier.responseStatus,
      responseSubmittedAt: rfqSupplier.responseSubmittedAt,
      vatIncluded: rfqSupplier.vatIncluded ?? "no",
      deliveryDays: rfqSupplier.deliveryDays ?? null,
      responseNotes: rfqSupplier.responseNotes ?? "",
      paymentTerms: rfqSupplier.paymentTerms ?? "",
      offerValidityDays: rfqSupplier.offerValidityDays ?? null,
      items,
      prices,
      company,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// POST /api/rfq/:token — submit prices (public)
router.post("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { prices, vatIncluded, deliveryDays, responseNotes, paymentTerms, offerValidityDays } = req.body;

    const [rfqSupplier] = await db
      .select()
      .from(supplierQuotationSuppliersTable)
      .where(eq(supplierQuotationSuppliersTable.token, token));

    if (!rfqSupplier) return res.status(404).json({ error: "الرابط غير صحيح" });

    if (rfqSupplier.responseStatus === "submitted") {
      return res.status(400).json({ error: "تم إرسال الأسعار مسبقاً" });
    }

    const [rfq] = await db
      .select()
      .from(supplierQuotationsTable)
      .where(eq(supplierQuotationsTable.id, rfqSupplier.rfqId));

    if (!rfq) return res.status(404).json({ error: "طلب التسعير غير موجود" });

    if (rfq.requestDate) {
      const deadline = new Date(rfq.requestDate);
      deadline.setHours(23, 59, 59, 999);
      if (new Date() > deadline) {
        return res.status(400).json({ error: `انتهى الموعد النهائي لتقديم عروض الأسعار (${rfq.requestDate})` });
      }
    }

    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ error: "يجب إدخال الأسعار" });
    }

    await db
      .delete(supplierQuotationItemPricesTable)
      .where(eq(supplierQuotationItemPricesTable.rfqSupplierId, rfqSupplier.id));

    const priceRows = (prices as any[]).map((p) => ({
      rfqSupplierId: rfqSupplier.id,
      rfqItemId: Number(p.rfqItemId),
      unitPrice: String(parseFloat(p.unitPrice) || 0),
      notes: p.notes?.trim() ?? "",
      vatIncluded: p.vatIncluded === "yes" ? "yes" : "no",
      deliveryDays: p.deliveryDays ? Number(p.deliveryDays) : null,
    }));
    await db.insert(supplierQuotationItemPricesTable).values(priceRows);

    await db
      .update(supplierQuotationSuppliersTable)
      .set({
        responseStatus: "submitted",
        responseSubmittedAt: new Date(),
        vatIncluded: vatIncluded ?? "no",
        deliveryDays: deliveryDays ? Number(deliveryDays) : null,
        responseNotes: responseNotes?.trim() ?? "",
        paymentTerms: paymentTerms?.trim() ?? "",
        offerValidityDays: offerValidityDays ? Number(offerValidityDays) : null,
      })
      .where(eq(supplierQuotationSuppliersTable.id, rfqSupplier.id));

    // Update supplier quotation status to "تم التسعير من المورد"
    await db
      .update(supplierQuotationsTable)
      .set({ status: "تم التسعير من المورد" })
      .where(eq(supplierQuotationsTable.id, rfq.id));

    // Update linked customer quotation status when a supplier responds
    if (rfq.sourceQuotationId) {
      await db
        .update(customerQuotationsTable)
        .set({ status: "تم الرد من المورد" })
        .where(eq(customerQuotationsTable.id, rfq.sourceQuotationId));
    }

    res.json({ success: true, message: "تم إرسال الأسعار بنجاح — شكراً لك" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حدث خطأ أثناء الإرسال" });
  }
});

export default router;
