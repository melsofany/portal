/**
 * Baileys WhatsApp client manager
 * Open-source: https://github.com/WhiskeySockets/Baileys (10k+ ⭐)
 *
 * QR-code-based WhatsApp connection — no Meta Business API required.
 * Saves messages to the whatsapp_messages DB table using raw SQL (pool).
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  isJidGroup,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import path from "path";
import { existsSync } from "fs";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import type { Response } from "express";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnStatus = "disconnected" | "connecting" | "qr" | "connected";

interface BaileysState {
  status: ConnStatus;
  qrDataUrl: string | null;
  socket: WASocket | null;
  phoneNumber: string | null;
}

// ─── In-memory state ──────────────────────────────────────────────────────────

const state: BaileysState = {
  status: "disconnected",
  qrDataUrl: null,
  socket: null,
  phoneNumber: null,
};

// ─── SSE broadcast ────────────────────────────────────────────────────────────

const sseClients = new Set<Response>();

export function addSseClient(res: Response): void {
  sseClients.add(res);
}

export function removeSseClient(res: Response): void {
  sseClients.delete(res);
}

function broadcast(event: Record<string, unknown>): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      (client as Response).write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getStatus(): { status: ConnStatus; qrDataUrl: string | null; phoneNumber: string | null } {
  return { status: state.status, qrDataUrl: state.qrDataUrl, phoneNumber: state.phoneNumber };
}

const AUTH_DIR = path.resolve(process.cwd(), ".baileys-auth");

export async function connectBaileys(): Promise<void> {
  if (state.status === "connected" || state.status === "connecting" || state.status === "qr") {
    return;
  }
  _startConnection();
}

export async function reconnectBaileys(): Promise<void> {
  if (state.socket) {
    try { state.socket.end(undefined); } catch { /* ignore */ }
    state.socket = null;
  }
  state.status = "disconnected";
  _startConnection();
}

export async function disconnectBaileys(): Promise<void> {
  if (state.socket) {
    try { await state.socket.logout(); } catch { /* ignore */ }
    state.socket = null;
  }
  state.status = "disconnected";
  state.qrDataUrl = null;
  state.phoneNumber = null;
  broadcast({ type: "status", status: "disconnected" });
}

export async function sendBaileysText(phone: string, text: string, contactName?: string): Promise<string | null> {
  if (!state.socket || state.status !== "connected") {
    throw new Error("WhatsApp غير متصل — يرجى المسح الضوئي أولاً");
  }
  const normalised = normalizePhone(phone);
  const jid = `${normalised}@s.whatsapp.net`;
  const result = await state.socket.sendMessage(jid, { text });
  const msgId = result?.key?.id ?? `out_${Date.now()}`;

  await pool.query(
    `INSERT INTO whatsapp_messages (direction, phone, contact_name, message_text, message_id, sent_at)
     VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (message_id) DO NOTHING`,
    ["out", normalised, contactName ?? normalised, text, msgId]
  );

  broadcast({ type: "message", phone: normalised });
  return msgId;
}

// ─── Internal connection logic ────────────────────────────────────────────────

function _startConnection(): void {
  state.status = "connecting";
  state.qrDataUrl = null;
  broadcast({ type: "status", status: "connecting" });
  _doConnect().catch((err) => {
    logger.error({ err }, "Baileys connect error");
    state.status = "disconnected";
    broadcast({ type: "status", status: "disconnected" });
  });
}

async function _doConnect(): Promise<void> {
  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: false,
    logger: logger.child({ module: "baileys" }) as never,
    getMessage: async () => undefined,
  });
  state.socket = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      state.status = "qr";
      try {
        state.qrDataUrl = await QRCode.toDataURL(qr, {
          width: 300, margin: 2,
          color: { dark: "#111b21", light: "#ffffff" },
        });
      } catch { state.qrDataUrl = null; }
      // Include status:"qr" so the frontend can set state correctly from one field
      broadcast({ type: "qr", status: "qr", qrDataUrl: state.qrDataUrl });
      logger.info("Baileys QR generated");
    }

    if (connection === "open") {
      state.status = "connected";
      state.qrDataUrl = null;
      const me = sock.authState?.creds?.me?.id ?? null;
      state.phoneNumber = me ? me.split(":")[0] : null;
      broadcast({ type: "status", status: "connected", phoneNumber: state.phoneNumber });
      logger.info({ phoneNumber: state.phoneNumber }, "Baileys connected");
    }

    if (connection === "close") {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      logger.info({ reason, shouldReconnect }, "Baileys connection closed");
      state.status = "disconnected";
      state.qrDataUrl = null;
      state.socket = null;
      broadcast({ type: "status", status: "disconnected" });
      if (shouldReconnect) setTimeout(_startConnection, 4000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      await _handleInbound(msg).catch((err) =>
        logger.error({ err }, "Baileys inbound error")
      );
    }
  });
}

async function _handleInbound(msg: proto.IWebMessageInfo): Promise<void> {
  const jid = msg.key.remoteJid ?? "";
  if (isJidGroup(jid) || jid === "status@broadcast" || msg.key.fromMe) return;

  const phone = normalizePhone(jid.replace("@s.whatsapp.net", "").replace("@c.us", ""));
  const content = msg.message;
  if (!content) return;

  let text = "";
  if (content.conversation) {
    text = content.conversation;
  } else if (content.extendedTextMessage?.text) {
    text = content.extendedTextMessage.text;
  } else if (content.imageMessage) {
    text = content.imageMessage.caption || "[📷 صورة]";
  } else if (content.documentMessage) {
    text = content.documentMessage.fileName || "[📄 ملف]";
  } else if (content.audioMessage) {
    text = "[🎵 رسالة صوتية]";
  } else if (content.videoMessage) {
    text = content.videoMessage.caption || "[🎬 فيديو]";
  } else if (content.stickerMessage) {
    text = "[🎭 ملصق]";
  } else if (content.contactMessage) {
    text = `[📇 ${content.contactMessage.displayName}]`;
  } else if (content.locationMessage) {
    text = "[📍 موقع]";
  } else {
    text = "[رسالة]";
  }

  const msgId = msg.key.id ?? `in_${Date.now()}`;
  const sentAt = msg.messageTimestamp
    ? new Date(Number(msg.messageTimestamp) * 1000)
    : new Date();

  // Try to get contact name from push notification name
  const contactName = (msg as unknown as { pushName?: string }).pushName ?? phone;

  await pool.query(
    `INSERT INTO whatsapp_messages (direction, phone, contact_name, message_text, message_id, sent_at)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (message_id) DO NOTHING`,
    ["in", phone, contactName, text, msgId, sentAt]
  );

  broadcast({ type: "message", phone, contactName, preview: text.slice(0, 80) });
  logger.info({ phone, msgId }, "Baileys inbound saved");
}

function normalizePhone(raw: string): string {
  let c = raw.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  if (c.startsWith("00")) c = c.slice(2);
  if (c.length === 11 && c.startsWith("0")) c = "2" + c;
  if (c.length === 10 && c.startsWith("1")) c = "20" + c;
  return c;
}

// ─── Auto-start if credentials exist ─────────────────────────────────────────

if (existsSync(path.join(AUTH_DIR, "creds.json"))) {
  logger.info("Baileys: credentials found → auto-connecting");
  _startConnection();
}
