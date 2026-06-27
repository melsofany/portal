import { Router } from "express";
  import { pool } from "@workspace/db";
  import crypto from "crypto";
  import {
    matchDescription, extractFingerprint, fingerprintHash,
    geminiExtractFingerprint, nextInternalCode, CATEGORY_PREFIX_MAP, ProductFingerprint,
  } from "../lib/item-coding-engine";

  const router = Router();

  pool.query(`
    CREATE TABLE IF NOT EXISTS canonical_items (
      id               SERIAL PRIMARY KEY,
      internal_code    TEXT NOT NULL UNIQUE,
      brand            TEXT NOT NULL DEFAULT '',
      category         TEXT NOT NULL DEFAULT '',
      description_ar   TEXT NOT NULL DEFAULT '',
      description_en   TEXT NOT NULL DEFAULT '',
      keywords         TEXT[] NOT NULL DEFAULT '{}',
      notes            TEXT NOT NULL DEFAULT '',
      fingerprint      JSONB NOT NULL DEFAULT '{}',
      fingerprint_hash TEXT NOT NULL DEFAULT '',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).then(() => pool.query(`
      ALTER TABLE canonical_items
        ADD COLUMN IF NOT EXISTS fingerprint      JSONB NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT NOT NULL DEFAULT ''
    `))
    .then(() => seedDefaultItems())
    .catch(err => console.error("[item-coding] init failed:", err.message));

  async function seedDefaultItems() {
    try {
      const { rows } = await pool.query("SELECT COUNT(*) AS cnt FROM canonical_items");
      if (parseInt(rows[0].cnt, 10) > 0) return;
      const defaults = [
        { description_en: "Schneider Electric TeSys D Contactor 9A 3P 220VAC Coil LC1D09M7",  description_ar: "كونتاكتور شنايدر تي سيز D، 9 أمبير، ثلاثي الأوجه، ملف 220 فولت",  brand: "Schneider", category: "Contactor", keywords: ["contactor","LC1D09M7","9A","220VAC","3P"],  code: "EL-CON-000001" },
        { description_en: "Schneider Electric TeSys D Contactor 18A 3P 220VAC Coil LC1D18M7", description_ar: "كونتاكتور شنايدر تي سيز D، 18 أمبير، ثلاثي الأوجه، ملف 220 فولت", brand: "Schneider", category: "Contactor", keywords: ["contactor","LC1D18M7","18A","220VAC","3P"], code: "EL-CON-000002" },
        { description_en: "Schneider Electric TeSys D Contactor 32A 3P 220VAC Coil LC1D32M7", description_ar: "كونتاكتور شنايدر تي سيز D، 32 أمبير، ثلاثي الأوجه، ملف 220 فولت", brand: "Schneider", category: "Contactor", keywords: ["contactor","LC1D32M7","32A","220VAC","3P"], code: "EL-CON-000003" },
        { description_en: "Schneider Electric TeSys D Contactor 40A 3P 220VAC Coil LC1D40M7", description_ar: "كونتاكتور شنايدر تي سيز D، 40 أمبير، ثلاثي الأوجه، ملف 220 فولت", brand: "Schneider", category: "Contactor", keywords: ["contactor","LC1D40M7","40A","220VAC","3P"], code: "EL-CON-000004" },
      ];
      for (const d of defaults) {
        const fp = extractFingerprint(`${d.description_en} ${d.description_ar}`);
        const hash = fingerprintHash(fp);
        await pool.query(
          `INSERT INTO canonical_items (internal_code,brand,category,description_ar,description_en,keywords,fingerprint,fingerprint_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (internal_code) DO NOTHING`,
          [d.code, d.brand, d.category, d.description_ar, d.description_en, d.keywords, JSON.stringify(fp), hash]
        );
      }
      console.log("[item-coding] seeded default items");
    } catch (err: any) {
      console.error("[item-coding] seed failed:", err.message);
    }
  }

  router.get("/canonical", async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT * FROM canonical_items ORDER BY internal_code ASC");
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: "فشل في جلب القائمة", details: err.message }); }
  });

  router.post("/canonical", async (req, res) => {
    const { brand = "", category = "", description_ar = "", description_en = "", keywords = [], notes = "", internal_code: manualCode } = req.body as any;
    if (!description_ar?.trim() && !description_en?.trim())
      return res.status(400).json({ error: "يجب إدخال توصيف عربي أو إنجليزي" });
    try {
      const fp = process.env.GEMINI_API_KEY
        ? await geminiExtractFingerprint(`${description_en} ${description_ar}`)
        : extractFingerprint(`${description_en} ${description_ar}`);
      if (brand) fp.brand = brand;
      if (category) fp.category = category;
      const hash = fingerprintHash(fp);
      const resolvedCategory = (category || fp.category || "").trim();
      const code = manualCode?.trim() || await nextInternalCode(resolvedCategory || undefined);
      const { rows } = await pool.query(
        `INSERT INTO canonical_items (internal_code,brand,category,description_ar,description_en,keywords,notes,fingerprint,fingerprint_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [code, (brand || fp.brand || "").trim(), resolvedCategory, description_ar.trim(), description_en.trim(),
         Array.isArray(keywords) ? keywords : [], notes.trim(), JSON.stringify(fp), hash]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ error: "الكود الداخلي موجود بالفعل" });
      res.status(500).json({ error: "فشل في الإضافة", details: err.message });
    }
  });

  router.post("/canonical/bulk", async (req, res) => {
    const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: "لا توجد بنود للاستيراد" });
    let inserted = 0; let skipped = 0; const errors: string[] = [];
    for (const item of items) {
      if (!item.description_ar?.trim() && !item.description_en?.trim()) { skipped++; continue; }
      try {
        const fp = extractFingerprint(`${item.description_en ?? ""} ${item.description_ar ?? ""}`);
        if (item.brand) fp.brand = item.brand;
        if (item.category) fp.category = item.category;
        const hash = fingerprintHash(fp);
        const resolvedCategory = (item.category ?? fp.category ?? "").trim();
        const code = item.internal_code?.trim() || await nextInternalCode(resolvedCategory || undefined);
        const kws = Array.isArray(item.keywords) ? item.keywords : typeof item.keywords === "string" ? item.keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : [];
        await pool.query(
          `INSERT INTO canonical_items (internal_code,brand,category,description_ar,description_en,keywords,notes,fingerprint,fingerprint_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (internal_code) DO UPDATE SET brand=$2,category=$3,description_ar=$4,description_en=$5,keywords=$6,notes=$7,fingerprint=$8,fingerprint_hash=$9,updated_at=NOW()`,
          [code, (item.brand ?? fp.brand ?? "").trim(), resolvedCategory, (item.description_ar ?? "").trim(), (item.description_en ?? "").trim(), kws, (item.notes ?? "").trim(), JSON.stringify(fp), hash]
        );
        inserted++;
      } catch (err: any) { errors.push(`${item.description_en ?? item.description_ar}: ${err.message}`); }
    }
    res.json({ inserted, skipped, errors: errors.slice(0, 10) });
  });

  router.put("/canonical/:id", async (req, res) => {
    const id = Number(req.params.id);
    const { brand = "", category = "", description_ar = "", description_en = "", keywords = [], notes = "" } = req.body as any;
    try {
      const fp = extractFingerprint(`${description_en} ${description_ar}`);
      if (brand) fp.brand = brand;
      if (category) fp.category = category;
      const hash = fingerprintHash(fp);
      const { rows } = await pool.query(
        `UPDATE canonical_items SET brand=$1,category=$2,description_ar=$3,description_en=$4,keywords=$5,notes=$6,fingerprint=$7,fingerprint_hash=$8,updated_at=NOW() WHERE id=$9 RETURNING *`,
        [(brand || fp.brand || "").trim(), (category || fp.category || "").trim(), description_ar.trim(), description_en.trim(), Array.isArray(keywords) ? keywords : [], notes.trim(), JSON.stringify(fp), hash, id]
      );
      if (!rows[0]) return res.status(404).json({ error: "العنصر غير موجود" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: "فشل في التعديل", details: err.message }); }
  });

  router.delete("/canonical/:id", async (req, res) => {
    const id = Number(req.params.id);
    try {
      const { rowCount } = await pool.query("DELETE FROM canonical_items WHERE id=$1", [id]);
      if (!rowCount) return res.status(404).json({ error: "العنصر غير موجود" });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: "فشل في الحذف", details: err.message }); }
  });

  router.post("/match", async (req, res) => {
    const description = String(req.body?.description ?? "").trim();
    if (!description) return res.json({ matched: false, score: 0, decision: "new", item: null, fingerprint: {}, method: "none" });
    try {
      const fp = process.env.GEMINI_API_KEY ? await geminiExtractFingerprint(description) : extractFingerprint(description);
      const result = await matchDescription(description);
      res.json({ matched: result.decision !== "new", score: result.score, decision: result.decision, item: result.matchedItem, fingerprint: fp, reasoning: result.reasoning ?? null, method: result.method ?? "fingerprint" });
    } catch (err: any) { res.status(500).json({ error: "فشل في المطابقة", details: err.message }); }
  });

  router.post("/match-bulk", async (req, res) => {
    const descriptions: string[] = Array.isArray(req.body?.descriptions) ? req.body.descriptions : [];
    if (!descriptions.length) return res.json([]);
    try {
      const results = await Promise.all(descriptions.map(async (desc) => {
        if (!desc?.trim()) return { description: desc, matched: false, score: 0, decision: "new", item: null };
        const result = await matchDescription(desc);
        return { description: desc, matched: result.decision !== "new", score: result.score, decision: result.decision, item: result.matchedItem };
      }));
      res.json(results);
    } catch (err: any) { res.status(500).json({ error: "فشل في المطابقة", details: err.message }); }
  });

  router.post("/extract-fingerprint", async (req, res) => {
    const description = String(req.body?.description ?? "").trim();
    if (!description) return res.json({});
    try {
      const fp = process.env.GEMINI_API_KEY ? await geminiExtractFingerprint(description) : extractFingerprint(description);
      const hash = fingerprintHash(fp);
      res.json({ fingerprint: fp, hash, method: process.env.GEMINI_API_KEY ? "gemini" : "rule-based" });
    } catch { const fp = extractFingerprint(description); res.json({ fingerprint: fp, hash: fingerprintHash(fp), method: "rule-based" }); }
  });

  export default router;
  