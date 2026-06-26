import { Router } from "express";
  import { db } from "@workspace/db";
  import {
    orderCostsTable,
    invoicesTable,
    customerOrdersTable,
    customerOrderItemsTable,
    deliveryPermitsTable,
    supplierOrdersTable,
    supplierOrderItemsTable,
    companyExpensesTable,
  } from "@workspace/db/schema";
  import { eq, desc, inArray } from "drizzle-orm";
  import crypto from "crypto";

  const router = Router({ mergeParams: true });

  /* ── Precision helpers ─────────────────────────────────────────────────── */
  function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }
  function pct(base: number, rate: number): number {
    return round2(base * (rate / 100));
  }
  function applyVat(subtotal: number, vatRate = 14): {
    subtotal: number; vatRate: number; vatAmount: number; totalAmount: number;
  } {
    const vatAmount = pct(subtotal, vatRate);
    return { subtotal: round2(subtotal), vatRate, vatAmount, totalAmount: round2(subtotal + vatAmount) };
  }

  function generateInvoiceNo(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return "INV-" + y + m + d + "-" + rand;
  }

  function generateInvoiceUUID(): string {
    return crypto.randomUUID();
  }

  async function safeCosts(customerOrderId: number) {
    try {
      return await db.select().from(orderCostsTable)
        .where(eq(orderCostsTable.customerOrderId, customerOrderId))
        .orderBy(orderCostsTable.createdAt);
    } catch { return []; }
  }
  async function safeInvoices(customerOrderId: number) {
    try {
      return await db.select().from(invoicesTable)
        .where(eq(invoicesTable.customerOrderId, customerOrderId));
    } catch { return []; }
  }

  async function getLinkedSupplierOrders(customerOrderId: number) {
    try {
      const items = await db.select({ orderId: supplierOrderItemsTable.orderId })
        .from(supplierOrderItemsTable)
        .where(eq(supplierOrderItemsTable.customerOrderId, customerOrderId));
      const ids = [...new Set(items.map(i => i.orderId).filter((id): id is number => !!id))];
      if (ids.length === 0) return [];
      return await db.select().from(supplierOrdersTable)
        .where(inArray(supplierOrdersTable.id, ids))
        .orderBy(supplierOrdersTable.createdAt);
    } catch { return []; }
  }

  /* ────────────────────────────────────────────────────────────────────────
   * ACCOUNTING ENGINE — محرك الحسابات المالية الصحيح
   *
   * صافي الربح = إجمالي أمر العميل (شامل 14% VAT)
   *            - إجمالي أسعار بنود المورد (RAW — بدون أي إضافات)
   *            - تأمينات 3% من قيمة أمر العميل (subtotal)
   *            - التكاليف الإضافية (شحن، جمارك، نقل...)
   * ──────────────────────────────────────────────────────────────────────── */
  function calcOrderFinancials(
    order: { totalAmount?: string | null },
    supplierOrders: Array<{ totalAmount?: string | null }>,
    costs: Array<{ totalAmount?: string | null }>,
    vatRate = 14,
  ) {
    // ── إجمالي العميل ─────────────────────────────────────────────────────
    const subtotal = round2(parseFloat(order.totalAmount ?? "0"));
    const { vatAmount, totalAmount } = applyVat(subtotal, vatRate);
    // totalAmount = subtotal + 14% VAT = إجمالي الفاتورة للعميل

    // ── التكاليف ──────────────────────────────────────────────────────────
    // 1. أسعار بنود المورد RAW (بدون أي ضرائب أو تأمين مضاف)
    const supplierTotal = round2(
      supplierOrders.reduce((s, so) => s + parseFloat(so.totalAmount ?? "0"), 0),
    );

    // 2. تأمينات = 3% من قيمة أمر العميل (subtotal — قبل الضريبة)
    const customerInsuranceRate = 3;
    const customerInsurance = pct(subtotal, customerInsuranceRate);

    // 3. تكاليف إضافية يدوية (شحن، جمارك، نقل...)
    const manualCosts = round2(
      costs.reduce((s, c) => s + parseFloat(c.totalAmount ?? "0"), 0),
    );

    // ── الربح = إجمالي العميل - (مورد + تأمين + أخرى) ──────────────────
    const totalCosts = round2(supplierTotal + customerInsurance + manualCosts);
    const netProfit = round2(totalAmount - totalCosts);
    const marginPct = totalAmount > 0 ? round2((netProfit / totalAmount) * 100) : 0;

    return {
      subtotal, vatRate, vatAmount, totalAmount,
      supplierTotal,
      customerInsurance, customerInsuranceRate,
      manualCosts, totalCosts,
      netProfit, marginPct,
    };
  }

  // ── GET /api/accounts/orders ──────────────────────────────────────────────
  router.get("/orders", async (req, res) => {
    try {
      const orders = await db.select().from(customerOrdersTable)
        .orderBy(desc(customerOrdersTable.createdAt));

      const result = await Promise.all(orders.map(async (o) => {
        const [costs, invoices, permits, supplierOrders] = await Promise.all([
          safeCosts(o.id),
          safeInvoices(o.id),
          db.select().from(deliveryPermitsTable).where(eq(deliveryPermitsTable.customerOrderId, o.id)),
          getLinkedSupplierOrders(o.id),
        ]);

        const fin = calcOrderFinancials(o, supplierOrders, costs);
        const invoice = invoices[0] ?? null;
        const allDelivered = permits.length > 0 && permits.every(p => p.status === "تم التسليم");

        return {
          ...o,
          ...fin,
          supplierOrdersCount: supplierOrders.length,
          invoice,
          permitsCount: permits.length,
          allDelivered,
        };
      }));

      res.json(result);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في جلب الأوامر" });
    }
  });

  // ── GET /api/accounts/orders/:id ─────────────────────────────────────────
  router.get("/orders/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [order] = await db.select().from(customerOrdersTable).where(eq(customerOrdersTable.id, id));
      if (!order) return res.status(404).json({ error: "الأمر غير موجود" });

      const [items, costs, permits, invoices, supplierOrders] = await Promise.all([
        db.select().from(customerOrderItemsTable)
          .where(eq(customerOrderItemsTable.orderId, id))
          .orderBy(customerOrderItemsTable.sortOrder),
        safeCosts(id),
        db.select().from(deliveryPermitsTable)
          .where(eq(deliveryPermitsTable.customerOrderId, id))
          .orderBy(deliveryPermitsTable.createdAt),
        safeInvoices(id),
        getLinkedSupplierOrders(id),
      ]);

      const allDelivered = permits.length > 0 && permits.every(p => p.status === "تم التسليم");
      const canInvoice = allDelivered && invoices.length === 0;
      const fin = calcOrderFinancials(order, supplierOrders, costs);

      res.json({
        ...order,
        items,
        costs,
        permits,
        supplierOrders,
        permitsCount: permits.length,
        ...fin,
        invoice: invoices[0] ?? null,
        allDelivered,
        canInvoice,
      });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في جلب تفاصيل الأمر" });
    }
  });

  // ── GET /api/accounts/orders/:id/costs ───────────────────────────────────
  router.get("/orders/:id/costs", async (req, res) => {
    try {
      const costs = await safeCosts(Number(req.params.id));
      res.json(costs);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في جلب التكاليف" });
    }
  });

  // ── POST /api/accounts/orders/:id/costs ──────────────────────────────────
  router.post("/orders/:id/costs", async (req, res) => {
    try {
      const customerOrderId = Number(req.params.id);
      const { costType, description, amount, referenceNo, notes } = req.body;

      if (!costType) return res.status(400).json({ error: "نوع التكلفة مطلوب" });
      if (!description?.trim()) return res.status(400).json({ error: "وصف التكلفة مطلوب" });
      if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ error: "المبلغ مطلوب" });

      const amt = round2(parseFloat(amount));

      const [cost] = await db.insert(orderCostsTable).values({
        customerOrderId,
        costType,
        description: description.trim(),
        supplierOrderId: null,
        amount: String(amt),
        vatRate: "0",
        vatAmount: "0",
        insuranceRate: "0",
        insuranceAmount: "0",
        totalAmount: String(amt),
        referenceNo: referenceNo?.trim() ?? "",
        notes: notes?.trim() ?? "",
      }).returning();

      res.status(201).json(cost);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في إضافة التكلفة" });
    }
  });

  // ── DELETE /api/accounts/costs/:id ───────────────────────────────────────
  router.delete("/costs/:id", async (req, res) => {
    try {
      await db.delete(orderCostsTable).where(eq(orderCostsTable.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في حذف التكلفة" });
    }
  });

  /* ── POST /api/accounts/orders/:id/invoice ──────────────────────────────
   * الفاتورة الضريبية — قانون ٦٧/٢٠١٦ — بنود أمر الشراء + ١٤٪ فقط
   */
  router.post("/orders/:id/invoice", async (req, res) => {
    try {
      const customerOrderId = Number(req.params.id);
      const { invoiceDate, vatRate, notes } = req.body;
      if (!invoiceDate) return res.status(400).json({ error: "تاريخ الفاتورة مطلوب" });

      const [order] = await db.select().from(customerOrdersTable).where(eq(customerOrdersTable.id, customerOrderId));
      if (!order) return res.status(404).json({ error: "الأمر غير موجود" });

      const permits = await db.select().from(deliveryPermitsTable).where(eq(deliveryPermitsTable.customerOrderId, customerOrderId));
      if (permits.length === 0) return res.status(422).json({ error: "لا يوجد إذن تسليم مرتبط بهذا الأمر" });
      const notDelivered = permits.filter(p => p.status !== "تم التسليم");
      if (notDelivered.length > 0) {
        return res.status(422).json({
          error: `لم يتم تسليم ${notDelivered.length} إذن بعد. يجب أن تكون جميع الإذونات بحالة "تم التسليم".`,
        });
      }

      const existing = await safeInvoices(customerOrderId);
      if (existing.length > 0) return res.status(409).json({ error: "تم إصدار فاتورة لهذا الأمر مسبقاً" });

      const vatPct = round2(parseFloat(vatRate ?? "14"));
      const [costs, supplierOrders] = await Promise.all([
        safeCosts(customerOrderId),
        getLinkedSupplierOrders(customerOrderId),
      ]);
      const fin = calcOrderFinancials(order, supplierOrders, costs, vatPct);

      const invoiceNo = generateInvoiceNo();
      const invoiceUUID = generateInvoiceUUID();

      const [invoice] = await db.insert(invoicesTable).values({
        invoiceNo,
        customerOrderId,
        customerOrderNo: order.orderNo,
        customerPoNo: order.customerPoNo ?? "",
        customerName: order.customerName ?? "",
        invoiceDate: invoiceDate.trim(),
        subtotal: String(fin.subtotal),
        vatRate: String(vatPct),
        vatAmount: String(fin.vatAmount),
        totalAmount: String(fin.totalAmount),
        totalCosts: String(fin.totalCosts),
        netProfit: String(fin.netProfit),
        status: "صادرة",
        notes: notes?.trim() ?? "",
      }).returning();

      await db.update(customerOrdersTable)
        .set({ status: "صدرت الفاتورة", updatedAt: new Date() })
        .where(eq(customerOrdersTable.id, customerOrderId));

      res.status(201).json({ ...invoice, invoiceUUID });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في إصدار الفاتورة" });
    }
  });

  // ── GET /api/accounts/invoices ────────────────────────────────────────────
  router.get("/invoices", async (req, res) => {
    try {
      const invoices = await db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt));
      res.json(invoices);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في جلب الفواتير" });
    }
  });

  // ── GET /api/accounts/invoices/:id ───────────────────────────────────────
  router.get("/invoices/:id", async (req, res) => {
    try {
      const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, Number(req.params.id)));
      if (!invoice) return res.status(404).json({ error: "الفاتورة غير موجودة" });
      const items = await db.select().from(customerOrderItemsTable)
        .where(eq(customerOrderItemsTable.orderId, invoice.customerOrderId))
        .orderBy(customerOrderItemsTable.sortOrder);
      const costs = await safeCosts(invoice.customerOrderId);
      res.json({ ...invoice, items, costs });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في جلب الفاتورة" });
    }
  });

  // ── PATCH /api/accounts/invoices/:id/status ──────────────────────────────
  router.patch("/invoices/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const allowed = ["صادرة", "مدفوعة", "ملغاة"];
      if (!allowed.includes(status)) return res.status(400).json({ error: "حالة غير صالحة" });

      const [updated] = await db.update(invoicesTable)
        .set({ status })
        .where(eq(invoicesTable.id, Number(req.params.id)))
        .returning();
      if (!updated) return res.status(404).json({ error: "الفاتورة غير موجودة" });

      // عند تحديد الفاتورة كمدفوعة → تحديث حالة أمر الشراء إلى "مكتمل"
      if (status === "مدفوعة") {
        await db.update(customerOrdersTable)
          .set({ status: "مكتمل", updatedAt: new Date() })
          .where(eq(customerOrdersTable.id, updated.customerOrderId));
      }

      // عند إلغاء الفاتورة → إعادة الأمر إلى "صدرت الفاتورة" (ليس مكتملاً)
      if (status === "ملغاة") {
        await db.update(customerOrdersTable)
          .set({ status: "صدرت الفاتورة", updatedAt: new Date() })
          .where(eq(customerOrdersTable.id, updated.customerOrderId));
      }

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في تحديث حالة الفاتورة" });
    }
  });

  // ── POST /api/accounts/sync-order-statuses ───────────────────────────────
  // مزامنة حالة أوامر الشراء بناءً على حالة الفواتير (تصحيح البيانات التاريخية)
  router.post("/sync-order-statuses", async (req, res) => {
    try {
      const allInvoices = await db.select().from(invoicesTable);
      let synced = 0;

      for (const inv of allInvoices) {
        let targetStatus: string | null = null;
        if (inv.status === "مدفوعة") targetStatus = "مكتمل";
        else if (inv.status === "صادرة") targetStatus = "صدرت الفاتورة";

        if (targetStatus) {
          await db.update(customerOrdersTable)
            .set({ status: targetStatus, updatedAt: new Date() })
            .where(eq(customerOrdersTable.id, inv.customerOrderId));
          synced++;
        }
      }

      res.json({ success: true, synced, total: allInvoices.length });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في المزامنة" });
    }
  });

  // ── DELETE /api/accounts/invoices/:id ────────────────────────────────────
  // حذف فاتورة — يُسمح فقط للفواتير الملغاة أو في حالات خاصة
  router.delete("/invoices/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
      if (!invoice) return res.status(404).json({ error: "الفاتورة غير موجودة" });

      // Reset the customer order status so a new invoice can be issued later
      await db.update(customerOrdersTable)
        .set({ status: "مفتوح", updatedAt: new Date() })
        .where(eq(customerOrdersTable.id, invoice.customerOrderId));

      await db.delete(invoicesTable).where(eq(invoicesTable.id, id));

      res.json({ success: true });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في حذف الفاتورة" });
    }
  });

  
  // ── GET /api/accounts/expenses ────────────────────────────────────────────
  router.get("/expenses", async (req, res) => {
    try {
      const expenses = await db.select().from(companyExpensesTable).orderBy(desc(companyExpensesTable.createdAt));
      res.json(expenses);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في جلب المصاريف" });
    }
  });

  // ── POST /api/accounts/expenses ────────────────────────────────────────────
  router.post("/expenses", async (req, res) => {
    try {
      const { expenseType, description, amount, expenseDate, referenceNo, notes } = req.body;
      if (!expenseType) return res.status(400).json({ error: "نوع المصروف مطلوب" });
      if (!description?.trim()) return res.status(400).json({ error: "وصف المصروف مطلوب" });
      if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ error: "المبلغ مطلوب" });
      if (!expenseDate) return res.status(400).json({ error: "التاريخ مطلوب" });

      const amt = round2(parseFloat(amount));
      const [expense] = await db.insert(companyExpensesTable).values({
        expenseType,
        description: description.trim(),
        amount: String(amt),
        expenseDate: expenseDate.trim(),
        referenceNo: referenceNo?.trim() ?? "",
        notes: notes?.trim() ?? "",
      }).returning();

      res.status(201).json(expense);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في إضافة المصروف" });
    }
  });

  // ── DELETE /api/accounts/expenses/:id ─────────────────────────────────────
  router.delete("/expenses/:id", async (req, res) => {
    try {
      await db.delete(companyExpensesTable).where(eq(companyExpensesTable.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في حذف المصروف" });
    }
  });


  export default router;
  