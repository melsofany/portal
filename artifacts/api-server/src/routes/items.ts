import { Router } from "express";
    import { pool } from "@workspace/db";

    const router = Router();

    // GET /api/items — all items from customer quotation requests (oldest first)
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
            cqi.internal_code,
            cq.quotation_no,
            cq.request_date,
            cq.status        AS quotation_status,
            cq.id            AS quotation_id,
            cu.name          AS customer_name
          FROM customer_quotation_items cqi
          JOIN customer_quotations cq ON cq.id = cqi.quotation_id
          LEFT JOIN customers cu ON cu.id = cq.customer_id
          ORDER BY cq.created_at ASC, cqi.sort_order ASC
        `);
        res.json(rows);
      } catch (err: any) {
        res.status(500).json({ error: "فشل في جلب البنود", details: err.message });
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
            cqi.internal_code,
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
  