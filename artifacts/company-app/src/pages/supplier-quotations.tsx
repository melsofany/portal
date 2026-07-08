import React, { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
function getAuthToken(): string | null {
  try { return localStorage.getItem('auth_token'); } catch { return null; }
}

function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { credentials: 'include', ...options, headers });
}

async function authFetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await authFetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'خطأ في الاتصال' }));
    throw new Error((err as any).error ?? 'خطأ في الاتصال');
  }
  return res.json() as Promise<T>;
}

import {
  Send, FileText, Mail, MessageSquare, Trash2, ChevronDown, ChevronUp,
  Search, CheckSquare, Square, X, ArrowRight, ArrowLeft,
  Link as LinkIcon, Copy, BarChart3, Check, Clock, Loader2, UserPlus, Eye, EyeOff,
  ChevronRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RfqItem {
  id: number;
  customerItemCode: string;
  description: string;
  partNo: string;
  unit: string;
  quantity: string;
  sortOrder: number;
}

interface RfqSupplier {
  supplierId: number;
  companyName: string;
  email: string | null;
  whatsapp: string | null;
  phone: string | null;
  sentVia: string;
  token: string;
  responseStatus: "pending" | "submitted";
  responseSubmittedAt: string | null;
  firstOpenedAt: string | null;
}

interface Rfq {
  id: number;
  rfqNo: string;
  sourceQuotationNo: string;
  customerOrderNo: string;
  requestDate: string;
  notes: string;
  status: string;
  createdAt: string;
  items: RfqItem[];
  suppliers: RfqSupplier[];
}

interface FoundCQ {
  id: number;
  quotationNo: string;
  customerName: string;
  customerOrderNo: string;
  requestDate: string;
  items: RfqItem[];
}

interface Supplier {
  id: number;
  companyName: string;
  email: string | null;
  whatsapp: string | null;
  phone: string | null;
  status: string;
  categories: { id: number; name: string }[];
}

interface Category {
  id: number;
  name: string;
}

interface SendAllResult {
  supplierId: number;
  companyName: string;
  token: string;
  rfqLink: string;
  whatsappSent: boolean;
  emailSent: boolean;
  whatsappFallbackLink: string | null;
  sentChannels: string[];
  errors: string[];
}

interface AnalysisData {
  items: RfqItem[];
  suppliers: {
    id: number;
    companyName: string;
    responseStatus: "pending" | "submitted";
    responseSubmittedAt: string | null;
    paymentTerms: string | null;
    offerValidityDays: number | null;
    responseNotes: string | null;
    deliveryDays: number | null;
    prices: { rfqItemId: number; unitPrice: string; notes: string; deliveryDays: number | null; vatIncluded: string }[];
  }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRfqLink(token: string) {
  return `${window.location.origin}/rfq/${token}`;
}

async function copyTokenLink(token: string, setCopied: (id: string) => void) {
  const link = getRfqLink(token);
  try {
    await navigator.clipboard.writeText(link);
    setCopied(token);
    setTimeout(() => setCopied(""), 2000);
  } catch {
    prompt("انسخ الرابط:", link);
  }
}

function fmtQty(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  const n = parseFloat(String(val));
  if (isNaN(n)) return String(val ?? "");
  return n % 1 === 0 ? String(Math.round(n)) : String(parseFloat(n.toFixed(10)));
}

async function downloadRfqPdf(rfq: Rfq, sup: RfqSupplier) {
    const win = window.open("", "_blank", "width=960,height=700");
    if (!win) { alert("يرجى السماح بالنوافذ المنبثقة في المتصفح"); return; }
    win.document.write('<html dir="rtl"><body style="font-family:Arial;padding:40px;text-align:center;color:#1e3a8a"><p>جاري تحميل الـ PDF…</p></body></html>');

    let companyName="",companyPhone="",companyAddress="",logoUrl="",companyEmail="",commercialReg="",taxReg="";
    try {
      const s = await fetch(`${API_BASE}/api/settings/public`);
      if (s.ok) {
        const j = await s.json() as any;
        companyName=j.name??""; companyPhone=j.phone??""; companyAddress=j.address??"";
        logoUrl=j.logoUrl??""; companyEmail=j.email??""; commercialReg=j.commercialReg??""; taxReg=j.taxReg??"";
      }
    } catch {}

    let senderName = "";
    try {
      const tok = getAuthToken();
      if (tok) {
        const p = JSON.parse(atob(tok.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
        senderName = (p.fullName ?? p.name ?? "") as string;
      }
    } catch {}

    let senderPhone = "";
    try {
      const r = await authFetch(`${API_BASE}/api/employees/me`);
      if (r.ok) { const e = await r.json() as any; senderPhone = e.phone ?? ""; }
    } catch {}

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="logo" style="max-height:65px;max-width:150px;object-fit:contain"/>`
      : (companyName ? `<div style="width:56px;height:56px;background:#1e4080;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700">${companyName.slice(0,1)}</div>` : "");

    const infoLine = [companyPhone?"📞 "+companyPhone:"",companyEmail?"✉ "+companyEmail:"",companyAddress?"📍 "+companyAddress:""].filter(Boolean).join("  ·  ");
    const regLine  = [commercialReg?"السجل التجاري: "+commercialReg:"",taxReg?"الرقم الضريبي: "+taxReg:""].filter(Boolean).join("  |  ");

    const rows = rfq.items.map((it,i)=>`<tr style="border-bottom:1px solid #e2e8f0;background:${i%2===0?"#fff":"#f8fafc"}">
      <td style="padding:7px 10px;text-align:center;color:#64748b;font-size:11px">${i+1}</td>
      <td style="padding:7px 10px;text-align:right;font-size:12px">${it.description??""}</td>
      <td style="padding:7px 10px;text-align:center;font-size:11px;color:#475569">${it.partNo??""}</td>
      <td style="padding:7px 10px;text-align:center;font-size:11px">${it.unit??""}</td>
      <td style="padding:7px 10px;text-align:center;font-size:12px;font-weight:600">${fmtQty(it.quantity)}</td>
    </tr>`).join("");

    const html=`<!DOCTYPE html><html dir="rtl" lang="ar"><head>
  <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>طلب تسعير ${rfq.rfqNo}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>
  *{box-sizing:border-box;margin:0;padding:0}body{font-family:'Cairo',Arial,sans-serif;direction:rtl;background:#fff;color:#1e293b}
  @media print{@page{size:A4;margin:8mm}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.no-print{display:none!important}}
  .page{max-width:794px;margin:0 auto}
  .hdr{background:#0f2240;color:#fff;padding:14px 22px;display:flex;align-items:center;gap:14px}
  .hi{text-align:right;flex:1}.ht{font-size:16px;font-weight:700}.hc{font-size:13px;color:#e2e8f0;margin-top:2px;font-weight:600}
  .hd{font-size:10px;color:#94a3b8;margin-top:3px;line-height:1.7}.hr{font-size:9px;color:#7dd3fc;margin-top:2px}
  .bd{padding:16px 22px}
  .rb{background:#f0f7ff;border:1px solid #bfdbfe;border-radius:6px;padding:8px 14px;margin-bottom:12px}
  .rl{font-size:9px;color:#3b82f6}.rv{font-size:16px;font-weight:700;color:#1e3a8a}
  .ig{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:12px}
  .ib{background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:6px 10px}
  .il{font-size:9px;color:#64748b}.iv{font-size:12px;font-weight:600;color:#1e293b}
  table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0}
  thead tr{background:#1e3a5f}thead th{padding:8px 10px;text-align:center;color:#fff;font-size:10px;font-weight:600}
  .nb{margin-top:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:9px 12px}
  .nl{font-size:9px;color:#92400e;margin-bottom:2px}.nt{font-size:11px;color:#78350f}
  .sr{margin-top:12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:5px;padding:9px 14px;display:flex;gap:24px;flex-wrap:wrap}
  .sl{font-size:9px;color:#0369a1;margin-bottom:2px}.sv{font-size:12px;font-weight:600;color:#0c4a6e}
  .pbtn{position:fixed;bottom:20px;left:20px;background:#1e3a8a;color:#fff;border:none;border-radius:8px;padding:12px 24px;font-size:14px;font-family:'Cairo',Arial,sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3)}
  </style></head><body>
  <div class="page">
    <div class="hdr">
      <div>${logoHtml}</div>
      <div class="hi">
        <div class="ht">طلب تسعير / Request for Quotation</div>
        <div class="hc">${companyName}</div>
        ${infoLine?'<div class="hd">'+infoLine+'</div>':""}
        ${regLine?'<div class="hr">'+regLine+'</div>':""}
      </div>
    </div>
    <div class="bd">
      <div class="rb"><div class="rl">رقم طلب التسعير / RFQ No.</div><div class="rv">${rfq.rfqNo}</div></div>
      <div class="ig">
        <div class="ib"><div class="il">آخر موعد للتسعير</div><div class="iv">${rfq.requestDate}</div></div>
        <div class="ib"><div class="il">المورد / Supplier</div><div class="iv">${sup.companyName}</div></div>
        <div class="ib"><div class="il">تاريخ الإصدار</div><div class="iv">${new Date().toLocaleDateString("ar-EG")}</div></div>
      </div>
      <table><thead><tr>
        <th style="width:34px">#</th><th>البيان / Description</th><th>Part No.</th><th>الوحدة</th><th>الكمية / Qty</th>
      </tr></thead><tbody>${rows}</tbody></table>
      ${rfq.notes?'<div class="nb"><div class="nl">ملاحظات / Notes</div><div class="nt">'+rfq.notes+'</div></div>':""}
      ${senderName||senderPhone?'<div class="sr">'+(senderName?'<div><div class="sl">👤 مسؤول الطلب</div><div class="sv">'+senderName+'</div></div>':'')+
      (senderPhone?'<div><div class="sl">📞 تليفون المسؤول</div><div class="sv">'+senderPhone+'</div></div>':'')+
      '</div>':""}
    </div>
  </div>
  <button class="pbtn no-print" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),700));<\/script>
  </body></html>`;

    win.document.open(); win.document.write(html); win.document.close();
  }
function buildWhatsAppMessage(rfqNo: string, requestDate: string, companyName: string, items: RfqItem[], token?: string) {
  const lines = items.map((item, idx) =>
    `${idx + 1}. ${item.description}${item.partNo ? ` | رقم القطعة: ${item.partNo}` : ""} — الكمية: ${fmtQty(item.quantity)} ${item.unit || ""}`.trim()
  ).join("\n");
  const linkLine = token ? `\n\n🔗 *رابط إدخال الأسعار إلكترونياً:*\n${getRfqLink(token)}` : "";
  return `🔷 *طلب تسعير - ${rfqNo}*\n📅 التاريخ: ${requestDate}\n\nالسادة / ${companyName}\n\nنرجو تفضلكم بتقديم عرض سعر للبنود التالية:\n\n${lines}${linkLine}\n\nشاكرين لكم حسن تعاونكم 🙏`;
}

async function sendWhatsApp(supplier: RfqSupplier | Supplier, rfqNo: string, requestDate: string, items: RfqItem[], token?: string): Promise<"sent" | "fallback" | "error"> {
  const raw = supplier.whatsapp || supplier.phone || "";
  if (!raw) { alert("لا يوجد رقم واتساب أو هاتف لهذا المورد"); return "error"; }
  const msg = buildWhatsAppMessage(rfqNo, requestDate, supplier.companyName, items, token);
  try {
    const res = await authFetch(`${API_BASE}/api/whatsapp/send`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: raw, message: msg }),
    });
    const data = await res.json() as any;
    if (res.status === 503 && data?.hint) {
      const phone = raw.replace(/[^0-9]/g, "");
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
      return "fallback";
    }
    if (!res.ok) { alert(`فشل الإرسال: ${data?.error ?? "خطأ غير معروف"}`); return "error"; }
    return "sent";
  } catch {
    const phone = raw.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    return "fallback";
  }
}

function openEmail(supplier: RfqSupplier | Supplier, rfqNo: string, requestDate: string, items: RfqItem[], token?: string) {
  if (!supplier.email) { alert("لا يوجد بريد إلكتروني لهذا المورد"); return; }
  const subject = encodeURIComponent(`طلب تسعير - ${rfqNo}`);
  const body = encodeURIComponent(buildWhatsAppMessage(rfqNo, requestDate, supplier.companyName, items, token));
  window.open(`mailto:${supplier.email}?subject=${subject}&body=${body}`, "_blank");
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    "مكتمل":               "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
    "مرسل":                "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
    "تم التسعير من المورد": "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
  };
  const cls = cfg[status] ?? "bg-slate-100 text-slate-600 ring-1 ring-slate-400/20";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{status}</span>;
}

// ─── SAP Table Header Cell ────────────────────────────────────────────────────

function TH({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-right text-[11px] font-semibold text-slate-600 whitespace-nowrap border-l border-slate-300/60 last:border-l-0 ${className}`}>
      {children}
    </th>
  );
}

// ─── Analysis Modal ───────────────────────────────────────────────────────────

function AnalysisModal({ rfqId, rfqNo, onClose }: { rfqId: number; rfqNo: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery<AnalysisData>({
    queryKey: ['rfq-analysis', rfqId],
    queryFn: () => authFetchJson<AnalysisData>(`${API_BASE}/api/supplier-quotations/${rfqId}/analysis`),
  });

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function runAiAnalysis() {
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    try {
      const res = await authFetch(`${API_BASE}/api/supplier-quotations/${rfqId}/ai-analysis`, { method: 'POST' });
      const json = await res.json() as any;
      if (!res.ok) throw new Error(json.error ?? 'حدث خطأ');
      setAiAnalysis(json.analysis);
    } catch (e: any) {
      setAiError(e.message ?? 'حدث خطأ');
    } finally {
      setAiLoading(false);
    }
  }

  const submittedSuppliers = data?.suppliers.filter(s => s.responseStatus === 'submitted') ?? [];
  const pendingSuppliers   = data?.suppliers.filter(s => s.responseStatus === 'pending')   ?? [];
  const totalSuppliers     = data?.suppliers.length ?? 0;
  const responseRate       = totalSuppliers > 0 ? Math.round((submittedSuppliers.length / totalSuppliers) * 100) : 0;

  function getPrice(supplier: AnalysisData['suppliers'][0], itemId: number): number | null {
    const p = supplier.prices.find(pr => pr.rfqItemId === itemId);
    if (!p) return null;
    const v = parseFloat(p.unitPrice);
    return isNaN(v) ? null : v;
  }
  function getBestPrice(itemId: number): number | null {
    const prices = submittedSuppliers.map(s => getPrice(s, itemId)).filter((p): p is number => p !== null && p > 0);
    return prices.length ? Math.min(...prices) : null;
  }
  function getSupplierTotal(supplier: AnalysisData['suppliers'][0]): number {
    return (data?.items ?? []).reduce((sum, item) => {
      const price = getPrice(supplier, item.id);
      const qty = parseFloat(item.quantity) || 0;
      return sum + (price ?? 0) * qty;
    }, 0);
  }
  function getItemsCovered(supplier: AnalysisData['suppliers'][0]): number {
    return (data?.items ?? []).filter(item => { const p = getPrice(supplier, item.id); return p !== null && p > 0; }).length;
  }
  function getBestTotalSupplier(): string {
    if (!data || submittedSuppliers.length === 0) return '';
    const nonZero = submittedSuppliers.map(s => ({ name: s.companyName, total: getSupplierTotal(s) })).filter(t => t.total > 0);
    if (!nonZero.length) return '';
    return nonZero.sort((a, b) => a.total - b.total)[0].name;
  }
  function printAnalysis() {
    if (!data) return;
    const today = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    const totalItems = data.items.length;
    const suppTotals = submittedSuppliers.map(s => ({
      name: s.companyName, total: getSupplierTotal(s),
      covered: data.items.filter(item => { const p = getPrice(s, item.id); return p !== null && p > 0; }).length,
    })).sort((a, b) => { if (a.total > 0 && b.total > 0) return a.total - b.total; return a.total > 0 ? -1 : 1; });
    const bestName = getBestTotalSupplier();
    const minTotal = suppTotals.filter(s => s.total > 0)[0]?.total ?? 0;
    const maxTotal = Math.max(...suppTotals.map(s => s.total), 1);
    const leaderRows = suppTotals.map((s, i) => {
      const cov = totalItems > 0 ? Math.round((s.covered / totalItems) * 100) : 0;
      const isBest = s.name === bestName && s.total > 0;
      const barW = s.total > 0 ? Math.round((s.total / maxTotal) * 100) : 0;
      return `<tr><td style="padding:8px 10px;border-bottom:1px solid #eee;color:#888;font-size:11px">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:${isBest ? '700' : '500'};color:${isBest ? '#15803d' : '#1e293b'}">${s.name}${isBest ? ' ★' : ''}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:11px">${s.covered} / ${totalItems}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center">
          <div style="display:flex;align-items:center;gap:6px;justify-content:center">
            <div style="width:80px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
              <div style="width:${barW}%;height:6px;background:${isBest ? '#22c55e' : '#60a5fa'};border-radius:3px"></div>
            </div>
            <span style="font-size:11px;color:#475569">${cov}%</span>
          </div>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-family:monospace;font-weight:700;color:${isBest ? '#15803d' : '#334155'}">${s.total > 0 ? s.total.toFixed(3) : '—'}</td>
      </tr>`;
    }).join('');
    const headerCols = submittedSuppliers.map(s => `<th style="padding:10px 8px;background:#1e3a5f;color:#fff;font-size:11px;text-align:center;min-width:100px">${s.companyName}</th>`).join('');
    const bodyRows = data.items.map((item, idx) => {
      const best = getBestPrice(item.id);
      const cells = submittedSuppliers.map(s => {
        const price = getPrice(s, item.id);
        const qty = parseFloat(item.quantity) || 0;
        const isBest = price !== null && price > 0 && best !== null && price === best;
        return `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;background:${isBest ? '#f0fdf4' : 'transparent'}">${price !== null && price > 0 ? `<div style="font-family:monospace;font-weight:${isBest ? '700' : '500'};color:${isBest ? '#15803d' : '#1e293b'}">${price.toFixed(3)}${isBest ? ' ★' : ''}</div><div style="font-family:monospace;font-size:10px;color:#94a3b8">${(price * qty).toFixed(3)}</div>` : '<span style="color:#cbd5e1">—</span>'}</td>`;
      }).join('');
      const bestCell = best !== null ? `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;background:#eff6ff;font-family:monospace;font-weight:700;color:#1d4ed8">${best.toFixed(3)}</td>` : `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#cbd5e1">—</td>`;
      return `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}"><td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:500">${item.description}${item.partNo ? `<div style='font-size:10px;color:#94a3b8'>${item.partNo}</div>` : ''}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-size:11px;color:#64748b;font-family:monospace">${fmtQty(item.quantity)} ${item.unit || ''}</td>${cells}${bestCell}</tr>`;
    }).join('');
    const totalCells = submittedSuppliers.map(s => { const t = getSupplierTotal(s); const isBest = s.companyName === bestName && t > 0; return `<td style="padding:10px 8px;text-align:center;font-family:monospace;font-weight:700;color:${isBest ? '#15803d' : '#334155'};background:${isBest ? '#f0fdf4' : 'transparent'}">${t > 0 ? t.toFixed(3) : '—'}${isBest ? ' ★' : ''}</td>`; }).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تحليل الأسعار - ${rfqNo}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;padding:12mm 16mm}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f2240;padding-bottom:14px;margin-bottom:18px}.logo h1{font-size:20px;font-weight:bold;color:#0f2240}.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}.kpi{border-radius:8px;padding:12px;text-align:center}.kpi .num{font-size:26px;font-weight:bold}.section-title{font-size:12px;font-weight:bold;color:#0f2240;border-right:3px solid #1e3a5f;padding-right:8px;margin-bottom:10px}table{width:100%;border-collapse:collapse}th{padding:10px 8px;background:#0f2240;color:#fff;font-size:11px;text-align:right}@media print{@page{margin:10mm}body{padding:0}}</style></head><body>
    <div class="header"><div class="logo"><h1>تحليل ومقارنة الأسعار</h1><p style="font-size:10px;color:#64748b;margin-top:3px">طباعة في: ${today}</p></div><div style="text-align:left;font-size:11px;color:#64748b"><strong style="display:block;font-size:14px;color:#0f2240;font-family:monospace">${rfqNo}</strong>إجمالي البنود: ${totalItems}</div></div>
    <div class="kpi-grid"><div class="kpi" style="background:#f1f5f9;border:1px solid #e2e8f0"><div class="num" style="color:#1e293b">${totalSuppliers}</div><div style="font-size:10px;color:#64748b;margin-top:4px">إجمالي الموردين</div></div><div class="kpi" style="background:#f0fdf4;border:1px solid #bbf7d0"><div class="num" style="color:#15803d">${submittedSuppliers.length}</div><div style="font-size:10px;color:#16a34a;margin-top:4px">استجابوا</div></div><div class="kpi" style="background:#fffbeb;border:1px solid #fde68a"><div class="num" style="color:#d97706">${pendingSuppliers.length}</div><div style="font-size:10px;color:#b45309;margin-top:4px">في الانتظار</div></div><div class="kpi" style="background:#eff6ff;border:1px solid #bfdbfe"><div class="num" style="color:#1d4ed8">${responseRate}%</div><div style="font-size:10px;color:#2563eb;margin-top:4px">نسبة الاستجابة</div></div></div>
    ${submittedSuppliers.length > 0 ? `<div style="margin-bottom:20px"><div class="section-title">ترتيب الموردين</div><table><thead><tr><th style="width:30px">#</th><th>المورد</th><th style="text-align:center;width:80px">البنود</th><th style="text-align:center;width:120px">التغطية</th><th style="text-align:center;width:100px">الإجمالي</th></tr></thead><tbody>${leaderRows}</tbody></table></div><div><div class="section-title">تفاصيل الأسعار بند بند</div><table><thead><tr><th>البند</th><th style="text-align:center;width:70px">الكمية</th>${headerCols}<th style="text-align:center;width:90px;background:#1e3a8a">أفضل سعر</th></tr></thead><tbody>${bodyRows}</tbody><tfoot><tr style="background:#f1f5f9;font-weight:bold;border-top:2px solid #cbd5e1"><td style="padding:10px;font-weight:700">الإجمالي الكلي</td><td></td>${totalCells}<td style="padding:10px;text-align:center;font-family:monospace;font-weight:700;color:#1d4ed8;background:#eff6ff">${minTotal > 0 ? minTotal.toFixed(3) : '—'}</td></tr></tfoot></table></div>` : '<p style="text-align:center;color:#94a3b8;padding:40px">لم يستجب أي مورد حتى الآن</p>'}
    ${pendingSuppliers.length > 0 ? `<p style="margin-top:14px;font-size:10px;color:#94a3b8">⏳ لم يستجب بعد: ${pendingSuppliers.map(s => s.companyName).join('، ')}</p>` : ''}
    </body></html>`;
    const win = window.open('', '_blank', 'width=1000,height=750');
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 700); }
  }

  const supplierTotals = submittedSuppliers.map(s => ({
    name: s.companyName, total: getSupplierTotal(s), covered: getItemsCovered(s), isBest: s.companyName === getBestTotalSupplier(),
  })).sort((a, b) => { if (a.total > 0 && b.total > 0) return a.total - b.total; if (a.total > 0) return -1; return 1; });
  const maxTotal = Math.max(...supplierTotals.map(s => s.total), 1);
  const totalItems = data?.items.length ?? 0;

  return (
    <Dialog open={true} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="p-0 max-w-5xl max-h-[92vh] flex flex-col gap-0 [&>button]:hidden overflow-hidden rounded" dir="rtl">

        {/* SAP-style Header */}
        <DialogHeader className="flex-row items-center justify-between bg-[#0f2240] px-5 py-3.5 rounded-t space-y-0">
          <div>
            <DialogTitle className="text-sm font-bold text-white">تحليل ومقارنة الأسعار</DialogTitle>
            <p className="text-blue-300 text-[11px] mt-0.5 font-mono">{rfqNo}</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1 rounded transition-colors">
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="p-5 space-y-5 overflow-auto max-h-[82vh]">
          {isLoading && <div className="flex items-center justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-[#1e3a5f]" /></div>}
          {error && <p className="text-red-500 text-sm">حدث خطأ في تحميل البيانات</p>}

          {data && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { val: totalSuppliers,            label: "إجمالي الموردين", cls: "bg-slate-50 border-slate-200 text-slate-800" },
                  { val: submittedSuppliers.length, label: "استجابوا",        cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                  { val: pendingSuppliers.length,   label: "في الانتظار",    cls: "bg-amber-50 border-amber-200 text-amber-700" },
                  { val: `${responseRate}%`,        label: "نسبة الاستجابة", cls: "bg-blue-50 border-blue-200 text-blue-700" },
                ].map((k, i) => (
                  <div key={i} className={`border rounded p-3 text-center ${k.cls}`}>
                    <p className="text-2xl font-bold">{k.val}</p>
                    <p className="text-[11px] mt-1 opacity-80">{k.label}</p>
                  </div>
                ))}
              </div>

              {submittedSuppliers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Clock className="h-10 w-10 mx-auto text-slate-300" />
                  <p className="font-medium text-sm">لم يستجب أي مورد حتى الآن</p>
                  <p className="text-xs">أرسل الروابط للموردين وانتظر ردودهم</p>
                </div>
              ) : (
                <>
                  {/* Bar chart comparison */}
                  <div className="border border-slate-200 bg-white rounded p-4">
                    <h3 className="text-xs font-semibold text-[#0f2240] mb-3 flex items-center gap-1.5 border-r-2 border-[#1e3a5f] pr-2">
                      <BarChart3 className="h-3.5 w-3.5 text-[#1e3a5f]" /> مقارنة الإجمالي الكلي للموردين
                    </h3>
                    <div className="space-y-3">
                      {supplierTotals.map((sup, idx) => {
                        const barPct = sup.total > 0 ? (sup.total / maxTotal) * 100 : 0;
                        const coverage = totalItems > 0 ? Math.round((sup.covered / totalItems) * 100) : 0;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                {sup.isBest && sup.total > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-sm">★ الأفضل</span>}
                                <span className={sup.isBest && sup.total > 0 ? 'font-semibold text-slate-800' : 'text-slate-600'}>{sup.name}</span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                <span className="font-mono">{sup.covered}/{totalItems} بند</span>
                                <span className={`font-mono ${sup.isBest && sup.total > 0 ? 'font-bold text-emerald-700' : 'text-slate-700'}`}>{sup.total > 0 ? sup.total.toFixed(3) : '—'}</span>
                              </div>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded overflow-hidden">
                              <div className={`h-full rounded transition-all ${sup.isBest && sup.total > 0 ? 'bg-emerald-500' : 'bg-[#1e3a5f]'}`} style={{ width: `${barPct}%` }} />
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="h-1 rounded bg-slate-200 flex-1 overflow-hidden">
                                <div className="h-full bg-slate-400 rounded" style={{ width: `${coverage}%` }} />
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0 w-16 text-left">تغطية {coverage}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Leaderboard */}
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 text-[11px] font-semibold text-slate-700 border-b border-slate-300">ترتيب الموردين</div>
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="bg-[#f0f4f8] border-b border-slate-200">
                          <TH className="w-8">#</TH>
                          <TH>المورد</TH>
                          <TH className="text-center">البنود</TH>
                          <TH className="text-center">التغطية</TH>
                          <TH className="text-center">الإجمالي</TH>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierTotals.map((sup, idx) => {
                          const coverage = totalItems > 0 ? Math.round((sup.covered / totalItems) * 100) : 0;
                          return (
                            <tr key={idx} className={`border-b border-slate-100 last:border-0 ${sup.isBest && sup.total > 0 ? 'bg-emerald-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                              <td className="px-3 py-2 text-slate-400 text-[10px]">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{sup.name}{sup.isBest && sup.total > 0 && <span className="mr-1.5 text-[10px] text-emerald-600">★</span>}</td>
                              <td className="px-3 py-2 text-center text-[11px] text-slate-600 font-mono">{sup.covered} / {totalItems}</td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 bg-slate-100 rounded h-1.5">
                                    <div className={`h-1.5 rounded ${coverage >= 80 ? 'bg-emerald-500' : coverage >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${coverage}%` }} />
                                  </div>
                                  <span className="text-[10px] text-slate-500 w-7">{coverage}%</span>
                                </div>
                              </td>
                              <td className={`px-3 py-2 text-center font-mono font-semibold ${sup.isBest && sup.total > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                                {sup.total > 0 ? sup.total.toFixed(3) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Detailed price table */}
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 text-[11px] font-semibold text-slate-700 border-b border-slate-300">تفاصيل الأسعار بند بند</div>
                    <div className="overflow-auto">
                      <table className="w-full text-xs text-right min-w-[600px]">
                        <thead>
                          <tr className="bg-[#0f2240] text-white">
                            <th className="px-3 py-2.5 font-semibold text-right sticky right-0 bg-[#0f2240] z-10 min-w-[180px] text-[11px]">البند</th>
                            <th className="px-3 py-2.5 font-semibold text-center w-20 text-[11px]">الكمية</th>
                            {submittedSuppliers.map(s => <th key={s.id} className="px-3 py-2.5 font-semibold text-center min-w-[120px] text-blue-100 text-[11px]">{s.companyName}</th>)}
                            <th className="px-3 py-2.5 font-semibold text-center bg-[#1e3a8a] min-w-[100px] text-[11px]">أفضل سعر</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.items.map((item, idx) => {
                            const best = getBestPrice(item.id);
                            // Anomaly detection: compute avg for this item across submitted suppliers
                            const itemPrices = submittedSuppliers.map(s => getPrice(s, item.id)).filter((p): p is number => p !== null && p > 0);
                            const avg = itemPrices.length >= 2 ? itemPrices.reduce((a, b) => a + b, 0) / itemPrices.length : null;
                            const hasAnomaly = avg !== null && itemPrices.some(p => p / avg > 1.5 || p / avg < 0.5);
                            return (
                              <tr key={item.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                <td className={`px-3 py-2 font-medium sticky right-0 z-10 border-l border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                  <div className="flex items-center gap-1">
                                    {hasAnomaly && <span title="يوجد شذوذ في أسعار هذا البند" className="text-orange-500 text-[11px] shrink-0">⚠️</span>}
                                    <div className="truncate max-w-[170px]" title={item.description}>{item.description}</div>
                                  </div>
                                  {item.partNo && <div className="text-[10px] text-slate-400 mr-4">{item.partNo}</div>}
                                  {avg !== null && <div className="text-[10px] text-slate-400 mt-0.5 mr-4 font-mono">متوسط: {avg.toFixed(3)}</div>}
                                </td>
                                <td className="px-3 py-2 text-center text-slate-500 font-mono text-[11px]">{fmtQty(item.quantity)} {item.unit}</td>
                                {submittedSuppliers.map(s => {
                                  const price = getPrice(s, item.id);
                                  const qty = parseFloat(item.quantity) || 0;
                                  const isBest = price !== null && price > 0 && best !== null && price === best;
                                  const ratio = avg !== null && price !== null && price > 0 ? price / avg : 1;
                                  const isHigh = avg !== null && ratio > 1.5;
                                  const isLow  = avg !== null && ratio < 0.5 && price !== null && price > 0;
                                  const anomalyPct = avg !== null && price !== null && price > 0
                                    ? (ratio > 1 ? `+${((ratio - 1) * 100).toFixed(0)}%` : `-${((1 - ratio) * 100).toFixed(0)}%`)
                                    : null;
                                  return (
                                    <td key={s.id} className={`px-3 py-2 text-center border-l border-slate-100 ${isBest ? 'bg-emerald-50' : isHigh ? 'bg-red-50' : isLow ? 'bg-yellow-50' : ''}`}>
                                      {price !== null && price > 0 ? (
                                        <div>
                                          <div className={`font-mono font-semibold ${isBest ? 'text-emerald-700' : isHigh ? 'text-red-700' : isLow ? 'text-yellow-700' : 'text-slate-800'}`}>
                                            {price.toFixed(3)}
                                            {isBest && <span className="mr-1 text-[10px] text-emerald-500">★</span>}
                                            {isHigh && <span className="mr-1 text-[9px] bg-red-100 text-red-600 rounded px-0.5 font-bold">مرتفع</span>}
                                            {isLow  && <span className="mr-1 text-[9px] bg-yellow-100 text-yellow-700 rounded px-0.5 font-bold">منخفض</span>}
                                          </div>
                                          <div className="flex items-center justify-center gap-1">
                                            <div className={`text-[10px] font-mono ${isBest ? 'text-emerald-400' : isHigh ? 'text-red-400' : isLow ? 'text-yellow-600' : 'text-slate-400'}`}>{(price * qty).toFixed(3)}</div>
                                            {(isHigh || isLow) && anomalyPct && avg !== null && <div className={`text-[9px] font-bold ${isHigh ? 'text-red-500' : 'text-yellow-600'}`}>{anomalyPct}</div>}
                                          </div>
                                        </div>
                                      ) : <span className="text-slate-300 text-[11px]">—</span>}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2 text-center bg-blue-50 border-l border-blue-200">
                                  {best !== null ? <span className="font-mono font-bold text-[#1e3a5f]">{best.toFixed(3)}</span> : <span className="text-slate-300">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-300 bg-[#f0f4f8] font-bold">
                            <td className="px-3 py-2.5 sticky right-0 bg-[#f0f4f8] z-10 text-slate-700 text-xs">الإجمالي الكلي</td>
                            <td />
                            {submittedSuppliers.map(s => {
                              const total = getSupplierTotal(s);
                              const isBest = s.companyName === getBestTotalSupplier() && total > 0;
                              return <td key={s.id} className={`px-3 py-2.5 text-center font-mono text-xs ${isBest ? 'text-emerald-700 bg-emerald-50' : 'text-slate-700'}`}>{total > 0 ? total.toFixed(3) : '—'}{isBest && <span className="mr-1 text-[10px]">★</span>}</td>;
                            })}
                            <td className="px-3 py-2.5 text-center bg-blue-50 font-mono text-[#1e3a5f] text-xs">
                              {submittedSuppliers.length > 0 ? (() => { const v = Math.min(...submittedSuppliers.map(s => getSupplierTotal(s)).filter(t => t > 0)); return isFinite(v) ? v.toFixed(3) : '—'; })() : '—'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Supplier Terms Section */}
                  {submittedSuppliers.some(s => s.paymentTerms || s.offerValidityDays || s.deliveryDays || s.responseNotes) && (
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 text-[11px] font-semibold text-slate-700 border-b border-slate-300">شروط الموردين</div>
                      <div className="overflow-auto">
                        <table className="w-full text-xs text-right min-w-[500px]">
                          <thead>
                            <tr className="bg-[#f0f4f8] border-b border-slate-200">
                              <TH>المورد</TH>
                              <TH className="text-center">شروط الدفع</TH>
                              <TH className="text-center">صلاحية العرض</TH>
                              <TH className="text-center">مدة التوريد</TH>
                              <TH className="text-center">ملاحظات المورد</TH>
                            </tr>
                          </thead>
                          <tbody>
                            {submittedSuppliers.map((s, idx) => (
                              <tr key={s.id} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                <td className="px-3 py-2.5 font-medium text-slate-800">{s.companyName}</td>
                                <td className="px-3 py-2.5 text-center text-slate-600">
                                  {s.paymentTerms ? <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 text-[11px]">{s.paymentTerms}</span> : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {s.offerValidityDays ? <span className="bg-slate-100 text-slate-700 rounded px-2 py-0.5 text-[11px] font-mono">{s.offerValidityDays} يوم</span> : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {s.deliveryDays ? <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5 text-[11px] font-mono">{s.deliveryDays} يوم</span> : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center text-slate-600 text-[11px]">
                                  {s.responseNotes ? s.responseNotes : <span className="text-slate-300">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {pendingSuppliers.length > 0 && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                      <span>لم يستجب بعد: <span className="text-slate-600">{pendingSuppliers.map(s => s.companyName).join('، ')}</span></span>
                    </div>
                  )}
                </>
              )}

              {/* AI Analysis Result */}
              {(aiLoading || aiAnalysis || aiError) && (
                <div className="border border-purple-200 rounded overflow-hidden">
                  <div className="bg-purple-50 px-4 py-2 text-[11px] font-semibold text-purple-800 border-b border-purple-200 flex items-center gap-2">
                    <span>✨</span> تحليل الذكاء الاصطناعي
                    {aiLoading && <Loader2 className="h-3 w-3 animate-spin text-purple-600 mr-auto" />}
                  </div>
                  <div className="p-4">
                    {aiLoading && (
                      <div className="flex items-center gap-2 text-purple-600 text-xs">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>جاري تحليل البيانات بالذكاء الاصطناعي…</span>
                      </div>
                    )}
                    {aiError && (
                      <div className="text-xs space-y-1.5">
                        {aiError.toLowerCase().includes('quota') || aiError.toLowerCase().includes('exceeded') ? (
                          <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-1">
                            <p className="font-semibold text-amber-800">⚠️ تم استنفاد حصة Gemini AI المجانية</p>
                            <p className="text-amber-700">يجب تفعيل الفوترة (Billing) في حسابك على Google Cloud لمتابعة استخدام الذكاء الاصطناعي.</p>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              <a href="https://console.cloud.google.com/billing" target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] hover:bg-amber-700">
                                تفعيل الفوترة
                              </a>
                              <a href="https://ai.dev/rate-limit" target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 border border-amber-400 text-amber-700 rounded text-[11px] hover:bg-amber-50">
                                مراقبة الاستخدام
                              </a>
                            </div>
                          </div>
                        ) : (
                          <p className="text-red-600">{aiError}</p>
                        )}
                      </div>
                    )}
                    {aiAnalysis && (
                      <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans" dir="rtl">
                        {aiAnalysis.split('\n').map((line, i) => {
                          const isBold = line.startsWith('**') || line.startsWith('##') || line.startsWith('###') || /^\d+\.\s+\*\*/.test(line);
                          const cleaned = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').replace(/^-\s/, '• ');
                          if (!cleaned.trim()) return <div key={i} className="h-2" />;
                          if (isBold) return <p key={i} className="font-bold text-slate-900 mt-2 mb-1">{cleaned}</p>;
                          return <p key={i} className="mb-0.5">{cleaned}</p>;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between bg-[#f8fafc]">
          <div className="flex items-center gap-2">
            <button onClick={printAnalysis} disabled={!data || submittedSuppliers.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded">
              <FileText className="h-3.5 w-3.5" /> طباعة التحليل
            </button>
            <button
              onClick={runAiAnalysis}
              disabled={aiLoading || !data || submittedSuppliers.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-300 bg-purple-50 text-xs text-purple-700 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded">
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>✨</span>}
              تحليل ذكي
            </button>
          </div>
          <button onClick={onClose} className="px-4 py-1.5 border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50 rounded transition-colors">إغلاق</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Wizard ──────────────────────────────────────────────────────────────────

function SendWizard({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [foundCQ, setFoundCQ] = useState<FoundCQ | null>(null);
  const [searchError, setSearchError] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<number>>(new Set());
  const [catFilter, setCatFilter] = useState<string>("all");
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const [notes, setNotes] = useState("");
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [savedRfqs, setSavedRfqs] = useState<any[]>([]);
  const [copiedToken, setCopiedToken] = useState("");
  const [confirmedItems, setConfirmedItems] = useState<RfqItem[]>([]);
  const [sendAllStatus, setSendAllStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [sendAllResults, setSendAllResults] = useState<SendAllResult[]>([]);

  async function handleSearch() {
    if (!searchTerm.trim()) return;
    setSearching(true); setSearchError(""); setFoundCQ(null); setSearchResults([]);
    try {
      const res = await authFetch(`${API_BASE}/api/supplier-quotations/search-cq?q=${encodeURIComponent(searchTerm.trim())}`);
      const data: any[] = await res.json();
      if (!data || data.length === 0) { setSearchError("لم يتم العثور على طلب بهذا الرقم"); return; }
      if (data.length === 1) { await handleSelectCQ(data[0].id); }
      else { setSearchResults(data); }
    } catch { setSearchError("حدث خطأ أثناء البحث"); }
    finally { setSearching(false); }
  }

  async function handleSelectCQ(id: number) {
    try {
      const res = await authFetch(`${API_BASE}/api/customer-quotations/${id}`);
      const data = await res.json();
      setFoundCQ(data);
      setSearchResults([]);
      setSelectedItemIds(new Set(data.items.map((i: RfqItem) => i.id)));
    } catch { setSearchError("حدث خطأ أثناء تحميل تفاصيل الطلب"); }
  }

  async function loadSuppliers() {
    if (suppliersLoaded) return;
    try {
      const [suppRes, catRes] = await Promise.all([
        authFetchJson(`${API_BASE}/api/suppliers`),
        authFetchJson(`${API_BASE}/api/supplier-categories`),
      ]);
      setSuppliers(suppRes.filter((s: Supplier) => s.status === "نشط"));
      setCategories(catRes);
      setSuppliersLoaded(true);
    } catch { /* ignore */ }
  }

  function goToStep(n: number) {
    if (n === 3) {
      const locked = (foundCQ?.items ?? []).filter(i => selectedItemIds.has(i.id));
      setConfirmedItems(locked);
      loadSuppliers();
    }
    setStep(n);
  }

  async function handleSave() {
    const itemsToSend = confirmedItems.length > 0
      ? confirmedItems
      : (foundCQ?.items ?? []).filter(i => selectedItemIds.has(i.id));
    if (itemsToSend.length === 0) { alert("يجب اختيار بند واحد على الأقل من البنود"); return; }
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/supplier-quotations`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceQuotationId: foundCQ?.id ?? null,
          sourceQuotationNo: foundCQ?.quotationNo ?? "",
          customerOrderNo: foundCQ?.customerOrderNo ?? "",
          requestDate, notes,
          items: itemsToSend,
          supplierIds: [...selectedSupplierIds],
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error); return; }
      const rfq = await res.json();
      setSavedRfqs([rfq]);
      onSaved();
      setStep(5);
      triggerSendAll(rfq.id);
    } catch { alert("حدث خطأ أثناء الحفظ"); }
    finally { setSaving(false); }
  }

  async function triggerSendAll(rfqId: number) {
    setSendAllStatus("sending");
    setSendAllResults([]);
    try {
      const res = await authFetch(`${API_BASE}/api/supplier-quotations/${rfqId}/send-all`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: window.location.origin }),
      });
      const data = await res.json() as any;
      if (!res.ok) { setSendAllStatus("error"); return; }
      setSendAllResults(data.results ?? []);
      setSendAllStatus("done");
    } catch { setSendAllStatus("error"); }
  }

  const selectedItems = (foundCQ?.items ?? []).filter(i => selectedItemIds.has(i.id));
  const step3Valid = selectedSupplierIds.size > 0;
  const totalUniqueSuppliers = selectedSupplierIds.size;
  const STEPS = ["استيراد البنود", "اختيار البنود", "اختيار الموردين", "مراجعة وإرسال"];

  // SAP-style input class
  const inputCls = "w-full border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200 rounded-sm";
  const labelCls = "block text-[11px] font-semibold text-slate-600 mb-1";

  return (
    <Dialog open={true} onOpenChange={v => { if (!v && step !== 4) onClose(); }}>
      <DialogContent className="p-0 max-w-3xl max-h-[93vh] flex flex-col gap-0 [&>button]:hidden overflow-hidden rounded" dir="rtl">

        {/* SAP Modal Header */}
        <DialogHeader className="flex-row items-center justify-between bg-[#0f2240] px-5 py-3 rounded-t space-y-0">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-blue-300" />
            <DialogTitle className="text-sm font-bold text-white">إرسال طلب تسعير للموردين</DialogTitle>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1 rounded transition-colors">
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* Step progress bar — SAP style */}
        {step <= 4 && (
          <div className="flex items-stretch border-b border-slate-200 bg-[#f0f4f8]">
            {STEPS.map((label, idx) => {
              const n = idx + 1;
              const active = step === n;
              const done = step > n;
              return (
                <React.Fragment key={n}>
                  <div className={`flex items-center gap-2 px-4 py-2.5 flex-1 min-w-0 relative
                    ${active ? "bg-white border-b-2 border-[#1e3a5f]" : done ? "bg-[#f0f4f8]" : "bg-[#f0f4f8]"}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold
                      ${active ? "bg-[#1e3a5f] text-white" : done ? "bg-emerald-500 text-white" : "bg-slate-300 text-slate-500"}`}>
                      {done ? <Check className="h-3 w-3" /> : n}
                    </span>
                    <span className={`text-[11px] font-medium truncate hidden sm:block
                      ${active ? "text-[#1e3a5f]" : done ? "text-emerald-600" : "text-slate-400"}`}>
                      {label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className="flex items-center text-slate-300 shrink-0">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">

          {/* ── STEP 1: Import CQ ── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-500 border-r-2 border-[#1e3a5f] pr-2">ابحث عن طلب تسعير العميل برقم الطلب أو رقم أمر الشراء</p>

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    className={`${inputCls} pr-8`}
                    placeholder="مثال: CQ-20260620-1234"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()} dir="ltr"
                  />
                </div>
                <button onClick={handleSearch} disabled={searching || !searchTerm.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-semibold disabled:opacity-50 transition-colors rounded-sm">
                  {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  بحث
                </button>
              </div>

              {searchError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
                  <X className="h-3.5 w-3.5 shrink-0" /> {searchError}
                </div>
              )}

              {/* Multiple results */}
              {searchResults.length > 1 && (
                <div className="border border-slate-200 rounded-sm overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600 border-b border-slate-300">
                    تم العثور على {searchResults.length} نتيجة — اختر الطلب المناسب
                  </div>
                  <div className="divide-y divide-slate-100 max-h-48 overflow-auto">
                    {searchResults.map(r => (
                      <button key={r.id} onClick={() => handleSelectCQ(r.id)}
                        className="w-full text-right px-4 py-2.5 hover:bg-blue-50 transition-colors flex justify-between items-center gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-[#1e3a5f] font-mono">{r.quotationNo}</span>
                          <span className="text-[11px] text-slate-500">{r.customerName || "—"}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{r.requestDate || ""}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Found CQ */}
              {foundCQ && (
                <div className="border border-emerald-300 bg-emerald-50 rounded-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-emerald-100 border-b border-emerald-200">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                      <Check className="h-3.5 w-3.5" /> تم العثور على الطلب
                    </div>
                    <button onClick={() => { setFoundCQ(null); setSearchResults([]); }}
                      className="text-[10px] text-slate-500 hover:text-red-600 border border-slate-300 bg-white px-2 py-0.5 rounded-sm">تغيير</button>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div><span className="text-slate-400">رقم الطلب: </span><span className="font-semibold font-mono text-[#0f2240]">{foundCQ.quotationNo}</span></div>
                    <div><span className="text-slate-400">العميل: </span><span className="font-semibold">{foundCQ.customerName}</span></div>
                    <div><span className="text-slate-400">رقم أمر الشراء: </span><span className="font-medium">{foundCQ.customerOrderNo || "—"}</span></div>
                    <div><span className="text-slate-400">عدد البنود: </span><span className="font-semibold text-[#1e3a5f]">{foundCQ.items.length} بند</span></div>
                  </div>
                  <div className="mx-3 mb-3 border border-slate-200 rounded-sm overflow-hidden">
                    <table className="w-full text-[11px] text-right">
                      <thead className="bg-slate-50 border-b border-slate-300">
                        <tr>
                          <TH className="w-8">#</TH>
                          <TH>الوصف</TH>
                          <TH>رقم القطعة</TH>
                          <TH>الكمية</TH>
                        </tr>
                      </thead>
                      <tbody>
                        {foundCQ.items.map((item, idx) => (
                          <tr key={item.id} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                            <td className="px-3 py-1.5 text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-1.5 font-medium">{item.description}</td>
                            <td className="px-3 py-1.5 text-slate-500">{item.partNo || "—"}</td>
                            <td className="px-3 py-1.5 font-mono">{fmtQty(item.quantity)} {item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Select Items ── */}
          {step === 2 && foundCQ && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500 border-r-2 border-[#1e3a5f] pr-2">اختر البنود التي تريد إرسالها للموردين</p>
                <div className="flex items-center gap-2 text-[11px]">
                  <button className="text-[#1e3a5f] hover:underline font-medium" onClick={() => setSelectedItemIds(new Set(foundCQ.items.map(i => i.id)))}>تحديد الكل</button>
                  <span className="text-slate-300">|</span>
                  <button className="text-slate-500 hover:underline" onClick={() => setSelectedItemIds(new Set())}>إلغاء الكل</button>
                </div>
              </div>
              <div className="border border-slate-200 rounded-sm overflow-hidden">
                <table className="w-full text-[11px] text-right">
                  <thead className="bg-slate-50 border-b border-slate-300">
                    <tr>
                      <TH className="w-10 text-center">✓</TH>
                      <TH>الوصف</TH>
                      <TH>كود البند</TH>
                      <TH>رقم القطعة</TH>
                      <TH className="text-center">الكمية</TH>
                      <TH className="text-center">الوحدة</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {foundCQ.items.map((item, idx) => {
                      const checked = selectedItemIds.has(item.id);
                      return (
                        <tr key={item.id}
                          className={`border-b border-slate-100 last:border-0 cursor-pointer select-none transition-colors
                            ${checked ? "bg-blue-50" : idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/30 hover:bg-slate-50"}`}
                          onClick={() => { const s = new Set(selectedItemIds); checked ? s.delete(item.id) : s.add(item.id); setSelectedItemIds(s); }}>
                          <td className="px-3 py-1.5 text-center">
                            <div className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border-2 transition-colors ${checked ? "bg-[#1e3a5f] border-[#1e3a5f]" : "border-slate-300"}`}>
                              {checked && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 font-medium">{item.description}</td>
                          <td className="px-3 py-1.5 text-slate-500 font-mono">{item.customerItemCode || "—"}</td>
                          <td className="px-3 py-1.5 text-slate-500 font-mono">{item.partNo || "—"}</td>
                          <td className="px-3 py-1.5 text-center font-mono">{fmtQty(item.quantity)}</td>
                          <td className="px-3 py-1.5 text-center text-slate-500">{item.unit || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400">تم تحديد <span className="font-semibold text-[#1e3a5f]">{selectedItemIds.size}</span> من {foundCQ.items.length} بند</p>
            </div>
          )}

          {/* ── STEP 3: Select Suppliers ── */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500 border-r-2 border-[#1e3a5f] pr-2">
                اختر الموردين — سيصل لكل مورد رابط خاص للرد على جميع البنود ({selectedItems.length} بند)
              </p>

              {/* Category filter pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 shrink-0">التصنيف:</span>
                {[{ id: "all", name: "الكل" }, ...categories.map(c => ({ id: String(c.id), name: c.name }))].map(cat => (
                  <button key={cat.id} onClick={() => setCatFilter(cat.id)}
                    className={`px-2.5 py-0.5 rounded-sm text-[10px] font-semibold border transition-all
                      ${catFilter === cat.id ? "bg-[#0f2240] text-white border-[#0f2240]" : "border-slate-300 text-slate-600 bg-white hover:border-[#1e3a5f] hover:text-[#1e3a5f]"}`}>
                    {cat.name}
                  </button>
                ))}
                {(() => {
                  const filtered = catFilter === "all" ? suppliers : suppliers.filter(s => s.categories.some(c => String(c.id) === catFilter));
                  const filteredIds = filtered.map(s => s.id);
                  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedSupplierIds.has(id));
                  return filtered.length > 0 ? (
                    <button onClick={() => {
                      const next = new Set(selectedSupplierIds);
                      if (allSelected) filteredIds.forEach(id => next.delete(id));
                      else filteredIds.forEach(id => next.add(id));
                      setSelectedSupplierIds(next);
                    }}
                      className={`mr-auto px-2.5 py-0.5 rounded-sm text-[10px] font-semibold border transition-colors
                        ${allSelected ? "bg-red-50 text-red-600 border-red-300" : "bg-emerald-50 text-emerald-700 border-emerald-300"}`}>
                      {allSelected ? "إلغاء تحديد الكل" : `تحديد الكل (${filtered.length})`}
                    </button>
                  ) : null;
                })()}
              </div>

              {/* Suppliers list — SAP dense table style */}
              {(() => {
                const filtered = catFilter === "all" ? suppliers : suppliers.filter(s => s.categories.some(c => String(c.id) === catFilter));
                return filtered.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">لا يوجد موردون في هذا التصنيف</p>
                ) : (
                  <div className="border border-slate-200 rounded-sm overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x-0 max-h-72 overflow-auto">
                      {filtered.map((sup, idx) => {
                        const checked = selectedSupplierIds.has(sup.id);
                        return (
                          <div key={sup.id}
                            onClick={() => { const next = new Set(selectedSupplierIds); checked ? next.delete(sup.id) : next.add(sup.id); setSelectedSupplierIds(next); }}
                            className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none transition-colors border-b border-slate-100 last:border-0
                              ${checked ? "bg-[#1e3a5f]/8 border-l-2 border-l-[#1e3a5f]" : idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/30 hover:bg-slate-50"}`}>
                            <div className={`shrink-0 h-4 w-4 rounded-sm border-2 flex items-center justify-center transition-colors
                              ${checked ? "bg-[#1e3a5f] border-[#1e3a5f]" : "border-slate-300"}`}>
                              {checked && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${checked ? "text-[#1e3a5f]" : "text-slate-700"}`}>{sup.companyName}</p>
                              {sup.categories.length > 0 && (
                                <p className="text-[10px] text-slate-400 truncate">{sup.categories.map(c => c.name).join(" · ")}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <p className="text-[11px] text-slate-400">
                {selectedSupplierIds.size > 0
                  ? <><span className="font-semibold text-[#1e3a5f]">{selectedSupplierIds.size}</span> مورد محدد — سيُنشأ طلب تسعير واحد يُرسل لجميعهم</>
                  : "لم يتم اختيار أي مورد بعد"}
              </p>
            </div>
          )}

          {/* ── STEP 4: Review & Send ── */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Summary panel */}
              <div className="border border-slate-200 rounded-sm overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-700 border-b border-slate-300">ملخص الطلب</div>
                <div className="p-3 grid grid-cols-2 gap-2 text-[11px] bg-[#f8fafc]">
                  <div><span className="text-slate-400">طلب تسعير العميل: </span><span className="font-semibold font-mono text-[#1e3a5f]">{foundCQ?.quotationNo || "—"}</span></div>
                  <div><span className="text-slate-400">عدد البنود: </span><span className="font-semibold text-[#1e3a5f]">{selectedItems.length} بند</span></div>
                  <div><span className="text-slate-400">رقم أمر الشراء: </span><span className="font-medium">{foundCQ?.customerOrderNo || "—"}</span></div>
                  <div><span className="text-slate-400">عدد الموردين: </span><span className="font-semibold text-[#1e3a5f]">{totalUniqueSuppliers} مورد</span></div>
                </div>

                {/* Items mini-table */}
                <div className="border-t border-slate-200 overflow-auto max-h-32">
                  <table className="w-full text-[11px] text-right">
                    <thead className="bg-[#f0f4f8] border-b border-slate-200 sticky top-0">
                      <tr>
                        <TH className="w-7">#</TH>
                        <TH>البند</TH>
                        <TH className="text-center">الكمية</TH>
                        <TH className="text-center">الوحدة</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item, idx) => (
                        <tr key={item.id} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                          <td className="px-3 py-1 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-1 font-medium truncate max-w-[200px]">{item.description}</td>
                          <td className="px-3 py-1 text-center font-mono">{fmtQty(item.quantity)}</td>
                          <td className="px-3 py-1 text-center text-slate-500">{item.unit || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Suppliers pills */}
                <div className="border-t border-slate-200 p-3 flex flex-wrap gap-1.5">
                  {[...selectedSupplierIds].map(sid => {
                    const sup = suppliers.find(s => s.id === sid);
                    return sup ? (
                      <span key={sid} className="px-2 py-0.5 text-[10px] font-semibold bg-[#1e3a5f]/10 text-[#1e3a5f] border border-[#1e3a5f]/20 rounded-sm">{sup.companyName}</span>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Date + Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>تاريخ إغلاق الطلب <span className="text-slate-400 font-normal">(آخر موعد للتسعير)</span></label>
                  <input type="date" value={requestDate} onChange={e => setRequestDate(e.target.value)} className={inputCls} dir="ltr" />
                </div>
                <div>
                  <label className={labelCls}>ملاحظات <span className="text-slate-400 font-normal">(اختياري)</span></label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي ملاحظات إضافية..." className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: Result ── */}
          {step === 5 && savedRfqs.length > 0 && (() => {
            const rfq = savedRfqs[0];
            const isSending = sendAllStatus === "sending";
            const isDone    = sendAllStatus === "done";
            const isError   = sendAllStatus === "error";
            const resultMap = new Map<number, SendAllResult>(sendAllResults.map(r => [r.supplierId, r]));

            return (
              <div className="space-y-4">
                {/* Success banner */}
                <div className="border border-emerald-300 bg-emerald-50 rounded-sm p-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-800">تم إنشاء طلب التسعير بنجاح</p>
                    <p className="text-[11px] text-emerald-600 font-mono mt-0.5">{rfq.rfqNo} — {rfq.items?.length} بند · {rfq.suppliers?.length} مورد</p>
                  </div>
                </div>

                {/* Send status banner */}
                {isSending && (
                  <div className="border border-blue-200 bg-blue-50 rounded-sm p-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#1e3a5f] shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[#1e3a5f]">جاري الإرسال التلقائي لجميع الموردين...</p>
                      <p className="text-[10px] text-blue-500">واتساب + إيميل</p>
                    </div>
                  </div>
                )}
                {isDone && (
                  <div className="border border-emerald-200 bg-emerald-50 rounded-sm p-3 flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-800">
                      تم الإرسال إلى {sendAllResults.filter(r => r.sentChannels.length > 0).length} من {sendAllResults.length} مورد
                    </p>
                  </div>
                )}
                {isError && (
                  <div className="border border-red-200 bg-red-50 rounded-sm p-3 flex items-center gap-2">
                    <X className="h-4 w-4 text-red-500 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-red-700">حدث خطأ في الإرسال التلقائي</p>
                      <p className="text-[10px] text-red-500">يمكنك الإرسال يدوياً من خلال الأزرار أدناه</p>
                    </div>
                  </div>
                )}

                {/* Per-supplier table */}
                <div className="text-[11px] font-semibold text-slate-600 border-r-2 border-[#1e3a5f] pr-2">تفاصيل الإرسال لكل مورد</div>
                <div className="border border-slate-200 rounded-sm overflow-hidden">
                  {(rfq.suppliers ?? []).map((sup: RfqSupplier, idx: number) => {
                    const result = resultMap.get(sup.supplierId);
                    const rfqLinkToUse = result?.rfqLink ?? getRfqLink(sup.token);

                    return (
                      <div key={sup.token} className={`border-b border-slate-200 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                        {/* Supplier row */}
                        <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-800 flex-1 min-w-0 truncate">{sup.companyName}</span>
                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            {isSending && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-blue-100 text-blue-700 text-[10px] font-semibold border border-blue-200">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" /> إرسال...
                              </span>
                            )}
                            {result?.whatsappSent && (
                              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                                <Check className="h-2.5 w-2.5" /> واتساب
                              </span>
                            )}
                            {result?.emailSent && (
                              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-sm bg-blue-100 text-blue-700 text-[10px] font-semibold border border-blue-200">
                                <Check className="h-2.5 w-2.5" /> إيميل
                              </span>
                            )}
                            {result && result.sentChannels.length === 0 && !result.whatsappFallbackLink && (
                              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-sm bg-amber-100 text-amber-700 text-[10px] font-semibold border border-amber-200">
                                <Clock className="h-2.5 w-2.5" /> لم يُرسل
                              </span>
                            )}
                          </div>
                          {/* Action buttons */}
                          <div className="flex gap-1 shrink-0">
                            <button className="flex items-center gap-0.5 px-2 py-0.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[10px] rounded-sm transition-colors"
                              onClick={() => downloadRfqPdf(rfq, sup)}>
                              <FileText className="h-3 w-3" /> PDF
                            </button>
                            <button className="flex items-center gap-0.5 px-2 py-0.5 border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 text-[10px] rounded-sm transition-colors"
                              onClick={() => sendWhatsApp(sup, rfq.rfqNo, rfq.requestDate, rfq.items, sup?.token)}>
                              <MessageSquare className="h-3 w-3" /> واتساب
                            </button>
                            <button className="flex items-center gap-0.5 px-2 py-0.5 border border-orange-200 bg-white hover:bg-orange-50 text-orange-700 text-[10px] rounded-sm transition-colors"
                              onClick={() => openEmail(sup, rfq.rfqNo, rfq.requestDate, rfq.items, sup?.token)}>
                              <Mail className="h-3 w-3" /> إيميل
                            </button>
                          </div>
                        </div>

                        {/* RFQ link */}
                        {sup.token && (
                          <div className="flex items-center gap-2 border-t border-slate-100 bg-[#f8fafc] px-3 py-1.5">
                            <LinkIcon className="h-3 w-3 shrink-0 text-[#1e3a5f]" />
                            <span className="text-[10px] text-slate-400 font-mono truncate flex-1">{rfqLinkToUse}</span>
                            <button onClick={() => copyTokenLink(sup.token, setCopiedToken)}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-white border border-slate-200 hover:border-[#1e3a5f] text-[10px] text-slate-500 hover:text-[#1e3a5f] shrink-0 transition-colors">
                              {copiedToken === sup.token ? <><Check className="h-2.5 w-2.5 text-emerald-600" /> تم</> : <><Copy className="h-2.5 w-2.5" /> نسخ</>}
                            </button>
                          </div>
                        )}

                        {/* WhatsApp fallback */}
                        {result?.whatsappFallbackLink && (
                          <div className="border-t border-emerald-100 px-3 py-1.5 bg-emerald-50 flex items-center gap-2">
                            <MessageSquare className="h-3 w-3 text-emerald-600 shrink-0" />
                            <span className="text-[10px] text-emerald-700">واتساب API غير مُهيأ —</span>
                            <a href={result.whatsappFallbackLink} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] font-semibold text-[#1e3a5f] underline">فتح واتساب يدوياً</a>
                          </div>
                        )}

                        {/* Errors */}
                        {result?.errors && result.errors.length > 0 && !result.errors.includes("whatsapp_not_configured") && (
                          <div className="border-t border-red-100 px-3 py-1.5 bg-red-50">
                            <p className="text-[10px] text-red-500">{result.errors.join(" — ")}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-[#f8fafc] px-5 py-3 flex items-center justify-between gap-3">
          {step <= 4 && step > 1 ? (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white text-xs text-slate-600 hover:bg-slate-50 rounded-sm transition-colors">
              <ArrowRight className="h-3.5 w-3.5" /> السابق
            </button>
          ) : <div />}
          <div className="flex gap-2">
            {step < 4 && (
              <button
                disabled={(step === 1 && !foundCQ) || (step === 2 && selectedItemIds.size === 0) || (step === 3 && !step3Valid)}
                onClick={() => goToStep(step + 1)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed rounded-sm transition-colors">
                التالي <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {step === 4 && (
              <button disabled={saving} onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 rounded-sm transition-colors">
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري الحفظ...</> : <><Send className="h-3.5 w-3.5" /> حفظ وإرسال</>}
              </button>
            )}
            {step === 5 && (
              <button onClick={onClose} className="px-4 py-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-semibold rounded-sm transition-colors">
                إغلاق
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── AddSupplierModal ─────────────────────────────────────────────────────────

function AddSupplierModal({ rfq, apiBase, onClose, onAdded }: {
  rfq: Rfq; apiBase: string; onClose: () => void; onAdded: () => void;
}) {
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [activeCat, setActiveCat] = React.useState<string>('all');
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    authFetch(`${apiBase}/api/suppliers`)
      .then(r => r.json())
      .then((all: Supplier[]) => {
        const existingIds = new Set(rfq.suppliers.map(s => s.supplierId));
        setSuppliers(all.filter(s => s.status === 'نشط' && !existingIds.has(s.id)));
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = React.useMemo(() => {
    const catMap = new Map<number, string>();
    suppliers.forEach(s => s.categories.forEach(c => catMap.set(c.id, c.name)));
    return Array.from(catMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [suppliers]);

  const filtered = React.useMemo(() => {
    let list = suppliers;
    if (activeCat !== 'all') list = list.filter(s => s.categories.some(c => String(c.id) === activeCat));
    if (search.trim()) list = list.filter(s => s.companyName.toLowerCase().includes(search.toLowerCase().trim()));
    return list;
  }, [suppliers, activeCat, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id));

  function toggle(id: number) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  }
  function toggleAll() {
    const next = new Set(selectedIds);
    if (allFilteredSelected) filtered.forEach(s => next.delete(s.id));
    else filtered.forEach(s => next.add(s.id));
    setSelectedIds(next);
  }

  async function handleAddSelected() {
    if (selectedIds.size === 0) return;
    setAdding(true); setError('');
    const errors: string[] = [];
    await Promise.all([...selectedIds].map(async supplierId => {
      try {
        const r = await authFetch(`${apiBase}/api/supplier-quotations/${rfq.id}/suppliers`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ supplierId }),
        });
        const data = await r.json();
        if (!r.ok) errors.push(data.error || 'فشل في إضافة المورد');
      } catch { errors.push('خطأ في الاتصال'); }
    }));
    setAdding(false);
    if (errors.length > 0) setError(errors[0]);
    else onAdded();
  }

  return (
    <Dialog open={true} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="p-0 max-w-lg max-h-[88vh] flex flex-col gap-0 [&>button]:hidden overflow-hidden rounded" dir="rtl">

        {/* SAP-style Header */}
        <DialogHeader className="flex-row items-center justify-between bg-[#0f2240] px-5 py-3 rounded-t space-y-0">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-blue-300" />
            <div>
              <DialogTitle className="font-bold text-white text-sm">إضافة موردين للطلب</DialogTitle>
              <p className="text-blue-300 text-[10px] font-mono">{rfq.rfqNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1 rounded transition-colors">
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 pt-3 pb-0">
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث باسم الشركة..." dir="rtl"
              className="w-full border border-slate-300 pr-8 pl-3 py-1.5 text-xs focus:outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/30 rounded-sm bg-white" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Category filter */}
        {!loading && categories.length > 0 && (
          <div className="px-4 pt-2.5 flex flex-wrap gap-1.5">
            {[{ id: 'all', name: `الكل (${suppliers.length})` }, ...categories.map(cat => ({
              id: String(cat.id), name: `${cat.name} (${suppliers.filter(s => s.categories.some(c => c.id === cat.id)).length})`
            }))].map(cat => (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                className={`px-2.5 py-0.5 text-[10px] font-semibold border rounded-sm transition-all
                  ${activeCat === cat.id ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-300 hover:border-[#1e3a5f] hover:text-[#1e3a5f]'}`}>
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Select all bar */}
        {!loading && filtered.length > 0 && (
          <div className="mx-4 mt-2.5 flex items-center justify-between bg-[#f0f4f8] border border-slate-200 px-3 py-1.5 rounded-sm">
            <button onClick={toggleAll} className="flex items-center gap-2 text-[11px] font-medium text-slate-600 hover:text-[#1e3a5f] transition-colors">
              <div className={`h-4 w-4 rounded-sm border-2 flex items-center justify-center transition-colors ${allFilteredSelected ? 'bg-[#1e3a5f] border-[#1e3a5f]' : 'border-slate-400'}`}>
                {allFilteredSelected && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              {allFilteredSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </button>
            {selectedIds.size > 0 && (
              <span className="text-[10px] font-bold text-[#1e3a5f] bg-blue-100 px-2 py-0.5 rounded-sm">{selectedIds.size} محدد</span>
            )}
          </div>
        )}

        {error && <p className="mx-4 mt-2 text-[11px] text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-sm">{error}</p>}

        {/* List */}
        <div className="overflow-y-auto flex-1 mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">{suppliers.length === 0 ? 'جميع الموردين النشطين مضافون بالفعل' : 'لا توجد نتائج مطابقة'}</div>
          ) : (
            <div className="border-t border-slate-200">
              {filtered.map((s, idx) => {
                const checked = selectedIds.has(s.id);
                return (
                  <div key={s.id} onClick={() => toggle(s.id)}
                    className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer select-none border-b border-slate-100 last:border-0 transition-colors
                      ${checked ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/30 hover:bg-slate-50'}`}>
                    <div className={`shrink-0 h-4 w-4 rounded-sm border-2 flex items-center justify-center transition-colors ${checked ? 'bg-[#1e3a5f] border-[#1e3a5f]' : 'border-slate-300'}`}>
                      {checked && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${checked ? 'text-[#1e3a5f]' : 'text-slate-800'}`}>{s.companyName}</p>
                      {s.categories.length > 0 && (
                        <p className="text-[10px] text-slate-400">{s.categories.map(c => c.name).join(' · ')}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3 bg-[#f8fafc]">
          <button onClick={onClose} className="px-4 py-1.5 border border-slate-300 bg-white text-xs text-slate-600 hover:bg-slate-50 rounded-sm transition-colors">إلغاء</button>
          <button onClick={handleAddSelected} disabled={adding || selectedIds.size === 0}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed rounded-sm transition-colors">
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            {adding ? 'جاري الإضافة...' : selectedIds.size > 0 ? `إضافة ${selectedIds.size} مورد` : 'إضافة'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SupplierQuotationsPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [analysisRfq, setAnalysisRfq] = useState<{ id: number; rfqNo: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [addingSupplierForRfq, setAddingSupplierForRfq] = useState<Rfq | null>(null);
  const queryClient = useQueryClient();

  const { data: rfqs = [], isLoading } = useQuery<Rfq[]>({
    queryKey: ["supplier-quotations"],
    queryFn: () => authFetchJson<Rfq[]>(`${API_BASE}/api/supplier-quotations`),
  });

  const filteredRfqs = React.useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return rfqs;
    return rfqs.filter(rfq => {
      if (rfq.rfqNo?.toLowerCase().includes(q)) return true;
      if (rfq.sourceQuotationNo?.toLowerCase().includes(q)) return true;
      if (rfq.customerOrderNo?.toLowerCase().includes(q)) return true;
      if (rfq.suppliers?.some(s => s.companyName?.toLowerCase().includes(q))) return true;
      if (rfq.items?.some(i => i.description?.toLowerCase().includes(q))) return true;
      if (rfq.items?.some(i => i.partNo?.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [rfqs, listSearch]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetch(`${API_BASE}/api/supplier-quotations/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-quotations"] }),
  });

  function handleDelete(id: number) {
    if (!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
    deleteMutation.mutate(id);
  }

  return (
    <AppLayout>
      <div className="space-y-4" dir="rtl">

        {/* ── Page Toolbar ── SAP style */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h1 className="text-base font-bold text-[#0f2240]">طلبات تسعير الموردين</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {rfqs.length > 0 ? `${rfqs.length} طلب تسعير` : "قائمة طلبات التسعير المرسلة للموردين"}
            </p>
          </div>
          <button onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-md transition-colors shadow-sm">
            <Send className="h-3.5 w-3.5" /> إرسال طلب تسعير جديد
          </button>
        </div>

        {/* ── Search bar ── */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={listSearch}
            onChange={e => setListSearch(e.target.value)}
            placeholder="بحث: رقم الطلب، طلب تسعير العميل، اسم المورد، رقم القطعة..."
            className="w-full rounded-lg border border-slate-300 bg-white pr-9 pl-9 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
            dir="rtl"
          />
          {listSearch && (
            <button onClick={() => setListSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* ── Results info ── */}
        {listSearch && (
          <p className="text-[11px] text-slate-400">{filteredRfqs.length} نتيجة من أصل {rfqs.length} طلب</p>
        )}

        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs">جاري التحميل...</span>
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoading && rfqs.length === 0 && (
          <div className="border border-slate-200 bg-white rounded-sm p-14 text-center">
            <div className="h-12 w-12 mx-auto mb-4 rounded bg-slate-100 flex items-center justify-center">
              <Send className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-slate-600 font-semibold text-sm">لا توجد طلبات تسعير حتى الآن</p>
            <p className="text-slate-400 text-xs mt-1 mb-4">اضغط على الزر أعلاه لإرسال طلب تسعير جديد للموردين</p>
            <button onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-semibold rounded-sm transition-colors">
              <Send className="h-3.5 w-3.5" /> إرسال طلب تسعير
            </button>
          </div>
        )}

        {!isLoading && rfqs.length > 0 && filteredRfqs.length === 0 && (
          <div className="border border-slate-200 bg-white rounded-sm p-10 text-center">
            <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-xs font-medium">لا توجد نتائج مطابقة</p>
            <p className="text-slate-400 text-[11px] mt-1">جرّب مصطلح بحث مختلف</p>
          </div>
        )}

        {/* ── Main Table ── */}
        {!isLoading && filteredRfqs.length > 0 && (
          <div className="border border-slate-200 rounded-sm overflow-hidden bg-white">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300">
                  <TH className="w-8 text-center">▼</TH>
                  <TH>رقم الطلب</TH>
                  <TH>طلب تسعير العميل</TH>
                  <TH>رقم أمر الشراء</TH>
                  <TH className="text-center">التاريخ</TH>
                  <TH className="text-center">البنود</TH>
                  <TH className="text-center">الموردون</TH>
                  <TH className="text-center">الاستجابة</TH>
                  <TH>الحالة</TH>
                  <TH className="text-center w-28">إجراءات</TH>
                </tr>
              </thead>
              <tbody>
                {filteredRfqs.map((rfq, rowIdx) => {
                  const isExpanded = expandedId === rfq.id;
                  const submittedCount = rfq.suppliers.filter(s => s.responseStatus === "submitted").length;
                  const responseRate = rfq.suppliers.length > 0
                    ? Math.round((submittedCount / rfq.suppliers.length) * 100)
                    : 0;

                  return (
                    <React.Fragment key={rfq.id}>
                      {/* Main row */}
                      <tr className={`border-b border-slate-100 cursor-pointer transition-colors
                        ${isExpanded ? "bg-blue-50" : rowIdx % 2 === 0 ? "bg-white hover:bg-[#f0f4f8]" : "bg-slate-50/40 hover:bg-[#f0f4f8]"}`}
                        onClick={() => setExpandedId(isExpanded ? null : rfq.id)}>

                        <td className="px-2 py-2.5 text-center text-slate-400">
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 inline text-[#1e3a5f]" />
                            : <ChevronDown className="h-3.5 w-3.5 inline" />}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-[#1e3a5f] font-mono">{rfq.rfqNo}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-600">{rfq.sourceQuotationNo || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-500">{rfq.customerOrderNo || "—"}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-slate-500">{rfq.requestDate}</td>
                        <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{rfq.items.length}</td>
                        <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{rfq.suppliers.length}</td>
                        <td className="px-3 py-2.5 text-center">
                          {rfq.suppliers.length > 0 ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-14 h-1.5 bg-slate-200 rounded overflow-hidden">
                                <div className={`h-full rounded ${responseRate >= 80 ? "bg-emerald-500" : responseRate >= 40 ? "bg-amber-400" : "bg-slate-300"}`}
                                  style={{ width: `${responseRate}%` }} />
                              </div>
                              <span className={`text-[10px] font-semibold ${submittedCount > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                                {submittedCount}/{rfq.suppliers.length}
                              </span>
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5"><StatusBadge status={rfq.status} /></td>
                        <td className="px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {submittedCount > 0 && (
                              <button
                                onClick={() => setAnalysisRfq({ id: rfq.id, rfqNo: rfq.rfqNo })}
                                title="تحليل ومقارنة الأسعار"
                                className="flex items-center gap-0.5 px-1.5 py-1 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-sm text-[10px] font-semibold transition-colors">
                                <BarChart3 className="h-3 w-3" /> تحليل
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(rfq.id)}
                              title="حذف"
                              className="p-1 border border-red-200 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 rounded-sm transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail rows */}
                      {isExpanded && (
                        <tr className="border-b border-slate-200">
                          <td colSpan={10} className="p-0">
                            <div className="bg-[#f8fafc] border-t-2 border-[#1e3a5f]/30 px-5 py-4 space-y-4">

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Items sub-table */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[11px] font-semibold text-slate-600 border-r-2 border-[#1e3a5f] pr-2">البنود ({rfq.items.length})</p>
                                  </div>
                                  <div className="border border-slate-200 rounded-sm overflow-hidden">
                                    <table className="w-full text-[11px] text-right">
                                      <thead className="bg-slate-50 border-b border-slate-300">
                                        <tr>
                                          <TH className="w-7">#</TH>
                                          <TH>الوصف</TH>
                                          <TH className="text-center">الكمية</TH>
                                          <TH className="text-center">الوحدة</TH>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {rfq.items.map((item, idx) => (
                                          <tr key={item.id} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                                            <td className="px-2 py-1.5 text-slate-400">{idx + 1}</td>
                                            <td className="px-2 py-1.5 font-medium">
                                              {item.description}
                                              {item.partNo && <span className="text-slate-400 mr-1.5 text-[10px] font-mono">{item.partNo}</span>}
                                            </td>
                                            <td className="px-2 py-1.5 text-center font-mono">{fmtQty(item.quantity)}</td>
                                            <td className="px-2 py-1.5 text-center text-slate-500">{item.unit || "—"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* Suppliers sub-table */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[11px] font-semibold text-slate-600 border-r-2 border-[#1e3a5f] pr-2">الموردون ({rfq.suppliers.length})</p>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => setAddingSupplierForRfq(rfq)}
                                        className="flex items-center gap-1 px-2 py-0.5 border border-[#1e3a5f] bg-white hover:bg-blue-50 text-[#1e3a5f] text-[10px] font-semibold rounded-sm transition-colors">
                                        <UserPlus className="h-3 w-3" /> إضافة مورد
                                      </button>
                                      {submittedCount > 0 && (
                                        <button onClick={() => setAnalysisRfq({ id: rfq.id, rfqNo: rfq.rfqNo })}
                                          className="flex items-center gap-1 px-2 py-0.5 border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-semibold rounded-sm transition-colors">
                                          <BarChart3 className="h-3 w-3" /> تحليل الأسعار
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="border border-slate-200 rounded-sm overflow-hidden">
                                    <table className="w-full text-[11px] text-right">
                                      <thead className="bg-slate-50 border-b border-slate-300">
                                        <tr>
                                          <TH>المورد</TH>
                                          <TH className="text-center">الحالة</TH>
                                          <TH className="text-center">الرؤية</TH>
                                          <TH className="text-center w-24">إرسال</TH>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {rfq.suppliers.map((sup, idx) => (
                                          <React.Fragment key={sup.supplierId}>
                                            <tr className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                                              <td className="px-2 py-1.5 font-medium text-slate-800">{sup.companyName}</td>
                                              <td className="px-2 py-1.5 text-center">
                                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border
                                                  ${sup.responseStatus === "submitted"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                                  {sup.responseStatus === "submitted"
                                                    ? <><Check className="h-2.5 w-2.5" /> استجاب</>
                                                    : <><Clock className="h-2.5 w-2.5" /> انتظار</>}
                                                </span>
                                              </td>
                                              <td className="px-2 py-1.5 text-center">
                                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border
                                                  ${sup.firstOpenedAt
                                                    ? "bg-sky-50 text-sky-700 border-sky-200"
                                                    : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                                                  {sup.firstOpenedAt ? <><Eye className="h-2.5 w-2.5" /> فتح</> : <><EyeOff className="h-2.5 w-2.5" /> لم يفتح</>}
                                                </span>
                                              </td>
                                              <td className="px-2 py-1.5 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                  <button title="PDF"
                                                    onClick={() => downloadRfqPdf(rfq, sup)}
                                                    className="p-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 rounded-sm transition-colors">
                                                    <FileText className="h-3 w-3" />
                                                  </button>
                                                  <button title="واتساب"
                                                    onClick={() => sendWhatsApp(sup, rfq.rfqNo, rfq.requestDate, rfq.items, sup.token)}
                                                    className="p-1 border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-600 rounded-sm transition-colors">
                                                    <MessageSquare className="h-3 w-3" />
                                                  </button>
                                                  <button title="إيميل"
                                                    onClick={() => openEmail(sup, rfq.rfqNo, rfq.requestDate, rfq.items, sup.token)}
                                                    className="p-1 border border-orange-200 bg-white hover:bg-orange-50 text-orange-500 rounded-sm transition-colors">
                                                    <Mail className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                            {/* Token link row */}
                                            {sup.token && (
                                              <tr className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-[#fafbfc]" : "bg-slate-50/60"}`}>
                                                <td colSpan={4} className="px-2 py-1.5">
                                                  <div className="flex items-center gap-2">
                                                    <LinkIcon className="h-3 w-3 shrink-0 text-[#1e3a5f]" />
                                                    <span className="text-[10px] text-slate-400 font-mono truncate flex-1">{getRfqLink(sup.token)}</span>
                                                    <button onClick={() => copyTokenLink(sup.token, setCopiedToken)}
                                                      className="flex items-center gap-0.5 px-1.5 py-0.5 border border-slate-200 bg-white hover:border-[#1e3a5f] hover:text-[#1e3a5f] text-[10px] text-slate-500 rounded-sm shrink-0 transition-colors">
                                                      {copiedToken === sup.token ? <><Check className="h-2.5 w-2.5 text-emerald-600" /> تم</> : <><Copy className="h-2.5 w-2.5" /> نسخ الرابط</>}
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>

                              {/* Notes */}
                              {rfq.notes && (
                                <div className="border border-amber-200 bg-amber-50 rounded-sm px-3 py-2 text-[11px] text-amber-800">
                                  <span className="font-semibold">ملاحظات: </span>{rfq.notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addingSupplierForRfq && (
        <AddSupplierModal rfq={addingSupplierForRfq} apiBase={API_BASE}
          onClose={() => setAddingSupplierForRfq(null)}
          onAdded={() => { queryClient.invalidateQueries({ queryKey: ["supplier-quotations"] }); setAddingSupplierForRfq(null); }} />
      )}
      {wizardOpen && (
        <SendWizard onClose={() => setWizardOpen(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["supplier-quotations"] })} />
      )}
      {analysisRfq && (
        <AnalysisModal rfqId={analysisRfq.id} rfqNo={analysisRfq.rfqNo} onClose={() => setAnalysisRfq(null)} />
      )}
    </AppLayout>
  );
}
