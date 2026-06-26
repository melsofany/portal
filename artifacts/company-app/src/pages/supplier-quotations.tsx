import React, { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
import {
  Send, FileText, Mail, MessageSquare, Trash2, ChevronDown, ChevronUp,
  Search, CheckSquare, Square, X, ArrowRight, ArrowLeft,
  Link as LinkIcon, Copy, BarChart3, Check, Clock, Loader2, UserPlus, Eye, EyeOff,
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

interface AnalysisData {
  items: RfqItem[];
  suppliers: {
    id: number;
    companyName: string;
    responseStatus: "pending" | "submitted";
    responseSubmittedAt: string | null;
    prices: { rfqItemId: number; unitPrice: string; notes: string }[];
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

function printRfqForSupplier(
  rfqNo: string, requestDate: string, sourceNo: string, customerOrderNo: string,
  notes: string, supplier: RfqSupplier | Supplier, items: RfqItem[], token?: string
) {
  const companyName = supplier.companyName;
  const link = token ? getRfqLink(token) : "";
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>طلب تسعير - ${rfqNo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; padding: 15mm 20mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0064d9; padding-bottom: 14px; margin-bottom: 18px; }
  .logo-area h1 { font-size: 22px; font-weight: bold; color: #0064d9; }
  .logo-area p { font-size: 11px; color: #555; margin-top: 4px; }
  .rfq-info { text-align: left; font-size: 11px; color: #555; }
  .rfq-info strong { display: block; font-size: 14px; color: #111; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 18px; }
  .meta-box { background: #f4f7fb; border: 1px solid #dde3ee; border-radius: 4px; padding: 8px 12px; }
  .meta-box .label { font-size: 10px; color: #666; font-weight: bold; }
  .meta-box .value { font-size: 12px; color: #111; margin-top: 3px; font-weight: 600; }
  .supplier-box { background: #eaf2ff; border: 1px solid #b3d0f5; border-radius: 4px; padding: 10px 14px; margin-bottom: 16px; }
  .supplier-box .label { font-size: 10px; color: #0064d9; font-weight: bold; }
  .supplier-box .value { font-size: 13px; color: #0a3060; font-weight: 700; margin-top: 3px; }
  .link-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 10px 14px; margin-bottom: 16px; font-size: 11px; }
  .link-box strong { color: #166534; }
  .link-box a { color: #0064d9; word-break: break-all; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  thead tr { background: #0064d9; color: white; }
  th { padding: 9px 10px; font-size: 11px; font-weight: 600; text-align: right; }
  td { padding: 8px 10px; font-size: 11px; border-bottom: 1px solid #e8e8e8; text-align: right; }
  tr:nth-child(even) td { background: #f7f9fc; }
  .notes-box { background: #fffbea; border: 1px solid #e8d87a; border-radius: 4px; padding: 10px 14px; margin-bottom: 16px; font-size: 11px; }
  .footer { text-align: center; color: #888; font-size: 10px; border-top: 1px solid #ddd; padding-top: 12px; margin-top: 20px; }
  @media print { @page { margin: 10mm; } body { padding: 0; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo-area">
    <h1>طلب تسعير</h1>
    <p>يرجى تقديم عرض سعر للبنود المدرجة أدناه</p>
  </div>
  <div class="rfq-info">
    <strong>${rfqNo}</strong>
    تاريخ: ${requestDate}
  </div>
</div>
<div class="supplier-box">
  <div class="label">مقدم إلى</div>
  <div class="value">${companyName}</div>
</div>
<div class="meta-grid">
  <div class="meta-box"><div class="label">رقم طلب التسعير المرجعي</div><div class="value">${sourceNo || "—"}</div></div>
  <div class="meta-box"><div class="label">رقم أمر الشراء</div><div class="value">${customerOrderNo || "—"}</div></div>
  <div class="meta-box"><div class="label">عدد البنود</div><div class="value">${items.length} بند</div></div>
</div>
${link ? `<div class="link-box"><strong>رابط إدخال الأسعار إلكترونياً:</strong><br/><a href="${link}">${link}</a></div>` : ""}
<table>
  <thead>
    <tr>
      <th style="width:40px">#</th>
      <th>الوصف</th>
      <th style="width:100px">رقم القطعة</th>
      <th style="width:80px">كود البند</th>
      <th style="width:60px">الوحدة</th>
      <th style="width:70px">الكمية</th>
      <th style="width:110px">سعر الوحدة</th>
      <th style="width:110px">الإجمالي</th>
    </tr>
  </thead>
  <tbody>
    ${items.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${item.description}</td>
      <td>${item.partNo || "—"}</td>
      <td>${item.customerItemCode || "—"}</td>
      <td>${item.unit || "—"}</td>
      <td>${item.quantity}</td>
      <td></td>
      <td></td>
    </tr>`).join("")}
  </tbody>
</table>
${notes ? `<div class="notes-box"><strong>ملاحظات:</strong> ${notes}</div>` : ""}
<div class="footer">يرجى الرد في أقرب وقت ممكن — نشكر حسن تعاونكم</div>
</body>
</html>`;
  const win = window.open("", "_blank", "width=900,height=700");
  if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 600); }
}

function buildWhatsAppMessage(rfqNo: string, requestDate: string, companyName: string, items: RfqItem[], token?: string) {
  const lines = items.map((item, idx) =>
    `${idx + 1}. ${item.description}${item.partNo ? ` | رقم القطعة: ${item.partNo}` : ""} — الكمية: ${item.quantity} ${item.unit || ""}`.trim()
  ).join("\n");
  const linkLine = token ? `\n\n🔗 *رابط إدخال الأسعار إلكترونياً:*\n${getRfqLink(token)}` : "";
  return `🔷 *طلب تسعير - ${rfqNo}*\n📅 التاريخ: ${requestDate}\n\nالسادة / ${companyName}\n\nنرجو تفضلكم بتقديم عرض سعر للبنود التالية:\n\n${lines}${linkLine}\n\nشاكرين لكم حسن تعاونكم 🙏`;
}

async function sendWhatsApp(supplier: RfqSupplier | Supplier, rfqNo: string, requestDate: string, items: RfqItem[], token?: string): Promise<"sent" | "fallback" | "error"> {
  const raw = supplier.whatsapp || supplier.phone || "";
  if (!raw) { alert("لا يوجد رقم واتساب أو هاتف لهذا المورد"); return "error"; }
  const msg = buildWhatsAppMessage(rfqNo, requestDate, supplier.companyName, items, token);

  try {
    const res = await fetch(`${API_BASE}/api/whatsapp/send`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: raw, message: msg }),
    });
    const data = await res.json() as any;

    if (res.status === 503 && data?.hint) {
      const phone = raw.replace(/[^0-9]/g, "");
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
      return "fallback";
    }
    if (!res.ok) {
      alert(`فشل الإرسال: ${data?.error ?? "خطأ غير معروف"}`);
      return "error";
    }
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

// ─── Analysis Modal ───────────────────────────────────────────────────────────

function AnalysisModal({ rfqId, rfqNo, onClose }: { rfqId: number; rfqNo: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery<AnalysisData>({
    queryKey: ['rfq-analysis', rfqId],
    queryFn: () => fetch(`${API_BASE}/api/supplier-quotations/${rfqId}/analysis`, { credentials: 'include' }).then(r => r.json()),
  });

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
    return (data?.items ?? []).filter(item => {
      const p = getPrice(supplier, item.id);
      return p !== null && p > 0;
    }).length;
  }

  function getBestTotalSupplier(): string {
    if (!data || submittedSuppliers.length === 0) return '';
    const totals = submittedSuppliers.map(s => ({ name: s.companyName, total: getSupplierTotal(s) }));
    const nonZero = totals.filter(t => t.total > 0);
    if (!nonZero.length) return '';
    return nonZero.sort((a, b) => a.total - b.total)[0].name;
  }

  function printAnalysis() {
    if (!data) return;
    const today = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    const totalItems = data.items.length;

    const suppTotals = submittedSuppliers.map(s => ({
      name: s.companyName,
      total: getSupplierTotal(s),
      covered: data.items.filter(item => { const p = getPrice(s, item.id); return p !== null && p > 0; }).length,
    })).sort((a, b) => {
      if (a.total > 0 && b.total > 0) return a.total - b.total;
      return a.total > 0 ? -1 : 1;
    });
    const bestName = getBestTotalSupplier();
    const minTotal = suppTotals.filter(s => s.total > 0)[0]?.total ?? 0;
    const maxTotal = Math.max(...suppTotals.map(s => s.total), 1);

    const leaderRows = suppTotals.map((s, i) => {
      const cov = totalItems > 0 ? Math.round((s.covered / totalItems) * 100) : 0;
      const isBest = s.name === bestName && s.total > 0;
      const barW = s.total > 0 ? Math.round((s.total / maxTotal) * 100) : 0;
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#888;font-size:11px">${i + 1}</td>
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
        return `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;background:${isBest ? '#f0fdf4' : 'transparent'}">
          ${price !== null && price > 0
            ? `<div style="font-family:monospace;font-weight:${isBest ? '700' : '500'};color:${isBest ? '#15803d' : '#1e293b'}">${price.toFixed(3)}${isBest ? ' ★' : ''}</div><div style="font-family:monospace;font-size:10px;color:#94a3b8">${(price * qty).toFixed(3)}</div>`
            : '<span style="color:#cbd5e1">—</span>'}
        </td>`;
      }).join('');
      const bestCell = best !== null
        ? `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;background:#eff6ff;font-family:monospace;font-weight:700;color:#1d4ed8">${best.toFixed(3)}</td>`
        : `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#cbd5e1">—</td>`;
      return `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:500">${item.description}${item.partNo ? `<div style='font-size:10px;color:#94a3b8'>${item.partNo}</div>` : ''}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-size:11px;color:#64748b;font-family:monospace">${item.quantity} ${item.unit || ''}</td>
        ${cells}${bestCell}
      </tr>`;
    }).join('');

    const totalCells = submittedSuppliers.map(s => {
      const t = getSupplierTotal(s);
      const isBest = s.companyName === bestName && t > 0;
      return `<td style="padding:10px 8px;text-align:center;font-family:monospace;font-weight:700;color:${isBest ? '#15803d' : '#334155'};background:${isBest ? '#f0fdf4' : 'transparent'}">${t > 0 ? t.toFixed(3) : '—'}${isBest ? ' ★' : ''}</td>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تحليل الأسعار - ${rfqNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#111; padding:12mm 16mm; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f2240; padding-bottom:14px; margin-bottom:18px; }
  .logo h1 { font-size:20px; font-weight:bold; color:#0f2240; }
  .logo p { font-size:10px; color:#64748b; margin-top:3px; }
  .rfq-info { text-align:left; font-size:11px; color:#64748b; }
  .rfq-info strong { display:block; font-size:14px; color:#0f2240; font-family:monospace; }
  .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:18px; }
  .kpi { border-radius:8px; padding:12px; text-align:center; }
  .kpi .num { font-size:26px; font-weight:bold; }
  .kpi .lbl { font-size:10px; margin-top:4px; }
  .section-title { font-size:12px; font-weight:bold; color:#0f2240; border-right:3px solid #0064d9; padding-right:8px; margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; }
  th { padding:10px 8px; background:#0f2240; color:#fff; font-size:11px; text-align:right; }
  @media print { @page { margin:10mm; } body { padding:0; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">
    <h1>تحليل ومقارنة الأسعار</h1>
    <p>تقرير تحليل عروض الموردين — طباعة في: ${today}</p>
  </div>
  <div class="rfq-info">
    <strong>${rfqNo}</strong>
    إجمالي البنود: ${totalItems}
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi" style="background:#f1f5f9;border:1px solid #e2e8f0">
    <div class="num" style="color:#1e293b">${totalSuppliers}</div>
    <div class="lbl" style="color:#64748b">إجمالي الموردين</div>
  </div>
  <div class="kpi" style="background:#f0fdf4;border:1px solid #bbf7d0">
    <div class="num" style="color:#15803d">${submittedSuppliers.length}</div>
    <div class="lbl" style="color:#16a34a">استجابوا</div>
  </div>
  <div class="kpi" style="background:#fffbeb;border:1px solid #fde68a">
    <div class="num" style="color:#d97706">${pendingSuppliers.length}</div>
    <div class="lbl" style="color:#b45309">في الانتظار</div>
  </div>
  <div class="kpi" style="background:#eff6ff;border:1px solid #bfdbfe">
    <div class="num" style="color:#1d4ed8">${responseRate}%</div>
    <div class="lbl" style="color:#2563eb">نسبة الاستجابة</div>
  </div>
</div>

${submittedSuppliers.length > 0 ? `
<div style="margin-bottom:20px">
  <div class="section-title">ترتيب الموردين</div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>المورد</th>
        <th style="text-align:center;width:80px">البنود</th>
        <th style="text-align:center;width:120px">التغطية</th>
        <th style="text-align:center;width:100px">الإجمالي</th>
      </tr>
    </thead>
    <tbody>${leaderRows}</tbody>
  </table>
</div>

<div>
  <div class="section-title">تفاصيل الأسعار بند بند</div>
  <table>
    <thead>
      <tr>
        <th>البند</th>
        <th style="text-align:center;width:70px">الكمية</th>
        ${headerCols}
        <th style="text-align:center;width:90px;background:#1e3a8a">أفضل سعر</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr style="background:#f1f5f9;font-weight:bold;border-top:2px solid #cbd5e1">
        <td style="padding:10px;font-weight:700">الإجمالي الكلي</td>
        <td></td>
        ${totalCells}
        <td style="padding:10px;text-align:center;font-family:monospace;font-weight:700;color:#1d4ed8;background:#eff6ff">${minTotal > 0 ? minTotal.toFixed(3) : '—'}</td>
      </tr>
    </tfoot>
  </table>
</div>
` : '<p style="text-align:center;color:#94a3b8;padding:40px">لم يستجب أي مورد حتى الآن</p>'}

${pendingSuppliers.length > 0 ? `<p style="margin-top:14px;font-size:10px;color:#94a3b8">⏳ لم يستجب بعد: ${pendingSuppliers.map(s => s.companyName).join('، ')}</p>` : ''}
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1000,height=750');
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 700); }
  }

  const supplierTotals = submittedSuppliers.map(s => ({
    name: s.companyName,
    total: getSupplierTotal(s),
    covered: getItemsCovered(s),
    isBest: s.companyName === getBestTotalSupplier(),
  })).sort((a, b) => {
    if (a.total > 0 && b.total > 0) return a.total - b.total;
    if (a.total > 0) return -1;
    return 1;
  });
  const maxTotal = Math.max(...supplierTotals.map(s => s.total), 1);
  const totalItems = data?.items.length ?? 0;

  return (
    <div className='fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 overflow-auto' dir='rtl'>
      <div className='relative w-full max-w-5xl my-6 rounded-xl bg-white shadow-2xl overflow-hidden'>

        {/* ── Header ── */}
        <div className='flex items-center justify-between bg-[#0f2240] px-6 py-4'>
          <div>
            <h2 className='text-lg font-bold text-white'>تحليل ومقارنة الأسعار</h2>
            <p className='text-blue-200 text-xs mt-0.5 font-mono'>{rfqNo}</p>
          </div>
          <button onClick={onClose} className='text-slate-300 hover:text-white p-1 rounded-lg transition-colors'>
            <X className='h-5 w-5' />
          </button>
        </div>

        <div className='p-6 space-y-5 overflow-auto max-h-[82vh]'>
          {isLoading && (
            <div className='flex items-center justify-center py-20'>
              <Loader2 className='h-8 w-8 animate-spin text-blue-600' />
            </div>
          )}
          {error && <p className='text-red-500 text-sm'>حدث خطأ في تحميل البيانات</p>}

          {data && (
            <>
              {/* ── KPI Cards ── */}
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                <div className='bg-slate-50 border border-slate-200 rounded-xl p-4 text-center'>
                  <p className='text-3xl font-bold text-slate-800'>{totalSuppliers}</p>
                  <p className='text-slate-500 text-xs mt-1'>إجمالي الموردين</p>
                </div>
                <div className='bg-green-50 border border-green-200 rounded-xl p-4 text-center'>
                  <p className='text-3xl font-bold text-green-700'>{submittedSuppliers.length}</p>
                  <p className='text-green-600 text-xs mt-1'>استجابوا</p>
                </div>
                <div className='bg-amber-50 border border-amber-200 rounded-xl p-4 text-center'>
                  <p className='text-3xl font-bold text-amber-600'>{pendingSuppliers.length}</p>
                  <p className='text-amber-500 text-xs mt-1'>في الانتظار</p>
                </div>
                <div className='bg-blue-50 border border-blue-200 rounded-xl p-4 text-center'>
                  <p className='text-3xl font-bold text-blue-700'>{responseRate}%</p>
                  <p className='text-blue-500 text-xs mt-1'>نسبة الاستجابة</p>
                </div>
              </div>

              {submittedSuppliers.length === 0 ? (
                <div className='text-center py-12 text-slate-400 space-y-2'>
                  <Clock className='h-10 w-10 mx-auto text-slate-300' />
                  <p className='font-medium'>لم يستجب أي مورد حتى الآن</p>
                  <p className='text-sm'>أرسل الروابط للموردين وانتظر ردودهم</p>
                </div>
              ) : (
                <>
                  {/* ── Supplier Comparison (CSS bars) ── */}
                  <div className='bg-white border border-slate-200 rounded-xl p-5'>
                    <h3 className='text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2'>
                      <BarChart3 className='h-4 w-4 text-blue-600' />
                      مقارنة الإجمالي الكلي للموردين
                    </h3>
                    <div className='space-y-3'>
                      {supplierTotals.map((sup, idx) => {
                        const barPct = sup.total > 0 ? (sup.total / maxTotal) * 100 : 0;
                        const coverage = totalItems > 0 ? Math.round((sup.covered / totalItems) * 100) : 0;
                        return (
                          <div key={idx} className='space-y-1'>
                            <div className='flex items-center justify-between text-sm'>
                              <div className='flex items-center gap-2'>
                                {sup.isBest && sup.total > 0 && (
                                  <span className='text-xs bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded'>★ الأفضل</span>
                                )}
                                <span className={sup.isBest && sup.total > 0 ? 'font-semibold text-slate-800' : 'text-slate-600'}>{sup.name}</span>
                              </div>
                              <div className='flex items-center gap-3 text-xs text-slate-500'>
                                <span className='font-mono'>{sup.covered}/{totalItems} بند</span>
                                <span className={sup.isBest && sup.total > 0 ? 'font-bold text-green-700' : 'font-mono text-slate-700'}>
                                  {sup.total > 0 ? sup.total.toFixed(3) : '—'}
                                </span>
                              </div>
                            </div>
                            <div className='h-2 w-full bg-slate-100 rounded-full overflow-hidden'>
                              <div
                                className={`h-full rounded-full transition-all ${sup.isBest && sup.total > 0 ? 'bg-green-500' : 'bg-blue-400'}`}
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                            <div className='flex items-center gap-1'>
                              <div className='h-1 rounded-full bg-slate-200 flex-1 overflow-hidden'>
                                <div className='h-full bg-slate-400 rounded-full' style={{ width: `${coverage}%` }} />
                              </div>
                              <span className='text-xs text-slate-400 shrink-0 w-16 text-left'>تغطية {coverage}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Supplier Leaderboard ── */}
                  <div className='bg-white border border-slate-200 rounded-xl p-5'>
                    <h3 className='text-sm font-semibold text-slate-700 mb-3'>ترتيب الموردين</h3>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='border-b border-slate-200'>
                          <th className='pb-2 text-slate-400 text-xs font-medium text-right w-6'>#</th>
                          <th className='pb-2 text-slate-400 text-xs font-medium text-right'>المورد</th>
                          <th className='pb-2 text-slate-400 text-xs font-medium text-center'>البنود</th>
                          <th className='pb-2 text-slate-400 text-xs font-medium text-center'>التغطية</th>
                          <th className='pb-2 text-slate-400 text-xs font-medium text-center'>الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierTotals.map((sup, idx) => {
                          const coverage = totalItems > 0 ? Math.round((sup.covered / totalItems) * 100) : 0;
                          return (
                            <tr key={idx} className='border-b border-slate-100 last:border-0'>
                              <td className='py-2.5 text-slate-400 text-xs'>{idx + 1}</td>
                              <td className='py-2.5 font-medium text-slate-800'>
                                {sup.name}
                                {sup.isBest && sup.total > 0 && (
                                  <span className='mr-1.5 text-xs text-green-600'>★</span>
                                )}
                              </td>
                              <td className='py-2.5 text-center text-xs text-slate-600'>{sup.covered} / {totalItems}</td>
                              <td className='py-2.5 text-center'>
                                <div className='flex items-center justify-center gap-2'>
                                  <div className='w-16 bg-slate-100 rounded-full h-1.5'>
                                    <div
                                      className={`h-1.5 rounded-full ${coverage >= 80 ? 'bg-green-500' : coverage >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                      style={{ width: `${coverage}%` }}
                                    />
                                  </div>
                                  <span className='text-xs text-slate-600 w-8'>{coverage}%</span>
                                </div>
                              </td>
                              <td className={`py-2.5 text-center font-mono font-semibold text-sm ${sup.isBest && sup.total > 0 ? 'text-green-700' : 'text-slate-700'}`}>
                                {sup.total > 0 ? sup.total.toFixed(3) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ── Detailed Price Table ── */}
                  <div>
                    <h3 className='text-sm font-semibold text-slate-700 mb-3'>تفاصيل الأسعار بند بند</h3>
                    <div className='overflow-auto rounded-xl border border-slate-200'>
                      <table className='w-full text-sm text-right min-w-[600px]'>
                        <thead>
                          <tr className='bg-[#0f2240] text-white'>
                            <th className='px-3 py-3 font-medium text-right sticky right-0 bg-[#0f2240] z-10 min-w-[180px]'>البند</th>
                            <th className='px-3 py-3 font-medium text-center w-20'>الكمية</th>
                            {submittedSuppliers.map(s => (
                              <th key={s.id} className='px-3 py-3 font-medium text-center min-w-[120px] text-blue-100'>{s.companyName}</th>
                            ))}
                            <th className='px-3 py-3 font-medium text-center bg-blue-900 min-w-[100px]'>أفضل سعر</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.items.map((item, idx) => {
                            const best = getBestPrice(item.id);
                            return (
                              <tr key={item.id} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                <td className={`px-3 py-2.5 font-medium sticky right-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                  <div className='truncate max-w-[180px]' title={item.description}>{item.description}</div>
                                  {item.partNo && <div className='text-xs text-slate-400'>{item.partNo}</div>}
                                </td>
                                <td className='px-3 py-2.5 text-center text-slate-600 font-mono text-xs'>
                                  {item.quantity} {item.unit}
                                </td>
                                {submittedSuppliers.map(s => {
                                  const price = getPrice(s, item.id);
                                  const qty = parseFloat(item.quantity) || 0;
                                  const total = price !== null ? (price * qty).toFixed(3) : null;
                                  const isBest = price !== null && price > 0 && best !== null && price === best;
                                  return (
                                    <td key={s.id} className={`px-3 py-2.5 text-center ${isBest ? 'bg-green-50' : ''}`}>
                                      {price !== null && price > 0 ? (
                                        <div>
                                          <div className={`font-mono font-semibold text-sm ${isBest ? 'text-green-700' : 'text-slate-800'}`}>
                                            {price.toFixed(3)}
                                            {isBest && <span className='mr-1 text-xs text-green-500'>★</span>}
                                          </div>
                                          <div className={`text-xs font-mono ${isBest ? 'text-green-500' : 'text-slate-400'}`}>{total}</div>
                                        </div>
                                      ) : (
                                        <span className='text-slate-300 text-xs'>—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className='px-3 py-2.5 text-center bg-blue-50'>
                                  {best !== null ? (
                                    <span className='font-mono font-bold text-blue-700'>{best.toFixed(3)}</span>
                                  ) : (
                                    <span className='text-slate-300 text-xs'>—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className='border-t-2 border-slate-300 bg-slate-100 font-bold'>
                            <td className='px-3 py-3 sticky right-0 bg-slate-100 z-10'>الإجمالي الكلي</td>
                            <td />
                            {submittedSuppliers.map(s => {
                              const total = getSupplierTotal(s);
                              const isBest = s.companyName === getBestTotalSupplier() && total > 0;
                              return (
                                <td key={s.id} className={`px-3 py-3 text-center font-mono ${isBest ? 'text-green-700 bg-green-50' : 'text-slate-700'}`}>
                                  {total > 0 ? total.toFixed(3) : '—'}
                                  {isBest && <span className='mr-1 text-xs'>★</span>}
                                </td>
                              );
                            })}
                            <td className='px-3 py-3 text-center bg-blue-50 font-mono text-blue-700'>
                              {submittedSuppliers.length > 0
                                ? (() => { const v = Math.min(...submittedSuppliers.map(s => getSupplierTotal(s)).filter(t => t > 0)); return isFinite(v) ? v.toFixed(3) : '—'; })()
                                : '—'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Pending note */}
                  {pendingSuppliers.length > 0 && (
                    <div className='text-xs text-slate-400 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2'>
                      <Clock className='h-3 w-3 text-amber-500 shrink-0' />
                      <span>لم يستجب بعد: <span className='text-slate-500'>{pendingSuppliers.map(s => s.companyName).join('، ')}</span></span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className='border-t px-6 py-4 flex items-center justify-between bg-slate-50'>
          <button
            onClick={printAnalysis}
            disabled={!data || submittedSuppliers.length === 0}
            className='flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
          >
            <FileText className='h-4 w-4' />
            طباعة التحليل
          </button>
          <Button onClick={onClose} variant='outline'>إغلاق</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Wizard ──────────────────────────────────────────────────────────────────

function SendWizard({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(1);
  const [searchBy, setSearchBy] = useState<"quotationNo" | "customerOrderNo">("quotationNo");
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [foundCQ, setFoundCQ] = useState<FoundCQ | null>(null);
  const [searchError, setSearchError] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // per-item supplier assignment: itemId → supplierIds[]
  const [itemSupplierMap, setItemSupplierMap] = useState<Record<number, number[]>>({});
  // per-item category filter for Step 3
  const [itemCatFilters, setItemCatFilters] = useState<Record<number, string>>({});
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const [notes, setNotes] = useState("");
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [savedRfqs, setSavedRfqs] = useState<any[]>([]);
  const [copiedToken, setCopiedToken] = useState("");
  const [addingSupplierForRfq, setAddingSupplierForRfq] = useState<Rfq | null>(null);

  async function handleSearch() {
    if (!searchTerm.trim()) return;
    setSearching(true); setSearchError(""); setFoundCQ(null); setSearchResults([]);
    try {
      const res = await fetch(`${API_BASE}/api/supplier-quotations/search-cq?q=${encodeURIComponent(searchTerm.trim())}`, { credentials: "include" });
      const data: any[] = await res.json();
      if (!data || data.length === 0) { setSearchError("لم يتم العثور على طلب بهذا الرقم"); return; }
      if (data.length === 1) {
        await handleSelectCQ(data[0].id);
      } else {
        setSearchResults(data);
      }
    } catch { setSearchError("حدث خطأ أثناء البحث"); }
    finally { setSearching(false); }
  }

  async function handleSelectCQ(id: number) {
    try {
      const res = await fetch(`${API_BASE}/api/customer-quotations/${id}`, { credentials: "include" });
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
        fetch(`${API_BASE}/api/suppliers`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_BASE}/api/supplier-categories`, { credentials: "include" }).then(r => r.json()),
      ]);
      setSuppliers(suppRes.filter((s: Supplier) => s.status === "نشط"));
      setCategories(catRes);
      setSuppliersLoaded(true);
    } catch { /* ignore */ }
  }

  function goToStep(n: number) {
    if (n === 3) loadSuppliers();
    setStep(n);
  }

  async function handleSave() {
    const selectedItems = (foundCQ?.items ?? []).filter(i => selectedItemIds.has(i.id));
    const itemSupplierAssignments = selectedItems.map(item => ({
      item,
      supplierIds: itemSupplierMap[item.id] ?? [],
    }));
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/supplier-quotations`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceQuotationId: foundCQ?.id ?? null,
          sourceQuotationNo: foundCQ?.quotationNo ?? "",
          customerOrderNo: foundCQ?.customerOrderNo ?? "",
          requestDate, notes, itemSupplierAssignments,
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error); return; }
      const rfqs = await res.json();
      setSavedRfqs(rfqs);
      onSaved();
      setStep(5);
    } catch { alert("حدث خطأ أثناء الحفظ"); }
    finally { setSaving(false); }
  }

  const selectedItems = (foundCQ?.items ?? []).filter(i => selectedItemIds.has(i.id));

  // Step 3 validation: every selected item must have ≥1 supplier assigned
  const step3Valid = selectedItems.length > 0 && selectedItems.every(i => (itemSupplierMap[i.id] ?? []).length > 0);

  // Total unique suppliers across all items
  const totalUniqueSuppliers = new Set(Object.values(itemSupplierMap).flat()).size;

  const STEPS = ["استيراد البنود", "اختيار البنود", "اختيار الموردين", "إرسال الطلب"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" dir="rtl">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b bg-[#0f2240] px-6 py-4">
          <h2 className="text-lg font-bold text-white">إرسال طلب تسعير للموردين</h2>
          <button onClick={onClose} className="text-slate-300 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        {step <= 4 && (
          <div className="flex border-b bg-slate-50 px-6 py-3 gap-0">
            {STEPS.map((label, idx) => {
              const n = idx + 1;
              const active = step === n;
              const done = step > n;
              return (
                <div key={n} className="flex items-center flex-1 min-w-0">
                  <div className={`flex items-center gap-2 text-xs font-medium truncate ${active ? "text-blue-700" : done ? "text-green-600" : "text-slate-400"}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-blue-700 text-white" : done ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                      {done ? "✓" : n}
                    </span>
                    <span className="hidden sm:inline truncate">{label}</span>
                  </div>
                  {idx < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200 mx-2 shrink-0 min-w-2" />}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">ابحث عن طلب تسعير العميل برقم الطلب.</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="مثال: CQ-20260620-1234"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()} dir="ltr"
                />
                <Button onClick={handleSearch} disabled={searching || !searchTerm.trim()} className="bg-[#0064d9] hover:bg-[#0854a0] shrink-0">
                  <Search className="h-4 w-4 ml-1" /> بحث
                </Button>
              </div>
              {searchError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{searchError}</p>}

              {/* ── نتائج متعددة ── */}
              {searchResults.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 font-medium">تم العثور على {searchResults.length} نتيجة — اختر الطلب المناسب:</p>
                  <div className="overflow-auto max-h-64 rounded-lg border border-slate-200 divide-y">
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleSelectCQ(r.id)}
                        className="w-full text-right px-4 py-3 hover:bg-blue-50 transition-colors flex justify-between items-center gap-3 text-sm"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-blue-700 font-mono">{r.quotationNo}</span>
                          <span className="text-slate-500 text-xs">{r.customerName || "—"}</span>
                        </div>
                        <div className="text-xs text-slate-400 shrink-0">{r.requestDate || ""}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── طلب محدد ── */}
              {foundCQ && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-700 font-semibold text-sm"><CheckSquare className="h-4 w-4" /> تم العثور على الطلب</div>
                    <button onClick={() => { setFoundCQ(null); setSearchResults([]); }} className="text-xs text-slate-400 hover:text-slate-600">تغيير</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-slate-500">رقم الطلب:</span> <span className="font-medium font-mono">{foundCQ.quotationNo}</span></div>
                    <div><span className="text-slate-500">العميل:</span> <span className="font-medium">{foundCQ.customerName}</span></div>
                    <div><span className="text-slate-500">رقم أمر الشراء:</span> <span className="font-medium">{foundCQ.customerOrderNo || "—"}</span></div>
                    <div><span className="text-slate-500">عدد البنود:</span> <span className="font-medium">{foundCQ.items.length} بند</span></div>
                  </div>
                  <div className="overflow-auto max-h-48 rounded border">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-100"><tr>
                        <th className="px-3 py-2 font-medium text-slate-500">#</th>
                        <th className="px-3 py-2 font-medium text-slate-500">الوصف</th>
                        <th className="px-3 py-2 font-medium text-slate-500">رقم القطعة</th>
                        <th className="px-3 py-2 font-medium text-slate-500">الكمية</th>
                      </tr></thead>
                      <tbody>
                        {foundCQ.items.map((item, idx) => (
                          <tr key={item.id} className="border-t">
                            <td className="px-3 py-1.5 text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-1.5">{item.description}</td>
                            <td className="px-3 py-1.5 text-slate-500">{item.partNo || "—"}</td>
                            <td className="px-3 py-1.5">{item.quantity} {item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && foundCQ && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">اختر البنود التي تريد إرسالها للموردين</p>
                <div className="flex gap-2">
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => setSelectedItemIds(new Set(foundCQ.items.map(i => i.id)))}>تحديد الكل</button>
                  <span className="text-slate-300">|</span>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => setSelectedItemIds(new Set())}>إلغاء الكل</button>
                </div>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-50 border-b"><tr>
                    <th className="w-10 px-3 py-2" />
                    <th className="px-3 py-2 font-medium text-slate-500">الوصف</th>
                    <th className="px-3 py-2 font-medium text-slate-500">كود البند</th>
                    <th className="px-3 py-2 font-medium text-slate-500">رقم القطعة</th>
                    <th className="px-3 py-2 font-medium text-slate-500">الكمية</th>
                    <th className="px-3 py-2 font-medium text-slate-500">الوحدة</th>
                  </tr></thead>
                  <tbody>
                    {foundCQ.items.map(item => {
                      const checked = selectedItemIds.has(item.id);
                      return (
                        <tr key={item.id} className={`border-t cursor-pointer ${checked ? "bg-blue-50" : "hover:bg-slate-50"}`}
                          onClick={() => { const s = new Set(selectedItemIds); checked ? s.delete(item.id) : s.add(item.id); setSelectedItemIds(s); }}>
                          <td className="px-3 py-2 text-center">{checked ? <CheckSquare className="h-4 w-4 text-blue-600 inline" /> : <Square className="h-4 w-4 text-slate-400 inline" />}</td>
                          <td className="px-3 py-2 font-medium">{item.description}</td>
                          <td className="px-3 py-2 text-slate-500">{item.customerItemCode || "—"}</td>
                          <td className="px-3 py-2 text-slate-500">{item.partNo || "—"}</td>
                          <td className="px-3 py-2">{item.quantity}</td>
                          <td className="px-3 py-2 text-slate-500">{item.unit || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">تم تحديد {selectedItemIds.size} من {foundCQ.items.length} بند</p>
            </div>
          )}

          {/* ── STEP 3 ── per-item supplier assignment ── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">حدد مورداً أو أكثر لكل بند — يمكن إرسال كل بند لمورد مختلف</p>
              {selectedItems.map((item) => {
                const assignedIds: number[] = itemSupplierMap[item.id] ?? [];
                const catFilter = itemCatFilters[item.id] ?? "all";
                const filtered = catFilter === "all" ? suppliers : suppliers.filter(s => s.categories.some(c => String(c.id) === catFilter));
                const toggle = (sid: number) => {
                  const cur = new Set(itemSupplierMap[item.id] ?? []);
                  cur.has(sid) ? cur.delete(sid) : cur.add(sid);
                  setItemSupplierMap(prev => ({ ...prev, [item.id]: [...cur] }));
                };
                return (
                  <div key={item.id} className={`rounded-lg border-2 p-4 space-y-3 ${assignedIds.length > 0 ? "border-blue-200 bg-blue-50/30" : "border-slate-200"}`}>
                    {/* Item header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{item.description}</p>
                        <p className="text-xs text-slate-500">{item.partNo ? `رقم القطعة: ${item.partNo}` : ""} {item.quantity} {item.unit}</p>
                      </div>
                      {assignedIds.length > 0 && (
                        <span className="shrink-0 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">{assignedIds.length} مورد</span>
                      )}
                    </div>
                    {/* Category filter */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-slate-400 shrink-0">التصنيف:</span>
                      <button onClick={() => setItemCatFilters(p => ({ ...p, [item.id]: "all" }))} className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${catFilter === "all" ? "bg-[#0064d9] text-white border-[#0064d9]" : "border-slate-300 text-slate-600 hover:border-blue-400"}`}>الكل</button>
                      {categories.map(cat => (
                        <button key={cat.id} onClick={() => setItemCatFilters(p => ({ ...p, [item.id]: String(cat.id) }))} className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${catFilter === String(cat.id) ? "bg-[#0064d9] text-white border-[#0064d9]" : "border-slate-300 text-slate-600 hover:border-blue-400"}`}>{cat.name}</button>
                      ))}
                    </div>
                    {/* Suppliers grid */}
                    {filtered.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">لا يوجد موردون في هذا التصنيف</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                        {filtered.map(sup => {
                          const checked = assignedIds.includes(sup.id);
                          return (
                            <button key={sup.id} onClick={() => toggle(sup.id)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-right transition-colors ${checked ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200 hover:border-blue-300"}`}>
                              {checked ? <CheckSquare className="h-4 w-4 shrink-0" /> : <Square className="h-4 w-4 shrink-0 text-slate-400" />}
                              <span className="truncate font-medium">{sup.companyName}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-slate-500">{totalUniqueSuppliers} مورد فريد — سيُنشأ طلب منفصل لكل مورد</p>
            </div>
          )}

          {/* ── STEP 4 ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 border p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-slate-500">البنود المختارة:</span> <span className="font-bold text-blue-700">{selectedItems.length} بند</span></div>
                  <div><span className="text-slate-500">عدد الطلبات:</span> <span className="font-bold text-blue-700">{totalUniqueSuppliers} طلب (مورد واحد لكل طلب)</span></div>
                  <div className="col-span-2"><span className="text-slate-500">رقم طلب تسعير العميل:</span> <span className="font-medium">{foundCQ?.quotationNo || "—"}</span></div>
                </div>
                <div className="border-t pt-2 space-y-1">
                  {selectedItems.map(item => {
                    const names = (itemSupplierMap[item.id] ?? []).map(sid => suppliers.find(s => s.id === sid)?.companyName ?? sid);
                    return (
                      <div key={item.id} className="flex items-start gap-2 text-xs">
                        <span className="font-medium text-slate-700 flex-1 truncate">{item.description}</span>
                        <span className="text-blue-600 shrink-0">{names.join("، ") || "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">تاريخ إغلاق الطلب <span className="text-xs font-normal text-slate-400">(آخر موعد لتسعير الموردين)</span></label>
                <input type="date" value={requestDate} onChange={e => setRequestDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">ملاحظات (اختياري)</label>
                <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي ملاحظات إضافية..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none" />
              </div>
            </div>
          )}

          {/* ── STEP 5: Success ── */}
          {step === 5 && savedRfqs.length > 0 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                <div className="text-2xl mb-2">✅</div>
                <p className="font-bold text-green-700">تم إنشاء {savedRfqs.length} طلب تسعير بنجاح</p>
                <p className="text-sm text-green-600 mt-1">طلب منفصل لكل مورد</p>
              </div>
              <p className="text-sm font-semibold text-slate-700">إرسال لكل مورد:</p>
              <div className="space-y-3">
                {savedRfqs.map((rfq: any) => {
                  const sup: RfqSupplier = rfq.supplier;
                  return (
                    <div key={rfq.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-800">{sup?.companyName}</p>
                        <span className="text-xs font-mono text-slate-400">{rfq.rfqNo}</span>
                      </div>
                      <p className="text-xs text-slate-500">{rfq.items?.length} بند</p>
                      {sup?.token && (
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg border px-3 py-2 text-xs font-mono text-slate-500 overflow-hidden">
                          <LinkIcon className="h-3 w-3 shrink-0 text-blue-500" />
                          <span className="truncate flex-1">{getRfqLink(sup.token)}</span>
                          <button
                            onClick={() => copyTokenLink(sup.token, setCopiedToken)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600 text-white shrink-0 hover:bg-blue-700 text-xs font-sans"
                          >
                            {copiedToken === sup.token ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {copiedToken === sup.token ? "تم" : "نسخ"}
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50"
                          onClick={() => printRfqForSupplier(rfq.rfqNo, rfq.requestDate, rfq.sourceQuotationNo, rfq.customerOrderNo, rfq.notes, sup, rfq.items, sup?.token)}>
                          <FileText className="h-4 w-4 ml-1" /> طباعة / PDF
                        </Button>
                        <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() => sendWhatsApp(sup, rfq.rfqNo, rfq.requestDate, rfq.items, sup?.token)}>
                          <MessageSquare className="h-4 w-4 ml-1" /> واتساب
                        </Button>
                        <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50"
                          onClick={() => openEmail(sup, rfq.rfqNo, rfq.requestDate, rfq.items, sup?.token)}>
                          <Mail className="h-4 w-4 ml-1" /> إيميل
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="border-t bg-slate-50 px-6 py-4 flex items-center justify-between gap-3">
          {step <= 4 && step > 1 ? (
            <Button variant="outline" onClick={() => setStep(s => s - 1)}>
              <ArrowRight className="h-4 w-4 ml-1" /> السابق
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            {step < 4 && (
              <Button className="bg-[#0064d9] hover:bg-[#0854a0]"
                disabled={(step === 1 && !foundCQ) || (step === 2 && selectedItemIds.size === 0) || (step === 3 && !step3Valid)}
                onClick={() => goToStep(step + 1)}>
                التالي <ArrowLeft className="h-4 w-4 mr-1" />
              </Button>
            )}
            {step === 4 && (
              <Button className="bg-green-600 hover:bg-green-700" disabled={saving} onClick={handleSave}>
                <Send className="h-4 w-4 ml-1" /> {saving ? "جاري الحفظ..." : "حفظ وإرسال"}
              </Button>
            )}
            {step === 5 && (
              <Button className="bg-[#0064d9] hover:bg-[#0854a0]" onClick={onClose}>إغلاق</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AddSupplierModal ────────────────────────────────────────────────────────

function AddSupplierModal({ rfq, apiBase, onClose, onAdded }: {
  rfq: Rfq;
  apiBase: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [activeCat, setActiveCat] = React.useState<string>('all');
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    fetch(`${apiBase}/api/suppliers`, { credentials: 'include' })
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

  function toggleAll() {
    const next = new Set(selectedIds);
    if (allFilteredSelected) { filtered.forEach(s => next.delete(s.id)); }
    else { filtered.forEach(s => next.add(s.id)); }
    setSelectedIds(next);
  }

  function toggle(id: number) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  }

  async function handleAddSelected() {
    if (selectedIds.size === 0) return;
    setAdding(true); setError('');
    const errors: string[] = [];
    await Promise.all([...selectedIds].map(async supplierId => {
      try {
        const r = await fetch(`${apiBase}/api/supplier-quotations/${rfq.id}/suppliers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ supplierId }),
        });
        const data = await r.json();
        if (!r.ok) errors.push(data.error || 'فشل في إضافة المورد');
      } catch { errors.push('خطأ في الاتصال'); }
    }));
    setAdding(false);
    if (errors.length > 0) { setError(errors[0]); }
    else { onAdded(); }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4' dir='rtl'>
      <div className='bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[88vh]'>

        <div className='flex items-center justify-between bg-[#0f2240] px-5 py-4 rounded-t-xl'>
          <div>
            <h3 className='font-bold text-white text-base'>إضافة موردين للطلب</h3>
            <p className='text-blue-200 text-xs mt-0.5 font-mono'>{rfq.rfqNo}</p>
          </div>
          <button onClick={onClose} className='text-slate-300 hover:text-white p-1 rounded-lg transition-colors'>
            <X className='h-5 w-5' />
          </button>
        </div>

        <div className='px-4 pt-4 pb-0'>
          <div className='relative'>
            <Search className='absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none' />
            <input
              type='text' value={search} onChange={e => setSearch(e.target.value)}
              placeholder='بحث باسم الشركة...' dir='rtl'
              className='w-full rounded-lg border border-slate-300 pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400'
            />
            {search && (
              <button onClick={() => setSearch('')} className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600'>
                <X className='h-3.5 w-3.5' />
              </button>
            )}
          </div>
        </div>

        {!loading && categories.length > 0 && (
          <div className='px-4 pt-3 pb-0'>
            <div className='flex flex-wrap gap-1.5'>
              <button
                onClick={() => setActiveCat('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${activeCat === 'all' ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-700'}`}
              >
                الكل <span className={activeCat === 'all' ? 'text-blue-200' : 'text-slate-400'}>({suppliers.length})</span>
              </button>
              {categories.map(cat => {
                const cnt = suppliers.filter(s => s.categories.some(c => c.id === cat.id)).length;
                const active = activeCat === String(cat.id);
                return (
                  <button key={cat.id} onClick={() => setActiveCat(String(cat.id))}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-700'}`}
                  >
                    {cat.name} <span className={active ? 'text-blue-100' : 'text-slate-400'}>({cnt})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className='mx-4 mt-3 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2'>
            <button onClick={toggleAll} className='flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-blue-700 transition-colors'>
              <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${allFilteredSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-400'}`}>
                {allFilteredSelected && <Check className='h-2.5 w-2.5 text-white' />}
              </div>
              {allFilteredSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              {filtered.length !== suppliers.length && (
                <span className='text-slate-400 font-normal'>({filtered.length} مورد)</span>
              )}
            </button>
            {selectedIds.size > 0 && (
              <span className='text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full'>
                {selectedIds.size} محدد
              </span>
            )}
          </div>
        )}

        {error && (
          <p className='mx-4 mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2'>{error}</p>
        )}

        <div className='overflow-y-auto flex-1 px-4 py-3 space-y-1'>
          {loading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-6 w-6 animate-spin text-slate-400' />
            </div>
          ) : filtered.length === 0 ? (
            <div className='text-center py-12'>
              <p className='text-slate-500 font-medium text-sm'>
                {suppliers.length === 0 ? 'جميع الموردين النشطين مضافون بالفعل' : 'لا توجد نتائج مطابقة'}
              </p>
            </div>
          ) : (
            filtered.map(s => {
              const checked = selectedIds.has(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer border transition-all select-none ${checked ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <div className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                    {checked && <Check className='h-2.5 w-2.5 text-white' />}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className={`text-sm font-medium ${checked ? 'text-blue-800' : 'text-slate-800'}`}>{s.companyName}</p>
                    {s.categories.length > 0 && (
                      <div className='flex flex-wrap gap-1 mt-0.5'>
                        {s.categories.map(c => (
                          <span key={c.id} className={`text-xs px-1.5 py-0.5 rounded ${activeCat === String(c.id) ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                            {c.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className='border-t px-4 py-3 flex items-center justify-between gap-3 bg-slate-50 rounded-b-xl'>
          <button onClick={onClose}
            className='px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100 transition-colors'>
            إلغاء
          </button>
          <button
            onClick={handleAddSelected}
            disabled={adding || selectedIds.size === 0}
            className='flex items-center gap-2 px-5 py-2 rounded-lg bg-[#0064d9] hover:bg-[#0854a0] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
          >
            {adding ? <Loader2 className='h-4 w-4 animate-spin' /> : <UserPlus className='h-4 w-4' />}
            {adding ? 'جاري الإضافة...' : selectedIds.size > 0 ? `إضافة ${selectedIds.size} مورد` : 'إضافة'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

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
    queryFn: () => fetch(`${API_BASE}/api/supplier-quotations`, { credentials: "include" }).then(r => r.json()),
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
    mutationFn: (id: number) => fetch(`${API_BASE}/api/supplier-quotations/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-quotations"] }),
  });

  function handleDelete(id: number) {
    if (!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
    deleteMutation.mutate(id);
  }

  return (
    <AppLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-800">طلبات تسعير الموردين</h1>
          <Button className="bg-[#0064d9] hover:bg-[#0854a0] w-full sm:w-auto" onClick={() => setWizardOpen(true)}>
            <Send className="h-4 w-4 ml-2" /> إرسال طلب تسعير للموردين
          </Button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={listSearch}
            onChange={e => setListSearch(e.target.value)}
            placeholder="بحث بـ: رقم الطلب، طلب تسعير العميل، طلب مرجعي، اسم المورد، توصيف البند، رقم القطعة..."
            className="w-full rounded-lg border border-slate-300 bg-white pr-9 pl-9 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
            dir="rtl"
          />
          {listSearch && (
            <button
              onClick={() => setListSearch("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center text-slate-400 py-16 text-sm">جاري التحميل...</div>
        ) : rfqs.length === 0 ? (
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-16 text-center">
            <Send className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">لا توجد طلبات تسعير حتى الآن</p>
            <p className="text-slate-400 text-sm mt-1">اضغط على الزر أعلاه لإرسال طلب تسعير جديد للموردين</p>
          </div>
        ) : filteredRfqs.length === 0 ? (
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-10 text-center">
            <Search className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">لا توجد نتائج مطابقة</p>
            <p className="text-slate-400 text-sm mt-1">جرّب مصطلح بحث مختلف</p>
          </div>
        ) : (
          <div className="space-y-3">
            {listSearch && (
              <p className="text-sm text-slate-500">
                {filteredRfqs.length} نتيجة من أصل {rfqs.length} طلب
              </p>
            )}
            {filteredRfqs.map(rfq => {
              const isExpanded = expandedId === rfq.id;
              const submittedCount = rfq.suppliers.filter(s => s.responseStatus === "submitted").length;
              return (
                <div key={rfq.id} className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                  {/* Row header */}
                  <div className="flex items-center gap-3 px-4 py-4 flex-wrap">
                    <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                      <div>
                        <span className="text-slate-400 text-xs">رقم الطلب</span>
                        <p className="font-bold text-blue-700">{rfq.rfqNo}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs">طلب التسعير المرجعي</span>
                        <p className="font-medium">{rfq.sourceQuotationNo || "—"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs">التاريخ</span>
                        <p className="font-medium">{rfq.requestDate}</p>
                      </div>
                      <div className="flex gap-3">
                        <div>
                          <span className="text-slate-400 text-xs">البنود</span>
                          <p className="font-medium">{rfq.items.length}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 text-xs">الموردون</span>
                          <p className="font-medium">{rfq.suppliers.length}</p>
                        </div>
                        {submittedCount > 0 && (
                          <div>
                            <span className="text-slate-400 text-xs">استجاب</span>
                            <p className="font-medium text-green-600">{submittedCount}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        rfq.status === "مكتمل"
                          ? "bg-green-100 text-green-700"
                          : rfq.status === "تم التسعير من المورد"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>{rfq.status}</span>
                      {submittedCount > 0 && (
                        <button
                          onClick={() => setAnalysisRfq({ id: rfq.id, rfqNo: rfq.rfqNo })}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 text-xs font-medium transition-colors"
                          title="تحليل ومقارنة الأسعار"
                        >
                          <BarChart3 className="h-3.5 w-3.5" /> تحليل
                        </button>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : rfq.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <button onClick={() => handleDelete(rfq.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t bg-slate-50 px-4 py-4 space-y-4">
                      {/* Items */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-2">البنود ({rfq.items.length})</p>
                        <div className="rounded-lg border overflow-auto">
                          <table className="w-full text-xs text-right">
                            <thead className="bg-slate-100"><tr>
                              <th className="px-3 py-2 font-medium text-slate-500">#</th>
                              <th className="px-3 py-2 font-medium text-slate-500">الوصف</th>
                              <th className="px-3 py-2 font-medium text-slate-500">رقم القطعة</th>
                              <th className="px-3 py-2 font-medium text-slate-500">الكمية</th>
                              <th className="px-3 py-2 font-medium text-slate-500">الوحدة</th>
                            </tr></thead>
                            <tbody>
                              {rfq.items.map((item, idx) => (
                                <tr key={item.id} className="border-t">
                                  <td className="px-3 py-1.5 text-slate-400">{idx + 1}</td>
                                  <td className="px-3 py-1.5 font-medium">{item.description}</td>
                                  <td className="px-3 py-1.5 text-slate-500">{item.partNo || "—"}</td>
                                  <td className="px-3 py-1.5">{item.quantity}</td>
                                  <td className="px-3 py-1.5 text-slate-500">{item.unit || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Suppliers */}
                      <div>
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <p className="text-xs font-semibold text-slate-500">الموردون ({rfq.suppliers.length})</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setAddingSupplierForRfq(rfq)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium border border-blue-200"
                            >
                              <UserPlus className="h-3 w-3" /> إضافة مورد
                            </button>
                          {submittedCount > 0 && (
                            <button
                              onClick={() => setAnalysisRfq({ id: rfq.id, rfqNo: rfq.rfqNo })}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-xs font-medium"
                            >
                              <BarChart3 className="h-3 w-3" /> تحليل ومقارنة الأسعار
                            </button>
                          )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {rfq.suppliers.map(sup => (
                            <div key={sup.supplierId} className="rounded-lg border bg-white overflow-hidden">
                              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                                <span className="text-sm font-medium flex-1">{sup.companyName}</span>
                                {/* Response status badge */}
                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sup.responseStatus === "submitted" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                  {sup.responseStatus === "submitted" ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                  {sup.responseStatus === "submitted" ? "استجاب" : "في الانتظار"}
                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sup.firstOpenedAt ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-400"}`}>
                                  {sup.firstOpenedAt ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                  {sup.firstOpenedAt ? "فتح الرابط" : "لم يفتح"}
                                </span>
                                </span>
                                <div className="flex gap-1.5">
                                  <button className="flex items-center gap-1 px-2.5 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs"
                                    onClick={() => printRfqForSupplier(rfq.rfqNo, rfq.requestDate, rfq.sourceQuotationNo, rfq.customerOrderNo, rfq.notes, sup, rfq.items, sup.token)}>
                                    <FileText className="h-3 w-3" /> PDF
                                  </button>
                                  <button className="flex items-center gap-1 px-2.5 py-1 rounded border border-green-200 text-green-600 hover:bg-green-50 text-xs"
                                    onClick={() => sendWhatsApp(sup, rfq.rfqNo, rfq.requestDate, rfq.items, sup.token)}>
                                    <MessageSquare className="h-3 w-3" /> واتساب
                                  </button>
                                  <button className="flex items-center gap-1 px-2.5 py-1 rounded border border-orange-200 text-orange-600 hover:bg-orange-50 text-xs"
                                    onClick={() => openEmail(sup, rfq.rfqNo, rfq.requestDate, rfq.items, sup.token)}>
                                    <Mail className="h-3 w-3" /> إيميل
                                  </button>
                                </div>
                              </div>
                              {/* Token link row */}
                              {sup.token && (
                                <div className="flex items-center gap-2 border-t px-3 py-2 bg-slate-50">
                                  <LinkIcon className="h-3 w-3 text-blue-400 shrink-0" />
                                  <span className="text-xs text-slate-400 font-mono truncate flex-1">{getRfqLink(sup.token)}</span>
                                  <button
                                    onClick={() => copyTokenLink(sup.token, setCopiedToken)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 hover:bg-blue-600 hover:text-white text-xs text-slate-600 shrink-0 transition-colors"
                                  >
                                    {copiedToken === sup.token ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                    {copiedToken === sup.token ? "تم النسخ" : "نسخ الرابط"}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {addingSupplierForRfq && (
        <AddSupplierModal
          rfq={addingSupplierForRfq}
          apiBase={API_BASE}
          onClose={() => setAddingSupplierForRfq(null)}
          onAdded={() => {
            queryClient.invalidateQueries({ queryKey: ["supplier-quotations"] });
            setAddingSupplierForRfq(null);
          }}
        />
      )}

      {wizardOpen && (
        <SendWizard
          onClose={() => setWizardOpen(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["supplier-quotations"] })}
        />
      )}

      {analysisRfq && (
        <AnalysisModal
          rfqId={analysisRfq.id}
          rfqNo={analysisRfq.rfqNo}
          onClose={() => setAnalysisRfq(null)}
        />
      )}
    </AppLayout>
  );
}
