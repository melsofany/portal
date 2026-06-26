import { pgTable, serial, text } from "drizzle-orm/pg-core";

  export const companySettingsTable = pgTable("company_settings", {
    id: serial("id").primaryKey(),

    // ── بيانات الشركة الأساسية ──
    name: text("name").default(""),
    logoUrl: text("logo_url").default(""),
    address: text("address").default(""),
    phone: text("phone").default(""),
    email: text("email").default(""),
    commercialReg: text("commercial_reg").default(""),
    taxReg: text("tax_reg").default(""),
    website: text("website").default(""),

    // ── SMTP ──
    smtpHost: text("smtp_host").default(""),
    smtpPort: text("smtp_port").default(""),
    smtpUser: text("smtp_user").default(""),
    smtpPass: text("smtp_pass").default(""),
    smtpFromName: text("smtp_from_name").default(""),

    // ── واتساب ──
    whatsappAccountId: text("whatsapp_account_id").default(""),
    whatsappPhoneNumber: text("whatsapp_phone_number").default(""),
    whatsappToken: text("whatsapp_token").default(""),
    whatsappVerifyToken: text("whatsapp_verify_token").default(""),
    whatsappTemplates: text("whatsapp_templates").default("[]"),

    // ── منظومة الفاتورة الإلكترونية (ZATCA) ──
    zatcaVatNumber: text("zatca_vat_number").default(""),
    zatcaEnvironment: text("zatca_environment").default("sandbox"),
    zatcaApiUrl: text("zatca_api_url").default(""),
    zatcaApiKey: text("zatca_api_key").default(""),
    zatcaCertificate: text("zatca_certificate").default(""),
    zatcaPrivateKey: text("zatca_private_key").default(""),

    // ── الإنترنت البنكي ──
    bankName: text("bank_name").default(""),
    bankIban: text("bank_iban").default(""),
    bankAccountNumber: text("bank_account_number").default(""),
    bankSwift: text("bank_swift").default(""),
    bankApiUrl: text("bank_api_url").default(""),
    bankApiKey: text("bank_api_key").default(""),
    bankApiSecret: text("bank_api_secret").default(""),
  });

  export type CompanySettings = typeof companySettingsTable.$inferSelect;
  