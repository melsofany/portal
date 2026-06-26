import { Router, type Request, type Response } from "express";
  import { pool } from "@workspace/db";

  const router = Router();

  const phoneId = () => process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  const token = () => process.env.WHATSAPP_ACCESS_TOKEN ?? "";
  const verifyToken = () => process.env.WHATSAPP_VERIFY_TOKEN ?? "portal_whatsapp_verify";

  // ─── Public webhook handlers ─────────────────────────────────────────────────

  export function webhookVerify(req: Request, res: Response): void {
    if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === verifyToken()) {
      res.status(200).send(req.query["hub.challenge"] as string);
      return;
    }
    res.sendStatus(403);
  }

  export async function webhookIncoming(req: Request, res: Response): Promise<void> {
    res.sendStatus(200);
    try {
      const body = req.body;
      if (body.object !== "whatsapp_business_account") return;
      for (const entry of (body.entry ?? []) as any[]) {
        for (const change of (entry.changes ?? []) as any[]) {
          const value = change.value;
          if (!value?.messages) continue;
          for (const msg of value.messages as any[]) {
            const from = String(msg.from);
            const text = msg.type === "text" ? (msg.text?.body ?? "") : `[${msg.type}]`;
            const msgId = String(msg.id);
            const ts = new Date(Number(msg.timestamp) * 1000);
            const contactArr = (value.contacts ?? []) as any[];
            const contactName = contactArr.find((c: any) => c.wa_id === from)?.profile?.name ?? from;
            await pool.query(
              `INSERT INTO whatsapp_messages
                 (direction, phone, contact_name, message_text, message_id, sent_at)
               VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT (message_id) DO NOTHING`,
              ["in", from, contactName, text, msgId, ts]
            );
          }
        }
      }
    } catch (err) {
      console.error("[whatsapp webhook]", err);
    }
  }

  // ─── POST /send ──────────────────────────────────────────────────────────────

  router.post("/send", async (req, res) => {
    const { to, message, contactName } = req.body as { to?: string; message?: string; contactName?: string };
    if (!to || !message) return res.status(400).json({ error: "to و message مطلوبان" });
    if (!phoneId() || !token())
      return res.status(503).json({
        error: "WhatsApp Business API غير مهيأ — أضف WHATSAPP_PHONE_NUMBER_ID و WHATSAPP_ACCESS_TOKEN في متغيرات البيئة",
        notConfigured: true,
      });

    const phone = to.replace(/\D/g, "");
    try {
      const apiRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId()}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: message } }),
      });
      const data = (await apiRes.json()) as any;
      if (!apiRes.ok)
        return res.status(apiRes.status).json({ error: "فشل إرسال الرسالة", details: data?.error?.message ?? JSON.stringify(data) });

      const msgId = data?.messages?.[0]?.id ?? `out_${Date.now()}_${Math.random()}`;
      await pool.query(
        `INSERT INTO whatsapp_messages (direction, phone, contact_name, message_text, message_id, sent_at)
         VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (message_id) DO NOTHING`,
        ["out", phone, contactName ?? phone, message, msgId]
      );
      return res.json({ success: true, messageId: msgId });
    } catch (err: any) {
      return res.status(500).json({ error: "خطأ في الاتصال بـ WhatsApp API", details: err.message });
    }
  });

  // ─── GET /conversations ───────────────────────────────────────────────────────

  router.get("/conversations", async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT DISTINCT ON (phone)
          phone, contact_name,
          message_text AS last_message,
          direction    AS last_direction,
          sent_at      AS last_at,
          (SELECT COUNT(*) FROM whatsapp_messages w2
           WHERE w2.phone = w1.phone AND w2.direction = 'in' AND w2.read_at IS NULL) AS unread_count
        FROM whatsapp_messages w1
        ORDER BY phone, sent_at DESC
      `);
      rows.sort((a: any, b: any) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: "فشل جلب المحادثات", details: err.message });
    }
  });

  // ─── GET /messages/:phone ─────────────────────────────────────────────────────

  router.get("/messages/:phone", async (req, res) => {
    try {
      const phone = req.params.phone.replace(/\D/g, "");
      await pool.query(
        `UPDATE whatsapp_messages SET read_at = NOW() WHERE phone = $1 AND direction = 'in' AND read_at IS NULL`,
        [phone]
      );
      const { rows } = await pool.query(
        `SELECT id, direction, phone, contact_name, message_text, sent_at
         FROM whatsapp_messages WHERE phone = $1 ORDER BY sent_at ASC`,
        [phone]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: "فشل جلب الرسائل", details: err.message });
    }
  });

  export default router;
  