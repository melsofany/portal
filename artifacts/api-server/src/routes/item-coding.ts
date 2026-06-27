import { Router } from "express";
import { pool } from "@workspace/db";
import crypto from "crypto";

const router = Router();

// ── Ensure table exists ───────────────────────────────────────────────────────
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
`).then(() => {
  // Add fingerprint columns if missing (migration)
  return pool.query(`
    ALTER TABLE canonical_items
      ADD COLUMN IF NOT EXISTS fingerprint      JSONB NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT NOT NULL DEFAULT ''
  `);
}).then(() => seedDefaultItems())
  .catch(err => console.error("[item-coding] init failed:", err.message));

// ── Next code generator ───────────────────────────────────────────────────────
async function nextInternalCode(): Promise<string> {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(CAST(internal_code AS BIGINT)), 0) + 1 AS next FROM canonical_items
     WHERE internal_code ~ '^[0-9]+$'`
  );
  const n: number = rows[0]?.next ?? 1;
  return String(n).padStart(11, "0");
}

// ── Product Fingerprint Extractor ─────────────────────────────────────────────
export interface ProductFingerprint {
  category?:   string;
  brand?:      string;
  series?:     string;
  current?:    string;
  poles?:      string;
  voltage?:    string;
  partNumber?: string;
  power?:      string;
  frequency?:  string;
  mounting?:   string;
  auxiliary?:  string;
  type?:       string;
}

const BRAND_MAP: Record<string, string> = {
  "schneider": "Schneider", "شنايدر": "Schneider", "telemecanique": "Schneider",
  "abb": "ABB", "أب": "ABB", "ابب": "ABB",
  "siemens": "Siemens", "سيمنز": "Siemens",
  "ls": "LS", "ال اس": "LS", "elس": "LS",
  "chint": "Chint", "شينت": "Chint",
  "eaton": "Eaton", "ايتون": "Eaton",
  "legrand": "Legrand", "ليغراند": "Legrand",
  "ge": "GE", "general electric": "GE",
  "omron": "Omron", "اومرون": "Omron",
  "phoenix": "Phoenix Contact", "phoenix contact": "Phoenix Contact",
  "weidmuller": "Weidmuller",
  "hager": "Hager",
  "moeller": "Moeller",
  "lovato": "Lovato",
  "carlo gavazzi": "Carlo Gavazzi",
};

const CATEGORY_MAP: Record<string, string> = {
  "contactor": "Contactor", "كونتاكتور": "Contactor", "magnetic contactor": "Contactor",
  "مفتاح مغناطيسي": "Contactor", "كونتاكتر": "Contactor",
  "circuit breaker": "Circuit Breaker", "قاطع": "Circuit Breaker",
  "mcb": "Circuit Breaker", "mccb": "Circuit Breaker", "acb": "Circuit Breaker",
  "قاطع هوائي": "Circuit Breaker", "قاطع كهربائي": "Circuit Breaker",
  "relay": "Relay", "ريلاي": "Relay", "رلي": "Relay", "مرحل": "Relay",
  "overload": "Overload Relay", "overload relay": "Overload Relay",
  "حماية حرارية": "Overload Relay", "بيمتال": "Overload Relay",
  "push button": "Push Button", "زر ضغط": "Push Button", "pushbutton": "Push Button",
  "cable": "Cable", "كابل": "Cable", "wire": "Cable", "سلك": "Cable",
  "transformer": "Transformer", "محول": "Transformer", "ترانس": "Transformer",
  "motor": "Motor", "موتور": "Motor", "محرك": "Motor",
  "switch": "Switch", "مفتاح": "Switch", "سويتش": "Switch",
  "fuse": "Fuse", "فيوز": "Fuse", "صاهر": "Fuse",
  "capacitor": "Capacitor", "كابسيتور": "Capacitor", "مكثف": "Capacitor",
  "inverter": "Inverter", "انفرتر": "Inverter", "vfd": "Inverter",
  "plc": "PLC", "بي ال سي": "PLC",
  "sensor": "Sensor", "سنسور": "Sensor", "حساس": "Sensor",
  "timer": "Timer", "تايمر": "Timer", "مؤقت": "Timer",
  "terminal": "Terminal Block", "ترمينال": "Terminal Block",
  "panel": "Panel", "لوحة": "Panel",
  "light": "Light", "مصباح": "Light", "انديكاتور": "Indicator",
};

