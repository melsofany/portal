import { Router, type IRouter } from "express";
    import healthRouter from "./health";
    import authRouter from "./auth";
    import rfqResponseRouter from "./rfq-response";
    import suppliersRouter from "./suppliers";
    import supplierCategoriesRouter from "./supplier-categories";
    import supplierPaymentMethodsRouter from "./supplier-payment-methods";
    import customersRouter from "./customers";
    import customerQuotationsRouter from "./customer-quotations";
    import supplierQuotationsRouter from "./supplier-quotations";
    import whatsappRouter, { webhookVerify, webhookIncoming } from "./whatsapp";
    import settingsRouter from "./settings";
    import customerOrdersRouter from "./customer-orders";
    import supplierOrdersRouter from "./supplier-orders";
    import accountsRouter from "./accounts";
    import supplierPaymentsRouter from "./supplier-payments";
    import deliveryPermitsRouter from "./delivery-permits";
  import itemsRouter from "./items";
  import dashboardRouter from "./dashboard";
  import employeesRouter from "./employees";
  import usersRouter from "./users";
    import { requireAuth, requirePermission, requireAdmin } from "../middlewares/authMiddleware";
    import { eq } from "drizzle-orm";
      import { db } from "@workspace/db";
      import { companySettingsTable, employeesTable } from "@workspace/db/schema";

    const router: IRouter = Router();

    router.use(healthRouter);
    router.use("/auth", authRouter);
    router.use("/rfq", rfqResponseRouter);

    // Public WhatsApp webhook — Meta sends these without Bearer auth
    router.get("/whatsapp/webhook", webhookVerify);
    router.post("/whatsapp/webhook", webhookIncoming);

    // Public endpoint — returns company name + logo without auth (used by sign-in page)
      router.get("/settings/public", async (_req, res) => {
        try {
          const rows = await db.select({ name: companySettingsTable.name, logoUrl: companySettingsTable.logoUrl }).from(companySettingsTable).limit(1);
          res.json(rows[0] ?? { name: "", logoUrl: "" });
        } catch {
          res.json({ name: "", logoUrl: "" });
        }
      });

    // Public endpoint — serves the company logo as a favicon image (no auth required)
    router.get("/settings/favicon", async (_req, res) => {
      try {
        const rows = await db.select({ logoUrl: companySettingsTable.logoUrl }).from(companySettingsTable).limit(1);
        const logoUrl = rows[0]?.logoUrl ?? "";
        if (!logoUrl) {
          const blank = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
          res.setHeader("Content-Type", "image/png");
          res.setHeader("Cache-Control", "public, max-age=60");
          return res.send(blank);
        }
        if (logoUrl.startsWith("data:")) {
          const [meta, b64] = logoUrl.split(",");
          const mimeMatch = meta.match(/data:([^;]+)/);
          const mime = mimeMatch ? mimeMatch[1] : "image/png";
          res.setHeader("Content-Type", mime);
          res.setHeader("Cache-Control", "public, max-age=60");
          return res.send(Buffer.from(b64, "base64"));
        }
        return res.redirect(302, logoUrl);
      } catch { res.status(500).end(); }
    });

      router.use(requireAuth);

    router.use("/suppliers",              requirePermission("suppliers"),      suppliersRouter);
    router.use("/suppliers/:id/payment-methods", requirePermission("suppliers"), supplierPaymentMethodsRouter);
    router.use("/supplier-categories",    requirePermission("suppliers"),      supplierCategoriesRouter);
    router.use("/customers",              requirePermission("customers"),      customersRouter);
    router.use("/customer-quotations",    requirePermission("quotations"),     customerQuotationsRouter);
    router.use("/supplier-quotations",    requirePermission("quotations"),     supplierQuotationsRouter);
    router.use("/whatsapp",               requireAdmin,                        whatsappRouter);
    router.use("/settings",               requirePermission("settings"),       settingsRouter);
    router.use("/customer-orders",        requirePermission("customerOrders"), customerOrdersRouter);
    router.use("/supplier-orders",        requirePermission("supplierOrders"), supplierOrdersRouter);
    router.use("/accounts",               requirePermission("finance"),        accountsRouter);
    router.use("/supplier-payments",      requirePermission("finance"),        supplierPaymentsRouter);
    router.use("/delivery-permits",       requirePermission("customerOrders"), deliveryPermitsRouter);
    router.use("/items",                  requirePermission("suppliers"),      itemsRouter);
    router.use("/dashboard",              requirePermission("dashboard"),      dashboardRouter);
    // Any authenticated user can read their own employee record (for PDF generation etc.)
      router.get("/employees/me", async (req, res) => {
        try {
          const userId = req.auth?.userId;
          if (!userId) return res.json({ phone: "", fullName: "" });
          const [emp] = await db.select({ phone: employeesTable.phone, fullName: employeesTable.fullName })
            .from(employeesTable).where(eq(employeesTable.userId, userId)).limit(1);
          res.json(emp ?? { phone: "", fullName: "" });
        } catch { res.json({ phone: "", fullName: "" }); }
      });
      router.use("/employees",              requirePermission("employees"),      employeesRouter);
    router.use("/users",                  requireAdmin,                        usersRouter);

    export default router;
  