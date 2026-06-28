import React, { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Search, Package, X, ChevronLeft } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface Item {
  id: number;
  customer_item_code: string;
  description: string;
  part_no: string;
  unit: string;
  quantity: string;
  quotation_no: string;
  request_date: string;
  quotation_close_date?: string;
  quotation_status: string;
  quotation_id: number;
  customer_name: string;
  internal_code?: string;
}

interface DetailRow {
  item_id: number;
  description: string;
  part_no: string;
  customer_item_code: string;
  unit: string;
  quoted_qty: string;
  quoted_unit_price: string;
  quotation_id: number;
  quotation_no: string;
  request_date: string;
  quotation_status: string;
  customer_order_no: string;
  customer_name: string;
  order_id: number | null;
  sales_order_no: string | null;
  customer_po_no: string | null;
  sales_order_date: string | null;
  order_status: string | null;
  ordered_qty: string | null;
  selling_unit_price: string | null;
  selling_total_price: string | null;
}

interface Stats {
  totalOccurrences: number;
  totalQuotedQty: number;
  orderedCount: number;
  totalOrderedQty: number;
  avgSellingPrice: number | null;
  minSellingPrice: number | null;
  maxSellingPrice: number | null;
  latestSupplierPrice: number | null;
  latestSupplierName: string | null;
}

