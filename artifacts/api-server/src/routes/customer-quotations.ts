import { Router } from "express";
import { db } from "@workspace/db";
import {
  customerQuotationsTable,
  customerQuotationItemsTable,
  customersTable,
  supplierQuotationsTable,
  supplierQuotationSuppliersTable,
  supplierQuotationItemsTable,
  supplierQuotationItemPricesTable,
  suppliersTable,
} from "@workspace/db/schema";
import { eq, desc, inArray, and } from "drizzle-orm";

const router = Router();

function generateQuotationNo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CQ-${y}${m}${d}-${rand}`;
}

// GET /api/customer-quotations
router.get("/", async (req, res) => {
  try {
    const quotations = await db
      .select({
        id: customerQuotationsTable.id,
        quotationNo: customerQuotationsTable.quotationNo,
        customerId: customerQuotationsTable.customerId,
        customerName: customersTable.name,
        responsibleName: customerQuotationsTable.responsibleName,
        requestDate: customerQuotationsTable.requestDate,
        expiryDate: customerQuotationsTable.expiryDate,
        customerOrderNo: customerQuotationsTable.customerOrderNo,
        status: customerQuotationsTable.status,
        createdAt: customerQuotationsTable.createdAt,
      })
      .from(customerQuotationsTable)
      .leftJoin(customersTable, eq(customerQuotationsTable.customerId, customersTable.id))
      .orderBy(desc(customerQuotationsTable.createdAt));

    res.json(quotations);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب طلبات التسعير" });
  }
});


  // GET /api/customer-quotations/search?q=...
  router.get("/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim().toLowerCase();
    if (!q) return res.json([]);
    try {
      const quotations = await db
        .select({
          id: customerQuotationsTable.id,
          quotationNo: customerQuotationsTable.quotationNo,
          customerId: customerQuotationsTable.customerId,
          customerName: customersTable.name,
          customerOrderNo: customerQuotationsTable.customerOrderNo,
          status: customerQuotationsTable.status,
        })
        .from(customerQuotationsTable)
        .leftJoin(customersTable, eq(customerQuotationsTable.customerId, customersTable.id))
        .orderBy(desc(customerQuotationsTable.createdAt));

      const filtered = quotations.filter(
        (qt) =>
          qt.quotationNo?.toLowerCase().includes(q) ||
          qt.customerOrderNo?.toLowerCase().includes(q)
      );

      const results = await Promise.all(
        filtered.slice(0, 10).map(async (qt) => {
          const items = await db
            .select()
            .from(customerQuotationItemsTable)
            .where(eq(customerQuotationItemsTable.quotationId, qt.id))
            .orderBy(customerQuotationItemsTable.sortOrder);
          return { ...qt, items };
        })
      );

      res.json(results);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في البحث" });
    }
  });

  // GET /api/customer-quotations/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [quotation] = await db
      .select({
        id: customerQuotationsTable.id,
        quotationNo: customerQuotationsTable.quotationNo,
        customerId: customerQuotationsTable.customerId,
        customerName: customersTable.name,
        responsibleName: customerQuotationsTable.responsibleName,
        requestDate: customerQuotationsTable.requestDate,
        expiryDate: customerQuotationsTable.expiryDate,
        customerOrderNo: customerQuotationsTable.customerOrderNo,
        status: customerQuotationsTable.status,
        createdAt: customerQuotationsTable.createdAt,
      })
      .from(customerQuotationsTable)
      .leftJoin(customersTable, eq(customerQuotationsTable.customerId, customersTable.id))
      .where(eq(customerQuotationsTable.id, id));

    if (!quotation) return res.status(404).json({ error: "الطلب غير موجود" });

    const items = await db
      .select()
      .from(customerQuotationItemsTable)
      .where(eq(customerQuotationItemsTable.quotationId, id))
      .orderBy(customerQuotationItemsTable.sortOrder);

    res.json({ ...quotation, items });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب الطلب" });
  }
});

// GET /api/customer-quotations/:id/best-supplier-prices
// Returns best submitted supplier price per customer quotation item
router.get("/:id/best-supplier-prices", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const cqItems = await db
      .select()
      .from(customerQuotationItemsTable)
      .where(eq(customerQuotationItemsTable.quotationId, id))
      .orderBy(customerQuotationItemsTable.sortOrder);

    const rfqs = await db
      .select()
      .from(supplierQuotationsTable)
      .where(eq(supplierQuotationsTable.sourceQuotationId, id));

    if (rfqs.length === 0) return res.json({});

    const rfqIds = rfqs.map((r) => r.id);

    const submitted = await db
      .select()
      .from(supplierQuotationSuppliersTable)
      .where(
        and(
          inArray(supplierQuotationSuppliersTable.rfqId, rfqIds),
          eq(supplierQuotationSuppliersTable.responseStatus, "submitted")
        )
      );

    if (submitted.length === 0) return res.json({});

    const submittedIds = submitted.map((s) => s.id);

    const prices = await db
      .select()
      .from(supplierQuotationItemPricesTable)
      .where(inArray(supplierQuotationItemPricesTable.rfqSupplierId, submittedIds));

    const sqItems = await db
      .select()
      .from(supplierQuotationItemsTable)
      .where(inArray(supplierQuotationItemsTable.rfqId, rfqIds));

    // Match customer items to supplier items by description (normalized)
    const result: Record<number, { bestPrice: number; count: number }> = {};

    for (const cqItem of cqItems) {
      const normDesc = cqItem.description.trim().toLowerCase();
      const matchingSqItems = sqItems.filter(
        (si) => si.description.trim().toLowerCase() === normDesc
      );
      if (matchingSqItems.length === 0) continue;

      const matchIds = matchingSqItems.map((si) => si.id);
      const itemPrices = prices
        .filter((p) => matchIds.includes(p.rfqItemId))
        .map((p) => parseFloat(p.unitPrice))
        .filter((p) => !isNaN(p) && p > 0);

      if (itemPrices.length === 0) continue;
      result[cqItem.id] = { bestPrice: Math.min(...itemPrices), count: itemPrices.length };
    }

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب أسعار الموردين" });
  }
});

// POST /api/customer-quotations
router.post("/", async (req, res) => {
  try {
    const { customerId, responsibleName, requestDate, expiryDate, customerOrderNo, items } = req.body;

    if (!customerId) return res.status(400).json({ error: "يجب اختيار العميل" });
    if (!requestDate) return res.status(400).json({ error: "تاريخ الطلب مطلوب" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "يجب إضافة بند واحد على الأقل" });
    }

    const quotationNo = generateQuotationNo();

    const [quotation] = await db
      .insert(customerQuotationsTable)
      .values({
        quotationNo,
        customerId: Number(customerId),
        responsibleName: responsibleName?.trim() ?? "",
        requestDate: requestDate.trim(),
        expiryDate: expiryDate?.trim() ?? "",
        customerOrderNo: customerOrderNo?.trim() ?? "",
        status: "مفتوح",
      })
      .returning();

    const itemRows = (items as any[]).map((item, idx) => ({
      quotationId: quotation.id,
      customerItemCode: item.customerItemCode?.trim() ?? "",
      description: item.description?.trim() ?? "",
      partNo: item.partNo?.trim() ?? "",
      unit: item.unit?.trim() ?? "",
      quantity: String(item.quantity ?? 0),
      sortOrder: idx,
    }));

    await db.insert(customerQuotationItemsTable).values(itemRows);

    const savedItems = await db
      .select()
      .from(customerQuotationItemsTable)
      .where(eq(customerQuotationItemsTable.quotationId, quotation.id))
      .orderBy(customerQuotationItemsTable.sortOrder);

    res.status(201).json({ ...quotation, items: savedItems });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إنشاء الطلب" });
  }
});

// PUT /api/customer-quotations/:id — edit header + items
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { customerId, responsibleName, requestDate, expiryDate, customerOrderNo, status, items } = req.body;

    if (!customerId) return res.status(400).json({ error: "يجب اختيار العميل" });
    if (!requestDate) return res.status(400).json({ error: "تاريخ الطلب مطلوب" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "يجب إضافة بند واحد على الأقل" });
    }

    const [existing] = await db
      .select()
      .from(customerQuotationsTable)
      .where(eq(customerQuotationsTable.id, id));
    if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });

    await db
      .update(customerQuotationsTable)
      .set({
        customerId: Number(customerId),
        responsibleName: responsibleName?.trim() ?? "",
        requestDate: requestDate.trim(),
        expiryDate: expiryDate?.trim() ?? "",
        customerOrderNo: customerOrderNo?.trim() ?? "",
        ...(status ? { status } : {}),
      })
      .where(eq(customerQuotationsTable.id, id));

    // Replace items
    await db.delete(customerQuotationItemsTable).where(eq(customerQuotationItemsTable.quotationId, id));

    const itemRows = (items as any[]).map((item, idx) => ({
      quotationId: id,
      customerItemCode: item.customerItemCode?.trim() ?? "",
      description: item.description?.trim() ?? "",
      partNo: item.partNo?.trim() ?? "",
      unit: item.unit?.trim() ?? "",
      quantity: String(item.quantity ?? 0),
      sortOrder: idx,
      unitPrice: item.unitPrice ? String(parseFloat(item.unitPrice) || 0) : "0",
      customerNotes: item.customerNotes?.trim() ?? "",
    }));

    await db.insert(customerQuotationItemsTable).values(itemRows);

    const savedItems = await db
      .select()
      .from(customerQuotationItemsTable)
      .where(eq(customerQuotationItemsTable.quotationId, id))
      .orderBy(customerQuotationItemsTable.sortOrder);

    const [updated] = await db
      .select({ id: customerQuotationsTable.id, quotationNo: customerQuotationsTable.quotationNo, status: customerQuotationsTable.status })
      .from(customerQuotationsTable)
      .where(eq(customerQuotationsTable.id, id));

    res.json({ ...updated, items: savedItems });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في تعديل الطلب" });
  }
});

// PATCH /api/customer-quotations/:id/pricing — set customer prices per item
router.patch("/:id/pricing", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { prices } = req.body; // [{ itemId, unitPrice, customerNotes }]

    if (!Array.isArray(prices)) return res.status(400).json({ error: "prices مطلوب" });

    for (const p of prices as any[]) {
      await db
        .update(customerQuotationItemsTable)
        .set({
          unitPrice: String(parseFloat(p.unitPrice) || 0),
          customerNotes: p.customerNotes?.trim() ?? "",
        })
        .where(
          and(
            eq(customerQuotationItemsTable.id, Number(p.itemId)),
            eq(customerQuotationItemsTable.quotationId, id)
          )
        );
    }

    // Check if all items have price — if so, set status to "مكتمل"
    const allItems = await db
      .select()
      .from(customerQuotationItemsTable)
      .where(eq(customerQuotationItemsTable.quotationId, id));

    const allPriced = allItems.every((it) => parseFloat(it.unitPrice ?? "0") > 0);
    if (allPriced) {
      await db
        .update(customerQuotationsTable)
        .set({ status: "مكتمل" })
        .where(eq(customerQuotationsTable.id, id));
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في حفظ التسعير" });
  }
});

// DELETE /api/customer-quotations/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(customerQuotationsTable).where(eq(customerQuotationsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في حذف الطلب" });
  }
});

export default router;
