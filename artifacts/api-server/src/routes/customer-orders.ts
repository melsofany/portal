import { Router } from "express";
  import { db } from "@workspace/db";
  import {
    customerOrdersTable,
    customerOrderItemsTable,
    customerQuotationsTable,
    customersTable,
  } from "@workspace/db/schema";
  import { eq, desc } from "drizzle-orm";

  const router = Router();

  function generateOrderNo(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return "CO-" + y + m + d + "-" + rand;
  }

  // GET /api/customer-orders
  router.get("/", async (req, res) => {
    try {
      const orders = await db
        .select()
        .from(customerOrdersTable)
        .orderBy(desc(customerOrdersTable.createdAt));

      const result = await Promise.all(
        orders.map(async (o) => {
          const items = await db
            .select()
            .from(customerOrderItemsTable)
            .where(eq(customerOrderItemsTable.orderId, o.id));
          return { ...o, itemCount: items.length };
        })
      );
      res.json(result);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في جلب أوامر الشراء" });
    }
  });

  
  // GET /api/customer-orders/search?q=...
  router.get("/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim().toLowerCase();
    if (!q) return res.json([]);
    try {
      const all = await db.select().from(customerOrdersTable).orderBy(desc(customerOrdersTable.createdAt));
      const filtered = all.filter(o =>
        o.orderNo.toLowerCase().includes(q) ||
        (o.customerPoNo ?? "").toLowerCase().includes(q) ||
        (o.customerName ?? "").toLowerCase().includes(q)
      );
      const result = await Promise.all(filtered.slice(0, 20).map(async (o) => {
        const items = await db.select().from(customerOrderItemsTable)
          .where(eq(customerOrderItemsTable.orderId, o.id))
          .orderBy(customerOrderItemsTable.sortOrder);
        return { ...o, items };
      }));
      res.json(result);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في البحث" });
    }
  });

  // GET /api/customer-orders/:id
  router.get("/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [order] = await db
        .select()
        .from(customerOrdersTable)
        .where(eq(customerOrdersTable.id, id));
      if (!order) return res.status(404).json({ error: "الأمر غير موجود" });

      const items = await db
        .select()
        .from(customerOrderItemsTable)
        .where(eq(customerOrderItemsTable.orderId, id))
        .orderBy(customerOrderItemsTable.sortOrder);

      res.json({ ...order, items });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في جلب الأمر" });
    }
  });

  // POST /api/customer-orders
  router.post("/", async (req, res) => {
    try {
      const { customerPoNo, orderDate, notes, items } = req.body;

      if (!customerPoNo?.trim()) return res.status(400).json({ error: "رقم أمر الشراء مطلوب" });
      if (!orderDate) return res.status(400).json({ error: "التاريخ مطلوب" });
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "يجب إضافة بند واحد على الأقل" });
      }

      let customerId: number | null = null;
      let customerName = "";
      const firstQuotationId = (items as any[])[0]?.quotationId;
      if (firstQuotationId) {
        const [cq] = await db
          .select({ customerId: customerQuotationsTable.customerId, customerName: customersTable.name })
          .from(customerQuotationsTable)
          .leftJoin(customersTable, eq(customerQuotationsTable.customerId, customersTable.id))
          .where(eq(customerQuotationsTable.id, Number(firstQuotationId)));
        if (cq) { customerId = cq.customerId; customerName = cq.customerName ?? ""; }
      }

      const totalAmount = (items as any[]).reduce((sum: number, it: any) =>
        sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0
      );

      const orderNo = generateOrderNo();
      const [order] = await db
        .insert(customerOrdersTable)
        .values({
          orderNo,
          customerPoNo: customerPoNo.trim(),
          customerId,
          customerName,
          orderDate: orderDate.trim(),
          notes: notes?.trim() ?? "",
          status: "مفتوح",
          totalAmount: String(totalAmount),
        })
        .returning();

      if (items.length > 0) {
        const itemRows = (items as any[]).map((item: any, idx: number) => ({
          orderId: order.id,
          quotationId: item.quotationId ? Number(item.quotationId) : null,
          quotationNo: item.quotationNo?.trim() ?? "",
          quotationItemId: item.quotationItemId ? Number(item.quotationItemId) : null,
          description: item.description?.trim() ?? "",
          partNo: item.partNo?.trim() ?? "",
          unit: item.unit?.trim() ?? "",
          quantity: String(parseFloat(item.quantity) || 0),
          unitPrice: String(parseFloat(item.unitPrice) || 0),
          totalPrice: String((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)),
          sortOrder: idx,
        }));
        await db.insert(customerOrderItemsTable).values(itemRows);
      }

      res.status(201).json({ ...order, itemCount: items.length });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في إنشاء الأمر" });
    }
  });

  // PUT /api/customer-orders/:id  (edit)
  router.put("/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { customerPoNo, orderDate, notes, status, items } = req.body;

      if (!customerPoNo?.trim()) return res.status(400).json({ error: "رقم أمر الشراء مطلوب" });
      if (!orderDate) return res.status(400).json({ error: "التاريخ مطلوب" });
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "يجب إضافة بند واحد على الأقل" });
      }

      let customerId: number | null = null;
      let customerName = "";
      const firstQuotationId = (items as any[])[0]?.quotationId;
      if (firstQuotationId) {
        const [cq] = await db
          .select({ customerId: customerQuotationsTable.customerId, customerName: customersTable.name })
          .from(customerQuotationsTable)
          .leftJoin(customersTable, eq(customerQuotationsTable.customerId, customersTable.id))
          .where(eq(customerQuotationsTable.id, Number(firstQuotationId)));
        if (cq) { customerId = cq.customerId; customerName = cq.customerName ?? ""; }
      }

      const totalAmount = (items as any[]).reduce((sum: number, it: any) =>
        sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0
      );

      const [updated] = await db
        .update(customerOrdersTable)
        .set({
          customerPoNo: customerPoNo.trim(),
          customerId,
          customerName,
          orderDate: orderDate.trim(),
          notes: notes?.trim() ?? "",
          status: status ?? "مفتوح",
          totalAmount: String(totalAmount),
          updatedAt: new Date(),
        })
        .where(eq(customerOrdersTable.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: "الأمر غير موجود" });

      // Replace all items
      await db.delete(customerOrderItemsTable).where(eq(customerOrderItemsTable.orderId, id));

      const itemRows = (items as any[]).map((item: any, idx: number) => ({
        orderId: id,
        quotationId: item.quotationId ? Number(item.quotationId) : null,
        quotationNo: item.quotationNo?.trim() ?? "",
        quotationItemId: item.quotationItemId ? Number(item.quotationItemId) : null,
        description: item.description?.trim() ?? "",
        partNo: item.partNo?.trim() ?? "",
        unit: item.unit?.trim() ?? "",
        quantity: String(parseFloat(item.quantity) || 0),
        unitPrice: String(parseFloat(item.unitPrice) || 0),
        totalPrice: String((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)),
        sortOrder: idx,
      }));
      await db.insert(customerOrderItemsTable).values(itemRows);

      res.json({ ...updated, itemCount: itemRows.length });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في تحديث الأمر" });
    }
  });

  // DELETE /api/customer-orders/:id
  router.delete("/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(customerOrdersTable).where(eq(customerOrdersTable.id, id));
      res.json({ success: true });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "فشل في حذف الأمر" });
    }
  });

  export default router;
  