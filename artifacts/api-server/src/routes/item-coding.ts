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
  `).then(() => pool.query(`
      ALTER TABLE canonical_items
        ADD COLUMN IF NOT EXISTS fingerprint      JSONB NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT NOT NULL DEFAULT ''
    `))
    .then(() => seedDefaultItems())
    .catch(err => console.error("[item-coding] init failed:", err.message));

  // ── Category → Code Prefix Map ────────────────────────────────────────────────
  const CATEGORY_PREFIX_MAP: Record<string, string> = {
    "Contactor":       "EL-CON",
    "Circuit Breaker": "EL-CB",
    "Relay":           "EL-REL",
    "Overload Relay":  "EL-OVR",
    "Push Button":     "EL-PB",
    "Cable":           "EL-CAB",
    "Transformer":     "EL-TRF",
    "Motor":           "ME-MOT",
    "Switch":          "EL-SWT",
    "Fuse":            "EL-FUS",
    "Capacitor":       "EL-CAP",
    "Inverter":        "EL-INV",
    "PLC":             "EL-PLC",
    "Sensor":          "IN-SEN",
    "Timer":           "EL-TIM",
    "Terminal Block":  "EL-TB",
    "Panel":           "EL-PNL",
    "Indicator":       "EL-IND",
    "Light":           "EL-LGT",
  };

  async function nextInternalCode(category?: string): Promise<string> {
    const prefix = (category && CATEGORY_PREFIX_MAP[category]) ?? "GEN-ITM";
    const { rows } = await pool.query(
      "SELECT COUNT(*) AS cnt FROM canonical_items WHERE internal_code LIKE $1",
      [prefix + "-%"]
    );
    const n = parseInt(rows[0]?.cnt ?? "0", 10) + 1;
    return `${prefix}-${String(n).padStart(6, "0")}`;
  }

  // ── Product Fingerprint ────────────────────────────────────────────────────────
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
    "ls": "LS", "ال اس": "LS",
    "chint": "Chint", "شينت": "Chint",
    "eaton": "Eaton", "ايتون": "Eaton",
    "legrand": "Legrand", "ليغراند": "Legrand",
    "ge": "GE", "general electric": "GE",
    "omron": "Omron", "اومرون": "Omron",
    "phoenix contact": "Phoenix Contact", "phoenix": "Phoenix Contact",
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

    for (const [key, val] of Object.entries(BRAND_MAP)) {
      if (t.includes(key.toLowerCase())) { fp.brand = val; break; }
    }
    for (const [key, val] of Object.entries(CATEGORY_MAP)) {
      if (t.includes(key.toLowerCase())) { fp.category = val; break; }
    }

    const currentMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:a\b|amp|amps|ampere|أمبير|امبير)/i);
    if (currentMatch) fp.current = currentMatch[1] + "A";

    const polesMatch = t.match(/(\d)\s*p(?:ole|oles)?(?:\s|$|\b|\()/i)
      || t.match(/(\d)\s*(?:أقطاب|قطب|وجه|فاز|أوجه)/i)
      || t.match(/(?:ثلاثي|3\s*phase|three.phase)/i);
    if (polesMatch) {
      if (/ثلاثي|3\s*phase|three.phase/i.test(t)) fp.poles = "3P";
      else fp.poles = polesMatch[1] + "P";
    }

    const voltMatch = t.match(/(\d+(?:\.\d+)?)\s*v(?:ac|dc)?(?:\s|$|\b)/i)
      || t.match(/(\d+(?:\.\d+)?)\s*فولت/i);
    if (voltMatch) {
      const suffix = t.includes("vdc") ? "VDC" : "VAC";
      fp.voltage = voltMatch[1] + suffix;
    }

    const powerMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:kw|kva|hp|كيلو)/i);
    if (powerMatch) fp.power = powerMatch[1].toUpperCase() + (t.includes("hp") ? "HP" : "KW");

    const freqMatch = t.match(/(\d+\/\d+|\d+)\s*hz/i);
    if (freqMatch) fp.frequency = freqMatch[1] + "Hz";

    const auxMatch = t.match(/(\d+no\+\d+nc|\d+nc\+\d+no)/i);
    if (auxMatch) fp.auxiliary = auxMatch[1].toUpperCase();

    const partMatch = t.match(/\b([a-z]{1,5}\d[a-z0-9]{3,12})\b/i);
    if (partMatch) fp.partNumber = partMatch[1].toUpperCase();

    if (/tesy[s]?\s*d/i.test(t)) fp.series = "TeSys D";
    else if (/tesy[s]?\s*e/i.test(t)) fp.series = "TeSys E";
    else if (/tesy[s]?\s*k/i.test(t)) fp.series = "TeSys K";
    else if (/3rt/i.test(t)) fp.series = "Sirius";
    else if (/cjx2/i.test(t)) fp.series = "CJX2";

    if (/din\s*rail|din/i.test(t)) fp.mounting = "DIN";

    return fp;
  }

  function fingerprintHash(fp: ProductFingerprint): string {
    const sorted = Object.keys(fp).sort().map(k => `${k}:${(fp as any)[k]}`).join("|");
    return crypto.createHash("md5").update(sorted).digest("hex").substring(0, 8).toUpperCase();
  }

  // ── Gemini AI Matching ────────────────────────────────────────────────────────
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
  const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

  interface GeminiMatchResult {
    score: number;
    reasoning: string;
    extractedFingerprint: ProductFingerprint;
  }

  async function geminiMatch(
    inputDescription: string,
    inputFp: ProductFingerprint,
    candidateItem: { description_en: string; description_ar: string; internal_code: string; fingerprint: ProductFingerprint }
  ): Promise<GeminiMatchResult> {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

    const prompt = `You are a procurement item matching engine. Your job is to compare two product descriptions and determine if they refer to the same physical product.

  INPUT DESCRIPTION:
  "${inputDescription}"

  EXTRACTED FINGERPRINT (input):
  ${JSON.stringify(inputFp, null, 2)}

  CANDIDATE ITEM IN DATABASE:
  Code: ${candidateItem.internal_code}
  Description EN: ${candidateItem.description_en}
  Description AR: ${candidateItem.description_ar}
  Fingerprint: ${JSON.stringify(candidateItem.fingerprint, null, 2)}

  TASK:
  1. Compare the two products based on their technical specifications (category, brand, current rating, poles, voltage, part number, series, etc.)
  2. Give a similarity score from 0 to 100:
     - 95-100: Definitely the same product (same specs, same part number or clearly identical)
     - 80-94: Likely the same product (most specs match, minor description differences)
     - 0-79: Different product (different specs, different ratings, or unclear)
  3. Also extract a refined fingerprint from the input description.

  Respond ONLY with valid JSON in this exact format:
  {
    "score": <number 0-100>,
    "reasoning": "<brief explanation in Arabic, max 80 chars>",
    "extractedFingerprint": {
      "category": "<if found>",
      "brand": "<if found>",
      "series": "<if found>",
      "current": "<e.g. 32A>",
      "poles": "<e.g. 3P>",
      "voltage": "<e.g. 220VAC>",
      "partNumber": "<if found>",
      "power": "<if found>",
      "frequency": "<if found>",
      "mounting": "<if found>",
      "auxiliary": "<if found>"
    }
  }`;

    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errText.substring(0, 200)}`);
    }

    const data = await res.json() as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text);

    return {
      score: Number(parsed.score ?? 0),
      reasoning: String(parsed.reasoning ?? ""),
      extractedFingerprint: parsed.extractedFingerprint ?? inputFp,
    };
  }

  async function geminiExtractFingerprint(description: string): Promise<ProductFingerprint> {
    if (!GEMINI_API_KEY) return extractFingerprint(description);

    const prompt = `You are a procurement item attribute extractor. Extract technical specifications from this product description.

  DESCRIPTION: "${description}"

  Extract these attributes if present:
  - category: product type in English (e.g. "Contactor", "Circuit Breaker", "Relay", "Overload Relay", "Push Button", "Cable", "Transformer", "Motor", "Switch", "Fuse", "Capacitor", "Inverter", "PLC", "Sensor", "Timer", "Terminal Block")
  - brand: manufacturer name in English (e.g. "Schneider", "ABB", "Siemens", "LS", "Chint")
  - series: product series (e.g. "TeSys D", "Sirius", "CJX2")
  - current: current rating with unit (e.g. "32A", "9A", "50A")
  - poles: number of poles (e.g. "3P", "4P", "1P")
  - voltage: voltage with type (e.g. "220VAC", "24VDC", "380VAC")
  - partNumber: model/part number (e.g. "LC1D32M7", "3RT2036")
  - power: power rating (e.g. "15KW", "5HP")
  - frequency: frequency (e.g. "50Hz", "50/60Hz")
  - mounting: mounting type (e.g. "DIN")
  - auxiliary: auxiliary contacts (e.g. "1NO+1NC")

  Respond ONLY with valid JSON. Omit fields not found in the description:
  {
    "category": "...",
    "brand": "...",
    "current": "...",
    "poles": "...",
    "voltage": "...",
    "partNumber": "..."
  }`;

    try {
      const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 512,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) return extractFingerprint(description);
      const data = await res.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsed = JSON.parse(text);
      // Remove empty string values
      const fp: ProductFingerprint = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v && String(v).trim()) (fp as any)[k] = v;
      }
      return fp;
    } catch {
      return extractFingerprint(description);
    }
  }

  // ── Match Engine (Gemini-powered with rule-based fallback) ────────────────────
  interface MatchResult {
    score:       number;
    decision:    "auto_link" | "confirm" | "new";
    matchedItem: any | null;
    reasoning?:  string;
    method?:     "gemini" | "fingerprint" | "hash";
  }

  function ruleBasedSimilarity(fpA: ProductFingerprint, fpB: ProductFingerprint): number {
    if (fpA.partNumber && fpB.partNumber && fpA.partNumber === fpB.partNumber) return 97;

    const weights: Record<string, number> = {
      category: 30, brand: 20, current: 18, poles: 12, voltage: 10, series: 5, power: 5,
    };
    let totalWeight = 0;
    let matchWeight = 0;
    for (const [field, weight] of Object.entries(weights)) {
      const a = (fpA as any)[field];
      const b = (fpB as any)[field];
      if (!a || !b) continue;
      totalWeight += weight;
      if (a === b) matchWeight += weight;
    }
    if (totalWeight === 0) return 0;
    return Math.round((matchWeight / totalWeight) * 100);
  }

  async function matchDescription(description: string): Promise<MatchResult> {
    const localFp = extractFingerprint(description);
    const hash = fingerprintHash(localFp);

    // 1. Exact fingerprint hash → instant auto-link (no Gemini needed)
    const { rows: hashRows } = await pool.query(
      "SELECT * FROM canonical_items WHERE fingerprint_hash = $1 LIMIT 1", [hash]
    );
    if (hashRows.length) {
      return { score: 99, decision: "auto_link", matchedItem: hashRows[0], method: "hash" };
    }

    // 2. Load all candidates
    const { rows: allItems } = await pool.query(
      "SELECT * FROM canonical_items ORDER BY id"
    );
    if (!allItems.length) {
      return { score: 0, decision: "new", matchedItem: null, method: "fingerprint" };
    }

    // 3. Rule-based pre-filter: find top 3 candidates
    const scored = allItems.map(item => {
      const itemFp = (item.fingerprint && typeof item.fingerprint === "object")
        ? item.fingerprint as ProductFingerprint
        : extractFingerprint(`${item.description_en} ${item.description_ar}`);
      return { item, score: ruleBasedSimilarity(localFp, itemFp), fp: itemFp };
    }).sort((a, b) => b.score - a.score);

    const bestRuleBased = scored[0];

    // 4. If Gemini is available, use it for the top candidate
    if (GEMINI_API_KEY && bestRuleBased.score >= 30) {
      try {
        const geminiResult = await geminiMatch(description, localFp, {
          description_en: bestRuleBased.item.description_en,
          description_ar: bestRuleBased.item.description_ar,
          internal_code:  bestRuleBased.item.internal_code,
          fingerprint:    bestRuleBased.fp,
        });

        const score = geminiResult.score;
        let decision: "auto_link" | "confirm" | "new";
        if (score >= 95) decision = "auto_link";
        else if (score >= 80) decision = "confirm";
        else decision = "new";

        return {
          score,
          decision,
          matchedItem: decision !== "new" ? bestRuleBased.item : null,
          reasoning:   geminiResult.reasoning,
          method:      "gemini",
        };
      } catch (err: any) {
        console.error("[item-coding] Gemini match failed, falling back to rule-based:", err.message);
      }
    }

    // 5. Fallback: rule-based only
    const score = bestRuleBased.score;
    let decision: "auto_link" | "confirm" | "new";
    if (score >= 95) decision = "auto_link";
    else if (score >= 80) decision = "confirm";
    else decision = "new";

    return {
      score,
      decision,
      matchedItem: decision !== "new" ? bestRuleBased.item : null,
      method: "fingerprint",
    };
  }

  // ── Seed ──────────────────────────────────────────────────────────────────────
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

  // ── Routes ────────────────────────────────────────────────────────────────────

  router.get("/canonical", async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT * FROM canonical_items ORDER BY internal_code ASC");
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: "فشل في جلب القائمة", details: err.message });
    }
  });

  router.post("/canonical", async (req, res) => {
    const { brand = "", category = "", description_ar = "", description_en = "", keywords = [], notes = "", internal_code: manualCode } = req.body as any;
    if (!description_ar?.trim() && !description_en?.trim())
      return res.status(400).json({ error: "يجب إدخال توصيف عربي أو إنجليزي" });

    try {
      const fp = GEMINI_API_KEY
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
        const kws = Array.isArray(item.keywords) ? item.keywords
          : typeof item.keywords === "string" ? item.keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : [];
        await pool.query(
          `INSERT INTO canonical_items (internal_code,brand,category,description_ar,description_en,keywords,notes,fingerprint,fingerprint_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (internal_code) DO UPDATE SET brand=$2,category=$3,description_ar=$4,description_en=$5,
             keywords=$6,notes=$7,fingerprint=$8,fingerprint_hash=$9,updated_at=NOW()`,
          [code, (item.brand ?? fp.brand ?? "").trim(), resolvedCategory,
           (item.description_ar ?? "").trim(), (item.description_en ?? "").trim(),
           kws, (item.notes ?? "").trim(), JSON.stringify(fp), hash]
        );
        inserted++;
      } catch (err: any) {
        errors.push(`${item.description_en ?? item.description_ar}: ${err.message}`);
      }
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
        `UPDATE canonical_items SET brand=$1,category=$2,description_ar=$3,description_en=$4,
           keywords=$5,notes=$6,fingerprint=$7,fingerprint_hash=$8,updated_at=NOW() WHERE id=$9 RETURNING *`,
        [(brand || fp.brand || "").trim(), (category || fp.category || "").trim(),
         description_ar.trim(), description_en.trim(), Array.isArray(keywords) ? keywords : [],
         notes.trim(), JSON.stringify(fp), hash, id]
      );
      if (!rows[0]) return res.status(404).json({ error: "العنصر غير موجود" });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: "فشل في التعديل", details: err.message });
    }
  });

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

  router.post("/match", async (req, res) => {
    const description = String(req.body?.description ?? "").trim();
    if (!description) return res.json({ matched: false, score: 0, decision: "new", item: null, fingerprint: {}, method: "none" });
    try {
      const fp = GEMINI_API_KEY
        ? await geminiExtractFingerprint(description)
        : extractFingerprint(description);
      const result = await matchDescription(description);
      res.json({
        matched:     result.decision !== "new",
        score:       result.score,
        decision:    result.decision,
        item:        result.matchedItem,
        fingerprint: fp,
        reasoning:   result.reasoning ?? null,
        method:      result.method ?? "fingerprint",
      });
    } catch (err: any) {
      res.status(500).json({ error: "فشل في المطابقة", details: err.message });
    }
  });

  router.post("/match-bulk", async (req, res) => {
    const descriptions: string[] = Array.isArray(req.body?.descriptions) ? req.body.descriptions : [];
    if (!descriptions.length) return res.json([]);
    try {
      const results = await Promise.all(
        descriptions.map(async (desc) => {
          if (!desc?.trim()) return { description: desc, matched: false, score: 0, decision: "new", item: null };
          const result = await matchDescription(desc);
          return { description: desc, matched: result.decision !== "new", score: result.score, decision: result.decision, item: result.matchedItem };
        })
      );
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: "فشل في المطابقة", details: err.message });
    }
  });

  router.post("/extract-fingerprint", async (req, res) => {
    const description = String(req.body?.description ?? "").trim();
    if (!description) return res.json({});
    try {
      const fp = GEMINI_API_KEY
        ? await geminiExtractFingerprint(description)
        : extractFingerprint(description);
      const hash = fingerprintHash(fp);
      res.json({ fingerprint: fp, hash, method: GEMINI_API_KEY ? "gemini" : "rule-based" });
    } catch (err: any) {
      const fp = extractFingerprint(description);
      res.json({ fingerprint: fp, hash: fingerprintHash(fp), method: "rule-based" });
    }
  });

  export default router;
  