interface DetailData {
  description: string;
  stats: Stats;
  rows: DetailRow[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

const QT_COLOR: Record<string, string> = {
  "مفتوح": "text-blue-700 bg-blue-50 border-blue-200",
  "مكتمل": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "ملغي":  "text-red-600 bg-red-50 border-red-200",
  "معلق":  "text-amber-700 bg-amber-50 border-amber-200",
};

function num(v: string | number | null | undefined, d = 3) {
  if (v == null || v === "") return "—";
  const n = parseFloat(String(v));
  return isNaN(n) ? "—" : n.toLocaleString("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: d });
}

function KPI({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`border border-slate-200 bg-white p-3 ${highlight ? "border-l-4 border-l-[#1e3a5f]" : ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? "text-[#1e3a5f]" : "text-slate-800"}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-block border px-1.5 py-0.5 text-[10px] font-semibold rounded-sm ${QT_COLOR[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {status}
    </span>
  );
}

function DetailModal({ description, internalCode, onClose }: { description: string; internalCode?: string; onClose: () => void }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const url = internalCode
      ? `${API_BASE}/api/items/detail-by-code?code=${encodeURIComponent(internalCode)}`
      : `${API_BASE}/api/items/detail?description=${encodeURIComponent(description)}`;
    fetch(url, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("فشل في جلب التفاصيل"); setLoading(false); });
  }, [description, internalCode]);

  const s = data?.stats;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mr-auto w-full max-w-6xl bg-[#f4f5f7] flex flex-col shadow-2xl overflow-hidden">
        <div className="bg-[#1e3a5f] text-white px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onClose} className="text-white/70 hover:text-white shrink-0"><X className="h-4 w-4" /></button>
            <ChevronLeft className="h-3.5 w-3.5 text-white/40 shrink-0" />
            <span className="text-xs text-white/60 shrink-0">البنود</span>
            <ChevronLeft className="h-3.5 w-3.5 text-white/40 shrink-0" />
            {internalCode && (
              <span className="font-mono text-xs bg-white/20 border border-white/30 rounded px-2 py-0.5 shrink-0">{internalCode}</span>
            )}
            <span className="text-sm font-semibold truncate">{data?.description || description}</span>
          </div>
          <span className="text-xs text-white/50 shrink-0">
            {internalCode ? `سجل الكود الإداري` : "سجل البند"}
          </span>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm animate-pulse">جاري التحميل...</div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-500 text-sm">{error}</div>
        ) : data && s ? (
          <div className="flex-1 overflow-y-auto">
            <div className="bg-white border-b border-slate-300 px-5 py-2 flex items-center gap-6 text-xs text-slate-600">
              <span><span className="text-slate-400">الوصف: </span><strong>{data.description}</strong></span>
              {data.rows[0]?.part_no && <span><span className="text-slate-400">PART NO: </span><span className="font-mono">{data.rows[0].part_no}</span></span>}
              {data.rows[0]?.unit && <span><span className="text-slate-400">الوحدة: </span>{data.rows[0].unit}</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-b border-slate-300 divide-x divide-x-reverse divide-slate-200">
              <KPI label="عدد طلبات التسعير" value={String(s.totalOccurrences)} highlight />
              <KPI label="إجمالي الكمية المطلوبة" value={num(s.totalQuotedQty, 0)} />
              <KPI label="أوامر بيع صادرة" value={`${s.orderedCount} / ${s.totalOccurrences}`} sub="من إجمالي الطلبات" />
              <KPI label="متوسط سعر البيع" value={s.avgSellingPrice != null ? num(s.avgSellingPrice) : "—"} highlight />
              <KPI label="أحدث سعر مورد" value={s.latestSupplierPrice != null ? num(s.latestSupplierPrice) : "—"} sub={s.latestSupplierName ?? undefined} />
              <KPI label="نطاق سعر البيع" value={s.minSellingPrice != null ? `${num(s.minSellingPrice)} — ${num(s.maxSellingPrice)}` : "—"} sub="الأدنى — الأعلى" />
            </div>
            <div className="bg-slate-100 border-b border-slate-300 px-5 py-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">سجل طلبات التسعير وأوامر البيع</span>
              <span className="text-[11px] text-slate-400">{data.rows.length} سجل</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-[#dce3ec] text-[#1e3a5f] border-b-2 border-[#1e3a5f]/20">
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300 w-7">#</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300">طلب التسعير</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300">العميل</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300">تاريخ الطلب</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300">حالة الطلب</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300">كود العميل للبند</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300">رقم أمر العميل</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300">الكمية</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300 bg-[#1e3a5f]/10">أمر البيع</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300 bg-[#1e3a5f]/10">تاريخ البيع</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300 bg-[#1e3a5f]/10">تاريخ الإغلاق</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300 bg-[#1e3a5f]/10">كمية البيع</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300 bg-[#1e3a5f]/10">سعر البيع</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-300 bg-[#1e3a5f]/10">الإجمالي</th>
                    <th className="px-3 py-2.5 font-semibold bg-[#1e3a5f]/10">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, idx) => {
                    const hasSale = row.order_id != null;
                    return (
                      <tr key={row.item_id} className={`border-b border-slate-200 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-blue-50/40`}>
                        <td className="px-3 py-2 text-slate-400 text-center border-l border-slate-200 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2 border-l border-slate-200 font-mono text-[#1e3a5f] font-semibold">{row.quotation_no}</td>
                        <td className="px-3 py-2 border-l border-slate-200 text-slate-700 max-w-[120px] truncate">{row.customer_name || "—"}</td>
                        <td className="px-3 py-2 border-l border-slate-200 text-slate-500 whitespace-nowrap">{row.request_date || "—"}</td>
                        <td className="px-3 py-2 border-l border-slate-200"><Badge status={row.quotation_status} /></td>
                        <td className="px-3 py-2 border-l border-slate-200 font-mono text-slate-600 text-center">{row.customer_item_code || "—"}</td>
                        <td className="px-3 py-2 border-l border-slate-200 font-mono text-slate-600">{row.customer_order_no || "—"}</td>
                        <td className="px-3 py-2 border-l border-slate-200 font-semibold text-center">{num(row.quoted_qty, 0)}</td>
                        {hasSale ? (
                          <>
                            <td className="px-3 py-2 border-l border-slate-200 bg-[#1e3a5f]/5 font-mono text-[#1e3a5f] font-bold">{row.customer_po_no || row.sales_order_no || "—"}</td>
                            <td className="px-3 py-2 border-l border-slate-200 bg-[#1e3a5f]/5 text-slate-500 whitespace-nowrap">{row.sales_order_date || "—"}</td>
                            <td className="px-3 py-2 border-l border-slate-200 bg-[#1e3a5f]/5 text-slate-500 whitespace-nowrap">{row.order_close_date || "—"}</td>
                            <td className="px-3 py-2 border-l border-slate-200 bg-[#1e3a5f]/5 font-semibold text-center">{num(row.ordered_qty, 0)}</td>
                            <td className="px-3 py-2 border-l border-slate-200 bg-[#1e3a5f]/5">{num(row.selling_unit_price)}</td>
                            <td className="px-3 py-2 border-l border-slate-200 bg-[#1e3a5f]/5 font-bold text-[#1e3a5f]">{num(row.selling_total_price)}</td>
                            <td className="px-3 py-2 bg-[#1e3a5f]/5"><Badge status={row.order_status ?? ""} /></td>
                          </>
                        ) : (
                          <td colSpan={8} className="px-3 py-2 bg-slate-100/50 text-slate-300 text-center text-[10px] tracking-wider">لم يصدر أمر بيع</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function ItemsPage() {
  const [items,        setItems]        = useState<Item[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [selectedDesc, setSelectedDesc] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const fetchItems = () => {
    fetch(`${API_BASE}/api/items`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = items.filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.description?.toLowerCase().includes(q) ||
      item.part_no?.toLowerCase().includes(q) ||
      item.customer_item_code?.toLowerCase().includes(q) ||
      item.quotation_no?.toLowerCase().includes(q) ||
      item.customer_name?.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="space-y-4">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">البنود</h1>
            <p className="text-xs text-slate-400 mt-0.5">مستخرجة من طلبات التسعير · اضغط على الوصف لعرض السجل الكامل</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-[#1e3a5f] text-white px-3 py-1 rounded-sm font-semibold tabular-nums">
              {filtered.length} بند
            </span>
          </div>
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالوصف، رقم القطعة، العميل، رقم الطلب..."
            className="w-full pr-9 pl-4 py-2 border border-slate-300 bg-white text-sm focus:outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/20 rounded-sm"
          />
        </div>

        {/* ── Items Table ── */}
        <div className="bg-white border border-slate-300 overflow-hidden rounded-sm shadow-sm">
          <div className="bg-[#dce3ec] border-b-2 border-[#1e3a5f]/20 px-4 py-2">
            <span className="text-[11px] font-semibold text-[#1e3a5f] uppercase tracking-wider">قائمة البنود</span>
          </div>
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm animate-pulse">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <Package className="h-10 w-10 opacity-20" />
              <p className="text-sm">{search ? "لا توجد نتائج للبحث" : "لا توجد بنود"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-[#eef0f4] border-b border-slate-300 text-slate-600">
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-200 w-8">#</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-200 whitespace-nowrap">الكود الإداري</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-200">الوصف</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-200">كود العميل</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-200">PART NO</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-200">الوحدة</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-200">الكمية</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-200">طلب التسعير</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-200">العميل</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-200">تاريخ الطلب</th>
                    <th className="px-3 py-2.5 font-semibold border-l border-slate-200">تاريخ الإغلاق</th>
                    <th className="px-3 py-2.5 font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => (
                    <tr key={item.id} className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                      <td className="px-3 py-2 text-slate-400 text-center border-l border-slate-100 font-mono">{idx + 1}</td>
                      <td className="px-3 py-2 border-l border-slate-100 whitespace-nowrap">
                        {item.internal_code ? (
                          <span className="font-mono font-bold tracking-widest text-[#1e3a5f] bg-[#1e3a5f]/8 rounded-sm px-2 py-1 text-[11px] border border-[#1e3a5f]/20">
                            {item.internal_code}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-l border-slate-100">
                        <button
                          onClick={() => { setSelectedDesc(item.description); setSelectedCode(item.internal_code || null); }}
                          className="text-right text-[#1e3a5f] font-semibold hover:underline underline-offset-2 break-words text-start"
                          title="اضغط لعرض السجل الكامل عبر الكود الإداري">
                          {item.description || "—"}
                        </button>
                      </td>
                      <td className="px-3 py-2 border-l border-slate-100 text-slate-500 font-mono">{item.customer_item_code || "—"}</td>
                      <td className="px-3 py-2 border-l border-slate-100 text-slate-500 font-mono">{item.part_no || "—"}</td>
                      <td className="px-3 py-2 border-l border-slate-100 text-slate-600">{item.unit || "—"}</td>
                      <td className="px-3 py-2 border-l border-slate-100 font-semibold text-center tabular-nums">
                        {item.quantity ? parseFloat(item.quantity).toLocaleString("ar-EG") : "—"}
                      </td>
                      <td className="px-3 py-2 border-l border-slate-100 font-mono text-[#1e3a5f]">{item.quotation_no}</td>
                      <td className="px-3 py-2 border-l border-slate-100 text-slate-700">{item.customer_name || "—"}</td>
                      <td className="px-3 py-2 border-l border-slate-100 text-slate-400 whitespace-nowrap">{item.request_date || "—"}</td>
                      <td className="px-3 py-2 border-l border-slate-100 text-slate-400 whitespace-nowrap">
                        {item.quotation_close_date || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block border px-1.5 py-0.5 text-[10px] font-semibold rounded-sm ${QT_COLOR[item.quotation_status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {item.quotation_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedDesc && (
        <DetailModal
          description={selectedDesc}
          internalCode={selectedCode ?? undefined}
          onClose={() => { setSelectedDesc(null); setSelectedCode(null); }}
        />
      )}
    </AppLayout>
  );
}
