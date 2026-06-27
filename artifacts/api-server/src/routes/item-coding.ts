import { Router } from "express";
  import { pool } from "@workspace/db";
  import Fuse from "fuse.js";

  const router = Router();

  // ── Ensure table exists on startup ───────────────────────────────────────────
  pool.query(`
    CREATE TABLE IF NOT EXISTS canonical_items (
      id             SERIAL PRIMARY KEY,
      internal_code  TEXT NOT NULL UNIQUE,
      brand          TEXT NOT NULL DEFAULT '',
      category       TEXT NOT NULL DEFAULT '',
      description_ar TEXT NOT NULL DEFAULT '',
      description_en TEXT NOT NULL DEFAULT '',
      keywords       TEXT[] NOT NULL DEFAULT '{}',
      notes          TEXT NOT NULL DEFAULT '',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(err => console.error("[item-coding] table init failed:", err.message));

  // ── Fuse.js index cache ──────────────────────────────────────────────────────
  let _cache: { fuse: InstanceType<typeof Fuse<any>>; items: any[] } | null = null;

  async function getFuse() {
    const { rows } = await pool.query(
      "SELECT * FROM canonical_items ORDER BY brand, internal_code"
    );
    const fuse = new Fuse(rows, {
      keys: [
        { name: "description_ar", weight: 0.35 },
        { name: "description_en", weight: 0.35 },
        { name: "internal_code",  weight: 0.20 },
        { name: "brand",          weight: 0.05 },
        { name: "category",       weight: 0.05 },
      ],
      includeScore: true,
      threshold: 0.75,
      ignoreLocation: true,
      minMatchCharLength: 2,
      findAllMatches: false,
    });
    _cache = { fuse, items: rows };
    return _cache;
  }

  function invalidateCache() { _cache = null; }

  // ── GET /api/item-coding/canonical ───────────────────────────────────────────
  router.get("/canonical", async (_req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM canonical_items ORDER BY brand, internal_code"
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: "فشل في جلب القائمة", details: err.message });
    }
  });

  // ── POST /api/item-coding/canonical ──────────────────────────────────────────
  router.post("/canonical", async (req, res) => {
    const {
      internal_code, brand = "", category = "",
      description_ar = "", description_en = "",
      keywords = [], notes = "",
    } = req.body as any;

    if (!internal_code?.trim())
      return res.status(400).json({ error: "الكود الداخلي مطلوب" });
    if (!description_ar?.trim() && !description_en?.trim())
      return res.status(400).json({ error: "يجب إدخال توصيف عربي أو إنجليزي" });

    try {
      const { rows } = await pool.query(
        `INSERT INTO canonical_items
           (internal_code, brand, category, description_ar, description_en, keywords, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          internal_code.trim(), brand.trim(), category.trim(),
          description_ar.trim(), description_en.trim(),
          Array.isArray(keywords) ? keywords : [],
          notes.trim(),
        ]
      );
      invalidateCache();
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code === "23505")
        return res.status(409).json({ error: "الكود الداخلي موجود بالفعل" });
      res.status(500).json({ error: "فشل في الإضافة", details: err.message });
    }
  });

  // ── PUT /api/item-coding/canonical/:id ───────────────────────────────────────
  router.put("/canonical/:id", async (req, res) => {
    const id = Number(req.params.id);
    const {
      internal_code, brand = "", category = "",
      description_ar = "", description_en = "",
      keywords = [], notes = "",
    } = req.body as any;

    if (!internal_code?.trim())
      return res.status(400).json({ error: "الكود الداخلي مطلوب" });

    try {
      const { rows } = await pool.query(
        `UPDATE canonical_items
         SET internal_code=$1, brand=$2, category=$3,
             description_ar=$4, description_en=$5,
             keywords=$6, notes=$7, updated_at=NOW()
         WHERE id=$8 RETURNING *`,
        [
          internal_code.trim(), brand.trim(), category.trim(),
          description_ar.trim(), description_en.trim(),
          Array.isArray(keywords) ? keywords : [],
          notes.trim(), id,
        ]
      );
      if (!rows[0]) return res.status(404).json({ error: "العنصر غير موجود" });
      invalidateCache();
      res.json(rows[0]);
    } catch (err: any) {
      if (err.code === "23505")
        return res.status(409).json({ error: "الكود الداخلي موجود بالفعل" });
      res.status(500).json({ error: "فشل في التعديل", details: err.message });
    }
  });

  // ── DELETE /api/item-coding/canonical/:id ────────────────────────────────────
  router.delete("/canonical/:id", async (req, res) => {
    const id = Number(req.params.id);
    try {
      const { rowCount } = await pool.query(
        "DELETE FROM canonical_items WHERE id=$1", [id]
      );
      if (!rowCount) return res.status(404).json({ error: "العنصر غير موجود" });
      invalidateCache();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "فشل في الحذف", details: err.message });
    }
  });

  // ── POST /api/item-coding/match ──────────────────────────────────────────────
  // Body: { description: string }
  // Returns: { matched, code, confidence, item, alternatives }
  router.post("/match", async (req, res) => {
    const description = String(req.body?.description ?? "").trim();
    if (!description)
      return res.json({ matched: false, code: null, confidence: 0, item: null });

    try {
      const { fuse, items } = await getFuse();
      if (!items.length)
        return res.json({ matched: false, code: null, confidence: 0, item: null });

      const results = fuse.search(description, { limit: 3 });
      if (!results.length)
        return res.json({ matched: false, code: null, confidence: 0, item: null });

      const best       = results[0];
      const confidence = parseFloat((1 - (best.score ?? 1)).toFixed(3));

      res.json({
        matched:      confidence >= 0.35,
        code:         best.item.internal_code,
        confidence,
        item:         best.item,
        alternatives: results.slice(1).map(r => ({
          code:       r.item.internal_code,
          confidence: parseFloat((1 - (r.score ?? 1)).toFixed(3)),
          item:       r.item,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: "فشل في المطابقة", details: err.message });
    }
  });

  // ── POST /api/item-coding/match-bulk ─────────────────────────────────────────
  // Body: { descriptions: string[] }
  router.post("/match-bulk", async (req, res) => {
    const descriptions: string[] = Array.isArray(req.body?.descriptions)
      ? req.body.descriptions : [];
    if (!descriptions.length) return res.json([]);

    try {
      const { fuse, items } = await getFuse();
      const results = descriptions.map((desc: string) => {
        if (!desc?.trim() || !items.length)
          return { description: desc, matched: false, code: null, confidence: 0, item: null };
        const hits = fuse.search(desc.trim(), { limit: 1 });
        if (!hits.length)
          return { description: desc, matched: false, code: null, confidence: 0, item: null };
        const confidence = parseFloat((1 - (hits[0].score ?? 1)).toFixed(3));
        return { description: desc, matched: confidence >= 0.35, code: hits[0].item.internal_code, confidence, item: hits[0].item };
      });
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: "فشل في المطابقة", details: err.message });
    }
  });

  export default router;
  