/**
 * WhatsApp routes — Baileys (open-source QR-based) for the chat page.
 * Meta webhook endpoints kept for compatibility with the supplier RFQ flow.
 */

import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/authMiddleware";
import {
  verifyWebhook,
  processWebhookEvent,
} from "../lib/whatsapp";
import {
  connectBaileys,
  reconnectBaileys,
  disconnectBaileys,
  sendBaileysText,
  getStatus,
  addSseClient,
  removeSseClient,
} from "../lib/baileys";

const router = Router();

// ─── SSE — real-time events ───────────────────────────────────────────────────

router.get("/events", requireAdmin, (req, res): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const hb = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(hb); removeSseClient(res); }
  }, 25_000);

  addSseClient(res);
  req.on("close", () => { clearInterval(hb); removeSseClient(res); });
});

// ─── Baileys connection management ────────────────────────────────────────────

router.get("/status", requireAdmin, (_req, res): void => {
  res.json(getStatus());
});

router.post("/connect", requireAdmin, async (_req, res): Promise<void> => {
  try {
    await connectBaileys();
    res.json({ ok: true, ...getStatus() });
  } catch (err) {
    logger.error({ err }, "baileys connect");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/reconnect", requireAdmin, async (_req, res): Promise<void> => {
  try {
    await reconnectBaileys();
    res.json({ ok: true, ...getStatus() });
  } catch (err) {
    logger.error({ err }, "baileys reconnect");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/disconnect", requireAdmin, async (_req, res): Promise<void> => {
  try {
    await disconnectBaileys();
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "baileys disconnect");
    res.status(500).json({ error: String(err) });
  }
});

// ─── Chat list ────────────────────────────────────────────────────────────────

router.get("/conversations", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (phone)
        phone,
        contact_name,
        message_text  AS last_message,
        direction     AS last_direction,
        sent_at       AS last_at,
        (SELECT COUNT(*) FROM whatsapp_messages w2
         WHERE w2.phone = w1.phone AND w2.direction = 'in' AND w2.read_at IS NULL
        ) AS unread_count
      FROM whatsapp_messages w1
      ORDER BY phone, sent_at DESC
    `);
    rows.sort((a: { last_at: string }, b: { last_at: string }) =>
      new Date(b.last_at).getTime() - new Date(a.last_at).getTime()
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "whatsapp/conversations");
    res.status(500).json({ error: "فشل جلب المحادثات" });
  }
});

// ─── Messages for a phone ─────────────────────────────────────────────────────

router.get("/messages/:phone", requireAdmin, async (req, res): Promise<void> => {
  const phone = req.params.phone.replace(/\D/g, "");
  try {
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
  } catch (err) {
    logger.error({ err, phone }, "whatsapp/messages/:phone");
    res.status(500).json({ error: "فشل جلب الرسائل" });
  }
});

// ─── Send message via Baileys ─────────────────────────────────────────────────

router.post("/send", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { to, message, contactName } = req.body as {
    to?: string; message?: string; contactName?: string;
  };
  if (!to || !message?.trim()) {
    res.status(400).json({ error: "to و message مطلوبان" });
    return;
  }
  try {
    const msgId = await sendBaileysText(to, message.trim(), contactName);
    res.json({ success: true, messageId: msgId });
  } catch (err) {
    logger.error({ err, to }, "whatsapp/send");
    res.status(500).json({
      error: err instanceof Error ? err.message : "فشل إرسال الرسالة",
    });
  }
});

// ─── Meta webhook — kept for RFQ supplier flow ───────────────────────────────

export function webhookVerify(req: Request, res: Response): void {
  const mode = req.query["hub.mode"];
  const verify_token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (
    mode !== "subscribe" ||
    typeof verify_token !== "string" ||
    typeof challenge !== "string"
  ) {
    res.sendStatus(403);
    return;
  }
  const result = verifyWebhook({
    "hub.mode": mode,
    "hub.verify_token": verify_token,
    "hub.challenge": challenge,
  });
  if (typeof result === "string") {
    res.status(200).send(result);
  } else {
    res.sendStatus(403);
  }
}

export async function webhookIncoming(
  req: Request & { rawBody?: string },
  res: Response
): Promise<void> {
  res.sendStatus(200);
  try {
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    await processWebhookEvent(req.body, req.rawBody, signature);
  } catch (err) {
    logger.error({ err }, "[whatsapp webhook] processing error");
  }
}

export default router;
