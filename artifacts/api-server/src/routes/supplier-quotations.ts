import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import {
  supplierQuotationsTable,
  supplierQuotationItemsTable,
  supplierQuotationSuppliersTable,
  supplierQuotationItemPricesTable,
  customerQuotationsTable,
  customerQuotationItemsTable,
  customersTable,
  suppliersTable,
  companySettingsTable,
  employeesTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, desc, inArray, or, ilike, and } from "drizzle-orm";

const router = Router();

function fmtQty(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  const n = parseFloat(String(val));
  if (isNaN(n)) return String(val ?? "");
  return n % 1 === 0 ? String(Math.round(n)) : String(parseFloat(n.toFixed(10)));
}

function generateRfqNo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SQ-${y}${m}${d}-${rand}`;
}

// ─── Message builder ────────────────────────────────────────────────────────
function buildWhatsAppText(
  rfqNo: string,
  requestDate: string,
  companyName: string,
  items: { description: string; partNo: string; quantity: string; unit: string }[],
  rfqLink: string
): string {
  const lines = items
    .map(
      (item, idx) =>
        `${idx + 1}. ${item.description}${item.partNo ? ` | رقم القطعة: ${item.partNo}` : ""} — الكمية: ${item.quantity} ${item.unit || ""}`.trim()
    )
    .join("\n");
  const linkLine = rfqLink
    ? `\n\n🔗 *رابط إدخال الأسعار إلكترونياً:*\n${rfqLink}`
    : "";
  return `🔷 *طلب تسعير - ${rfqNo}*\n📅 التاريخ: ${requestDate}\n\nالسادة / ${companyName}\n\nنرجو تفضلكم بتقديم عرض سعر للبنود التالية:\n\n${lines}${linkLine}\n\nشاكرين لكم حسن تعاونكم 🙏`;
}

function buildEmailHtml(
  rfqNo: string,
  requestDate: string,
  companyName: string,
  companyFromName: string,
  items: { description: string; partNo: string; customerItemCode: string; unit: string; quantity: string }[],
  rfqLink: string,
  notes: string
): string {
  const itemRows = items
    .map(
      (item, idx) => `
    <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"}">
      <td style="padding:8px 12px;border-bottom:1px solid #e8e8e8;text-align:center;color:#64748b">${idx + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e8e8;font-weight:500">${item.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e8e8;color:#64748b;text-align:center">${item.partNo || "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e8e8;color:#64748b;text-align:center">${item.unit || "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e8e8;text-align:center;font-weight:600">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e8e8e8;text-align:center;color:#94a3b8">____</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>طلب تسعير - ${rfqNo}</title></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;direction:rtl">
<div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#0f2240;padding:28px 32px">
    <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:bold">طلب تسعير</h1>
    <p style="margin:6px 0 0;font-size:13px;color:#94a3b8">${companyFromName}</p>
  </div>
  <div style="padding:28px 32px">
    <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;margin-bottom:20px">
      <p style="margin:0;font-size:12px;color:#3b82f6;font-weight:bold">رقم طلب التسعير</p>
      <p style="margin:4px 0 0;font-size:20px;font-family:monospace;font-weight:bold;color:#1e3a8a">${rfqNo}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr>
        <td style="padding:6px 0;color:#64748b;font-size:13px">التاريخ:</td>
        <td style="padding:6px 0;font-weight:600;font-size:13px">${requestDate}</td>
        <td style="padding:6px 0;color:#64748b;font-size:13px">عدد البنود:</td>
        <td style="padding:6px 0;font-weight:600;font-size:13px">${items.length} بند</td>
      </tr>
    </table>
    <div style="background:#eaf2ff;border-radius:8px;padding:12px 16px;margin-bottom:20px">
      <p style="margin:0;font-size:11px;color:#0064d9;font-weight:bold">مقدم إلى</p>
      <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0a3060">${companyName}</p>
    </div>
    <p style="font-size:14px;color:#334155;margin-bottom:16px">نرجو تفضلكم بتقديم عرض سعر للبنود التالية:</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead>
        <tr style="background:#0f2240">
          <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:center;width:32px">#</th>
          <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:right">الوصف</th>
          <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:center">رقم القطعة</th>
          <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:center">الوحدة</th>
          <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:center">الكمية</th>
          <th style="padding:10px 12px;color:#fff;font-size:12px;text-align:center">سعر الوحدة</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    ${rfqLink ? `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin-bottom:20px">
      <p style="margin:0;font-size:12px;font-weight:bold;color:#166534">🔗 رابط إدخال الأسعار إلكترونياً</p>
      <a href="${rfqLink}" style="color:#0064d9;font-size:13px;word-break:break-all;display:block;margin-top:6px">${rfqLink}</a>
      <p style="margin:8px 0 0;font-size:11px;color:#64748b">انقر على الرابط لإدخال أسعارك مباشرةً بشكل إلكتروني</p>
    </div>` : ""}
    ${notes ? `<div style="background:#fffbea;border:1px solid #e8d87a;border-radius:8px;padding:12px 16px;margin-bottom:20px"><p style="margin:0;font-size:13px"><strong>ملاحظات:</strong> ${notes}</p></div>` : ""}
    <p style="font-size:13px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:8px">يرجى الرد في أقرب وقت ممكن — نشكر حسن تعاونكم</p>
  </div>
</div>
</body>
</html>`;
}

// ─── PDF Generator ──────────────────────────────────────────────────────────
let _arabicFontCache: Buffer | null = null;
async function getArabicFont(): Promise<Buffer | null> {
  if (_arabicFontCache) return _arabicFontCache;
  try {
    // Amiri is a high-quality Arabic calligraphy font (SIL Open Font License)
    const res = await fetch(
      "https://github.com/aliftype/amiri/raw/refs/heads/main/fonts/Amiri-Regular.ttf",
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      _arabicFontCache = Buffer.from(await res.arrayBuffer());
      return _arabicFontCache;
    }
  } catch {}
  // Fallback: try jsDelivr mirror
  try {
    const res2 = await fetch(
      "https://cdn.jsdelivr.net/gh/aliftype/amiri@main/fonts/Amiri-Regular.ttf",
      { signal: AbortSignal.timeout(8000) }
    );
    if (res2.ok) {
      _arabicFontCache = Buffer.from(await res2.arrayBuffer());
      return _arabicFontCache;
    }
  } catch {}
  return null;
}

async function generateRfqPdf(opts: {
  rfqNo: string;
  requestDate: string;
  companyName: string;
  supplierName: string;
  items: { description: string; partNo?: string | null; unit?: string | null; quantity: string }[];
  senderName: string;
  senderPhone: string;
  notes?: string;
}): Promise<Buffer> {
  const { rfqNo, requestDate, companyName, supplierName, items, senderName, senderPhone, notes } = opts;

  // Dynamic import so esbuild can resolve at runtime
  // Use require() via the globalThis.require set in the esbuild banner (more reliable than dynamic import for CJS modules)
    const _req = (globalThis as any).require as NodeRequire;
    const PDFDocument = _req("pdfkit") as any;
  const fontBuffer = await getArabicFont();

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const margin = 40;
    const contentW = W - margin * 2;

    // Register Arabic font if available
    if (fontBuffer) {
      doc.registerFont("Arabic", fontBuffer);
    }
    const font = fontBuffer ? "Arabic" : "Helvetica";

    // ── Helper: draw a filled rectangle with an optional border ──
    // PDFKit: fill() ends the path, so stroke() on same path afterwards draws nothing.
    // Use save/restore + explicit path duplication via fillAndStroke where both are needed.
    const drawRect = (x: number, ry: number, w: number, h: number, fillColor: string, strokeColor?: string) => {
      if (strokeColor) {
        doc.save().roundedRect(x, ry, w, h, 0).fillAndStroke(fillColor, strokeColor).restore();
      } else {
        doc.rect(x, ry, w, h).fill(fillColor);
      }
    };
    const drawRoundedBox = (x: number, ry: number, w: number, h: number, r: number, fillColor: string, strokeColor?: string) => {
      if (strokeColor) {
        doc.save().roundedRect(x, ry, w, h, r).fillAndStroke(fillColor, strokeColor).restore();
      } else {
        doc.roundedRect(x, ry, w, h, r).fill(fillColor);
      }
    };

    // ── Header bar ──
    drawRect(0, 0, W, 75, "#0f2240");
    doc.fillColor("#ffffff").font(font).fontSize(18)
      .text("طلب تسعير / Request for Quotation", margin, 18, { width: contentW, align: "right" });
    doc.fillColor("#94a3b8").fontSize(11)
      .text(companyName, margin, 42, { width: contentW, align: "right" });

    let y = 90;

    // ── RFQ number box ──
    drawRoundedBox(margin, y, contentW, 44, 6, "#f0f7ff", "#bfdbfe");
    doc.fillColor("#3b82f6").font(font).fontSize(9)
      .text("رقم طلب التسعير / RFQ No.", margin + 8, y + 6, { width: contentW - 16, align: "right" });
    doc.fillColor("#1e3a8a").fontSize(16)
      .text(rfqNo, margin + 8, y + 20, { width: contentW - 16, align: "right" });
    y += 54;

    // ── Info fields ──
    const infoFields: [string, string][] = [
      ["التاريخ / Date", requestDate],
      ["المورد / To", supplierName],
      ["مقدم من / From", senderName],
    ];
    if (senderPhone) infoFields.push(["هاتف المرسل / Sender Phone", senderPhone]);

    doc.font(font).fontSize(10);
    for (const [label, value] of infoFields) {
      doc.fillColor("#64748b").text(label + ":", margin, y, { continued: false, width: contentW, align: "right" });
      doc.fillColor("#0f172a").text(value, margin, y + 13, { width: contentW, align: "right" });
      y += 32;
    }
    y += 8;

    // ── Section title ──
    doc.fillColor("#0f2240").fontSize(11).font(font)
      .text("البنود المطلوب تسعيرها / Items for Quotation", margin, y, { width: contentW, align: "right" });
    y += 18;

    // ── Table helpers ──
    const colWidths = { no: 28, desc: contentW - 28 - 90 - 55 - 55, partNo: 90, unit: 55, qty: 55 };
    const rowH = 22;

    const drawTableHeader = (startY: number) => {
      drawRect(margin, startY, contentW, rowH, "#0f2240");
      doc.fillColor("#ffffff").fontSize(8.5).font(font);
      let hx = margin;
      doc.text("#", hx, startY + 6, { width: colWidths.no, align: "center" }); hx += colWidths.no;
      doc.text("الوصف / Description", hx, startY + 6, { width: colWidths.desc, align: "right" }); hx += colWidths.desc;
      doc.text("رقم القطعة / Part No.", hx, startY + 6, { width: colWidths.partNo, align: "center" }); hx += colWidths.partNo;
      doc.text("الوحدة / Unit", hx, startY + 6, { width: colWidths.unit, align: "center" }); hx += colWidths.unit;
      doc.text("الكمية / Qty", hx, startY + 6, { width: colWidths.qty, align: "center" });
      return startY + rowH;
    };

    y = drawTableHeader(y);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 40;
        y = drawTableHeader(y); // re-render header on each new page
      }
      const bg = i % 2 === 0 ? "#ffffff" : "#f0f4f8";
      drawRect(margin, y, contentW, rowH, bg, "#e2e8f0");

      doc.fillColor("#374151").fontSize(8.5).font(font);
      let cx = margin;
      doc.text(String(i + 1), cx, y + 6, { width: colWidths.no, align: "center" }); cx += colWidths.no;
      doc.text(item.description, cx, y + 6, { width: colWidths.desc, align: "right" }); cx += colWidths.desc;
      doc.text(item.partNo || "—", cx, y + 6, { width: colWidths.partNo, align: "center" }); cx += colWidths.partNo;
      doc.text(item.unit || "—", cx, y + 6, { width: colWidths.unit, align: "center" }); cx += colWidths.unit;
      doc.text(fmtQty(item.quantity), cx, y + 6, { width: colWidths.qty, align: "center" });
      y += rowH;
    }

    y += 16;

    // ── Notes ──
    if (notes) {
      if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
      drawRoundedBox(margin, y, contentW, 36, 4, "#fffbea", "#e8d87a");
      doc.fillColor("#92400e").font(font).fontSize(9)
        .text("ملاحظات / Notes: " + notes, margin + 8, y + 8, { width: contentW - 16, align: "right" });
      y += 44;
    }

    // ── Footer ──
    if (y > doc.page.height - 50) { doc.addPage(); y = 40; }
    doc.moveTo(margin, y).lineTo(W - margin, y).strokeColor("#e2e8f0").stroke();
    y += 8;
    doc.fillColor("#94a3b8").font(font).fontSize(8.5)
      .text("يرجى الرد في أقرب وقت ممكن — نشكر حسن تعاونكم", margin, y, { width: contentW, align: "center" });

    doc.end();
  });
}

// ─── GET /api/supplier-quotations/search-cq?q=... ───────────────────────────
router.get("/search-cq", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);

    const pattern = `%${q}%`;

    const quotations = await db
      .select({
        id: customerQuotationsTable.id,
        quotationNo: customerQuotationsTable.quotationNo,
        customerName: customersTable.name,
        customerOrderNo: customerQuotationsTable.customerOrderNo,
        requestDate: customerQuotationsTable.requestDate,
        status: customerQuotationsTable.status,
      })
      .from(customerQuotationsTable)
      .leftJoin(customersTable, eq(customerQuotationsTable.customerId, customersTable.id))
      .where(or(
        ilike(customerQuotationsTable.quotationNo, pattern),
        ilike(customerQuotationsTable.customerOrderNo, pattern),
      ))
      .orderBy(desc(customerQuotationsTable.id))
      .limit(20);

    res.json(quotations);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في البحث" });
  }
});

// ─── GET /api/supplier-quotations/:id/analysis ──────────────────────────────
router.get("/:id/analysis", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const items = await db
      .select()
      .from(supplierQuotationItemsTable)
      .where(eq(supplierQuotationItemsTable.rfqId, id))
      .orderBy(supplierQuotationItemsTable.sortOrder);

    const rfqSuppliers = await db
      .select({
        id: supplierQuotationSuppliersTable.id,
        supplierId: supplierQuotationSuppliersTable.supplierId,
        companyName: suppliersTable.companyName,
        responseStatus: supplierQuotationSuppliersTable.responseStatus,
        responseSubmittedAt: supplierQuotationSuppliersTable.responseSubmittedAt,
        token: supplierQuotationSuppliersTable.token,
        paymentTerms: supplierQuotationSuppliersTable.paymentTerms,
        offerValidityDays: supplierQuotationSuppliersTable.offerValidityDays,
        responseNotes: supplierQuotationSuppliersTable.responseNotes,
        deliveryDays: supplierQuotationSuppliersTable.deliveryDays,
      })
      .from(supplierQuotationSuppliersTable)
      .leftJoin(suppliersTable, eq(supplierQuotationSuppliersTable.supplierId, suppliersTable.id))
      .where(eq(supplierQuotationSuppliersTable.rfqId, id));

    const rfqSupplierIds = rfqSuppliers.map((s) => s.id);

    let prices: any[] = [];
    if (rfqSupplierIds.length > 0) {
      prices = await db
        .select()
        .from(supplierQuotationItemPricesTable)
        .where(inArray(supplierQuotationItemPricesTable.rfqSupplierId, rfqSupplierIds));
    }

    const suppliersWithPrices = rfqSuppliers.map((s) => ({
      ...s,
      prices: prices.filter((p) => p.rfqSupplierId === s.id),
    }));

    res.json({ items, suppliers: suppliersWithPrices });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب التحليل" });
  }
});

// ─── GET /api/supplier-quotations ───────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const rfqs = await db
      .select()
      .from(supplierQuotationsTable)
      .orderBy(desc(supplierQuotationsTable.createdAt));

    if (rfqs.length === 0) return res.json([]);

    const rfqIds = rfqs.map((r) => r.id);

    const items = await db
      .select()
      .from(supplierQuotationItemsTable)
      .where(inArray(supplierQuotationItemsTable.rfqId, rfqIds));

    const rfqSuppliers = await db
      .select({
        rfqId: supplierQuotationSuppliersTable.rfqId,
        supplierId: supplierQuotationSuppliersTable.supplierId,
        sentVia: supplierQuotationSuppliersTable.sentVia,
        sentAt: supplierQuotationSuppliersTable.sentAt,
        token: supplierQuotationSuppliersTable.token,
        responseStatus: supplierQuotationSuppliersTable.responseStatus,
        responseSubmittedAt: supplierQuotationSuppliersTable.responseSubmittedAt,
        companyName: suppliersTable.companyName,
        email: suppliersTable.email,
        whatsapp: suppliersTable.whatsapp,
        phone: suppliersTable.phone,
        firstOpenedAt: supplierQuotationSuppliersTable.firstOpenedAt,
      })
      .from(supplierQuotationSuppliersTable)
      .leftJoin(suppliersTable, eq(supplierQuotationSuppliersTable.supplierId, suppliersTable.id))
      .where(inArray(supplierQuotationSuppliersTable.rfqId, rfqIds));

    const result = rfqs.map((rfq) => ({
      ...rfq,
      items: items.filter((i) => i.rfqId === rfq.id),
      suppliers: rfqSuppliers.filter((s) => s.rfqId === rfq.id),
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب طلبات التسعير" });
  }
});

// ─── GET /api/supplier-quotations/:id ───────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [rfq] = await db
      .select()
      .from(supplierQuotationsTable)
      .where(eq(supplierQuotationsTable.id, id));

    if (!rfq) return res.status(404).json({ error: "الطلب غير موجود" });

    const items = await db
      .select()
      .from(supplierQuotationItemsTable)
      .where(eq(supplierQuotationItemsTable.rfqId, id))
      .orderBy(supplierQuotationItemsTable.sortOrder);

    const suppliers = await db
      .select({
        rfqId: supplierQuotationSuppliersTable.rfqId,
        supplierId: supplierQuotationSuppliersTable.supplierId,
        sentVia: supplierQuotationSuppliersTable.sentVia,
        sentAt: supplierQuotationSuppliersTable.sentAt,
        token: supplierQuotationSuppliersTable.token,
        responseStatus: supplierQuotationSuppliersTable.responseStatus,
        responseSubmittedAt: supplierQuotationSuppliersTable.responseSubmittedAt,
        companyName: suppliersTable.companyName,
        email: suppliersTable.email,
        whatsapp: suppliersTable.whatsapp,
        phone: suppliersTable.phone,
      })
      .from(supplierQuotationSuppliersTable)
      .leftJoin(suppliersTable, eq(supplierQuotationSuppliersTable.supplierId, suppliersTable.id))
      .where(eq(supplierQuotationSuppliersTable.rfqId, id));

    res.json({ ...rfq, items, suppliers });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب الطلب" });
  }
});

// ─── POST /api/supplier-quotations ──────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { sourceQuotationId, sourceQuotationNo, customerOrderNo, requestDate, notes, items, supplierIds } = req.body;

    if (!requestDate) return res.status(400).json({ error: "تاريخ الطلب مطلوب" });
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "يجب إضافة بند واحد على الأقل" });
    if (!Array.isArray(supplierIds) || supplierIds.length === 0)
      return res.status(400).json({ error: "يجب اختيار مورد واحد على الأقل" });

    const rfqNo = generateRfqNo();

    const [rfq] = await db
      .insert(supplierQuotationsTable)
      .values({
        rfqNo,
        sourceQuotationId: sourceQuotationId ? Number(sourceQuotationId) : null,
        sourceQuotationNo: sourceQuotationNo?.trim() ?? "",
        customerOrderNo: customerOrderNo?.trim() ?? "",
        requestDate: requestDate.trim(),
        notes: notes?.trim() ?? "",
        status: "مرسل",
      })
      .returning();

    const itemRows = (items as any[]).map((item: any, idx: number) => ({
      rfqId: rfq.id,
      customerItemCode: item.customerItemCode?.trim() ?? "",
      description: item.description?.trim() ?? "",
      partNo: item.partNo?.trim() ?? "",
      unit: item.unit?.trim() ?? "",
      quantity: String(item.quantity ?? 0),
      sortOrder: idx,
    }));
    await db.insert(supplierQuotationItemsTable).values(itemRows);

    await db.insert(supplierQuotationSuppliersTable).values(
      (supplierIds as number[]).map(sid => ({
        rfqId: rfq.id,
        supplierId: Number(sid),
        sentVia: "",
        token: randomUUID(),
      }))
    );

    const savedItems = await db
      .select()
      .from(supplierQuotationItemsTable)
      .where(eq(supplierQuotationItemsTable.rfqId, rfq.id))
      .orderBy(supplierQuotationItemsTable.sortOrder);

    const savedSuppliers = await db
      .select({
        id: supplierQuotationSuppliersTable.id,
        rfqId: supplierQuotationSuppliersTable.rfqId,
        supplierId: supplierQuotationSuppliersTable.supplierId,
        sentVia: supplierQuotationSuppliersTable.sentVia,
        sentAt: supplierQuotationSuppliersTable.sentAt,
        token: supplierQuotationSuppliersTable.token,
        responseStatus: supplierQuotationSuppliersTable.responseStatus,
        responseSubmittedAt: supplierQuotationSuppliersTable.responseSubmittedAt,
        companyName: suppliersTable.companyName,
        email: suppliersTable.email,
        whatsapp: suppliersTable.whatsapp,
        phone: suppliersTable.phone,
      })
      .from(supplierQuotationSuppliersTable)
      .leftJoin(suppliersTable, eq(supplierQuotationSuppliersTable.supplierId, suppliersTable.id))
      .where(eq(supplierQuotationSuppliersTable.rfqId, rfq.id));

    res.status(201).json({ ...rfq, items: savedItems, suppliers: savedSuppliers });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إنشاء الطلب" });
  }
});

// ─── POST /api/supplier-quotations/:id/send-all ─────────────────────────────
// Sends WhatsApp + Email to ALL suppliers of this RFQ in one batch.
router.post("/:id/send-all", async (req, res) => {
  try {
    const rfqId = Number(req.params.id);
    const { baseUrl } = req.body as { baseUrl?: string };

    // Resolve app base URL for RFQ links
    const appBase =
      baseUrl?.trim() ||
      process.env.APP_BASE_URL?.trim() ||
      `${req.protocol}://${req.get("host")}`;

    // Load RFQ
    const [rfq] = await db
      .select()
      .from(supplierQuotationsTable)
      .where(eq(supplierQuotationsTable.id, rfqId));
    if (!rfq) return res.status(404).json({ error: "الطلب غير موجود" });

    // Load items
    const items = await db
      .select()
      .from(supplierQuotationItemsTable)
      .where(eq(supplierQuotationItemsTable.rfqId, rfqId))
      .orderBy(supplierQuotationItemsTable.sortOrder);

    // Load suppliers with contact info
    const rfqSuppliers = await db
      .select({
        id: supplierQuotationSuppliersTable.id,
        supplierId: supplierQuotationSuppliersTable.supplierId,
        token: supplierQuotationSuppliersTable.token,
        sentVia: supplierQuotationSuppliersTable.sentVia,
        companyName: suppliersTable.companyName,
        email: suppliersTable.email,
        whatsapp: suppliersTable.whatsapp,
        phone: suppliersTable.phone,
      })
      .from(supplierQuotationSuppliersTable)
      .leftJoin(suppliersTable, eq(supplierQuotationSuppliersTable.supplierId, suppliersTable.id))
      .where(eq(supplierQuotationSuppliersTable.rfqId, rfqId));

    // Load company settings for SMTP + WhatsApp config
    const settingsRows = await db.select().from(companySettingsTable).limit(1);
    const settings = settingsRows[0] ?? null;

    const waPhoneId = settings?.whatsappPhoneNumber || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    const waToken = settings?.whatsappToken || process.env.WHATSAPP_ACCESS_TOKEN || "";
    const waEnabled = !!(waPhoneId && waToken);

    // Build nodemailer transporter if SMTP is configured
    let transporter: any = null;
    if (
      settings?.smtpHost &&
      settings?.smtpPort &&
      settings?.smtpUser &&
      settings?.smtpPass
    ) {
      try {
        const nodemailer = await import("nodemailer");
        transporter = nodemailer.default.createTransport({
          host: settings.smtpHost,
          port: Number(settings.smtpPort),
          secure: Number(settings.smtpPort) === 465,
          auth: { user: settings.smtpUser, pass: settings.smtpPass },
        });
      } catch (e) {
        req.log.warn("nodemailer not available — email sending disabled");
      }
    }

    const fromName = settings?.smtpFromName || settings?.name || "نظام المشتريات";
    const fromEmail = settings?.smtpUser || "";

    // ── Get sender info (name + phone) from the authenticated user ──
    const senderName = req.auth?.fullName || req.auth?.username || "مسؤول المشتريات";
    let senderPhone = "";
    if (req.auth?.userId) {
      try {
        // Look up user's linked employee to get their phone number
        const [user] = await db
          .select({ employeeId: usersTable.employeeId })
          .from(usersTable)
          .where(eq(usersTable.id, req.auth.userId))
          .limit(1);
        if (user?.employeeId) {
          const [emp] = await db
            .select({ phone: employeesTable.phone })
            .from(employeesTable)
            .where(eq(employeesTable.id, user.employeeId))
            .limit(1);
          senderPhone = emp?.phone ?? "";
        }
      } catch {}
    }

    // ── Generate a single PDF for this RFQ (shared across all suppliers) ──
    // The PDF contains RFQ details + sender info but NO token or link.
    let rfqPdfBuffer: Buffer | null = null;
    try {
      rfqPdfBuffer = await generateRfqPdf({
        rfqNo: rfq.rfqNo,
        requestDate: rfq.requestDate,
        companyName: fromName,
        supplierName: "—", // overridden per-supplier below
        items,
        senderName,
        senderPhone,
        notes: rfq.notes ?? "",
      });
    } catch (pdfErr: any) {
      req.log.warn(pdfErr, "PDF generation failed — continuing without PDF attachment");
    }

    // Process each supplier
    const results = await Promise.all(
      rfqSuppliers.map(async (sup) => {
        const rfqLink = sup.token ? `${appBase}/rfq/${sup.token}` : "";
        const sentChannels: string[] = [];
        const errors: string[] = [];

        // Generate per-supplier PDF (with correct supplier name)
        let supplierPdfBuffer: Buffer | null = rfqPdfBuffer;
        try {
          supplierPdfBuffer = await generateRfqPdf({
            rfqNo: rfq.rfqNo,
            requestDate: rfq.requestDate,
            companyName: fromName,
            supplierName: sup.companyName ?? "",
            items,
            senderName,
            senderPhone,
            notes: rfq.notes ?? "",
          });
        } catch {
          // fall back to generic PDF
        }

        // ── WhatsApp ──
        const whatsappRaw = sup.whatsapp || sup.phone || "";
        if (whatsappRaw) {
          const phone = whatsappRaw.replace(/\D/g, "");
          const message = buildWhatsAppText(
            rfq.rfqNo,
            rfq.requestDate,
            sup.companyName ?? "",
            items,
            rfqLink
          );

          if (waEnabled) {
            try {
              // Step 1: Send text message (includes the supplier link for online pricing)
              const waRes = await fetch(
                `https://graph.facebook.com/v19.0/${waPhoneId}/messages`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${waToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: phone,
                    type: "text",
                    text: { body: message },
                  }),
                }
              );
              if (waRes.ok) {
                sentChannels.push("whatsapp");
              } else {
                const errData = await waRes.json() as any;
                errors.push(`WhatsApp text: ${errData?.error?.message ?? waRes.status}`);
              }

              // Step 2: Upload PDF and send as document (if PDF was generated)
              if (supplierPdfBuffer && sentChannels.includes("whatsapp")) {
                try {
                  const pdfFilename = `RFQ-${rfq.rfqNo}.pdf`;
                  const formData = new FormData();
                  formData.append("messaging_product", "whatsapp");
                  formData.append("type", "application/pdf");
                  formData.append(
                    "file",
                    new Blob([supplierPdfBuffer], { type: "application/pdf" }),
                    pdfFilename
                  );
                  const uploadRes = await fetch(
                    `https://graph.facebook.com/v19.0/${waPhoneId}/media`,
                    {
                      method: "POST",
                      headers: { Authorization: `Bearer ${waToken}` },
                      body: formData,
                    }
                  );
                  if (!uploadRes.ok) {
                    const uploadErr = await uploadRes.json() as any;
                    errors.push(`WhatsApp PDF upload: ${uploadErr?.error?.message ?? uploadRes.status}`);
                  } else {
                    const { id: mediaId } = await uploadRes.json() as any;
                    const docRes = await fetch(
                      `https://graph.facebook.com/v19.0/${waPhoneId}/messages`,
                      {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${waToken}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          messaging_product: "whatsapp",
                          to: phone,
                          type: "document",
                          document: {
                            id: mediaId,
                            filename: pdfFilename,
                            caption: `طلب تسعير ${rfq.rfqNo} — مرفق ملف PDF بالبنود التفصيلية`,
                          },
                        }),
                      }
                    );
                    if (!docRes.ok) {
                      const docErr = await docRes.json() as any;
                      errors.push(`WhatsApp PDF send: ${docErr?.error?.message ?? docRes.status}`);
                    }
                  }
                } catch (pdfSendErr: any) {
                  req.log.warn(pdfSendErr, "WhatsApp PDF document send failed");
                  errors.push(`WhatsApp PDF: ${pdfSendErr.message}`);
                }
              }
            } catch (e: any) {
              errors.push(`WhatsApp: ${e.message}`);
            }
          } else {
            // No WhatsApp API — return wa.me fallback link
            const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
            return {
              supplierId: sup.supplierId,
              companyName: sup.companyName,
              token: sup.token,
              rfqLink,
              whatsappFallbackLink: waLink,
              emailSent: false,
              whatsappSent: false,
              sentChannels: [],
              errors: ["whatsapp_not_configured"],
            };
          }
        }

        // ── Email ──
        if (sup.email && transporter) {
          const htmlBody = buildEmailHtml(
            rfq.rfqNo,
            rfq.requestDate,
            sup.companyName ?? "",
            fromName,
            items,
            rfqLink,
            rfq.notes ?? ""
          );
          try {
            await transporter.sendMail({
              from: `"${fromName}" <${fromEmail}>`,
              to: sup.email,
              subject: `طلب تسعير - ${rfq.rfqNo}`,
              html: htmlBody,
              text: buildWhatsAppText(rfq.rfqNo, rfq.requestDate, sup.companyName ?? "", items, rfqLink),
              ...(supplierPdfBuffer
                ? {
                    attachments: [
                      {
                        filename: `RFQ-${rfq.rfqNo}.pdf`,
                        content: supplierPdfBuffer,
                        contentType: "application/pdf",
                      },
                    ],
                  }
                : {}),
            });
            sentChannels.push("email");
          } catch (e: any) {
            errors.push(`Email: ${e.message}`);
          }
        }

        // Update sentVia + sentAt in DB if anything was sent
        if (sentChannels.length > 0) {
          await db
            .update(supplierQuotationSuppliersTable)
            .set({
              sentVia: sentChannels.join("+"),
              sentAt: new Date(),
            })
            .where(eq(supplierQuotationSuppliersTable.id, sup.id));
        }

        return {
          supplierId: sup.supplierId,
          companyName: sup.companyName,
          token: sup.token,
          rfqLink,
          whatsappFallbackLink: null,
          whatsappSent: sentChannels.includes("whatsapp"),
          emailSent: sentChannels.includes("email"),
          sentChannels,
          errors,
        };
      })
    );

    res.json({
      rfqNo: rfq.rfqNo,
      waEnabled,
      smtpEnabled: !!transporter,
      results,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إرسال طلبات التسعير" });
  }
});

