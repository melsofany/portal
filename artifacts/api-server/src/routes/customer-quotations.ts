import { Router } from "express";
import { db, pool } from "@workspace/db";
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
import { extractFingerprint, fingerprintHash, nextInternalCode } from "../lib/item-coding-engine";

const router = Router();

async function generateQuotationNo(): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const prefix = `CQ-${y}${m}${d}-`;

  // Find the highest sequence number used today
  const { rows } = await pool.query<{ quotation_no: string }>(
    `SELECT quotation_no FROM customer_quotations WHERE quotation_no LIKE $1 ORDER BY quotation_no DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let seq = 1;
  if (rows[0]) {
    const last = rows[0].quotation_no.replace(prefix, "");
    const n = parseInt(last, 10);
    if (!isNaN(n)) seq = n + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Auto-match an item against canonical_items using Part No first, then description.
 * Matching priority:
 *   1. Exact Part No match (strongest signal — different part nos = different items)
 *   2. Exact description match
 *   3. High-confidence fuzzy match (score ≥ 10)
 *   4. None found → auto-create new canonical item
 */
async function autoCodeItem(description: string, partNo?: string): Promise<{ code: string; score: number }> {
  if (!description.trim()) return { code: "", score: 0 };
  const desc = description.trim().toLowerCase();
  const pno  = partNo?.trim() ?? "";

  try {
    // Ensure part_no column exists
    await pool.query(`ALTER TABLE canonical_items ADD COLUMN IF NOT EXISTS part_no TEXT NOT NULL DEFAULT ''`).catch(() => {});

    // Step 1: exact Part No match — most reliable differentiator
    if (pno) {
      const { rows: pnoRows } = await pool.query<{ internal_code: string }>(
        `SELECT internal_code FROM canonical_items WHERE LOWER(TRIM(part_no)) = LOWER($1) LIMIT 1`,
        [pno]
      );
      if (pnoRows[0]) return { code: pnoRows[0].internal_code, score: 20 };
    }

    // Step 2: description similarity (raised threshold to 10 to prevent false matches
    //          from shared substring like "SOUTHBEND OVEN OLYMPIC GOLD")
    const { rows } = await pool.query<{ internal_code: string; score: number }>(`
      SELECT internal_code,
        (
          CASE
            WHEN LOWER(description_en) = $2 THEN 20
            WHEN LOWER(description_ar) = $2 THEN 20
            WHEN LOWER(description_en) ILIKE $1 THEN 14
            WHEN LOWER(description_ar) ILIKE $1 THEN 14
            WHEN $2 ILIKE '%' || LOWER(description_en) || '%'
              AND LENGTH(description_en) > 8 THEN 10
            WHEN $2 ILIKE '%' || LOWER(description_ar) || '%'
              AND LENGTH(description_ar) > 8 THEN 10
            ELSE 0
          END
          + COALESCE((
              SELECT COUNT(*)::int FROM unnest(keywords) k
              WHERE LENGTH(k) > 3 AND $2 ILIKE '%' || LOWER(k) || '%'
            ), 0)
        ) AS score
      FROM canonical_items
      WHERE
        LOWER(description_en) ILIKE $1 OR LOWER(description_ar) ILIKE $1
        OR $2 ILIKE '%' || LOWER(description_en) || '%'
        OR $2 ILIKE '%' || LOWER(description_ar) || '%'
      ORDER BY score DESC LIMIT 1
    `, [`%${desc}%`, desc]);

    if (rows[0] && rows[0].score >= 10) {
      return { code: rows[0].internal_code, score: rows[0].score };
    }

    // Step 3: No confident match → auto-create new canonical item
    const fp = extractFingerprint(description.trim());
    if (pno) fp.partNo = pno;
    const hash     = fingerprintHash(fp);
    const category = (fp.category as string | undefined)?.trim() ?? "";
    const brand    = (fp.brand    as string | undefined)?.trim() ?? "";
    const keywords = Array.isArray(fp.keywords) ? fp.keywords as string[] : [];
    const newCode  = await nextInternalCode(category || undefined);

    await pool.query(`
      INSERT INTO canonical_items
        (internal_code, part_no, brand, category, description_en, description_ar,
         keywords, notes, fingerprint, fingerprint_hash)
      VALUES ($1,$2,$3,$4,$5,'',$6,'',$7,$8)
      ON CONFLICT (internal_code) DO NOTHING
    `, [newCode, pno, brand, category, description.trim(), keywords,
        JSON.stringify(fp), hash]);

    return { code: newCode, score: 0 };
  } catch {
    return { code: "", score: 0 };
  }
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

    // ── Duplicate customerOrderNo check for same customer ──
    if (customerOrderNo?.trim()) {
      const duplicate = await db
        .select({ id: customerQuotationsTable.id, quotationNo: customerQuotationsTable.quotationNo })
        .from(customerQuotationsTable)
        .where(
          and(
            eq(customerQuotationsTable.customerId, Number(customerId)),
            eq(customerQuotationsTable.customerOrderNo, customerOrderNo.trim())
          )
        )
        .limit(1);
      if (duplicate.length > 0) {
        return res.status(409).json({
          error: `رقم طلب العميل "${customerOrderNo.trim()}" مسجّل مسبقاً في الطلب ${duplicate[0].quotationNo} لنفس العميل`,
        });
      }
    }

    // ── Ensure new columns exist (migration guard) ──
    await pool.query(`
      ALTER TABLE customer_quotation_items
        ADD COLUMN IF NOT EXISTS internal_code TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS internal_code_score NUMERIC(6,2) NOT NULL DEFAULT 0
    `).catch(() => {});

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

    // Auto-code each item description in parallel (Part No passed as primary key)
    const codingResults = await Promise.all(
      (items as any[]).map((item) =>
        autoCodeItem(item.description?.trim() ?? "", item.partNo?.trim() || undefined)
      )
    );

    const itemRows = (items as any[]).map((item, idx) => ({
      quotationId: quotation.id,
      customerItemCode: item.customerItemCode?.trim() ?? "",
      description: item.description?.trim() ?? "",
      partNo: item.partNo?.trim() ?? "",
      unit: item.unit?.trim() ?? "",
      quantity: String(item.quantity ?? 0),
      sortOrder: idx,
      internalCode: codingResults[idx].code,
      internalCodeScore: String(codingResults[idx].score),
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

    // ── Duplicate customerOrderNo check for same customer (exclude current record) ──
    if (customerOrderNo?.trim()) {
      const duplicate = await db
        .select({ id: customerQuotationsTable.id, quotationNo: customerQuotationsTable.quotationNo })
        .from(customerQuotationsTable)
        .where(
          and(
            eq(customerQuotationsTable.customerId, Number(customerId)),
            eq(customerQuotationsTable.customerOrderNo, customerOrderNo.trim())
          )
        )
        .limit(1);
      if (duplicate.length > 0 && duplicate[0].id !== id) {
        return res.status(409).json({
          error: `رقم طلب العميل "${customerOrderNo.trim()}" مسجّل مسبقاً في الطلب ${duplicate[0].quotationNo} لنفس العميل`,
        });
      }
    }

    // ── Ensure new columns exist (migration guard) ──
    await pool.query(`
      ALTER TABLE customer_quotation_items
        ADD COLUMN IF NOT EXISTS internal_code TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS internal_code_score NUMERIC(6,2) NOT NULL DEFAULT 0
    `).catch(() => {});

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

    await db.delete(customerQuotationItemsTable).where(eq(customerQuotationItemsTable.quotationId, id));

    // Auto-code each item description in parallel (Part No passed as primary key)
    const codingResults = await Promise.all(
      (items as any[]).map((item) =>
        autoCodeItem(item.description?.trim() ?? "", item.partNo?.trim() || undefined)
      )
    );

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
      // Keep manually set code if provided; otherwise use auto-match
      internalCode: (item.internalCode?.trim()) || codingResults[idx].code,
      internalCodeScore: String(codingResults[idx].score),
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
    const { prices } = req.body;

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

      await db
        .update(supplierQuotationsTable)
        .set({ status: "مكتمل" })
        .where(eq(supplierQuotationsTable.sourceQuotationId, id));
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
