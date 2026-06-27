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
`).then(() => seedDefaultItems()).catch(err => console.error("[item-coding] table init failed:", err.message));

// ── Default seed items (runs only if table is empty) ─────────────────────────
async function seedDefaultItems() {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) AS cnt FROM canonical_items");
    if (parseInt(rows[0].cnt) > 0) return;

    const defaults = [
      {
        internal_code: "LC1D09M7",
        brand: "Schneider Electric",
        category: "كونتاكتورات / Contactors",
        description_ar: "كونتاكتور شنايدر تي سيز D، 9 أمبير، ثلاثي الأوجه، ملف 220 فولت AC",
        description_en: "Schneider Electric TeSys D Contactor, 9A, 3P (3NO), 220VAC Coil, LC1D09M7",
        keywords: ["contactor","magnetic contactor","كونتاكتور","مفتاح مغناطيسي","9A","9 amp","220VAC","3P","LC1D09","TeSys","motor starter"],
        notes: "",
      },
      {
        internal_code: "LC1D18M7",
        brand: "Schneider Electric",
        category: "كونتاكتورات / Contactors",
        description_ar: "كونتاكتور شنايدر تي سيز D، 18 أمبير، ثلاثي الأوجه، ملف 220 فولت AC",
        description_en: "Schneider Electric TeSys D Contactor, 18A, 3P (3NO), 220VAC Coil, LC1D18M7",
        keywords: ["contactor","magnetic contactor","كونتاكتور","مفتاح مغناطيسي","18A","18 amp","220VAC","3P","LC1D18","TeSys","motor starter"],
        notes: "",
      },
      {
        internal_code: "LC1D25M7",
        brand: "Schneider Electric",
        category: "كونتاكتورات / Contactors",
        description_ar: "كونتاكتور شنايدر تي سيز D، 25 أمبير، ثلاثي الأوجه، ملف 220 فولت AC",
        description_en: "Schneider Electric TeSys D Contactor, 25A, 3P (3NO), 220VAC Coil, LC1D25M7",
        keywords: ["contactor","magnetic contactor","كونتاكتور","مفتاح مغناطيسي","25A","25 amp","220VAC","3P","LC1D25","TeSys","motor starter"],
        notes: "",
      },
      {
        internal_code: "LC1D32M7",
        brand: "Schneider Electric",
        category: "كونتاكتورات / Contactors",
        description_ar: "كونتاكتور شنايدر تي سيز D، 32 أمبير، ثلاثي الأوجه، ملف 220 فولت AC",
        description_en: "Schneider Electric TeSys D Contactor, 32A, 3P (3NO), 220VAC Coil, LC1D32M7",
        keywords: ["contactor","magnetic contactor","كونتاكتور","مفتاح مغناطيسي","مفتاح تلامس","32A","32 amp","220VAC","3P","3NO","LC1D32","TeSys D","motor starter","AC-3","15kw","400V","كونتاكتور كهربائي","كونتاكتور قدرة","كونتاكتور صناعي","كونتاكتور شنايدر","ثلاثي الأقطاب","ثلاثي الأوجه","ثلاثي فاز","ثلاثي","MCC","motor control","لوحة تحكم","محرك","FRANCE TELEMECANIQUE","ITH"],
        notes: "P/N: LC1D32M7 — ITH 50A, 15KW @ 400V. FRANCE TELEMECANIQUE 220V 50/60HZ",
      },
      {
        internal_code: "LC1D40M7",
        brand: "Schneider Electric",
        category: "كونتاكتورات / Contactors",
        description_ar: "كونتاكتور شنايدر تي سيز D، 40 أمبير، ثلاثي الأوجه، ملف 220 فولت AC",
        description_en: "Schneider Electric TeSys D Contactor, 40A, 3P (3NO), 220VAC Coil, LC1D40M7",
        keywords: ["contactor","magnetic contactor","كونتاكتور","مفتاح مغناطيسي","40A","40 amp","220VAC","3P","LC1D40","TeSys","motor starter"],
        notes: "",
      },
      {
        internal_code: "LC1D50M7",
        brand: "Schneider Electric",
        category: "كونتاكتورات / Contactors",
        description_ar: "كونتاكتور شنايدر تي سيز D، 50 أمبير، ثلاثي الأوجه، ملف 220 فولت AC",
        description_en: "Schneider Electric TeSys D Contactor, 50A, 3P (3NO), 220VAC Coil, LC1D50M7",
        keywords: ["contactor","magnetic contactor","كونتاكتور","مفتاح مغناطيسي","50A","50 amp","220VAC","3P","LC1D50","TeSys","motor starter"],
        notes: "",
      },
      {
        internal_code: "LC1D65M7",
        brand: "Schneider Electric",
        category: "كونتاكتورات / Contactors",
        description_ar: "كونتاكتور شنايدر تي سيز D، 65 أمبير، ثلاثي الأوجه، ملف 220 فولت AC",
        description_en: "Schneider Electric TeSys D Contactor, 65A, 3P (3NO), 220VAC Coil, LC1D65M7",
        keywords: ["contactor","magnetic contactor","كونتاكتور","مفتاح مغناطيسي","65A","65 amp","220VAC","3P","LC1D65","TeSys","motor starter"],
        notes: "",
      },
      {
        internal_code: "LC1D80M7",
        brand: "Schneider Electric",
        category: "كونتاكتورات / Contactors",
        description_ar: "كونتاكتور شنايدر تي سيز D، 80 أمبير، ثلاثي الأوجه، ملف 220 فولت AC",
        description_en: "Schneider Electric TeSys D Contactor, 80A, 3P (3NO), 220VAC Coil, LC1D80M7",
        keywords: ["contactor","magnetic contactor","كونتاكتور","مفتاح مغناطيسي","80A","80 amp","220VAC","3P","LC1D80","TeSys","motor starter"],
        notes: "",
      },
    ];

    for (const item of defaults) {
      await pool.query(
        `INSERT INTO canonical_items
           (internal_code, brand, category, description_ar, description_en, keywords, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (internal_code) DO NOTHING`,
        [item.internal_code, item.brand, item.category, item.description_ar, item.description_en, item.keywords, item.notes]
      );
    }
    console.log("[item-coding] seeded", defaults.length, "default canonical items");
  } catch (err: any) {
    console.error("[item-coding] seed failed:", err.message);
  }
}

// ── Fuse.js index cache ──────────────────────────────────────────────────────
let _cache: { fuse: InstanceType<typeof Fuse>; items: any[] } | null = null;

async function getFuse() {
  if (_cache) return _cache;
  const { rows } = await pool.query(
    "SELECT * FROM canonical_items ORDER BY brand, internal_code"
  );
  // Flatten keywords into a searchable string per item
  const enriched = rows.map((r: any) => ({
    ...r,
    keywords_str: Array.isArray(r.keywords) ? r.keywords.join(" ") : "",
  }));
  const fuse = new Fuse(enriched, {
    keys: [
      { name: "description_ar",  weight: 0.35 },
      { name: "description_en",  weight: 0.30 },
      { name: "keywords_str",    weight: 0.20 },
      { name: "internal_code",   weight: 0.10 },
      { name: "brand",           weight: 0.03 },
      { name: "category",        weight: 0.02 },
    ],
    includeScore: true,
    threshold: 0.65,       // 0–1, lower = stricter; 0.65 is permissive enough for Arabic variants
    ignoreLocation: true,  // Don't penalise match position in the string
    minMatchCharLength: 2,
    findAllMatches: true,
  });
  _cache = { fuse, items: enriched };
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

// ── POST /api/item-coding/canonical/bulk ─────────────────────────────────────
// Body: { items: Array<{internal_code, brand?, category?, description_ar?, description_en?, keywords?, notes?}> }
// Upserts items: inserts new, updates existing by internal_code.
router.post("/canonical/bulk", async (req, res) => {
  const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "لا توجد بنود للاستيراد" });

  let inserted = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const item of items) {
    if (!item.internal_code?.trim()) { skipped++; continue; }
    if (!item.description_ar?.trim() && !item.description_en?.trim()) { skipped++; continue; }
    try {
      const kws = Array.isArray(item.keywords)
        ? item.keywords
        : typeof item.keywords === "string"
          ? item.keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
          : [];
      await pool.query(
        `INSERT INTO canonical_items
           (internal_code, brand, category, description_ar, description_en, keywords, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (internal_code) DO UPDATE SET
           brand=$2, category=$3, description_ar=$4, description_en=$5,
           keywords=$6, notes=$7, updated_at=NOW()`,
        [
          item.internal_code.trim(),
          (item.brand ?? "").trim(),
          (item.category ?? "").trim(),
          (item.description_ar ?? "").trim(),
          (item.description_en ?? "").trim(),
          kws,
          (item.notes ?? "").trim(),
        ]
      );
      inserted++;
    } catch (err: any) {
      errors.push(`${item.internal_code}: ${err.message}`);
    }
  }

  invalidateCache();
  res.json({ inserted, skipped, errors: errors.slice(0, 10) });
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

    const results = fuse.search(description, { limit: 5 });
    if (!results.length)
      return res.json({ matched: false, code: null, confidence: 0, item: null });

    const best       = results[0];
    const confidence = parseFloat((1 - (best.score ?? 1)).toFixed(3));

    // Threshold lowered to 0.25 to accommodate Arabic/English description variants
    const MATCH_THRESHOLD = 0.25;

    res.json({
      matched:      confidence >= MATCH_THRESHOLD,
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
    const MATCH_THRESHOLD = 0.25;
    const results = descriptions.map((desc: string) => {
      if (!desc?.trim() || !items.length)
        return { description: desc, matched: false, code: null, confidence: 0, item: null };
      const hits = fuse.search(desc.trim(), { limit: 1 });
      if (!hits.length)
        return { description: desc, matched: false, code: null, confidence: 0, item: null };
      const confidence = parseFloat((1 - (hits[0].score ?? 1)).toFixed(3));
      return {
        description: desc,
        matched:     confidence >= MATCH_THRESHOLD,
        code:        hits[0].item.internal_code,
        confidence,
        item:        hits[0].item,
      };
    });
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: "فشل في المطابقة", details: err.message });
  }
});

export default router;
