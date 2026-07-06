import React, { useState, useEffect, useRef, useCallback } from "react";
  import AppLayout from "@/components/AppLayout";
  import { MessageCircle, Send, Plus, Phone, CheckCheck, X, AlertCircle } from "lucide-react";

  interface Conversation {
    phone: string;
    contact_name: string;
    last_message: string;
    last_direction: "in" | "out";
    last_at: string;
    unread_count: number;
  }

  interface Message {
    id: number;
    direction: "in" | "out";
    phone: string;
    contact_name: string;
    message_text: string;
    sent_at: string;
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function fmtDate(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "اليوم";
    if (d.toDateString() === yest.toDateString()) return "أمس";
    return d.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function Avatar({ name, size = 10 }: { name: string; size?: number }) {
    const letter = (name || "?").charAt(0).toUpperCase();
    const colors = ["bg-emerald-100 text-emerald-700","bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-amber-100 text-amber-700"];
    const c = colors[letter.charCodeAt(0) % colors.length];
    return (
      <div className={`rounded-full ${c} flex items-center justify-center font-bold text-sm flex-shrink-0`}
           style={{ width: size * 4, height: size * 4 }}>
        {letter}
      </div>
    );
  }

  export default function WhatsAppPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activePhone, setActivePhone] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [notConfigured, setNotConfigured] = useState(false);
    const [showNewConv, setShowNewConv] = useState(false);
    const [newPhone, setNewPhone] = useState("");
    const [newName, setNewName] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const loadConversations = useCallback(async () => {
      try {
        const res = await fetch("/api/whatsapp/conversations");
        if (res.ok) setConversations(await res.json());
      } catch {}
      setLoading(false);
    }, []);

    const loadMessages = useCallback(async (phone: string) => {
      try {
        const res = await fetch(`/api/whatsapp/messages/${phone}`);
        if (res.ok) {
          setMessages(await res.json());
          setConversations(prev => prev.map(c => c.phone === phone ? { ...c, unread_count: 0 } : c));
        }
      } catch {}
    }, []);

    useEffect(() => {
      loadConversations();
      const t = setInterval(loadConversations, 10_000);
      return () => clearInterval(t);
    }, [loadConversations]);

    useEffect(() => {
      if (!activePhone) return;
      loadMessages(activePhone);
      const t = setInterval(() => loadMessages(activePhone), 5_000);
      return () => clearInterval(t);
    }, [activePhone, loadMessages]);

    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
      if (!inputText.trim() || !activePhone || sending) return;
      setSending(true);
      setSendError(null);
      const text = inputText.trim();
      setInputText("");
      const conv = conversations.find(c => c.phone === activePhone);
      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: activePhone, message: text, contactName: conv?.contact_name }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSendError(data.error ?? "فشل الإرسال");
          setInputText(text);
          if (data.notConfigured) setNotConfigured(true);
        } else {
          await loadMessages(activePhone);
          await loadConversations();
        }
      } catch {
        setSendError("خطأ في الاتصال بالخادم");
        setInputText(text);
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const handleStartConversation = () => {
      if (!newPhone.trim()) return;
      const phone = newPhone.replace(/\D/g, "");
      if (!conversations.find(c => c.phone === phone)) {
        setConversations(prev => [{
          phone, contact_name: newName.trim() || phone,
          last_message: "", last_direction: "out",
          last_at: new Date().toISOString(), unread_count: 0,
        }, ...prev]);
      }
      setActivePhone(phone);
      setShowNewConv(false);
      setNewPhone("");
      setNewName("");
    };

    const activeConv = conversations.find(c => c.phone === activePhone);

    // Group by date
    const grouped: Array<{ dateLabel?: string; msg: Message }> = [];
    let lastDate = "";
    for (const msg of messages) {
      const label = fmtDate(msg.sent_at);
      if (label !== lastDate) { grouped.push({ dateLabel: label, msg }); lastDate = label; }
      else grouped.push({ msg });
    }

    return (
      <AppLayout>
        <div className="flex h-[calc(100vh-112px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          {/* ── Sidebar ── */}
          <div className="w-80 flex-shrink-0 flex flex-col border-l border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-slate-800">الواتساب</span>
              </div>
              <button onClick={() => setShowNewConv(true)}
                className="h-8 w-8 rounded-full hover:bg-emerald-50 flex items-center justify-center text-emerald-600 transition-colors"
                title="محادثة جديدة">
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm animate-pulse">جاري التحميل...</div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center gap-2">
                  <MessageCircle className="h-10 w-10 opacity-30" />
                  <p className="text-sm font-medium">لا توجد محادثات</p>
                  <p className="text-xs">اضغط + لبدء محادثة جديدة</p>
                </div>
              ) : conversations.map(conv => (
                <button key={conv.phone}
                  onClick={() => { setActivePhone(conv.phone); setSendError(null); }}
                  className={`w-full text-right flex items-center gap-3 px-4 py-3 border-b border-slate-100 transition-colors ${activePhone === conv.phone ? "bg-emerald-50" : "hover:bg-white"}`}>
                  <Avatar name={conv.contact_name || conv.phone} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-800 truncate">{conv.contact_name || conv.phone}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0 mr-1">{fmtTime(conv.last_at)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <p className="text-xs text-slate-500 truncate max-w-[155px]">
                        {conv.last_direction === "out" && <CheckCheck className="inline h-3 w-3 text-emerald-500 ml-0.5" />}
                        {conv.last_message || "—"}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="bg-emerald-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center flex-shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Chat Panel ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {!activePhone ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] gap-4">
                <div className="h-28 w-28 rounded-full bg-white shadow-md flex items-center justify-center">
                  <MessageCircle className="h-14 w-14 text-emerald-300" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-slate-700">Company Portal — الواتساب</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-xs">اختر محادثة أو ابدأ محادثة جديدة مع مورد أو عميل</p>
                </div>
                {notConfigured && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-700 max-w-sm text-center">
                    يجب إضافة WHATSAPP_PHONE_NUMBER_ID و WHATSAPP_ACCESS_TOKEN في متغيرات البيئة على Render
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
                  <Avatar name={activeConv?.contact_name || activePhone} size={10} />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{activeConv?.contact_name || activePhone}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{activePhone}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#f0f2f5] space-y-1" style={{ direction: "ltr" }}>
                  {grouped.map(({ dateLabel, msg }) => (
                    <React.Fragment key={msg.id}>
                      {dateLabel && (
                        <div className="flex justify-center my-3">
                          <span className="bg-white text-xs text-slate-500 px-3 py-1 rounded-full shadow-sm">{dateLabel}</span>
                        </div>
                      )}
                      <div className={`flex ${msg.direction === "out" ? "justify-end" : "justify-start"} mb-1`}>
                        <div className={`max-w-[70%] px-3 py-2 rounded-2xl shadow-sm text-sm ${
                          msg.direction === "out" ? "bg-emerald-500 text-white rounded-br-none" : "bg-white text-slate-800 rounded-bl-none"
                        }`} style={{ direction: "rtl", textAlign: "right" }}>
                          <p className="leading-relaxed break-words">{msg.message_text}</p>
                          <p className={`text-xs mt-1 flex items-center gap-0.5 ${msg.direction === "out" ? "text-emerald-100 justify-start" : "text-slate-400 justify-end"}`}>
                            {msg.direction === "out" && <CheckCheck className="h-3 w-3" />}
                            {fmtTime(msg.sent_at)}
                          </p>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {sendError && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-t border-red-100 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">{sendError}</span>
                    <button onClick={() => setSendError(null)}><X className="h-4 w-4" /></button>
                  </div>
                )}

                <div className="flex items-end gap-2 p-3 bg-white border-t border-slate-200">
                  <textarea ref={textareaRef} value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب رسالة... (Enter للإرسال)"
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 max-h-32 overflow-y-auto"
                    style={{ direction: "rtl" }}
                    onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 128) + "px"; }}
                  />
                  <button onClick={handleSend} disabled={!inputText.trim() || sending}
                    className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 flex items-center justify-center text-white transition-colors flex-shrink-0">
                    {sending
                      ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Send className="h-4 w-4 rotate-180" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {showNewConv && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNewConv(false)}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-slate-800 text-lg">محادثة جديدة</h3>
                <button onClick={() => setShowNewConv(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">رقم الواتساب <span className="text-red-500">*</span></label>
                  <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleStartConversation()}
                    placeholder="201234567890"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    style={{ direction: "ltr" }} autoFocus />
                  <p className="text-xs text-slate-400 mt-1">رمز الدولة + الرقم بدون + أو 00</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الاسم (اختياري)</label>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleStartConversation()}
                    placeholder="اسم المورد أو العميل"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleStartConversation} disabled={!newPhone.trim()}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                  بدء المحادثة
                </button>
                <button onClick={() => setShowNewConv(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl transition-colors">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </AppLayout>
    );
  }
  