function extractFingerprint(text: string): ProductFingerprint {
  const fp: ProductFingerprint = {};
  const t = text.toLowerCase().replace(/[\u200b-\u200d\ufeff]/g, "");

  // ── Brand ──────────────────────────────────────────────────────────────────
  for (const [key, val] of Object.entries(BRAND_MAP)) {
    if (t.includes(key.toLowerCase())) { fp.brand = val; break; }
  }

  // ── Category ───────────────────────────────────────────────────────────────
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (t.includes(key.toLowerCase())) { fp.category = val; break; }
  }

  // ── Current (Amperes) ──────────────────────────────────────────────────────
  const currentMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:a\b|amp|amps|ampere|أمبير|امبير)/i);
  if (currentMatch) fp.current = currentMatch[1] + "A";

  // ── Poles ──────────────────────────────────────────────────────────────────
  const polesMatch = t.match(/(\d)\s*p(?:ole|oles)?(?:\s|$|\b|\()/i)
    || t.match(/(\d)\s*(?:أقطاب|قطب|وجه|فاز|أوجه)/i)
    || t.match(/(?:ثلاثي|3\s*phase|three.phase)/i);
  if (polesMatch) {
    if (/ثلاثي|3\s*phase|three.phase/i.test(t)) fp.poles = "3P";
    else fp.poles = polesMatch[1] + "P";
  }

  // ── Voltage ────────────────────────────────────────────────────────────────
  const voltMatch = t.match(/(\d+(?:\.\d+)?)\s*v(?:ac|dc)?(?:\s|$|\b)/i)
    || t.match(/(\d+(?:\.\d+)?)\s*فولت/i);
  if (voltMatch) {
    const suffix = t.includes("vdc") ? "VDC" : "VAC";
    fp.voltage = voltMatch[1] + suffix;
  }

  // ── Power (KW/HP) ──────────────────────────────────────────────────────────
  const powerMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:kw|kva|hp|كيلو)/i);
  if (powerMatch) fp.power = powerMatch[1].toUpperCase() + (t.includes("hp") ? "HP" : "KW");

  // ── Frequency ─────────────────────────────────────────────────────────────
  const freqMatch = t.match(/(\d+\/\d+|\d+)\s*hz/i);
  if (freqMatch) fp.frequency = freqMatch[1] + "Hz";

  // ── Auxiliary contacts ─────────────────────────────────────────────────────
  const auxMatch = t.match(/(\d+no\+\d+nc|\d+nc\+\d+no)/i);
  if (auxMatch) fp.auxiliary = auxMatch[1].toUpperCase();

  // ── Part Number / Model ────────────────────────────────────────────────────
  const partMatch = t.match(/\b([a-z]{1,5}\d[a-z0-9]{3,12})\b/i);
  if (partMatch) fp.partNumber = partMatch[1].toUpperCase();

  // ── Series ────────────────────────────────────────────────────────────────
  if (/tesy[s]?\s*d/i.test(t)) fp.series = "TeSys D";
  else if (/tesy[s]?\s*e/i.test(t)) fp.series = "TeSys E";
  else if (/tesy[s]?\s*k/i.test(t)) fp.series = "TeSys K";
  else if (/3rt/i.test(t)) fp.series = "Sirius";
  else if (/s-p\d+/i.test(t)) fp.series = "S-T";
  else if (/cjx2/i.test(t)) fp.series = "CJX2";

  // ── Mounting ──────────────────────────────────────────────────────────────
  if (/din\s*rail|din/i.test(t)) fp.mounting = "DIN";

  return fp;
}

function fingerprintHash(fp: ProductFingerprint): string {
  const sorted = Object.keys(fp).sort().map(k => `${k}:${(fp as any)[k]}`).join("|");
  return crypto.createHash("md5").update(sorted).digest("hex").substring(0, 8).toUpperCase();
}

// ── Similarity Calculator ─────────────────────────────────────────────────────
interface MatchResult {
  score:       number;   // 0-100
  decision:    "auto_link" | "confirm" | "new";
  matchedItem: any | null;
}

