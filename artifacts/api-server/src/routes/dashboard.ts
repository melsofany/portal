import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const { rows: customersCount } = await pool.query(`SELECT COUNT(*) AS count FROM customers`);
    const { rows: suppliersCount } = await pool.query(`SELECT COUNT(*) AS count FROM suppliers`);
    const { rows: ordersStats } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'مفتوح' THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN status = 'قيد التنفيذ' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status = 'مكتمل' THEN 1 ELSE 0 END) AS completed,
        COALESCE(SUM(total_amount::numeric), 0) AS total_revenue
      FROM customer_orders
    `);
    const { rows: quotationsStats } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'معلق' THEN 1 ELSE 0 END) AS pending
      FROM customer_quotations
    `);
    const { rows: invoicesStats } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'مدفوعة' THEN total_amount::numeric ELSE 0 END), 0) AS paid_amount,
        COALESCE(SUM(CASE WHEN status = 'صادرة' THEN total_amount::numeric ELSE 0 END), 0) AS pending_amount
      FROM invoices
    `);
    const { rows: recentOrders } = await pool.query(`
      SELECT id, order_no, customer_name, order_date, status, total_amount
      FROM customer_orders
      ORDER BY created_at DESC
      LIMIT 5
    `);

    res.json({
      customers: parseInt(customersCount[0].count),
      suppliers: parseInt(suppliersCount[0].count),
      orders: {
        total: parseInt(ordersStats[0].total),
        open: parseInt(ordersStats[0].open),
        inProgress: parseInt(ordersStats[0].in_progress),
        completed: parseInt(ordersStats[0].completed),
        totalRevenue: parseFloat(ordersStats[0].total_revenue),
      },
      quotations: {
        total: parseInt(quotationsStats[0].total),
        pending: parseInt(quotationsStats[0].pending),
      },
      invoices: {
        total: parseInt(invoicesStats[0].total),
        paidAmount: parseFloat(invoicesStats[0].paid_amount),
        pendingAmount: parseFloat(invoicesStats[0].pending_amount),
      },
      recentOrders,
    });
  } catch (err: any) {
    res.status(500).json({ error: "فشل في جلب إحصائيات الداشبورد", details: err.message });
  }
});

export default router;
