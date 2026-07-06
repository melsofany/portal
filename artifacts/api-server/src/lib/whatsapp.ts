import { WhatsAppAPI } from "whatsapp-api-js";
import type { GetParams, PostData } from "whatsapp-api-js/types";
import { Text } from "whatsapp-api-js/messages";
import { logger } from "./logger";

export const PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID ?? process.env.WHATSAPP_PHONE_NUMBER ?? "";
export const ACCESS_TOKEN =
  process.env.WHATSAPP_ACCESS_TOKEN ?? process.env.WHATSAPP_TOKEN ?? "";
export const WEBHOOK_VERIFY_TOKEN =
  process.env.WHATSAPP_VERIFY_TOKEN ?? "portal_whatsapp_verify";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

export const isWhatsAppConfigured = Boolean(PHONE_NUMBER_ID && ACCESS_TOKEN);

export interface InboundWhatsAppMessage {
  from: string;
  text: string;
  messageId: string;
  timestamp: Date;
  contactName: string;
}

type InboundHandler = (msg: InboundWhatsAppMessage) => void | Promise<void>;

let inboundHandler: InboundHandler | null = null;

export function onInboundMessage(handler: InboundHandler): void {
  inboundHandler = handler;
}

export const Whatsapp: WhatsAppAPI = APP_SECRET
  ? new WhatsAppAPI({
      token: ACCESS_TOKEN,
      appSecret: APP_SECRET,
      secure: true,
      webhookVerifyToken: WEBHOOK_VERIFY_TOKEN,
    })
  : new WhatsAppAPI({
      token: ACCESS_TOKEN,
      secure: false,
      webhookVerifyToken: WEBHOOK_VERIFY_TOKEN,
    });

Whatsapp.on.message = async ({ from, message, name }) => {
  if (!inboundHandler) return;
  const msg = message as unknown as {
    id: string;
    type: string;
    timestamp: string;
    text?: { body: string };
  };
  try {
    await inboundHandler({
      from: String(from),
      text: msg.type === "text" ? (msg.text?.body ?? "") : `[${msg.type}]`,
      messageId: String(msg.id),
      timestamp: new Date(Number(msg.timestamp) * 1000),
      contactName: name ?? String(from),
    });
  } catch (err) {
    logger.error({ err }, "WhatsApp inbound message handling error");
  }
};

Whatsapp.on.status = ({ status, id, error }) => {
  if (status === "failed") {
    logger.error({ id, status, error }, "WhatsApp message delivery FAILED");
  }
};

export function verifyWebhook(params: GetParams): string | undefined {
  try {
    return Whatsapp.get(params);
  } catch {
    return undefined;
  }
}

export async function processWebhookEvent(
  body: PostData,
  rawBody?: string,
  signature?: string,
): Promise<void> {
  if (APP_SECRET && rawBody && signature) {
    await Whatsapp.post(body, rawBody, signature);
  } else {
    await Whatsapp.post(body);
  }
}

export async function sendWhatsAppText(to: string, message: string): Promise<string> {
  if (!isWhatsAppConfigured) throw new Error("WhatsApp Business API not configured");
  const phone = to.replace(/\D/g, "");
  const result = (await Whatsapp.sendMessage(PHONE_NUMBER_ID, phone, new Text(message))) as {
    error?: unknown;
    messages?: Array<{ id: string }>;
  };
  if (result.error) {
    throw new Error(
      typeof result.error === "object" ? JSON.stringify(result.error) : String(result.error),
    );
  }
  const messageId = result.messages?.[0]?.id;
  return messageId ?? `out_${Date.now()}_${Math.random()}`;
}