function calculateSimilarity(fpA: ProductFingerprint, fpB: ProductFingerprint): number {
  // Part number exact match → very high confidence
  if (fpA.partNumber && fpB.partNumber) {
    if (fpA.partNumber === fpB.partNumber) return 97;
  }

  const weights: Record<string, number> = {
    category:   30,
    brand:      20,
    current:    18,
    poles:      12,
    voltage:    10,
    series:      5,
    power:       5,
  };

  let totalWeight = 0;
  let matchWeight = 0;

  for (const [field, weight] of Object.entries(weights)) {
    const a = (fpA as any)[field];
    const b = (fpB as any)[field];
    if (!a || !b) continue; // skip unknown fields
    totalWeight += weight;
    if (a === b) matchWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((matchWeight / totalWeight) * 100);
}

async function matchDescription(description: string): Promise<MatchResult> {
  const fp = extractFingerprint(description);
  const hash = fingerprintHash(fp);

  // First check exact hash match
  const { rows: hashRows } = await pool.query(
    "SELECT * FROM canonical_items WHERE fingerprint_hash = $1 LIMIT 1", [hash]
  );
  if (hashRows.length) return { score: 99, decision: "auto_link", matchedItem: hashRows[0] };

  // Then compare with all items
  const { rows: allItems } = await pool.query(
    "SELECT * FROM canonical_items ORDER BY id"
  );

  let bestScore = 0;
  let bestItem: any = null;

  for (const item of allItems) {
    const itemFp = (item.fingerprint && typeof item.fingerprint === "object")
      ? item.fingerprint as ProductFingerprint
      : extractFingerprint(`${item.description_en} ${item.description_ar}`);
    const score = calculateSimilarity(fp, itemFp);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  let decision: "auto_link" | "confirm" | "new";
  if (bestScore >= 95) decision = "auto_link";
  else if (bestScore >= 70) decision = "confirm";
  else decision = "new";

  return { score: bestScore, decision, matchedItem: decision !== "new" ? bestItem : null };
}

// ── Default seed ──────────────────────────────────────────────────────────────
async function seedDefaultItems() {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) AS cnt FROM canonical_items");
    if (parseInt(rows[0].cnt) > 0) return;
    const defaults = [
      {
        description_en: "Schneider Electric TeSys D Contactor 9A 3P 220VAC Coil LC1D09M7",
        description_ar: "كونتاكتور شنايدر تي سيز D، 9 أمبير، ثلاثي الأوجه، ملف 220 فولت",
        brand: "Schneider", category: "Contactor",
        keywords: ["contactor","LC1D09M7","9A","220VAC","3P"],
      },
      {
        description_en: "Schneider Electric TeSys D Contactor 18A 3P 220VAC Coil LC1D18M7",
        description_ar: "كونتاكتور شنايدر تي سيز D، 18 أمبير، ثلاثي الأوجه، ملف 220 فولت",
        brand: "Schneider", category: "Contactor",
        keywords: ["contactor","LC1D18M7","18A","220VAC","3P"],
      },
      {
        description_en: "Schneider Electric TeSys D Contactor 32A 3P 220VAC Coil LC1D32M7",
        description_ar: "كونتاكتور شنايدر تي سيز D، 32 أمبير، ثلاثي الأوجه، ملف 220 فولت",
        brand: "Schneider", category: "Contactor",
        keywords: ["contactor","LC1D32M7","32A","220VAC","3P"],
      },
      {
        description_en: "Schneider Electric TeSys D Contactor 40A 3P 220VAC Coil LC1D40M7",
        description_ar: "كونتاكتور شنايدر تي سيز D، 40 أمبير، ثلاثي الأوجه، ملف 220 فولت",
        brand: "Schneider", category: "Contactor",
        keywords: ["contactor","LC1D40M7","40A","220VAC","3P"],
      },
    ];
    let counter = 1;
    for (const d of defaults) {
      const fp = extractFingerprint(`${d.description_en} ${d.description_ar}`);
      const hash = fingerprintHash(fp);
      const code = String(counter++).padStart(11, "0");
      await pool.query(
        `INSERT INTO canonical_items
           (internal_code,brand,category,description_ar,description_en,keywords,fingerprint,fingerprint_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (internal_code) DO NOTHING`,
        [code, d.brand, d.category, d.description_ar, d.description_en,
         d.keywords, JSON.stringify(fp), hash]
      );
    }
    console.log("[item-coding] seeded", defaults.length, "default items");
  } catch (err: any) {
    console.error("[item-coding] seed failed:", err.message);
  }
}

// ── GET /api/item-coding/canonical ───────────────────────────────────────────
router.get("/canonical", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM canonical_items ORDER BY internal_code ASC"
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "فشل في جلب القائمة", details: err.message });
  }
});

