import { pool } from "@workspace/db";

  /**
   * Runs CREATE TABLE IF NOT EXISTS for all tables.
   * Safe to call on every startup — idempotent.
   */
  export async function runMigrations(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id            SERIAL PRIMARY KEY,
          username      TEXT NOT NULL UNIQUE,
          email         TEXT,
          password_hash TEXT NOT NULL,
          full_name     TEXT DEFAULT '',
          role          TEXT NOT NULL DEFAULT 'user',
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS customers (
          id              SERIAL PRIMARY KEY,
          name            TEXT NOT NULL,
          phone           TEXT UNIQUE,
          whatsapp        TEXT UNIQUE,
          email           TEXT UNIQUE,
          address         TEXT,
          commercial_reg  TEXT,
          tax_reg         TEXT,
          status          TEXT NOT NULL DEFAULT 'نشط',
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS supplier_categories (
          id         SERIAL PRIMARY KEY,
          name       TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS suppliers (
          id              SERIAL PRIMARY KEY,
          company_name    TEXT NOT NULL,
          contact_name    TEXT,
          phone           TEXT UNIQUE,
          whatsapp        TEXT UNIQUE,
          email           TEXT UNIQUE,
          address         TEXT,
          commercial_reg  TEXT,
          tax_reg         TEXT,
          status          TEXT NOT NULL DEFAULT 'نشط',
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS supplier_category_assignments (
          id          SERIAL PRIMARY KEY,
          supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
          category_id INTEGER NOT NULL REFERENCES supplier_categories(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS customer_quotations (
          id                SERIAL PRIMARY KEY,
          quotation_no      TEXT NOT NULL UNIQUE,
          customer_id       INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
          responsible_name  TEXT DEFAULT '',
          request_date      TEXT NOT NULL,
          expiry_date       TEXT DEFAULT '',
          customer_order_no TEXT DEFAULT '',
          status            TEXT NOT NULL DEFAULT 'مفتوح',
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS customer_quotation_items (
          id                 SERIAL PRIMARY KEY,
          quotation_id       INTEGER NOT NULL REFERENCES customer_quotations(id) ON DELETE CASCADE,
          customer_item_code TEXT DEFAULT '',
          description        TEXT NOT NULL,
          part_no            TEXT DEFAULT '',
          unit               TEXT DEFAULT '',
          quantity           NUMERIC(12,3) NOT NULL DEFAULT 0,
          sort_order         INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS supplier_quotations (
          id                  SERIAL PRIMARY KEY,
          rfq_no              TEXT NOT NULL UNIQUE,
          source_quotation_id INTEGER REFERENCES customer_quotations(id) ON DELETE SET NULL,
          source_quotation_no TEXT DEFAULT '',
          customer_order_no   TEXT DEFAULT '',
          request_date        TEXT NOT NULL,
          notes               TEXT DEFAULT '',
          status              TEXT NOT NULL DEFAULT 'مرسل',
          created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS supplier_quotation_items (
          id                 SERIAL PRIMARY KEY,
          rfq_id             INTEGER NOT NULL REFERENCES supplier_quotations(id) ON DELETE CASCADE,
          customer_item_code TEXT DEFAULT '',
          description        TEXT NOT NULL,
          part_no            TEXT DEFAULT '',
          unit               TEXT DEFAULT '',
          quantity           NUMERIC(12,3) NOT NULL DEFAULT 0,
          sort_order         INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS supplier_quotation_suppliers (
          id                    SERIAL PRIMARY KEY,
          rfq_id                INTEGER NOT NULL REFERENCES supplier_quotations(id) ON DELETE CASCADE,
          supplier_id           INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
          sent_via              TEXT DEFAULT '',
          sent_at               TIMESTAMPTZ,
          token                 TEXT DEFAULT '',
          response_status       TEXT NOT NULL DEFAULT 'pending',
          response_submitted_at TIMESTAMPTZ,
          vat_included          TEXT DEFAULT 'no',
          delivery_days         INTEGER,
          response_notes        TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS supplier_quotation_item_prices (
          id              SERIAL PRIMARY KEY,
          rfq_supplier_id INTEGER NOT NULL REFERENCES supplier_quotation_suppliers(id) ON DELETE CASCADE,
          rfq_item_id     INTEGER NOT NULL REFERENCES supplier_quotation_items(id) ON DELETE CASCADE,
          unit_price      NUMERIC(14,3) NOT NULL DEFAULT 0,
          notes           TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS company_settings (
          id              SERIAL PRIMARY KEY,
          name            TEXT DEFAULT '',
          logo_url        TEXT DEFAULT '',
          address         TEXT DEFAULT '',
          phone           TEXT DEFAULT '',
          email           TEXT DEFAULT '',
          commercial_reg  TEXT DEFAULT '',
          tax_reg         TEXT DEFAULT '',
          website         TEXT DEFAULT ''
        );
      `);
      // Add new columns idempotently
        await client.query(`
          ALTER TABLE supplier_quotation_suppliers ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMPTZ;
        `);
      // Add new columns idempotently
        await client.query(`
          ALTER TABLE supplier_quotation_suppliers ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMPTZ;
          ALTER TABLE customer_quotation_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(14,3) DEFAULT 0;
          ALTER TABLE customer_quotation_items ADD COLUMN IF NOT EXISTS customer_notes TEXT DEFAULT '';
        `);
        
        // Add customer orders tables
        await client.query(`
          CREATE TABLE IF NOT EXISTS customer_orders (
            id              SERIAL PRIMARY KEY,
            order_no        TEXT NOT NULL UNIQUE,
            customer_po_no  TEXT DEFAULT '',
            customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
            customer_name   TEXT DEFAULT '',
            order_date      TEXT NOT NULL,
            notes           TEXT DEFAULT '',
            status          TEXT NOT NULL DEFAULT 'مفتوح',
            total_amount    NUMERIC(14,3) DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS customer_order_items (
            id                 SERIAL PRIMARY KEY,
            order_id           INTEGER NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
            quotation_id       INTEGER REFERENCES customer_quotations(id) ON DELETE SET NULL,
            quotation_no       TEXT DEFAULT '',
            quotation_item_id  INTEGER REFERENCES customer_quotation_items(id) ON DELETE SET NULL,
            description        TEXT NOT NULL,
            part_no            TEXT DEFAULT '',
            unit               TEXT DEFAULT '',
            quantity           NUMERIC(12,3) NOT NULL DEFAULT 0,
            unit_price         NUMERIC(14,3) NOT NULL DEFAULT 0,
            total_price        NUMERIC(14,3) NOT NULL DEFAULT 0,
            sort_order         INTEGER NOT NULL DEFAULT 0
          );
        `);
        
        // Add supplier orders tables
        await client.query(`
          CREATE TABLE IF NOT EXISTS supplier_orders (
            id              SERIAL PRIMARY KEY,
            order_no        TEXT NOT NULL UNIQUE,
            supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
            supplier_name   TEXT DEFAULT '',
            supplier_email  TEXT DEFAULT '',
            supplier_whatsapp TEXT DEFAULT '',
            order_date      TEXT NOT NULL,
            notes           TEXT DEFAULT '',
            status          TEXT NOT NULL DEFAULT 'مفتوح',
            total_amount    NUMERIC(14,3) DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS supplier_order_items (
            id                      SERIAL PRIMARY KEY,
            order_id                INTEGER NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
            customer_order_id       INTEGER REFERENCES customer_orders(id) ON DELETE SET NULL,
            customer_order_no       TEXT DEFAULT '',
            customer_order_item_id  INTEGER REFERENCES customer_order_items(id) ON DELETE SET NULL,
            description             TEXT NOT NULL,
            part_no                 TEXT DEFAULT '',
            unit                    TEXT DEFAULT '',
            quantity                NUMERIC(12,3) NOT NULL DEFAULT 0,
            unit_price              NUMERIC(14,3) NOT NULL DEFAULT 0,
            total_price             NUMERIC(14,3) NOT NULL DEFAULT 0,
            sort_order              INTEGER NOT NULL DEFAULT 0
          );
        `);

        // Add supplier payment methods table
        await client.query(`
          CREATE TABLE IF NOT EXISTS supplier_payment_methods (
            id             SERIAL PRIMARY KEY,
            supplier_id    INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
            type           TEXT NOT NULL,
            wallet_type    TEXT,
            owner_name     TEXT,
            phone          TEXT,
            bank_name      TEXT,
            account_number TEXT,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        // Add supplier payments table
        await client.query(`
          CREATE TABLE IF NOT EXISTS supplier_payments (
            id                SERIAL PRIMARY KEY,
            payment_no        TEXT NOT NULL UNIQUE,
            supplier_order_id INTEGER NOT NULL REFERENCES supplier_orders(id) ON DELETE RESTRICT,
            order_no          TEXT DEFAULT '',
            supplier_id       INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
            supplier_name     TEXT DEFAULT '',
            amount            NUMERIC(14,3) NOT NULL DEFAULT 0,
            payment_date      TEXT NOT NULL,
            payment_method    TEXT NOT NULL DEFAULT 'تحويل بنكي',
            reference_no      TEXT DEFAULT '',
            receipt_file_data TEXT DEFAULT '',
            receipt_file_name TEXT DEFAULT '',
            receipt_file_type TEXT DEFAULT '',
            notes             TEXT DEFAULT '',
            status            TEXT NOT NULL DEFAULT 'مدفوع',
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        // Add accounting / expenses tables
        await client.query(`
          CREATE TABLE IF NOT EXISTS expense_categories (
            id           SERIAL PRIMARY KEY,
            code         TEXT NOT NULL UNIQUE,
            name_ar      TEXT NOT NULL,
            name_en      TEXT NOT NULL,
            type         TEXT NOT NULL,
            account_code TEXT,
            is_system    BOOLEAN NOT NULL DEFAULT FALSE,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS expenses (
            id                SERIAL PRIMARY KEY,
            category_id       INTEGER REFERENCES expense_categories(id),
            type              TEXT NOT NULL,
            supplier_order_id INTEGER REFERENCES supplier_orders(id) ON DELETE SET NULL,
            date              TEXT NOT NULL,
            description       TEXT NOT NULL,
            amount            NUMERIC(14,2) NOT NULL,
            vat_rate          NUMERIC(5,2)  NOT NULL DEFAULT 0,
            vat_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
            total_amount      NUMERIC(14,2) NOT NULL,
            reference_no      TEXT DEFAULT '',
            notes             TEXT DEFAULT '',
            payment_method    TEXT DEFAULT '',
            status            TEXT NOT NULL DEFAULT 'مسجل',
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        // Add delivery permits table
        await client.query(`
          CREATE TABLE IF NOT EXISTS delivery_permits (
            id                SERIAL PRIMARY KEY,
            permit_no         TEXT NOT NULL UNIQUE,
            customer_order_id INTEGER REFERENCES customer_orders(id) ON DELETE RESTRICT,
            customer_order_no TEXT DEFAULT '',
            customer_po_no    TEXT DEFAULT '',
            customer_name     TEXT DEFAULT '',
            supplier_order_id INTEGER REFERENCES supplier_orders(id) ON DELETE RESTRICT,
            supplier_order_no TEXT DEFAULT '',
            supplier_name     TEXT DEFAULT '',
            delivery_date     TEXT NOT NULL,
            notes             TEXT DEFAULT '',
            status            TEXT NOT NULL DEFAULT '\u0635\u0627\u062f\u0631',
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        // Fix existing supplier orders that have payments but status is still مفتوح
        await client.query(`
          UPDATE supplier_orders
          SET status = 'مكتمل', updated_at = NOW()
          WHERE id IN (
            SELECT DISTINCT supplier_order_id FROM supplier_payments
          )
          AND status != 'مكتمل';
        `);

        // Add rejection_reason column to delivery_permits if not exists
        await client.query(`
          ALTER TABLE delivery_permits ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT '';
        `);


          // WhatsApp messages table
          await client.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_messages (
              id           SERIAL PRIMARY KEY,
              direction    TEXT NOT NULL,
              phone        TEXT NOT NULL,
              contact_name TEXT NOT NULL DEFAULT '',
              message_text TEXT NOT NULL DEFAULT '',
              message_id   TEXT NOT NULL UNIQUE,
              read_at      TIMESTAMPTZ,
              sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_wamsg_phone   ON whatsapp_messages(phone);
            CREATE INDEX IF NOT EXISTS idx_wamsg_sent_at ON whatsapp_messages(sent_at DESC);
          `);

          // Order costs & invoices tables (accounts module)
          await client.query(`
            CREATE TABLE IF NOT EXISTS order_costs (
              id                  SERIAL PRIMARY KEY,
              customer_order_id   INTEGER NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
              cost_type           TEXT NOT NULL,
              description         TEXT NOT NULL,
              supplier_order_id   INTEGER REFERENCES supplier_orders(id) ON DELETE SET NULL,
              amount              NUMERIC(14,2) NOT NULL DEFAULT 0,
              vat_rate            NUMERIC(5,2)  NOT NULL DEFAULT 14,
              vat_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
              insurance_rate      NUMERIC(5,2)  NOT NULL DEFAULT 3,
              insurance_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
              total_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
              reference_no        TEXT DEFAULT '',
              notes               TEXT DEFAULT '',
              created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
          `);

          await client.query(`
            CREATE TABLE IF NOT EXISTS invoices (
              id                  SERIAL PRIMARY KEY,
              invoice_no          TEXT NOT NULL UNIQUE,
              customer_order_id   INTEGER NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT,
              customer_order_no   TEXT DEFAULT '',
              customer_po_no      TEXT DEFAULT '',
              customer_name       TEXT DEFAULT '',
              invoice_date        TEXT NOT NULL,
              subtotal            NUMERIC(14,2) NOT NULL DEFAULT 0,
              vat_rate            NUMERIC(5,2)  NOT NULL DEFAULT 14,
              vat_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
              total_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
              total_costs         NUMERIC(14,2) NOT NULL DEFAULT 0,
              net_profit          NUMERIC(14,2) NOT NULL DEFAULT 0,
              status              TEXT NOT NULL DEFAULT 'مسودة',
              notes               TEXT DEFAULT '',
              created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
          `);
          // Company general expenses table
          await client.query(`
            CREATE TABLE IF NOT EXISTS company_expenses (
              id            SERIAL PRIMARY KEY,
              expense_type  TEXT NOT NULL,
              description   TEXT NOT NULL,
              amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
              expense_date  TEXT NOT NULL,
              reference_no  TEXT DEFAULT '',
              notes         TEXT DEFAULT '',
              created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
          `);


            // Add new company_settings columns (SMTP, WhatsApp, ZATCA, Bank)
            await client.query(`
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS smtp_host         TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS smtp_port         TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS smtp_user         TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS smtp_pass         TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS smtp_from_name    TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS whatsapp_account_id   TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS whatsapp_phone_number TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS whatsapp_token        TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS whatsapp_verify_token TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS whatsapp_templates    TEXT DEFAULT '[]';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS zatca_vat_number   TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS zatca_environment  TEXT DEFAULT 'sandbox';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS zatca_api_url      TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS zatca_api_key      TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS zatca_certificate  TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS zatca_private_key  TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_name          TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_iban          TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_account_number TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_swift         TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_api_url       TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_api_key       TEXT DEFAULT '';
              ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_api_secret    TEXT DEFAULT '';
            `);

            // Add session_token column to users table (single-session support)
            await client.query(`
              ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT;
            `);

            console.log("[migrate] Schema ready");
    } finally {
      client.release();
    }
  }
  
