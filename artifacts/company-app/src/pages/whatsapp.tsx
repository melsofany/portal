/**
 * WhatsApp chat page — powered by Baileys (open-source, QR-based)
 * https://github.com/WhiskeySockets/Baileys
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import {
  MessageCircle, Send, Plus, Phone, CheckCheck, Check,
  X, Wifi, WifiOff, QrCode, RefreshCw, ArrowLeft, Users,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type ConnStatus = "disconnected" | "connecting" | "qr" | "connected";

interface WaStatus {
  status: ConnStatus;
  qrDataUrl: string | null;
  phoneNumber: string | null;
}

interface Conversation {
  phone: string;
  contact_name: string;
  last_message: string;
  last_direction: "in" | "out";
  last_at: string;
  unread_count: number | string;
}

interface Message {
  id: number;
  direction: "in" | "out";
  phone: string;
  contact_name: string;
  message_text: string;
  sent_at: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return fmtTime(iso);
  if (diff === 1) return "أمس";
  if (diff < 7)  return d.toLocaleDateString("ar-EG", { weekday: "short" });
  return d.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit" });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "اليوم";
  if (d.toDateString() === yest.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-EG", { day: "2-digit", month: "long", year: "numeric" });
}

const AVATAR_COLORS = [
  "#25d366","#128c7e","#075e54","#34b7f1","#00bcd4",
  "#9c27b0","#673ab7","#3f51b5","#f44336","#ff9800",
];
function avatarBg(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const letter = (name || "?").charAt(0).toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarBg(name) }}
    >
      {letter}
    </div>
  );
}

// ─── Connection badge ───────────────────────────────────────────────────────

function ConnBadge({ status, phone }: { status: ConnStatus; phone: string | null }) {
  const cfg: Record<ConnStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    connected:    { label: phone ? `متصل · ${phone}` : "متصل", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: <Wifi size={11} /> },
    connecting:   { label: "جارٍ الاتصال…", cls: "bg-amber-400/20 text-amber-300 border-amber-400/30", icon: <RefreshCw size={11} className="animate-spin" /> },
    qr:           { label: "في انتظار المسح", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: <QrCode size={11} /> },
    disconnected: { label: "غير متصل", cls: "bg-red-500/20 text-red-400 border-red-500/30", icon: <WifiOff size={11} /> },
  };
  const { label, cls, icon } = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {icon} {label}
    </span>
  );
}

// ─── QR Modal ───────────────────────────────────────────────────────────────

function QrModal({ qrDataUrl, onClose }: { qrDataUrl: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#202c33] rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white/80"><X size={20} /></button>
        <div className="flex items-center justify-center gap-2 mb-5">
          <div className="w-8 h-8 bg-[#25d366] rounded-full flex items-center justify-center">
            <MessageCircle size={16} className="text-white" />
          </div>
          <h2 className="text-white font-bold text-lg">ربط WhatsApp</h2>
        </div>
        <div className="bg-white p-2 rounded-xl inline-block">
          <img src={qrDataUrl} alt="QR" className="w-60 h-60" />
        </div>
        <div className="mt-5 text-right space-y-1 text-sm text-white/60">
          <p className="text-white/80 font-medium">خطوات الاتصال:</p>
          <p>١. افتح WhatsApp على هاتفك</p>
          <p>٢. اضغط ⋮ ثم «الأجهزة المرتبطة»</p>
          <p>٣. اضغط «ربط جهاز» ثم امسح الكود</p>
        </div>
        <p className="mt-4 text-[11px] text-white/30">الكود صالح 60 ثانية — يُحدَّث تلقائياً عند انتهائه</p>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [waStatus, setWaStatus]           = useState<WaStatus>({ status: "disconnected", qrDataUrl: null, phoneNumber: null });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePhone, setActivePhone]     = useState<string | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [inputText, setInputText]         = useState("");
  const [sending, setSending]             = useState(false);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showQr, setShowQr]               = useState(false);
  const [showNewConv, setShowNewConv]     = useState(false);
  const [newPhone, setNewPhone]           = useState("");
  const [newName, setNewName]             = useState("");
  const [search, setSearch]               = useState("");
  const [sendError, setSendError]         = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const esRef          = useRef<EventSource | null>(null);

  // ── Data fetchers ─────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/whatsapp/status", { credentials: "include" });
      if (r.ok) setWaStatus(await r.json());
    } catch { /* ignore */ }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const r = await fetch("/api/whatsapp/conversations", { credentials: "include" });
      if (r.ok) setConversations(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (phone: string) => {
    try {
      const r = await fetch(`/api/whatsapp/messages/${phone}`, { credentials: "include" });
      if (r.ok) {
        setMessages(await r.json());
        setConversations(prev => prev.map(c => c.phone === phone ? { ...c, unread_count: 0 } : c));
      }
    } catch { /* ignore */ }
  }, []);

  // ── SSE setup ─────────────────────────────────────────────────────────────

  useEffect(() => {
    loadStatus();
    loadConversations();

    const es = new EventSource("/api/whatsapp/events", { withCredentials: true });
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as Record<string, unknown>;
        if (ev.type === "status" || ev.type === "qr") {
          setWaStatus({
            status:      (ev.status as ConnStatus) ?? "disconnected",
            qrDataUrl:   (ev.qrDataUrl as string) ?? null,
            phoneNumber: (ev.phoneNumber as string) ?? null,
          });
          if (ev.type === "qr") setShowQr(true);
          if (ev.status === "connected") { setShowQr(false); loadConversations(); }
        }
        if (ev.type === "message") {
          loadConversations();
          if (activePhone && ev.phone === activePhone) loadMessages(activePhone);
        }
      } catch { /* ignore */ }
    };

    return () => { es.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activePhone) loadMessages(activePhone);
  }, [activePhone, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (waStatus.status === "qr" && waStatus.qrDataUrl) setShowQr(true);
  }, [waStatus]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleConnect = async () => {
    setActionLoading(true);
    try { await fetch("/api/whatsapp/connect", { method: "POST", credentials: "include" }); }
    catch { /* ignore */ }
    finally { setActionLoading(false); await loadStatus(); }
  };

  const handleReconnect = async () => {
    setActionLoading(true);
    try { await fetch("/api/whatsapp/reconnect", { method: "POST", credentials: "include" }); }
    catch { /* ignore */ }
    finally { setActionLoading(false); await loadStatus(); }
  };

  const handleDisconnect = async () => {
    if (!confirm("سيتم قطع الاتصال بـ WhatsApp. متابعة؟")) return;
    setActionLoading(true);
    try {
      await fetch("/api/whatsapp/disconnect", { method: "POST", credentials: "include" });
      setWaStatus({ status: "disconnected", qrDataUrl: null, phoneNumber: null });
      setConversations([]); setMessages([]); setActivePhone(null);
    } catch { /* ignore */ }
    finally { setActionLoading(false); }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activePhone || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);
    setSendError(null);
    const conv = conversations.find(c => c.phone === activePhone);
    // Optimistic message
    const opt: Message = {
      id: Date.now(), direction: "out", phone: activePhone,
      contact_name: conv?.contact_name ?? activePhone,
      message_text: text, sent_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, opt]);
    try {
      const r = await fetch("/api/whatsapp/send", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: activePhone, message: text, contactName: conv?.contact_name }),
      });
      const j = await r.json();
      if (!r.ok) { setSendError(j.error ?? "فشل الإرسال"); }
      else { loadConversations(); }
    } catch { setSendError("فشل الاتصال بالخادم"); }
    finally { setSending(false); }
  };

  const handleStartConversation = () => {
    if (!newPhone.trim()) return;
    const phone = newPhone.trim().replace(/\D/g, "");
    setActivePhone(phone);
    setMessages([]);
    setShowNewConv(false);
    setNewPhone(""); setNewName("");
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = conversations.filter(c =>
    !search ||
    c.contact_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const activeConv = conversations.find(c => c.phone === activePhone);
  const groupedMessages = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, m) => {
    const date = fmtDate(m.sent_at);
    const last = acc[acc.length - 1];
    if (last?.date === date) last.msgs.push(m);
    else acc.push({ date, msgs: [m] });
    return acc;
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      {showQr && waStatus.qrDataUrl && (
        <QrModal qrDataUrl={waStatus.qrDataUrl} onClose={() => setShowQr(false)} />
      )}

      {showNewConv && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewConv(false)}>
          <div className="bg-[#202c33] rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold text-lg">محادثة جديدة</h3>
              <button onClick={() => setShowNewConv(false)} className="text-white/40 hover:text-white/80"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">رقم الواتساب *</label>
                <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleStartConversation()}
                  placeholder="201234567890"
                  className="w-full bg-[#2a3942] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#25d366]/40"
                  style={{ direction: "ltr" }} autoFocus />
                <p className="text-xs text-white/30 mt-1">رمز الدولة + الرقم بدون + أو 00</p>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">الاسم (اختياري)</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleStartConversation()}
                  placeholder="اسم الطرف الآخر"
                  className="w-full bg-[#2a3942] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#25d366]/40" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleStartConversation} disabled={!newPhone.trim()}
                className="flex-1 bg-[#25d366] hover:bg-[#22bf5c] disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                بدء المحادثة
              </button>
              <button onClick={() => setShowNewConv(false)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white/70 text-sm font-medium py-2.5 rounded-xl transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-full overflow-hidden" dir="rtl" style={{ background: "#111b21" }}>

        {/* ── Sidebar: conversation list ──────────────────────────────────── */}
        <div className={`flex flex-col border-l border-white/5 flex-shrink-0 ${activePhone ? "hidden md:flex w-80" : "flex flex-1 md:w-80 md:flex-none"}`}>

          {/* Header */}
          <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#25d366] rounded-full flex items-center justify-center flex-shrink-0">
              <MessageCircle size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight">WhatsApp</p>
              <ConnBadge status={waStatus.status} phone={waStatus.phoneNumber} />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {waStatus.status === "disconnected" && (
                <button onClick={handleConnect} disabled={actionLoading}
                  className="bg-[#25d366] hover:bg-[#22bf5c] disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1 transition-colors">
                  {actionLoading ? <RefreshCw size={12} className="animate-spin" /> : <Wifi size={12} />}
                  اتصال
                </button>
              )}
              {waStatus.status === "qr" && waStatus.qrDataUrl && (
                <button onClick={() => setShowQr(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1 transition-colors">
                  <QrCode size={12} /> عرض QR
                </button>
              )}
              {waStatus.status === "connecting" && (
                <RefreshCw size={16} className="text-white/40 animate-spin" />
              )}
              {waStatus.status === "connected" && (
                <>
                  <button onClick={() => setShowNewConv(true)}
                    className="text-white/50 hover:text-white p-1.5 rounded-full transition-colors" title="محادثة جديدة">
                    <Plus size={18} />
                  </button>
                  <button onClick={handleDisconnect} disabled={actionLoading}
                    className="text-white/30 hover:text-white/70 p-1.5 rounded-full transition-colors" title="قطع الاتصال">
                    <WifiOff size={16} />
                  </button>
                </>
              )}
              <button onClick={() => { loadConversations(); loadStatus(); }}
                className="text-white/30 hover:text-white/70 p-1.5 rounded-full transition-colors" title="تحديث">
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 py-2 bg-[#111b21]">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 بحث"
              className="w-full bg-[#202c33] text-white placeholder-white/30 border-0 rounded-lg px-4 py-2 text-sm focus:outline-none"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {waStatus.status === "disconnected" && !loading && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
                <div className="w-16 h-16 bg-[#202c33] rounded-full flex items-center justify-center">
                  <WifiOff size={28} className="text-white/20" />
                </div>
                <div>
                  <p className="text-white/60 font-medium">غير متصل</p>
                  <p className="text-white/30 text-sm mt-1">اضغط «اتصال» لربط WhatsApp</p>
                </div>
                <button onClick={handleConnect} disabled={actionLoading}
                  className="bg-[#25d366] hover:bg-[#22bf5c] disabled:opacity-50 text-white px-5 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors">
                  {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <Wifi size={14} />}
                  اتصال بـ WhatsApp
                </button>
              </div>
            )}

            {waStatus.status === "qr" && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 p-4 text-center">
                <QrCode size={32} className="text-blue-400" />
                <p className="text-white/60 text-sm">امسح رمز QR لإتمام الربط</p>
                {waStatus.qrDataUrl && (
                  <button onClick={() => setShowQr(true)} className="text-blue-400 text-xs underline">عرض رمز QR</button>
                )}
              </div>
            )}

            {waStatus.status === "connecting" && (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <RefreshCw size={28} className="text-[#25d366] animate-spin" />
                <p className="text-white/40 text-sm">جارٍ الاتصال…</p>
              </div>
            )}

            {filtered.length === 0 && waStatus.status === "connected" && !loading && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 p-4 text-center">
                <Users size={28} className="text-white/20" />
                <p className="text-white/40 text-sm">لا توجد محادثات</p>
                <button onClick={() => setShowNewConv(true)} className="text-[#25d366] text-xs underline">ابدأ محادثة جديدة</button>
              </div>
            )}

            {filtered.map(conv => {
              const isActive = conv.phone === activePhone;
              const unread = Number(conv.unread_count ?? 0);
              return (
                <button key={conv.phone} onClick={() => setActivePhone(conv.phone)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-white/5 text-right transition-colors ${isActive ? "bg-[#2a3942]" : "hover:bg-[#202c33]"}`}>
                  <Avatar name={conv.contact_name || conv.phone} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white font-medium text-sm truncate">{conv.contact_name || conv.phone}</p>
                      <p className="text-white/30 text-[11px] flex-shrink-0">{conv.last_at ? fmtShort(conv.last_at) : ""}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-white/40 text-xs truncate">{conv.last_message}</p>
                      {unread > 0 && (
                        <span className="bg-[#25d366] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right panel: messages ──────────────────────────────────────── */}
        <div className={`flex-1 flex flex-col overflow-hidden ${!activePhone ? "hidden md:flex" : "flex"}`}>
          {!activePhone ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: "#0b141a" }}>
              <div className="w-20 h-20 bg-[#202c33] rounded-full flex items-center justify-center">
                <MessageCircle size={36} className="text-[#25d366]" />
              </div>
              <div className="text-center">
                <p className="text-white/60 font-semibold text-lg">WhatsApp</p>
                <p className="text-white/25 text-sm mt-1">اختر محادثة للبدء</p>
              </div>
              {waStatus.status !== "connected" && (
                <button onClick={handleConnect} disabled={actionLoading}
                  className="mt-2 bg-[#25d366] hover:bg-[#22bf5c] text-white px-6 py-2.5 rounded-full font-medium flex items-center gap-2 disabled:opacity-50 transition-colors">
                  {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <Wifi size={14} />}
                  اتصال بـ WhatsApp
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 border-b border-white/5 flex-shrink-0">
                <button onClick={() => setActivePhone(null)} className="md:hidden text-white/50 hover:text-white p-1">
                  <ArrowLeft size={18} />
                </button>
                <Avatar name={activeConv?.contact_name || activePhone} size={38} />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{activeConv?.contact_name || activePhone}</p>
                  <p className="text-white/40 text-xs">{activePhone}</p>
                </div>
                <button onClick={() => loadMessages(activePhone)}
                  className="text-white/30 hover:text-white/70 p-1.5 rounded-full transition-colors">
                  <RefreshCw size={15} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-0.5" style={{ background: "#0b141a" }}>
                {groupedMessages.map(({ date, msgs }) => (
                  <div key={date}>
                    <div className="flex justify-center my-3">
                      <span className="bg-[#182229] text-white/40 text-[11px] px-3 py-1 rounded-full">{date}</span>
                    </div>
                    {msgs.map(msg => {
                      const isOut = msg.direction === "out";
                      return (
                        <div key={msg.id} className={`flex mb-1 ${isOut ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm ${isOut ? "bg-[#005c4b] text-white rounded-tr-none" : "bg-[#202c33] text-white rounded-tl-none"}`}>
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message_text}</p>
                            <div className={`flex items-center gap-1 mt-1 ${isOut ? "justify-end" : "justify-start"}`}>
                              <span className="text-[10px] text-white/30">{fmtTime(msg.sent_at)}</span>
                              {isOut && <CheckCheck size={12} className="text-blue-400" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="bg-[#202c33] px-4 py-3 flex-shrink-0">
                {sendError && (
                  <p className="text-red-400 text-xs mb-2 text-center">{sendError}</p>
                )}
                {waStatus.status !== "connected" ? (
                  <div className="text-center text-white/40 text-xs py-2">
                    <WifiOff size={12} className="inline ml-1" />
                    غير متصل — الإرسال غير متاح
                    <button onClick={handleReconnect} className="text-[#25d366] mr-2 underline">إعادة الاتصال</button>
                  </div>
                ) : (
                  <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex items-end gap-2">
                    <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="اكتب رسالة…"
                      rows={1}
                      className="flex-1 resize-none bg-[#2a3942] text-white placeholder-white/25 border-0 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#25d366]/30 min-h-[42px] max-h-28"
                      style={{ direction: "rtl" }}
                      disabled={sending}
                    />
                    <button type="submit" disabled={!inputText.trim() || sending}
                      className="w-10 h-10 rounded-full bg-[#25d366] hover:bg-[#22bf5c] disabled:opacity-40 flex items-center justify-center flex-shrink-0 transition-all active:scale-95">
                      {sending
                        ? <RefreshCw size={16} className="text-white animate-spin" />
                        : <Send size={16} className="text-white rotate-180" />}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
