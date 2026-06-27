import { Router } from "express";
    import { pool } from "@workspace/db";
    import { extractFingerprint, fingerprintHash, nextInternalCode } from "../lib/item-coding-engine";

    const router = Router();

    // ── Shared helper: match or auto-create canonical item ───────────────────
    async function resolveCode(description: string): Promise<string> {
      if (!description.trim()) return "";
      const desc = description.trim().toLowerCase();
      try {
        const { rows } = await pool.query<{ internal_code: string; score: number }>(`
          SELECT internal_code,
            (
              CASE
                WHEN LOWER(description_en) = $2 THEN 20
                WHEN LOWER(description_ar) = $2 THEN 20
                WHEN LOWER(description_en) ILIKE $1 THEN 12
                WHEN LOWER(description_ar) ILIKE $1 THEN 12
                WHEN $2 ILIKE '%' || LOWER(description_en) || '%' AND LENGTH(description_en) > 4 THEN 8
                WHEN $2 ILIKE '%' || LOWER(description_ar) || '%' AND LENGTH(description_ar) > 4 THEN 8
                ELSE 0
              END
              + COALESCE((
                  SELECT COUNT(*)::int FROM unnest(keywords) k
                  WHERE LENGTH(k) > 2 AND $2 ILIKE '%' || LOWER(k) || '%'
                ), 0)
            ) AS score
          FROM canonical_items
          WHERE
            LOWER(description_en) ILIKE $1 OR LOWER(description_ar) ILIKE $1
            OR $2 ILIKE '%' || LOWER(description_en) || '%'
            OR $2 ILIKE '%' || LOWER(description_ar) || '%'
            OR EXISTS (SELECT 1 FROM unnest(keywords) k WHERE LENGTH(k) > 2 AND $2 ILIKE '%' || LOWER(k) || '%')
          ORDER BY score DESC LIMIT 1
        `, [`%${desc}%`, desc]);

        if (rows[0] && rows[0].score >= 3) return rows[0].internal_code;

        // No match — auto-create
        const fp = extractFingerprint(description.trim());
        const hash = fingerprintHash(fp);
        const category = (fp.category as string | undefined)?.trim() ?? "";
        const brand    = (fp.brand    as string | undefined)?.trim() ?? "";
        const keywords = Array.isArray(fp.keywords) ? fp.keywords as string[] : [];
        const newCode  = await nextInternalCode(category || undefined);
        await pool.query(`
          INSERT INTO canonical_items
            (internal_code, brand, category, description_en, description_ar, keywords, notes, fingerprint, fingerprint_hash)
          VALUES ($1,$2,$3,$4,'',$5,'', $6,$7)
          ON CONFLICT (internal_code) DO NOTHING
        `, [newCode, brand, category, description.trim(), keywords, JSON.stringify(fp), hash]);
        return newCode;
      } catch {
        return "";
      }
    }

    // GET /api/items — all items (with canonical code resolved via JOIN)
    router.get("/", async (req, res) => {
      try {
        const { rows } = await pool.query(`
          SELECT
            cqi.id,
            cqi.customer_item_code,
            cqi.description,
            cqi.part_no,
            cqi.unit,
            cqi.quantity,
            cqi.sort_order,
            COALESCE(cqi.internal_code, ci.internal_code) AS internal_code,
            cq.quotation_no,
            cq.request_date,
            cq.status        AS quotation_status,
            cq.id            AS quotation_id,
            cu.name          AS customer_name
          FROM customer_quotation_items cqi
          JOIN customer_quotations cq ON cq.id = cqi.quotation_id
          LEFT JOIN customers cu ON cu.id = cq.customer_id
          LEFT JOIN canonical_items ci
            ON LOWER(TRIM(ci.description_en)) = LOWER(TRIM(cqi.description))
            OR LOWER(TRIM(ci.description_ar)) = LOWER(TRIM(cqi.description))
          ORDER BY cq.created_at ASC, cqi.sort_order ASC
        `);
        res.json(rows);
      } catch (err: any) {
        res.status(500).json({ error: "فشل في جلب البنود", details: err.message });
      }
    });

    // POST /api/items/backfill-codes — auto-code all items missing an internal_code
    router.post("/backfill-codes", async (req, res) => {
      try {
        // Ensure column exists
        await pool.query(`
          ALTER TABLE customer_quotation_items
            ADD COLUMN IF NOT EXISTS internal_code TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS internal_code_score NUMERIC(6,2) NOT NULL DEFAULT 0
        `).catch(() => {});

        const { rows: uncoded } = await pool.query<{ id: number; description: string }>(`
          SELECT id, description FROM customer_quotation_items
          WHERE TRIM(internal_code) = '' OR internal_code IS NULL
            AND TRIM(description) <> ''
        `);

        let coded = 0;
        let failed = 0;
        for (const row of uncoded) {
          const code = await resolveCode(row.description);
          if (code) {
            await pool.query(
              `UPDATE customer_quotation_items SET internal_code = $1 WHERE id = $2`,
              [code, row.id]
            );
            coded++;
          } else {
            failed++;
          }
        }

        res.json({ total: uncoded.length, coded, failed });
      } catch (err: any) {
        res.status(500).json({ error: "فشل في تكويد البنود", details: err.message });
      }
    });

    // GET /api/items/detail?description=...
    router.get("/detail", async (req, res) => {
      const description = String(req.query.description ?? "").trim();
      if (!description) return res.status(400).json({ error: "description مطلوب" });

      try {
        const { rows } = await pool.query(`
          SELECT
            cqi.id                        AS item_id,
            cqi.description,
            cqi.part_no,
            cqi.customer_item_code,
            cqi.unit,
            cqi.quantity                  AS quoted_qty,
            cqi.unit_price                AS quoted_unit_price,
            COALESCE(cqi.internal_code, ci.internal_code) AS internal_code,
            cq.id                         AS quotation_id,
            cq.quotation_no,
            cq.request_date,
            cq.status                     AS quotation_status,
            cq.customer_order_no,
            cu.name                       AS customer_name,
            co.id                         AS order_id,
            co.order_no                   AS sales_order_no,
            co.customer_po_no             AS customer_po_no,
            co.order_date                 AS sales_order_date,
            co.status                     AS order_status,
            coi.quantity                  AS ordered_qty,
            coi.unit_price                AS selling_unit_price,
            coi.total_price               AS selling_total_price
          FROM customer_quotation_items cqi
          JOIN customer_quotations cq  ON cq.id  = cqi.quotation_id
          LEFT JOIN customers cu       ON cu.id  = cq.customer_id
          LEFT JOIN customer_order_items coi ON coi.quotation_item_id = cqi.id
          LEFT JOIN customer_orders co       ON co.id = coi.order_id
          LEFT JOIN canonical_items ci
            ON LOWER(TRIM(ci.description_en)) = LOWER(TRIM(cqi.description))
            OR LOWER(TRIM(ci.description_ar)) = LOWER(TRIM(cqi.description))
          WHERE LOWER(TRIM(cqi.description)) = LOWER(TRIM($1))
          ORDER BY cq.created_at ASC
        `, [description]);

        const { rows: supplierRows } = await pool.query(`
          SELECT sqip.unit_price AS latest_supplier_price,
                 s.company_name AS supplier_name,
                 COALESCE(sqs.response_submitted_at, sqs.sent_at) AS price_date
          FROM supplier_quotation_item_prices sqip
          JOIN supplier_quotation_items sqi  ON sqi.id  = sqip.rfq_item_id
          JOIN supplier_quotation_suppliers sqs ON sqs.id = sqip.rfq_supplier_id
          LEFT JOIN suppliers s ON s.id = sqs.supplier_id
          WHERE LOWER(TRIM(sqi.description)) = LOWER(TRIM($1))
            AND sqip.unit_price > 0
          ORDER BY COALESCE(sqs.response_submitted_at, sqs.sent_at, '1970-01-01') DESC, sqip.id DESC
          LIMIT 1
        `, [description]);

        const latestSupplierPrice = supplierRows[0] ?? null;
        const totalOccurrences = rows.length;
        const totalQuotedQty   = rows.reduce((s: number, r: any) => s + (parseFloat(r.quoted_qty) || 0), 0);
        const orderedRows      = rows.filter((r: any) => r.order_id != null);
        const totalOrderedQty  = orderedRows.reduce((s: number, r: any) => s + (parseFloat(r.ordered_qty) || 0), 0);
        const sellingPrices    = orderedRows.map((r: any) => parseFloat(r.selling_unit_price) || 0).filter((p: number) => p > 0);
        const avgSellingPrice  = sellingPrices.length ? sellingPrices.reduce((a: number, b: number) => a + b, 0) / sellingPrices.length : null;
        const minSellingPrice  = sellingPrices.length ? Math.min(...sellingPrices) : null;
        const maxSellingPrice  = sellingPrices.length ? Math.max(...sellingPrices) : null;

        res.json({
          description,
          stats: {
            totalOccurrences, totalQuotedQty, orderedCount: orderedRows.length,
            totalOrderedQty, avgSellingPrice, minSellingPrice, maxSellingPrice,
            latestSupplierPrice: latestSupplierPrice ? parseFloat(latestSupplierPrice.latest_supplier_price) : null,
            latestSupplierName: latestSupplierPrice?.supplier_name ?? null,
          },
          rows,
        });
      } catch (err: any) {
        res.status(500).json({ error: "فشل في جلب تفاصيل البند", details: err.message });
      }
    });

    export default router;
