import { Router } from "express";
import { db, pool } from "@workspace/db";
import {
  supplierPaymentsTable,
  supplierOrdersTable,
} from "@workspace/db/schema";
import { eq, desc, and, ne } from "drizzle-orm";

const router = Router();

function generatePaymentNo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return "PAY-" + y + m + d + "-" + rand;
}

// GET /api/supplier-payments
router.get("/", async (req, res) => {
  try {
    const payments = await db
      .select()
      .from(supplierPaymentsTable)
      .orderBy(desc(supplierPaymentsTable.createdAt));
    // strip heavy file data from list view
    const result = payments.map(({ receiptFileData, ...p }) => p);
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب المدفوعات" });
  }
});

// GET /api/supplier-payments/check/:supplierOrderId
router.get("/check/:supplierOrderId", async (req, res) => {
  try {
    const supplierOrderId = Number(req.params.supplierOrderId);
    const existing = await db
      .select({
        id: supplierPaymentsTable.id,
        paymentNo: supplierPaymentsTable.paymentNo,
        referenceNo: supplierPaymentsTable.referenceNo,
        amount: supplierPaymentsTable.amount,
        paymentDate: supplierPaymentsTable.paymentDate,
      })
      .from(supplierPaymentsTable)
      .where(eq(supplierPaymentsTable.supplierOrderId, supplierOrderId));
    res.json({ alreadyPaid: existing.length > 0, payments: existing });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في التحقق من حالة الدفع" });
  }
});

// GET /api/supplier-payments/:id  (includes file data)
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [payment] = await db
      .select()
      .from(supplierPaymentsTable)
      .where(eq(supplierPaymentsTable.id, id));
    if (!payment) return res.status(404).json({ error: "الدفعة غير موجودة" });
    res.json(payment);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في جلب الدفعة" });
  }
});

// POST /api/supplier-payments
router.post("/", async (req, res) => {
  try {
    const {
      supplierOrderId,
      amount,
      paymentDate,
      paymentMethod,
      referenceNo,
      receiptFileData,
      receiptFileName,
      receiptFileType,
      notes,
    } = req.body;

    if (!supplierOrderId) {
      return res.status(400).json({ error: "أمر الشراء مطلوب" });
    }
    if (!paymentDate) {
      return res.status(400).json({ error: "تاريخ الدفع مطلوب" });
    }
    const refNo = referenceNo?.trim() ?? "";
    if (!refNo) {
      return res.status(400).json({ error: "رقم الإيصال / المرجع مطلوب" });
    }

    // Prevent duplicate payment for same PO
    const existingForOrder = await db
      .select({ paymentNo: supplierPaymentsTable.paymentNo })
      .from(supplierPaymentsTable)
      .where(eq(supplierPaymentsTable.supplierOrderId, Number(supplierOrderId)));
    if (existingForOrder.length > 0) {
      return res.status(409).json({
        error:
          "لا يمكن الدفع أكثر من مرة لنفس أمر الشراء — تم تسجيل دفعة مسبقاً برقم: " +
          existingForOrder[0].paymentNo,
      });
    }

    // Prevent duplicate reference number across all payments
    const existingRef = await db
      .select({ paymentNo: supplierPaymentsTable.paymentNo })
      .from(supplierPaymentsTable)
      .where(eq(supplierPaymentsTable.referenceNo, refNo));
    if (existingRef.length > 0) {
      return res.status(409).json({
        error:
          "رقم الإيصال/المرجع \"" + refNo + "\" مستخدم مسبقاً في دفعة رقم: " +
          existingRef[0].paymentNo,
      });
    }

    const [order] = await db
      .select()
      .from(supplierOrdersTable)
      .where(eq(supplierOrdersTable.id, Number(supplierOrderId)));
    if (!order) {
      return res.status(404).json({ error: "أمر الشراء غير موجود" });
    }

    const paymentNo = generatePaymentNo();

    const [payment] = await db
      .insert(supplierPaymentsTable)
      .values({
        paymentNo,
        supplierOrderId: Number(supplierOrderId),
        orderNo: order.orderNo ?? "",
        supplierId: order.supplierId ?? null,
        supplierName: order.supplierName ?? "",
        amount: String(parseFloat(amount) || 0),
        paymentDate: paymentDate.trim(),
        paymentMethod: paymentMethod?.trim() || "تحويل بنكي",
        referenceNo: refNo,
        receiptFileData: receiptFileData ?? "",
        receiptFileName: receiptFileName?.trim() ?? "",
        receiptFileType: receiptFileType?.trim() ?? "",
        notes: notes?.trim() ?? "",
        status: "مدفوع",
      })
      .returning();

    // Mark the supplier order as completed
    await pool.query(
      "UPDATE supplier_orders SET status = $1, updated_at = NOW() WHERE id = $2",
      ["مكتمل", Number(supplierOrderId)]
    );

    const { receiptFileData: _, ...safePayment } = payment;
    res.status(201).json(safePayment);
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في تسجيل الدفعة" });
  }
});

// DELETE /api/supplier-payments/:id
router.delete("/:id", async (req, res) => {
  try {
    await db
      .delete(supplierPaymentsTable)
      .where(eq(supplierPaymentsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل في حذف الدفعة" });
  }
});

export default router;
