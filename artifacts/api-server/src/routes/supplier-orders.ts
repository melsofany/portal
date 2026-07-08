import { Router } from "express";
  import { db } from "@workspace/db";
  import {
    supplierOrdersTable,
    supplierOrderItemsTable,
    suppliersTable,
    customerOrdersTable,
    customerOrderItemsTable,
    supplierQuotationsTable,
    supplierQuotationItemsTable,
    supplierQuotationSuppliersTable,
    supplierQuotationItemPricesTable,
    employeesTable,
  } from "@workspace/db/schema";
  import { eq, desc, and, inArray, or, ilike } from "drizzle-orm";

  const router = Router();

  function generateOrderNo(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return "SO-" + y + m + d + "-" + rand;
  }

  // GET /api/supplier-orders/find-rfq-prices?supplierId=X&customerOrderId=Y
  router.get("/find-rfq-prices", async (req, res) => {
    try {
      const supplierId = Number(req.query.supplierId);
      const customerOrderId = Number(req.query.customerOrderId);
      if (!supplierId || !customerOrderId) return res.json({ found: false, rfqNo: null, items: [] });

      const [co] = await db.select().from(customerOrdersTable).where(eq(customerOrdersTable.id, customerOrderId));
      if (!co) return res.json({ found: false, rfqNo: null, items: [] });

      const coItems = await db.select().from(customerOrderItemsTable)
        .where(eq(customerOrderItemsTable.orderId, customerOrderId));

      const quotationIds = [...new Set(coItems.map(it => it.quotationId).filter((id): id is number => !!id))];

      const conditions: any[] = [];
      if (quotationIds.length > 0) conditions.push(inArray(supplierQuotationsTable.sourceQuotationId, quotationIds));
      if (co.orderNo) conditions.push(ilike(supplierQuotationsTable.customerOrderNo, co.orderNo));
      if (co.customerPoNo) conditions.push(ilike(supplierQuotationsTable.customerOrderNo, co.customerPoNo));
      if (conditions.length === 0) return res.json({ found: false, rfqNo: null, items: [] });

      const rfqs = await db.select().from(supplierQuotationsTable)
        .where(conditions.length === 1 ? conditions[0] : or(...conditions));
      if (!rfqs.length) return res.json({ found: false, rfqNo: null, items: [] });

      const rfqIds = rfqs.map(r => r.id);
      const rfqSuppliers = await db.select().from(supplierQuotationSuppliersTable).where(
        and(inArray(supplierQuotationSuppliersTable.rfqId, rfqIds), eq(supplierQuotationSuppliersTable.supplierId, supplierId))
      );
      if (!rfqSuppliers.length) return res.json({ found: false, rfqNo: null, items: [] });

      const respondedSupplier = rfqSuppliers.find(s => s.responseStatus === "submitted" || s.responseStatus === "responded") ?? rfqSuppliers[0];
      const matchedRfq = rfqs.find(r => r.id === respondedSupplier.rfqId)!;

      const rfqItems = await db.select().from(supplierQuotationItemsTable)
        .where(eq(supplierQuotationItemsTable.rfqId, matchedRfq.id))
        .orderBy(supplierQuotationItemsTable.sortOrder);

      const prices = await db.select().from(supplierQuotationItemPricesTable)
        .where(eq(supplierQuotationItemPricesTable.rfqSupplierId, respondedSupplier.id));

      const priceMap = new Map<number, string>();
      prices.forEach(p => priceMap.set(p.rfqItemId, String(p.unitPrice ?? "0")));

      res.json({
        found: true, rfqNo: matchedRfq.rfqNo,
        rfqSupplierId: respondedSupplier.id, responseStatus: respondedSupplier.responseStatus,
        items: rfqItems.map(it => ({
          rfqItemId: it.id, description: it.description,
          partNo: it.partNo ?? "", unit: it.unit ?? "",
          unitPrice: priceMap.get(it.id) ?? "0",
        })),
      });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في البحث عن أسعار طلب التسعير" });
    }
  });

  // GET /api/supplier-orders
  router.get("/", async (req, res) => {
    try {
      const orders = await db.select().from(supplierOrdersTable).orderBy(desc(supplierOrdersTable.createdAt));
      const result = await Promise.all(orders.map(async (o) => {
        const items = await db.select().from(supplierOrderItemsTable).where(eq(supplierOrderItemsTable.orderId, o.id));
        return { ...o, itemCount: items.length };
      }));
      res.json(result);
    } catch (err) { req.log.error(err); res.status(500).json({ error: "فشل في جلب طلبات التوريد" }); }
  });

  // GET /api/supplier-orders/:id
  router.get("/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [order] = await db.select().from(supplierOrdersTable).where(eq(supplierOrdersTable.id, id));
      if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
      const items = await db.select().from(supplierOrderItemsTable)
        .where(eq(supplierOrderItemsTable.orderId, id)).orderBy(supplierOrderItemsTable.sortOrder);
      res.json({ ...order, items });
    } catch (err) { req.log.error(err); res.status(500).json({ error: "فشل في جلب الطلب" }); }
  });

  async function upsertOrder(body: any, orderId?: number) {
    const { supplierId, orderDate, notes, status, items, representativeId } = body;
    if (!orderDate) throw { status: 400, error: "التاريخ مطلوب" };
    if (!Array.isArray(items) || items.length === 0) throw { status: 400, error: "يجب إضافة بند واحد على الأقل" };

    let supplierName = "", supplierEmail = "", supplierWhatsapp = "";
    if (supplierId) {
      const [sup] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, Number(supplierId)));
      if (sup) { supplierName = sup.companyName ?? ""; supplierEmail = sup.email ?? ""; supplierWhatsapp = sup.whatsapp ?? sup.phone ?? ""; }
    }

    let representativeName = "", representativePhone = "";
    let repId: number | null = representativeId ? Number(representativeId) : null;
    if (repId) {
      const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, repId));
      if (emp) {
        representativeName = emp.fullName ?? "";
        representativePhone = emp.phone ?? "";
      } else {
        repId = null; // الموظف غير موجود — لا نخزن ID يتيم
      }
    }

    const totalAmount = (items as any[]).reduce((s: number, it: any) =>
      s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);

    const itemRows = (items as any[]).map((item: any, idx: number) => ({
      customerOrderId: item.customerOrderId ? Number(item.customerOrderId) : null,
      customerOrderNo: item.customerOrderNo?.trim() ?? "",
      customerOrderItemId: item.customerOrderItemId ? Number(item.customerOrderItemId) : null,
      description: item.description?.trim() ?? "",
      partNo: item.partNo?.trim() ?? "",
      unit: item.unit?.trim() ?? "",
      quantity: String(parseFloat(item.quantity) || 0),
      unitPrice: String(parseFloat(item.unitPrice) || 0),
      totalPrice: String((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)),
      sortOrder: idx,
    }));

    if (orderId) {
      const [updated] = await db.update(supplierOrdersTable)
        .set({
          supplierId: supplierId ? Number(supplierId) : null, supplierName, supplierEmail, supplierWhatsapp,
          orderDate: orderDate.trim(), notes: notes?.trim() ?? "", status: status ?? "مفتوح",
          totalAmount: String(totalAmount),
          representativeId: repId, representativeName, representativePhone,
          updatedAt: new Date(),
        })
        .where(eq(supplierOrdersTable.id, orderId)).returning();
      if (!updated) throw { status: 404, error: "الطلب غير موجود" };
      await db.delete(supplierOrderItemsTable).where(eq(supplierOrderItemsTable.orderId, orderId));
      await db.insert(supplierOrderItemsTable).values(itemRows.map(r => ({ ...r, orderId })));
      return { ...updated, itemCount: itemRows.length };
    } else {
      const orderNo = generateOrderNo();
      const [order] = await db.insert(supplierOrdersTable)
        .values({
          orderNo, supplierId: supplierId ? Number(supplierId) : null, supplierName, supplierEmail, supplierWhatsapp,
          orderDate: orderDate.trim(), notes: notes?.trim() ?? "", status: "مفتوح", totalAmount: String(totalAmount),
          representativeId: repId, representativeName, representativePhone,
        })
        .returning();
      await db.insert(supplierOrderItemsTable).values(itemRows.map(r => ({ ...r, orderId: order.id })));
      return { ...order, itemCount: itemRows.length };
    }
  }

  router.post("/", async (req, res) => {
    try { res.status(201).json(await upsertOrder(req.body)); }
    catch (err: any) {
      if (err.status) return res.status(err.status).json({ error: err.error });
      req.log.error(err); res.status(500).json({ error: "فشل في إنشاء الطلب" });
    }
  });

  router.put("/:id", async (req, res) => {
    try { res.json(await upsertOrder(req.body, Number(req.params.id))); }
    catch (err: any) {
      if (err.status) return res.status(err.status).json({ error: err.error });
      req.log.error(err); res.status(500).json({ error: "فشل في تحديث الطلب" });
    }
  });

  async function findRfqNo(orderId: number, supplierId: number | null): Promise<string> {
    if (!supplierId) return "";
    try {
      const items = await db.select().from(supplierOrderItemsTable).where(eq(supplierOrderItemsTable.orderId, orderId));
      const coId = items.find(it => it.customerOrderId)?.customerOrderId;
      if (!coId) return "";
      const coItems = await db.select().from(customerOrderItemsTable).where(eq(customerOrderItemsTable.orderId, coId));
      const quotationIds = [...new Set(coItems.map(it => it.quotationId).filter((id): id is number => !!id))];
      if (!quotationIds.length) return "";
      const rfqs = await db.select().from(supplierQuotationsTable)
        .where(inArray(supplierQuotationsTable.sourceQuotationId, quotationIds));
      if (!rfqs.length) return "";
      const rfqIds = rfqs.map(r => r.id);
      const [rfqSup] = await db.select().from(supplierQuotationSuppliersTable).where(
        and(inArray(supplierQuotationSuppliersTable.rfqId, rfqIds), eq(supplierQuotationSuppliersTable.supplierId, supplierId))
      );
      return rfqs.find(r => r.id === rfqSup?.rfqId)?.rfqNo ?? "";
    } catch { return ""; }
  }

  router.post("/:id/send-whatsapp", async (req, res) => {
    try {
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;
      if (!phoneNumberId || !accessToken)
        return res.status(503).json({ error: "WhatsApp Business API غير مهيأ.", notConfigured: true });

      const id = Number(req.params.id);
      const [order] = await db.select().from(supplierOrdersTable).where(eq(supplierOrdersTable.id, id));
      if (!order) return res.status(404).json({ error: "الطلب غير موجود" });

      const phone = (order.supplierWhatsapp ?? "").replace(/[^0-9]/g, "");
      if (!phone) return res.status(400).json({ error: "لا يوجد رقم واتسآب لهذا المورد" });

      const items = await db.select().from(supplierOrderItemsTable)
        .where(eq(supplierOrderItemsTable.orderId, id)).orderBy(supplierOrderItemsTable.sortOrder);
      const rfqNo = await findRfqNo(id, order.supplierId);

      const lines: string[] = [];
      lines.push("طلب توريد رقم: " + order.orderNo);
      lines.push("التاريخ: " + order.orderDate);
      if (order.supplierName) lines.push("إلى: " + order.supplierName);
      if (rfqNo) lines.push("رقم طلب التسعير: " + rfqNo);
      lines.push(""); lines.push("البنود:");
      items.forEach((it, i) => {
        const qty = parseFloat(String(it.quantity)) || 0;
        const price = parseFloat(String(it.unitPrice)) || 0;
        let line = (i + 1) + ". " + it.description;
        if (it.partNo) line += " | Part: " + it.partNo;
        line += " | كمية: " + qty;
        if (price > 0) line += " | سعر: " + price.toFixed(3);
        if (it.customerOrderNo) line += " | أمر عميل: " + it.customerOrderNo;
        lines.push(line);
      });
      const total = items.reduce((s, it) => s + (parseFloat(String(it.quantity)) || 0) * (parseFloat(String(it.unitPrice)) || 0), 0);
      if (total > 0) { lines.push(""); lines.push("الإجمالي: " + total.toFixed(3)); }
      if (order.representativeName) {
        lines.push("");
        lines.push("مندوب الاستلام: " + order.representativeName);
        if (order.representativePhone) lines.push("هاتف المندوب: " + order.representativePhone);
      }
      if (order.notes) { lines.push(""); lines.push("ملاحظات: " + order.notes); }

      const waRes = await fetch("https://graph.facebook.com/v21.0/" + phoneNumberId + "/messages", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: lines.join("\n") } }),
      });
      const waData = await waRes.json() as any;
      if (!waRes.ok) { req.log.error(waData); return res.status(502).json({ error: waData?.error?.message ?? "فشل في إرسال رسالة الواتسآب" }); }
      res.json({ success: true, messageId: waData.messages?.[0]?.id });
    } catch (err) { req.log.error(err); res.status(500).json({ error: "حدث خطأ أثناء الإرسال" }); }
  });

  router.delete("/:id", async (req, res) => {
    try {
      await db.delete(supplierOrdersTable).where(eq(supplierOrdersTable.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (err) { req.log.error(err); res.status(500).json({ error: "فشل في حذف الطلب" }); }
  });

  export default router;
