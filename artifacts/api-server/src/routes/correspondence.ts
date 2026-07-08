import { Router } from "express";
import { db } from "@workspace/db";
import { correspondenceTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();

// ── Gemini client ────────────────────────────────────────────────────────────
function getGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY غير مضبوط");
  return new GoogleGenerativeAI(key);
}

// ── Auto-number helper ───────────────────────────────────────────────────────
async function nextDocNumber(type: string): Promise<string> {
  const prefix =
    type === "memo" ? "MEM" : type === "delegation" ? "DEL" : "COR";
  const year = new Date().getFullYear();

  // count existing docs of same type+year to get next sequence
  const rows = await db
    .select({ id: correspondenceTable.id })
    .from(correspondenceTable)
    .where(sql`type = ${type} AND extract(year from created_at) = ${year}`);

  const seq = String(rows.length + 1).padStart(4, "0");
  return `${prefix}-${year}-${seq}`;
}

// ── POST /api/correspondence/scan  ─────────────────────────────────────────
// Accepts { imageBase64, mimeType } → returns extracted fields via Gemini Vision
router.post("/scan", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", docType = "correspondence" } =
      req.body as { imageBase64: string; mimeType?: string; docType?: string };

    if (!imageBase64) return res.status(400).json({ error: "الصورة مطلوبة" });

    const genAI = getGemini();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `أنت نظام استخراج بيانات من وثائق رسمية عربية.
استخرج المعلومات التالية من الوثيقة في الصورة وأرجعها كـ JSON فقط بدون أي نص إضافي:
{
  "subject": "موضوع الوثيقة أو عنوانها",
  "fromTo": "اسم الجهة المُرسِلة أو الموقِّعة",
  "docDate": "تاريخ الوثيقة بصيغة YYYY-MM-DD إذا وُجد، وإلا null",
  "dueDate": "تاريخ الاستحقاق أو الرد إذا وُجد، وإلا null",
  "refNumber": "رقم الوثيقة أو المرجع إذا وُجد، وإلا null",
  "notes": "أي ملاحظات مهمة أخرى في الوثيقة، مختصرة"
}
إذا لم تجد قيمة لحقل ما اجعله null. أرجع JSON فقط.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType as any,
          data: imageBase64.replace(/^data:[^;]+;base64,/, ""),
        },
      },
    ]);

    const text = result.response.text().trim();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: "تعذّر تحليل الوثيقة، حاول مجدداً" });
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Generate auto doc number
    const docNumber = await nextDocNumber(docType);

    res.json({ ...extracted, docNumber });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: err.message ?? "فشل تحليل الوثيقة" });
  }
});

// ── GET /api/correspondence ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(correspondenceTable)
      .orderBy(desc(correspondenceTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب الوثائق" });
  }
});

// ── POST /api/correspondence ─────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      docNumber, type, direction, subject, fromTo,
      docDate, dueDate, status, priority, notes,
      attachmentUrl, attachmentName,
    } = req.body;

    if (!docNumber?.trim()) return res.status(400).json({ error: "رقم الوثيقة مطلوب" });
    if (!type) return res.status(400).json({ error: "نوع الوثيقة مطلوب" });
    if (!subject?.trim()) return res.status(400).json({ error: "الموضوع مطلوب" });

    const [row] = await db
      .insert(correspondenceTable)
      .values({
        docNumber: docNumber.trim(),
        type,
        direction: direction ?? null,
        subject: subject.trim(),
        fromTo: fromTo?.trim() ?? null,
        docDate: docDate || null,
        dueDate: dueDate || null,
        status: status ?? "open",
        priority: priority ?? "normal",
        notes: notes?.trim() ?? null,
        attachmentUrl: attachmentUrl ?? null,
        attachmentName: attachmentName ?? null,
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إضافة الوثيقة" });
  }
});

// ── PUT /api/correspondence/:id ──────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      docNumber, type, direction, subject, fromTo,
      docDate, dueDate, status, priority, notes,
      attachmentUrl, attachmentName,
    } = req.body;

    if (!docNumber?.trim()) return res.status(400).json({ error: "رقم الوثيقة مطلوب" });
    if (!type) return res.status(400).json({ error: "نوع الوثيقة مطلوب" });
    if (!subject?.trim()) return res.status(400).json({ error: "الموضوع مطلوب" });

    const [updated] = await db
      .update(correspondenceTable)
      .set({
        docNumber: docNumber.trim(),
        type,
        direction: direction ?? null,
        subject: subject.trim(),
        fromTo: fromTo?.trim() ?? null,
        docDate: docDate || null,
        dueDate: dueDate || null,
        status: status ?? "open",
        priority: priority ?? "normal",
        notes: notes?.trim() ?? null,
        attachmentUrl: attachmentUrl ?? null,
        attachmentName: attachmentName ?? null,
      })
      .where(eq(correspondenceTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "الوثيقة غير موجودة" });
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في تعديل الوثيقة" });
  }
});

// ── DELETE /api/correspondence/:id ──────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(correspondenceTable).where(eq(correspondenceTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في حذف الوثيقة" });
  }
});

export default router;
