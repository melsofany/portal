import { Router } from "express";
  import { db } from "@workspace/db";
  import { companySettingsTable } from "@workspace/db/schema";

  const router = Router();

  async function ensureSettings() {
    const rows = await db.select().from(companySettingsTable).limit(1);
    if (rows.length === 0) {
      const inserted = await db.insert(companySettingsTable).values({}).returning();
      return inserted[0];
    }
    return rows[0];
  }

  // Public endpoint — returns only name + logoUrl (no auth required)
    router.get("/public", async (req, res) => {
      try {
        const settings = await ensureSettings();
        res.json({ name: settings.name, logoUrl: settings.logoUrl });
      } catch {
        res.json({ name: "", logoUrl: "" });
      }
    });

    router.get("/", async (req, res) => {
    try {
      const settings = await ensureSettings();
      res.json(settings);
    } catch (err) {
      req.log?.error?.(err);
      res.status(500).json({ error: "فشل في جلب الإعدادات" });
    }
  });

  router.put("/", async (req, res) => {
    try {
      const body = req.body as Record<string, string>;
      const settings = await ensureSettings();
      const updated = await db
        .update(companySettingsTable)
        .set({
          name: body.name ?? settings.name,
          logoUrl: body.logoUrl ?? settings.logoUrl,
          address: body.address ?? settings.address,
          phone: body.phone ?? settings.phone,
          email: body.email ?? settings.email,
          commercialReg: body.commercialReg ?? settings.commercialReg,
          taxReg: body.taxReg ?? settings.taxReg,
          website: body.website ?? settings.website,
          smtpHost: body.smtpHost ?? settings.smtpHost,
          smtpPort: body.smtpPort ?? settings.smtpPort,
          smtpUser: body.smtpUser ?? settings.smtpUser,
          smtpPass: body.smtpPass ?? settings.smtpPass,
          smtpFromName: body.smtpFromName ?? settings.smtpFromName,
          whatsappAccountId: body.whatsappAccountId ?? settings.whatsappAccountId,
          whatsappPhoneNumber: body.whatsappPhoneNumber ?? settings.whatsappPhoneNumber,
          whatsappToken: body.whatsappToken ?? settings.whatsappToken,
          whatsappVerifyToken: body.whatsappVerifyToken ?? settings.whatsappVerifyToken,
          whatsappTemplates: body.whatsappTemplates ?? settings.whatsappTemplates,
          zatcaVatNumber: body.zatcaVatNumber ?? settings.zatcaVatNumber,
          zatcaEnvironment: body.zatcaEnvironment ?? settings.zatcaEnvironment,
          zatcaApiUrl: body.zatcaApiUrl ?? settings.zatcaApiUrl,
          zatcaApiKey: body.zatcaApiKey ?? settings.zatcaApiKey,
          zatcaCertificate: body.zatcaCertificate ?? settings.zatcaCertificate,
          zatcaPrivateKey: body.zatcaPrivateKey ?? settings.zatcaPrivateKey,
          bankName: body.bankName ?? settings.bankName,
          bankIban: body.bankIban ?? settings.bankIban,
          bankAccountNumber: body.bankAccountNumber ?? settings.bankAccountNumber,
          bankSwift: body.bankSwift ?? settings.bankSwift,
          bankApiUrl: body.bankApiUrl ?? settings.bankApiUrl,
          bankApiKey: body.bankApiKey ?? settings.bankApiKey,
          bankApiSecret: body.bankApiSecret ?? settings.bankApiSecret,
        })
        .returning();
      res.json(updated[0]);
    } catch (err) {
      req.log?.error?.(err);
      res.status(500).json({ error: "فشل في حفظ الإعدادات" });
    }
  });

  export default router;
  