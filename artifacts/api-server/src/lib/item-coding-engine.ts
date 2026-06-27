import crypto from "crypto";
  import { pool } from "@workspace/db";

  // ── Types ──────────────────────────────────────────────────────────────────

  export interface ProductFingerprint {
    brand?: string;
    category?: string;
    model?: string;
    partNo?: string;
    voltage?: string;
    current?: string;
    power?: string;
    poles?: string;
    coilVoltage?: string;
    rating?: string;
    size?: string;
    color?: string;
    material?: string;
    keywords?: string[];
    [key: string]: string | string[] | undefined;
  }

  // ── Category prefix map ────────────────────────────────────────────────────

  export const CATEGORY_PREFIX_MAP: Record<string, string> = {
    "Contactor":         "CON",
    "Relay":             "REL",
    "Circuit Breaker":   "CB",
    "Motor":             "MOT",
    "Cable":             "CAB",
    "Switch":            "SW",
    "Transformer":       "TRF",
    "Sensor":            "SEN",
    "PLC":               "PLC",
    "Drive":             "DRV",
    "Inverter":          "INV",
    "Panel":             "PNL",
    "Meter":             "MET",
    "Fuse":              "FUS",
    "Terminal":          "TRM",
    "Button":            "BTN",
    "Lamp":              "LMP",
    "Breaker":           "BKR",
    "Overload":          "OVL",
    "Capacitor":         "CAP",
    "Resistor":          "RES",
    "Connector":         "CNC",
    "Duct":              "DCT",
    "Rail":              "RAL",
    "Enclosure":         "ENC",
    "Battery":           "BAT",
    "UPS":               "UPS",
    "Pump":              "PMP",
    "Valve":             "VLV",
    "Pipe":              "PIP",
    "Fitting":           "FIT",
    "Filter":            "FLT",
    "Fan":               "FAN",
    "HVAC":              "HVC",
  };

  const DEFAULT_PREFIX = "GEN";

  // ── Rule-based fingerprint extractor ──────────────────────────────────────

  export function extractFingerprint(text: string): ProductFingerprint {
    const fp: ProductFingerprint = {};
    const t = text.trim();

    // Brand detection (common brands in electrical/automation sector)
    const brands = [
      "Schneider", "ABB", "Siemens", "Legrand", "Eaton", "Omron", "Phoenix Contact",
      "Rockwell", "Allen Bradley", "Allen-Bradley", "Mitsubishi", "Yokogawa", "Honeywell",
      "Emerson", "Danfoss", "Wago", "Beckhoff", "Moxa", "Advantech", "Delta", "LS",
      "Hager", "Gewiss", "Clipsal", "MK Electric", "Rexel", "Havells", "Prayog",
      "General Electric", "GE", "Fuji", "Chint", "Delixi", "Lovato",
    ];
    for (const b of brands) {
      if (new RegExp("\\b" + b + "\\b", "i").test(t)) { fp.brand = b; break; }
    }

    // Current rating (e.g., 9A, 18A, 100A, 9 A)
    const currentMatch = t.match(/\b(\d+(?:\.\d+)?)\ ?[Aa](?:\b|mpere|mp)/);
    if (currentMatch) fp.current = currentMatch[1] + "A";

    // Voltage (e.g., 220VAC, 24VDC, 380V, 230 V)
    const voltageMatch = t.match(/\b(\d+(?:\.\d+)?)\ ?[Vv](?:AC|DC|ac|dc)?(?:\b|olt)/);
    if (voltageMatch) fp.voltage = voltageMatch[1] + "V";

    // Poles (3P, 4P, 1P)
    const polesMatch = t.match(/\b([1-4])\ ?[Pp](?:ole|hase|\b)/);
    if (polesMatch) fp.poles = polesMatch[1] + "P";

    // Coil voltage (if separate from main voltage)
    const coilMatch = t.match(/coil\ *(\d+)\ ?[Vv]/i);
    if (coilMatch) fp.coilVoltage = coilMatch[1] + "V";

    // Part/Model number pattern (alphanumeric code like LC1D09M7, 3RT2015, etc.)
    const partMatch = t.match(/\b([A-Z]{1,4}[0-9][A-Z0-9]{3,14})\b/);
    if (partMatch) fp.partNo = partMatch[1];

    // Power (kW or W)
    const powerMatch = t.match(/\b(\d+(?:\.\d+)?)\ ?[kK]?[Ww]\b/);
    if (powerMatch) fp.power = powerMatch[0].trim();

    // Category detection from keywords
    const categoryMap: [RegExp, string][] = [
      [/contactor|كونتاكتور/i,           "Contactor"],
      [/relay|ريلاي|رلاي/i,              "Relay"],
      [/circuit\ breaker|MCB|MCCB|قاطع/i, "Circuit Breaker"],
      [/overload|overload\ relay/i,    "Overload"],
      [/motor|موتور/i,                  "Motor"],
      [/cable|كابل/i,                   "Cable"],
      [/switch|مفتاح/i,                 "Switch"],
      [/transformer|محول/i,             "Transformer"],
      [/sensor|حساس/i,                  "Sensor"],
      [/PLC/i,                          "PLC"],
      [/drive|inverter|انفيرتر/i,       "Drive"],
      [/panel|لوحة/i,                   "Panel"],
      [/meter|عداد/i,                   "Meter"],
      [/fuse|فيوز/i,                    "Fuse"],
      [/terminal|ترمينال/i,             "Terminal"],
      [/button|push\ ?button|زر/i,     "Button"],
      [/lamp|light|indicator|إشارة/i,   "Lamp"],
      [/capacitor|كثافة/i,              "Capacitor"],
      [/filter|فلتر/i,                  "Filter"],
    ];
    for (const [re, cat] of categoryMap) {
      if (re.test(t)) { fp.category = cat; break; }
    }

    // Keywords: meaningful words (length > 2, not common stopwords)
    const stopwords = new Set(["the","and","for","with","من","في","على","مع","إلى","the","a","an"]);
    fp.keywords = t.split(/[\s,;]+/)
      .map(w => w.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "").toLowerCase())
      .filter(w => w.length > 2 && !stopwords.has(w));

    return fp;
  }

  // ── Fingerprint hash ───────────────────────────────────────────────────────

  export function fingerprintHash(fp: ProductFingerprint): string {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fp)) {
      if (v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) {
        normalized[k] = Array.isArray(v) ? [...v].sort() : v;
      }
    }
    return crypto.createHash("md5").update(JSON.stringify(normalized)).digest("hex");
  }

  // ── Gemini fingerprint extractor ───────────────────────────────────────────

  export async function geminiExtractFingerprint(text: string): Promise<ProductFingerprint> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return extractFingerprint(text);

    try {
      const prompt = `Extract structured product information from this description and return ONLY a JSON object with these optional fields: brand, category, model, partNo, voltage, current, power, poles, coilVoltage, rating, size, keywords (array of strings).

  Description: ${text}

  Return only valid JSON, no markdown.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
          }),
        }
      );
      const data = await res.json() as any;
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return extractFingerprint(text);
      const parsed = JSON.parse(jsonMatch[0]) as ProductFingerprint;
      return parsed;
    } catch {
      return extractFingerprint(text);
    }
  }

  // ── Next internal code ────────────────────────────────────────────────────

  export async function nextInternalCode(category?: string): Promise<string> {
    const prefix = (category && CATEGORY_PREFIX_MAP[category]) ? CATEGORY_PREFIX_MAP[category] : DEFAULT_PREFIX;

    try {
      // Find the max existing sequence number for this prefix
      const { rows } = await pool.query<{ max_seq: string | null }>(
        `SELECT MAX(CAST(REGEXP_REPLACE(internal_code, '^[A-Z]+-', '') AS INTEGER)) AS max_seq
         FROM canonical_items
         WHERE internal_code ~ ('^' || $1 || '-[0-9]+$')`,
        [prefix]
      );
      const maxSeq = parseInt(rows[0]?.max_seq ?? "0", 10) || 0;
      const nextSeq = String(maxSeq + 1).padStart(6, "0");
      return `${prefix}-${nextSeq}`;
    } catch {
      const ts = Date.now().toString().slice(-6);
      return `${prefix}-${ts}`;
    }
  }

  // ── Match description against canonical items ─────────────────────────────

  export async function matchDescription(description: string): Promise<{
    decision: "exact" | "close" | "review" | "new";
    score: number;
    matchedItem: Record<string, unknown> | null;
    reasoning?: string;
    method?: string;
  }> {
    if (!description.trim()) {
      return { decision: "new", score: 0, matchedItem: null, method: "none" };
    }

    const fp = process.env.GEMINI_API_KEY
      ? await geminiExtractFingerprint(description)
      : extractFingerprint(description);

    const hash = fingerprintHash(fp);
    const desc = description.trim().toLowerCase();

    try {
      // 1. Exact fingerprint hash match
      const { rows: exactRows } = await pool.query(
        "SELECT * FROM canonical_items WHERE fingerprint_hash = $1 LIMIT 1",
        [hash]
      );
      if (exactRows[0]) {
        return { decision: "exact", score: 1.0, matchedItem: exactRows[0], method: "fingerprint-exact" };
      }

      // 2. Score-based similarity match
      const { rows: candidates } = await pool.query<Record<string, unknown>>(
        `SELECT *,
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
                SELECT COUNT(*)::int
                FROM unnest(keywords) k
                WHERE LENGTH(k) > 2 AND $2 ILIKE '%' || LOWER(k) || '%'
              ), 0)
            + CASE WHEN brand IS NOT NULL AND $2 ILIKE '%' || LOWER(brand) || '%' THEN 3 ELSE 0 END
            + CASE WHEN fingerprint->>'current' IS NOT NULL AND $2 ILIKE '%' || (fingerprint->>'current') || '%' THEN 2 ELSE 0 END
            + CASE WHEN fingerprint->>'voltage' IS NOT NULL AND $2 ILIKE '%' || (fingerprint->>'voltage') || '%' THEN 2 ELSE 0 END
          ) AS match_score
         FROM canonical_items
         WHERE
           LOWER(description_en) ILIKE $1
           OR LOWER(description_ar) ILIKE $1
           OR $2 ILIKE '%' || LOWER(description_en) || '%'
           OR $2 ILIKE '%' || LOWER(description_ar) || '%'
           OR brand ILIKE $3
           OR EXISTS (
             SELECT 1 FROM unnest(keywords) k
             WHERE LENGTH(k) > 2 AND $2 ILIKE '%' || LOWER(k) || '%'
           )
         ORDER BY match_score DESC
         LIMIT 5`,
        [`%${desc}%`, desc, `%${fp.brand ?? "____NOMATCH____"}%`]
      );

      if (!candidates[0]) {
        return { decision: "new", score: 0, matchedItem: null, method: "no-candidates" };
      }

      const topScore = Number((candidates[0] as any).match_score);

      // Normalize score to 0-1 range (max theoretical score ~30)
      const normalized = Math.min(topScore / 25, 1.0);

      if (normalized >= 0.8 || topScore >= 20) {
        return { decision: "exact", score: normalized, matchedItem: candidates[0], method: "similarity-high", reasoning: `score=${topScore}` };
      } else if (normalized >= 0.4 || topScore >= 8) {
        return { decision: "close", score: normalized, matchedItem: candidates[0], method: "similarity-medium", reasoning: `score=${topScore}` };
      } else if (topScore >= 3) {
        return { decision: "review", score: normalized, matchedItem: candidates[0], method: "similarity-low", reasoning: `score=${topScore}` };
      }

      return { decision: "new", score: 0, matchedItem: null, method: "below-threshold" };
    } catch (err: any) {
      return { decision: "new", score: 0, matchedItem: null, method: "error", reasoning: err.message };
    }
  }
  