// ── POST /api/item-coding/canonical ──────────────────────────────────────────
router.post("/canonical", async (req, res) => {
  const {
    brand = "", category = "",
    description_ar = "", description_en = "",
    keywords = [], notes = "",
    internal_code: manualCode,
  } = req.body as any;

  if (!description_ar?.trim() && !description_en?.trim())
    return res.status(400).json({ error: "يجب إدخال توصيف عربي أو إنجليزي" });

  try {
    const fp = extractFingerprint(`${description_en} ${description_ar}`);
    if (brand) fp.brand = brand;
    if (category) fp.category = category;
    const hash = fingerprintHash(fp);
    const code = manualCode?.trim() || await nextInternalCode();

    const { rows } = await pool.query(
      `INSERT INTO canonical_items
         (internal_code,brand,category,description_ar,description_en,keywords,notes,fingerprint,fingerprint_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        code,
        (brand || fp.brand || "").trim(),
        (category || fp.category || "").trim(),
        description_ar.trim(), description_en.trim(),
        Array.isArray(keywords) ? keywords : [],
        notes.trim(),
        JSON.stringify(fp), hash,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "الكود الداخلي موجود بالفعل" });
    res.status(500).json({ error: "فشل في الإضافة", details: err.message });
  }
});

// ── POST /api/item-coding/canonical/bulk ─────────────────────────────────────
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
      const code = item.internal_code?.trim() || await nextInternalCode();
      const kws = Array.isArray(item.keywords) ? item.keywords
        : typeof item.keywords === "string"
          ? item.keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
          : [];
      await pool.query(
        `INSERT INTO canonical_items
           (internal_code,brand,category,description_ar,description_en,keywords,notes,fingerprint,fingerprint_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (internal_code) DO UPDATE SET
           brand=$2,category=$3,description_ar=$4,description_en=$5,
           keywords=$6,notes=$7,fingerprint=$8,fingerprint_hash=$9,updated_at=NOW()`,
        [
          code,
          (item.brand ?? fp.brand ?? "").trim(),
          (item.category ?? fp.category ?? "").trim(),
          (item.description_ar ?? "").trim(), (item.description_en ?? "").trim(),
          kws, (item.notes ?? "").trim(), JSON.stringify(fp), hash,
        ]
      );
      inserted++;
    } catch (err: any) {
      errors.push(`${item.description_en ?? item.description_ar}: ${err.message}`);
    }
  }
  res.json({ inserted, skipped, errors: errors.slice(0, 10) });
});

// ── PUT /api/item-coding/canonical/:id ───────────────────────────────────────
router.put("/canonical/:id", async (req, res) => {
  const id = Number(req.params.id);
  const {
    brand = "", category = "",
    description_ar = "", description_en = "",
    keywords = [], notes = "",
  } = req.body as any;

  try {
    const fp = extractFingerprint(`${description_en} ${description_ar}`);
    if (brand) fp.brand = brand;
    if (category) fp.category = category;
    const hash = fingerprintHash(fp);

    const { rows } = await pool.query(
      `UPDATE canonical_items
       SET brand=$1,category=$2,description_ar=$3,description_en=$4,
           keywords=$5,notes=$6,fingerprint=$7,fingerprint_hash=$8,updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [
        (brand || fp.brand || "").trim(),
        (category || fp.category || "").trim(),
        description_ar.trim(), description_en.trim(),
        Array.isArray(keywords) ? keywords : [],
        notes.trim(), JSON.stringify(fp), hash, id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: "العنصر غير موجود" });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "فشل في التعديل", details: err.message });
  }
});

// ── DELETE /api/item-coding/canonical/:id ────────────────────────────────────
router.delete("/canonical/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rowCount } = await pool.query("DELETE FROM canonical_items WHERE id=$1", [id]);
    if (!rowCount) return res.status(404).json({ error: "العنصر غير موجود" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "فشل في الحذف", details: err.message });
  }
});

// ── POST /api/item-coding/match ──────────────────────────────────────────────
router.post("/match", async (req, res) => {
  const description = String(req.body?.description ?? "").trim();
  if (!description) return res.json({ matched: false, score: 0, decision: "new", item: null, fingerprint: {} });
  try {
    const fp = extractFingerprint(description);
    const result = await matchDescription(description);
    res.json({
      matched:     result.decision !== "new",
      score:       result.score,
      decision:    result.decision,
      item:        result.matchedItem,
      fingerprint: fp,
    });
  } catch (err: any) {
    res.status(500).json({ error: "فشل في المطابقة", details: err.message });
  }
});

// ── POST /api/item-coding/match-bulk ─────────────────────────────────────────
router.post("/match-bulk", async (req, res) => {
  const descriptions: string[] = Array.isArray(req.body?.descriptions) ? req.body.descriptions : [];
  if (!descriptions.length) return res.json([]);
  try {
    const results = await Promise.all(
      descriptions.map(async (desc) => {
        if (!desc?.trim()) return { description: desc, matched: false, score: 0, decision: "new", item: null };
        const result = await matchDescription(desc);
        return {
          description: desc,
          matched:     result.decision !== "new",
          score:       result.score,
          decision:    result.decision,
          item:        result.matchedItem,
        };
      })
    );
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: "فشل في المطابقة", details: err.message });
  }
});

// ── POST /api/item-coding/extract-fingerprint ─────────────────────────────────
router.post("/extract-fingerprint", (req, res) => {
  const description = String(req.body?.description ?? "").trim();
  if (!description) return res.json({});
  const fp = extractFingerprint(description);
  const hash = fingerprintHash(fp);
  res.json({ fingerprint: fp, hash });
});

export default router;
