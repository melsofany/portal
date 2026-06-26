import { Router } from "express";
import { db } from "@workspace/db";
import {
  deliveryPermitsTable,
  customerOrdersTable,
  customerOrderItemsTable,
  supplierOrdersTable,
  supplierOrderItemsTable,
  supplierPaymentsTable,
} from "@workspace/db/schema";
import { eq, desc, inArray } from "drizzle-orm";

const router = Router();

function generatePermitNo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return "DP-" + y + m + d + "-" + rand;
}

// GET /api/delivery-permits
router.get("/", async (req, res) => {
  try {
    const permits = await db
      .select()
      .from(deliveryPermitsTable)
      .orderBy(desc(deliveryPermitsTable.createdAt));
    res.json(permits);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب إذونات التسليم" });
  }
});

// GET /api/delivery-permits/:id/items
router.get("/:id/items", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "معرف الإذن مطلوب" });

    const [permit] = await db
      .select()
      .from(deliveryPermitsTable)
      .where(eq(deliveryPermitsTable.id, id));
    if (!permit) return res.status(404).json({ error: "إذن التسليم غير موجود" });

    const items = await db
      .select()
      .from(customerOrderItemsTable)
      .where(eq(customerOrderItemsTable.orderId, permit.customerOrderId!))
      .orderBy(customerOrderItemsTable.sortOrder);

    res.json(items);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب بنود الإذن" });
  }
});

