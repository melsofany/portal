import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import {
  supplierQuotationsTable,
  supplierQuotationItemsTable,
  supplierQuotationSuppliersTable,
  supplierQuotationItemPricesTable,
  customerQuotationsTable,
  customerQuotationItemsTable,
  customersTable,
  suppliersTable,
} from "@workspace/db/schema";
import { eq, desc, inArray, or, ilike, and } from "drizzle-orm";

const router = Router();

function generateRfqNo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SQ-${y}${m}${d}-${rand}`;
}

// GET /api/supplier-quotations/search-cq?q=...  — returns array of matches
router.get("/search-cq", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);

    const pattern = `%${q}%`;

    const quotations = await db
      .select({
        id: customerQuotationsTable.id,
        quotationNo: customerQuotationsTable.quotationNo,
        customerName: customersTable.name,
        customerOrderNo: customerQuotationsTable.customerOrderNo,
        requestDate: customerQuotationsTable.requestDate,
        status: customerQuotationsTable.status,
      })
      .from(customerQuotationsTable)
      .leftJoin(customersTable, eq(customerQuotationsTable.customerId, customersTable.id))
      .where(or(
        ilike(customerQuotationsTable.quotationNo, pattern),
        ilike(customerQuotationsTable.customerOrderNo, pattern),
      ))
      .orderBy(desc(customerQuotationsTable.id))
      .limit(20);

    res.json(quotations);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في البحث" });
  }
});

// GET /api/supplier-quotations/:id/analysis
router.get("/:id/analysis", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const items = await db
      .select()
      .from(supplierQuotationItemsTable)
      .where(eq(supplierQuotationItemsTable.rfqId, id))
      .orderBy(supplierQuotationItemsTable.sortOrder);

    const rfqSuppliers = await db
      .select({
        id: supplierQuotationSuppliersTable.id,
        supplierId: supplierQuotationSuppliersTable.supplierId,
        companyName: suppliersTable.companyName,
        responseStatus: supplierQuotationSuppliersTable.responseStatus,
        responseSubmittedAt: supplierQuotationSuppliersTable.responseSubmittedAt,
        token: supplierQuotationSuppliersTable.token,
      })
      .from(supplierQuotationSuppliersTable)
      .leftJoin(suppliersTable, eq(supplierQuotationSuppliersTable.supplierId, suppliersTable.id))
      .where(eq(supplierQuotationSuppliersTable.rfqId, id));

    const rfqSupplierIds = rfqSuppliers.map((s) => s.id);

    let prices: any[] = [];
    if (rfqSupplierIds.length > 0) {
      prices = await db
        .select()
        .from(supplierQuotationItemPricesTable)
        .where(inArray(supplierQuotationItemPricesTable.rfqSupplierId, rfqSupplierIds));
    }

    const suppliersWithPrices = rfqSuppliers.map((s) => ({
      ...s,
      prices: prices.filter((p) => p.rfqSupplierId === s.id),
    }));

    res.json({ items, suppliers: suppliersWithPrices });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب التحليل" });
  }
});

// GET /api/supplier-quotations
router.get("/", async (req, res) => {
  try {
    const rfqs = await db
      .select()
      .from(supplierQuotationsTable)
      .orderBy(desc(supplierQuotationsTable.createdAt));

    if (rfqs.length === 0) return res.json([]);

    const rfqIds = rfqs.map((r) => r.id);

    const items = await db
      .select()
      .from(supplierQuotationItemsTable)
      .where(inArray(supplierQuotationItemsTable.rfqId, rfqIds));

    const rfqSuppliers = await db
      .select({
        rfqId: supplierQuotationSuppliersTable.rfqId,
        supplierId: supplierQuotationSuppliersTable.supplierId,
        sentVia: supplierQuotationSuppliersTable.sentVia,
        sentAt: supplierQuotationSuppliersTable.sentAt,
        token: supplierQuotationSuppliersTable.token,
        responseStatus: supplierQuotationSuppliersTable.responseStatus,
        responseSubmittedAt: supplierQuotationSuppliersTable.responseSubmittedAt,
        companyName: suppliersTable.companyName,
        email: suppliersTable.email,
        whatsapp: suppliersTable.whatsapp,
        phone: suppliersTable.phone,
        firstOpenedAt: supplierQuotationSuppliersTable.firstOpenedAt,
      })
      .from(supplierQuotationSuppliersTable)
      .leftJoin(suppliersTable, eq(supplierQuotationSuppliersTable.supplierId, suppliersTable.id))
      .where(inArray(supplierQuotationSuppliersTable.rfqId, rfqIds));

    const result = rfqs.map((rfq) => ({
      ...rfq,
      items: items.filter((i) => i.rfqId === rfq.id),
      suppliers: rfqSuppliers.filter((s) => s.rfqId === rfq.id),
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب طلبات التسعير" });
  }
});

// GET /api/supplier-quotations/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [rfq] = await db
      .select()
      .from(supplierQuotationsTable)
      .where(eq(supplierQuotationsTable.id, id));

    if (!rfq) return res.status(404).json({ error: "الطلب غير موجود" });

    const items = await db
      .select()
      .from(supplierQuotationItemsTable)
      .where(eq(supplierQuotationItemsTable.rfqId, id))
      .orderBy(supplierQuotationItemsTable.sortOrder);

    const suppliers = await db
      .select({
        rfqId: supplierQuotationSuppliersTable.rfqId,
        supplierId: supplierQuotationSuppliersTable.supplierId,
        sentVia: supplierQuotationSuppliersTable.sentVia,
        sentAt: supplierQuotationSuppliersTable.sentAt,
        token: supplierQuotationSuppliersTable.token,
        responseStatus: supplierQuotationSuppliersTable.responseStatus,
        responseSubmittedAt: supplierQuotationSuppliersTable.responseSubmittedAt,
        companyName: suppliersTable.companyName,
        email: suppliersTable.email,
        whatsapp: suppliersTable.whatsapp,
        phone: suppliersTable.phone,
      })
      .from(supplierQuotationSuppliersTable)
      .leftJoin(suppliersTable, eq(supplierQuotationSuppliersTable.supplierId, suppliersTable.id))
      .where(eq(supplierQuotationSuppliersTable.rfqId, id));

    res.json({ ...rfq, items, suppliers });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب الطلب" });
  }
});

// POST /api/supplier-quotations
// Accepts itemSupplierAssignments: { item: {...}, supplierIds: number[] }[]
// Creates one RFQ per unique supplier, each containing only their assigned items.
router.post("/", async (req, res) => {
  try {
    const { sourceQuotationId, sourceQuotationNo, customerOrderNo, requestDate, notes, itemSupplierAssignments } = req.body;

    if (!requestDate) return res.status(400).json({ error: "تاريخ الطلب مطلوب" });
    if (!Array.isArray(itemSupplierAssignments) || itemSupplierAssignments.length === 0)
      return res.status(400).json({ error: "يجب إضافة بند واحد على الأقل" });

    // Build supplierItem map: supplierId → items[]
    const supplierItemMap: Map<number, any[]> = new Map();
    for (const { item, supplierIds } of itemSupplierAssignments as any[]) {
      if (!Array.isArray(supplierIds) || supplierIds.length === 0) continue;
      for (const sid of supplierIds) {
        const id = Number(sid);
        if (!supplierItemMap.has(id)) supplierItemMap.set(id, []);
        supplierItemMap.get(id)!.push(item);
      }
    }

    if (supplierItemMap.size === 0)
      return res.status(400).json({ error: "يجب اختيار مورد واحد على الأقل" });

    const createdRfqs: any[] = [];

    for (const [supplierId, supplierItems] of supplierItemMap) {
      const rfqNo = generateRfqNo();

      const [rfq] = await db
        .insert(supplierQuotationsTable)
        .values({
          rfqNo,
          sourceQuotationId: sourceQuotationId ? Number(sourceQuotationId) : null,
          sourceQuotationNo: sourceQuotationNo?.trim() ?? "",
          customerOrderNo: customerOrderNo?.trim() ?? "",
          requestDate: requestDate.trim(),
          notes: notes?.trim() ?? "",
          status: "مرسل",
        })
        .returning();

      const itemRows = (supplierItems as any[]).map((item: any, idx: number) => ({
        rfqId: rfq.id,
        customerItemCode: item.customerItemCode?.trim() ?? "",
        description: item.description?.trim() ?? "",
        partNo: item.partNo?.trim() ?? "",
        unit: item.unit?.trim() ?? "",
        quantity: String(item.quantity ?? 0),
        sortOrder: idx,
      }));
      await db.insert(supplierQuotationItemsTable).values(itemRows);

      await db.insert(supplierQuotationSuppliersTable).values({
        rfqId: rfq.id,
        supplierId,
        sentVia: "",
        token: randomUUID(),
      });

      const savedItems = await db
        .select()
        .from(supplierQuotationItemsTable)
        .where(eq(supplierQuotationItemsTable.rfqId, rfq.id))
        .orderBy(supplierQuotationItemsTable.sortOrder);

      const [savedSupplier] = await db
        .select({
          rfqId: supplierQuotationSuppliersTable.rfqId,
          supplierId: supplierQuotationSuppliersTable.supplierId,
          sentVia: supplierQuotationSuppliersTable.sentVia,
          sentAt: supplierQuotationSuppliersTable.sentAt,
          token: supplierQuotationSuppliersTable.token,
          responseStatus: supplierQuotationSuppliersTable.responseStatus,
          responseSubmittedAt: supplierQuotationSuppliersTable.responseSubmittedAt,
          companyName: suppliersTable.companyName,
          email: suppliersTable.email,
          whatsapp: suppliersTable.whatsapp,
          phone: suppliersTable.phone,
        })
        .from(supplierQuotationSuppliersTable)
        .leftJoin(suppliersTable, eq(supplierQuotationSuppliersTable.supplierId, suppliersTable.id))
        .where(eq(supplierQuotationSuppliersTable.rfqId, rfq.id));

      createdRfqs.push({ ...rfq, items: savedItems, supplier: savedSupplier });
    }

    res.status(201).json(createdRfqs);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إنشاء الطلب" });
  }
});

// POST /api/supplier-quotations/:id/suppliers
router.post("/:id/suppliers", async (req, res) => {
  try {
    const rfqId = Number(req.params.id);
    const { supplierId } = req.body;
    if (!supplierId) return res.status(400).json({ error: "المورد مطلوب" });

    const [rfq] = await db.select().from(supplierQuotationsTable).where(eq(supplierQuotationsTable.id, rfqId));
    if (!rfq) return res.status(404).json({ error: "الطلب غير موجود" });

    const existing = await db.select({ id: supplierQuotationSuppliersTable.id })
      .from(supplierQuotationSuppliersTable)
      .where(and(
        eq(supplierQuotationSuppliersTable.rfqId, rfqId),
        eq(supplierQuotationSuppliersTable.supplierId, Number(supplierId))
      ));
    if (existing.length > 0) return res.status(400).json({ error: "المورد مضاف بالفعل" });

    const [newSup] = await db.insert(supplierQuotationSuppliersTable).values({
      rfqId,
      supplierId: Number(supplierId),
      sentVia: "",
      token: randomUUID(),
    }).returning();

    const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, Number(supplierId)));

    res.status(201).json({
      ...newSup,
      companyName: supplier?.companyName ?? "",
      email: supplier?.email ?? null,
      whatsapp: supplier?.whatsapp ?? null,
      phone: supplier?.phone ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إضافة المورد" });
  }
});

// DELETE /api/supplier-quotations/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(supplierQuotationsTable).where(eq(supplierQuotationsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في حذف الطلب" });
  }
});

export default router;
