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
} from "@workspace/db/schema";
import { eq, desc, inArray, or, ilike, and } from "drizzle-orm";

const router = Router();

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

    // Process each supplier
    const results = await Promise.all(
      rfqSuppliers.map(async (sup) => {
        const rfqLink = sup.token ? `${appBase}/rfq/${sup.token}` : "";
        const sentChannels: string[] = [];
        const errors: string[] = [];

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
                errors.push(`WhatsApp: ${errData?.error?.message ?? waRes.status}`);
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
