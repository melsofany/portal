import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import {
  verifyWebhook,
  processWebhookEvent,
  onInboundMessage,
  sendWhatsAppText,
  isWhatsAppConfigured,
} from "../lib/whatsapp";
import { logger } from "../lib/logger";

const router = Router();

// ─── Public webhook handlers ─────────────────────────────────────────────────
// Uses the open-source whatsapp-api-js library (official Meta Cloud API
// wrapper) instead of hand-parsing the raw entry/changes payload shape.

export function webhookVerify(req: Request, res: Response): void {
  const mode = req.query["hub.mode"];
  const verify_token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode !== "subscribe" || typeof verify_token !== "string" || typeof challenge !== "string") {
    res.sendStatus(403);
    return;
  }
  const result = verifyWebhook({ "hub.mode": mode, "hub.verify_token": verify_token, "hub.challenge": challenge });
  if (typeof result === "string") {
    res.status(200).send(result);
  } else {
    res.sendStatus(403);
  }
}

onInboundMessage(async (msg) => {
  await pool.query(
    `INSERT INTO whatsapp_messages
       (direction, phone, contact_name, message_text, message_id, sent_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (message_id) DO NOTHING`,
    ["in", msg.from, msg.contactName, msg.text, msg.messageId, msg.timestamp],
  );
});

export async function webhookIncoming(req: Request & { rawBody?: string }, res: Response): Promise<void> {
  res.sendStatus(200);
  try {
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    await processWebhookEvent(req.body, req.rawBody, signature);
  } catch (err) {
    logger.error({ err }, "[whatsapp webhook] processing error");
  }
}

// ─── POST /send ──────────────────────────────────────────────────────────────

router.post("/send", async (req, res) => {
  const { to, message, contactName } = req.body as { to?: string; message?: string; contactName?: string };
  if (!to || !message) return res.status(400).json({ error: "to و message مطلوبان" });
  if (!isWhatsAppConfigured)
    return res.status(503).json({
      error: "WhatsApp Business API غير مهيأ — أضف WHATSAPP_PHONE_NUMBER_ID و WHATSAPP_ACCESS_TOKEN في متغيرات البيئة",
      notConfigured: true,
    });

  const phone = to.replace(/\D/g, "");
  try {
    const msgId = await sendWhatsAppText(phone, message);
    await pool.query(
      `INSERT INTO whatsapp_messages (direction, phone, contact_name, message_text, message_id, sent_at)
       VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (message_id) DO NOTHING`,
      ["out", phone, contactName ?? phone, message, msgId]
    );
    return res.json({ success: true, messageId: msgId });
  } catch (err: any) {
    return res.status(500).json({ error: "فشل إرسال الرسالة", details: err.message });
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