// GET /api/delivery-permits/check-order/:customerOrderId
router.get("/check-order/:customerOrderId", async (req, res) => {
  try {
    const customerOrderId = Number(req.params.customerOrderId);
    if (!customerOrderId) return res.status(400).json({ error: "معرف الأمر مطلوب" });

    const [co] = await db
      .select()
      .from(customerOrdersTable)
      .where(eq(customerOrdersTable.id, customerOrderId));
    if (!co) return res.status(404).json({ error: "أمر الشراء غير موجود" });

    const soItems = await db
      .select()
      .from(supplierOrderItemsTable)
      .where(eq(supplierOrderItemsTable.customerOrderId, customerOrderId));

    const supplierOrderIds = [...new Set(soItems.map((i) => i.orderId))];
    if (supplierOrderIds.length === 0) {
      return res.json({
        customerOrder: co,
        supplierOrders: [],
        canIssuePermit: false,
        reason: "لا يوجد أمر توريد مرتبط بهذا الأمر",
      });
    }

    const supplierOrders = await db
      .select()
      .from(supplierOrdersTable)
      .where(inArray(supplierOrdersTable.id, supplierOrderIds));

    const ordersWithPayment = await Promise.all(
      supplierOrders.map(async (so) => {
        const payments = await db
          .select()
          .from(supplierPaymentsTable)
          .where(eq(supplierPaymentsTable.supplierOrderId, so.id));
        return { ...so, payments, isPaid: payments.length > 0 };
      })
    );

    const allPaid = ordersWithPayment.every((o) => o.isPaid);
    const anyPaid = ordersWithPayment.some((o) => o.isPaid);

    const existingPermits = await db
      .select()
      .from(deliveryPermitsTable)
      .where(eq(deliveryPermitsTable.customerOrderId, customerOrderId));

    res.json({
      customerOrder: co,
      supplierOrders: ordersWithPayment,
      canIssuePermit: anyPaid,
      allPaid,
      existingPermits,
      reason: anyPaid
        ? null
        : "لا يمكن إصدار إذن التسليم — لم يتم سداد المورد بعد",
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في التحقق من حالة الأمر" });
  }
});

// POST /api/delivery-permits
router.post("/", async (req, res) => {
  try {
    const { customerOrderId, supplierOrderId, deliveryDate, notes } = req.body;

    if (!customerOrderId)
      return res.status(400).json({ error: "أمر شراء العميل مطلوب" });
    if (!supplierOrderId)
      return res.status(400).json({ error: "أمر التوريد مطلوب" });
    if (!deliveryDate)
      return res.status(400).json({ error: "تاريخ التسليم مطلوب" });

    const payments = await db
      .select()
      .from(supplierPaymentsTable)
      .where(eq(supplierPaymentsTable.supplierOrderId, Number(supplierOrderId)));

    if (payments.length === 0) {
      return res.status(422).json({
        error: "لا يمكن إصدار إذن التسليم — لم يتم سداد المورد لأمر التوريد هذا بعد",
      });
    }

    const linkItems = await db
      .select()
      .from(supplierOrderItemsTable)
      .where(eq(supplierOrderItemsTable.orderId, Number(supplierOrderId)));
    const isLinked = linkItems.some(
      (i) => i.customerOrderId === Number(customerOrderId)
    );
    if (!isLinked) {
      return res.status(422).json({
        error: "أمر التوريد غير مرتبط بأمر شراء العميل المحدد",
      });
    }

    const [co] = await db
      .select()
      .from(customerOrdersTable)
      .where(eq(customerOrdersTable.id, Number(customerOrderId)));
    if (!co) return res.status(404).json({ error: "أمر الشراء غير موجود" });

    const [so] = await db
      .select()
      .from(supplierOrdersTable)
      .where(eq(supplierOrdersTable.id, Number(supplierOrderId)));
    if (!so) return res.status(404).json({ error: "أمر التوريد غير موجود" });

    const permitNo = generatePermitNo();

    const [permit] = await db
      .insert(deliveryPermitsTable)
      .values({
        permitNo,
        customerOrderId: Number(customerOrderId),
        customerOrderNo: co.orderNo,
        customerPoNo: co.customerPoNo ?? "",
        customerName: co.customerName ?? "",
        supplierOrderId: Number(supplierOrderId),
        supplierOrderNo: so.orderNo,
        supplierName: so.supplierName ?? "",
        deliveryDate: deliveryDate.trim(),
        notes: notes?.trim() ?? "",
        status: "صادر",
        rejectionReason: "",
      })
      .returning();

    res.status(201).json(permit);
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في إنشاء إذن التسليم" });
  }
});

// PATCH /api/delivery-permits/:id/status
router.patch("/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "معرف الإذن مطلوب" });

    const { status, rejectionReason } = req.body;
    const allowedStatuses = ["تم التسليم", "مرفوض"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "الحالة غير صالحة. القيم المسموح بها: تم التسليم، مرفوض" });
    }

    if (status === "مرفوض" && (!rejectionReason || !String(rejectionReason).trim())) {
      return res.status(400).json({ error: "سبب الرفض مطلوب عند تحديد حالة مرفوض" });
    }

    const [existing] = await db
      .select()
      .from(deliveryPermitsTable)
      .where(eq(deliveryPermitsTable.id, id));
    if (!existing) return res.status(404).json({ error: "إذن التسليم غير موجود" });

    const [updated] = await db
      .update(deliveryPermitsTable)
      .set({
        status,
        rejectionReason: status === "مرفوض" ? String(rejectionReason).trim() : "",
      })
      .where(eq(deliveryPermitsTable.id, id))
      .returning();

    res.json(updated);

      // إذا أصبح إذن التسليم "تم التسليم"، حدّث حالة أمر العميل المرتبط تلقائياً
      if (status === "تم التسليم" && existing.customerOrderId) {
        await db
          .update(customerOrdersTable)
          .set({ status: "قيد إصدار الفاتورة", updatedAt: new Date() })
          .where(eq(customerOrdersTable.id, existing.customerOrderId));
      }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في تحديث حالة الإذن" });
  }
});

// DELETE /api/delivery-permits/:id
router.delete("/:id", async (req, res) => {
  try {
    await db
      .delete(deliveryPermitsTable)
      .where(eq(deliveryPermitsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في حذف إذن التسليم" });
  }
});

export default router;