// ─── POST /api/supplier-quotations/:id/suppliers ─────────────────────────────
router.post("/:id/suppliers", async (req, res) => {
  try {
    const rfqId = Number(req.params.id);
    const { supplierId } = req.body;
    if (!supplierId) return res.status(400).json({ error: "المورد مطلوب" });

    const [rfq] = await db.select().from(supplierQuotationsTable).where(eq(supplierQuotationsTable.id, rfqId));
    if (!rfq) return res.status(404).json({ error: "الطلب غير موجود" });

    const existing = await db.select({ id: supplierQuotationSuppliersTable.id })
      .from(supplierQuotationSuppliersTable)
      .where(and(
        eq(supplierQuotationSuppliersTable.rfqId, rfqId),
        eq(supplierQuotationSuppliersTable.supplierId, Number(supplierId))
      ));
    if (existing.length > 0) return res.status(400).json({ error: "المورد مضاف بالفعل" });

    const [newSup] = await db.insert(supplierQuotationSuppliersTable).values({
      rfqId,
      supplierId: Number(supplierId),
      sentVia: "",
      token: randomUUID(),
    }).returning();

    const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, Number(supplierId)));

    res.status(201).json({
      ...newSup,
      companyName: supplier?.companyName ?? "",
      email: supplier?.email ?? null,
      whatsapp: supplier?.whatsapp ?? null,
      phone: supplier?.phone ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إضافة المورد" });
  }
});


  // ─── GET /api/supplier-quotations/:rfqId/pdf/:supplierId ─────────────────────
  router.get("/:rfqId/pdf/:supplierId", async (req, res) => {
    try {
      const rfqId    = Number(req.params.rfqId);
      const supplierIdParam = Number(req.params.supplierId);

      const [rfq] = await db.select().from(supplierQuotationsTable)
        .where(eq(supplierQuotationsTable.id, rfqId));
      if (!rfq) return res.status(404).json({ error: "الطلب غير موجود" });

      const items = await db.select().from(supplierQuotationItemsTable)
        .where(eq(supplierQuotationItemsTable.rfqId, rfqId))
        .orderBy(supplierQuotationItemsTable.sortOrder);

      const [rfqSup] = await db
        .select({ companyName: suppliersTable.companyName })
        .from(supplierQuotationSuppliersTable)
        .leftJoin(suppliersTable, eq(supplierQuotationSuppliersTable.supplierId, suppliersTable.id))
        .where(and(
          eq(supplierQuotationSuppliersTable.rfqId, rfqId),
          eq(supplierQuotationSuppliersTable.supplierId, supplierIdParam),
        ));

      const [settings] = await db
        .select({ name: companySettingsTable.name })
        .from(companySettingsTable).limit(1);

      const userId = req.auth?.userId;
      let senderName = req.auth?.fullName ?? "";
      let senderPhone = "";
      if (userId) {
        const [emp] = await db
          .select({ phone: employeesTable.phone, fullName: employeesTable.fullName })
          .from(employeesTable)
          .where(eq(employeesTable.userId, userId))
          .limit(1);
        if (emp) { senderName = emp.fullName ?? senderName; senderPhone = emp.phone ?? ""; }
      }

      const pdfBuffer = await generateRfqPdf({
        rfqNo:        rfq.rfqNo,
        requestDate:  rfq.requestDate,
        companyName:  settings?.name ?? "",
        supplierName: rfqSup?.companyName ?? "",
        items:        items.map(i => ({
          description: i.description,
          partNo:      i.partNo   ?? undefined,
          unit:        i.unit     ?? undefined,
          quantity:    i.quantity,
        })),
        senderName,
        senderPhone,
        notes: rfq.notes ?? "",
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="RFQ-${rfq.rfqNo}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في توليد الـ PDF" });
    }
  });

  // ─── DELETE /api/supplier-quotations/:id ────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(supplierQuotationsTable).where(eq(supplierQuotationsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في حذف الطلب" });
  }
});

export default router;
