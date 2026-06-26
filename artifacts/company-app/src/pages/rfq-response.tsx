import React, { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Building2, CheckCircle, AlertCircle, Loader2, Send, Check, MapPin, Phone, Mail, Globe, FileText } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface RfqItem {
  id: number;
  customerItemCode: string;
  description: string;
  partNo: string;
  unit: string;
  quantity: string;
}

interface CompanySettings {
  name: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  commercialReg: string;
  taxReg: string;
  website: string;
}

interface RfqData {
  rfqNo: string;
  deadlineDate: string;
  notes: string;
  supplierName: string;
  responseStatus: "pending" | "submitted";
  responseSubmittedAt: string | null;
  vatIncluded: string;
  deliveryDays: number | null;
  responseNotes: string;
  paymentTerms: string;
  offerValidityDays: number | null;
  items: RfqItem[];
  prices: { rfqItemId: number; unitPrice: string; notes: string; vatIncluded?: string; deliveryDays?: number | null }[];
  company: CompanySettings;
}

interface ItemPrice {
  unitPrice: string;
  notes: string;
  vatIncluded: boolean;
  deliveryDays: string;
}

function formatQty(qty: string): string {
  const n = parseFloat(qty);
  if (isNaN(n)) return qty;
  return n % 1 === 0 ? n.toFixed(0) : n.toString();
}

export default function RfqResponsePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<RfqData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prices, setPrices] = useState<Record<number, ItemPrice>>({});
  const [vatIncluded, setVatIncluded] = useState<"yes" | "no">("no");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [responseNotes, setResponseNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [offerValidityDays, setOfferValidityDays] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/rfq/${token}`)
      .then((r) => (r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error))))
      .then((d: RfqData) => {
        setData(d);
        const initial: Record<number, ItemPrice> = {};
        d.items.forEach((item) => {
          const existing = d.prices.find((p) => p.rfqItemId === item.id);
          initial[item.id] = {
            unitPrice: existing?.unitPrice ?? "",
            notes: existing?.notes ?? "",
            vatIncluded: existing?.vatIncluded === "yes",
            deliveryDays: existing?.deliveryDays != null ? String(existing.deliveryDays) : "",
          };
        });
        setPrices(initial);
        setVatIncluded((d.vatIncluded === "yes" ? "yes" : "no"));
        setDeliveryDays(d.deliveryDays != null ? String(d.deliveryDays) : "");
        setResponseNotes(d.responseNotes ?? "");
        setPaymentTerms(d.paymentTerms ?? "");
        setOfferValidityDays(d.offerValidityDays != null ? String(d.offerValidityDays) : "");
        if (d.responseStatus === "submitted") setSubmitted(true);
      })
      .catch((e: any) => setError(typeof e === "string" ? e : "الرابط غير صحيح أو منتهي الصلاحية"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload = data.items.map((item) => ({
        rfqItemId: item.id,
        unitPrice: prices[item.id]?.unitPrice ?? "0",
        notes: prices[item.id]?.notes ?? "",
        vatIncluded: prices[item.id]?.vatIncluded ? "yes" : "no",
        deliveryDays: prices[item.id]?.deliveryDays ? Number(prices[item.id]?.deliveryDays) : null,
      }));
      const res = await fetch(`${API_BASE}/api/rfq/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prices: payload,
          vatIncluded,
          deliveryDays: deliveryDays ? Number(deliveryDays) : null,
          responseNotes,
          paymentTerms,
          offerValidityDays: offerValidityDays ? Number(offerValidityDays) : null,
        }),
      });
      const result = await res.json();
      if (!res.ok) { setSubmitError(result.error); return; }
      setSubmitted(true);
    } catch {
      setSubmitError("حدث خطأ أثناء الإرسال، يرجى المحاولة مجدداً");
    } finally {
      setSubmitting(false);
    }
  }

  function setPrice(itemId: number, field: keyof ItemPrice, value: string | boolean) {
    setPrices((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  }

  function lineTotal(itemId: number, qty: string) {
    const p = parseFloat(prices[itemId]?.unitPrice ?? "0") || 0;
    const q = parseFloat(qty) || 0;
    return p * q;
  }

  const grandTotal = data?.items.reduce((s, item) => s + lineTotal(item.id, item.quantity), 0) ?? 0;

  const isExpired = data?.deadlineDate
    ? (() => { const d = new Date(data.deadlineDate); d.setHours(23, 59, 59, 999); return new Date() > d; })()
    : false;

  const isFormDisabled = submitted || isExpired;

  /* ── Loading ── */
  if (loading) return (
    <div dir="rtl" className="flex h-screen items-center justify-center bg-[#f1f5f9]">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-[#0064d9]" />
        <span className="text-sm">جاري التحميل...</span>
      </div>
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div dir="rtl" className="flex h-screen flex-col bg-[#f1f5f9]">
      <header className="flex h-14 items-center gap-3 border-b bg-[#0f2240] px-6 shadow">
        <Building2 className="h-6 w-6 text-blue-400" />
        <span className="text-base font-bold text-white">نظام إدارة الأعمال</span>
      </header>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-10 text-center max-w-sm w-full">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800 mb-2">رابط غير صحيح</h2>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    </div>
  );

  if (!data) return null;

  const co: CompanySettings = data.company ?? { name: "", logoUrl: "", address: "", phone: "", email: "", commercialReg: "", taxReg: "", website: "" };

  return (
    <div dir="rtl" className="flex h-[100dvh] flex-col bg-[#f1f5f9] text-slate-900 overflow-hidden">

      {/* ── Top bar ── */}
      <header className="flex h-14 shrink-0 items-center border-b bg-[#0f2240] px-4 shadow-sm gap-3">
        <Building2 className="h-6 w-6 shrink-0 text-blue-400" />
        <span className="text-base font-bold text-white tracking-wide">{co.name || "نظام إدارة الأعمال"}</span>
        <div className="flex-1" />
        <span className="hidden sm:block text-sm font-mono text-blue-300">{data.rfqNo}</span>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${submitted ? "bg-green-500/20 text-green-300" : "bg-amber-500/20 text-amber-300"}`}>
          {submitted ? <Check className="h-3 w-3" /> : <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />}
          {submitted ? "تم الإرسال" : "في الانتظار"}
        </span>
      </header>

      {/* ── Page title ── */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-4 shadow-sm">
        <h1 className="text-base font-bold text-slate-800">نموذج عرض الأسعار</h1>
        <span className="sm:hidden text-xs font-mono text-slate-400">{data.rfqNo}</span>
        <span className="hidden sm:block text-sm text-slate-500">{data.supplierName}</span>
      </div>

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
        <div className="mx-auto max-w-5xl space-y-4">

          {/* ── Company card ── */}
          {(co.name || co.address || co.phone || co.email || co.commercialReg || co.taxReg) && (
            <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                {co.logoUrl && (
                  <div className="shrink-0">
                    <img src={co.logoUrl} alt="شعار الشركة" className="h-16 w-auto max-w-[140px] object-contain rounded" />
                  </div>
                )}
                {!co.logoUrl && co.name && (
                  <div className="shrink-0 h-16 w-16 rounded-xl bg-[#0064d9] flex items-center justify-center">
                    <span className="text-white font-bold text-xl">{co.name.charAt(0)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {co.name && <h2 className="text-base font-bold text-slate-800 mb-2">{co.name}</h2>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                    {co.address && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{co.address}</span>
                      </div>
                    )}
                    {co.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span dir="ltr">{co.phone}</span>
                      </div>
                    )}
                    {co.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{co.email}</span>
                      </div>
                    )}
                    {co.website && (
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{co.website}</span>
                      </div>
                    )}
                    {co.commercialReg && (
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>س.ت: <strong>{co.commercialReg}</strong></span>
                      </div>
                    )}
                    {co.taxReg && (
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>ت.ض: <strong>{co.taxReg}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── RFQ info card ── */}
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400 mb-1 font-medium">المورد</p>
                <p className="font-semibold text-slate-800">{data.supplierName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1 font-medium">رقم الطلب</p>
                <p className="font-semibold text-[#0064d9]">{data.rfqNo}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1 font-medium">آخر موعد للتسعير</p>
                <p className={`font-semibold ${isExpired ? "text-red-600" : "text-slate-700"}`}>
                  {data.deadlineDate}
                  {isExpired && <span className="mr-2 text-xs font-normal">(منتهي)</span>}
                </p>
              </div>
            </div>
            {data.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 font-medium mb-1">ملاحظات الطلب</p>
                <p className="text-sm text-slate-700">{data.notes}</p>
              </div>
            )}
          </div>

          {/* Expired / Submitted banners */}
          {isExpired && !submitted && (
            <div className="flex items-start gap-3 rounded-xl bg-white border border-red-200 shadow-sm p-5">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">انتهى الموعد النهائي للتسعير</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  لقد انتهى الموعد النهائي لتقديم عروض الأسعار ({data.deadlineDate}). يرجى التواصل مع الجهة المُصدِرة للطلب.
                </p>
              </div>
            </div>
          )}

          {submitted && (
            <div className="flex items-start gap-3 rounded-xl bg-white border border-green-200 shadow-sm p-5">
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">تم إرسال عرض أسعارك بنجاح</p>
                <p className="text-sm text-slate-500 mt-0.5">شكراً لكم — تم استلام عرضكم وسيتم مراجعته من قِبل الفريق المختص.</p>
                {data.responseSubmittedAt && (
                  <p className="text-xs text-slate-400 mt-1">
                    وقت الإرسال: {new Date(data.responseSubmittedAt).toLocaleString("ar-SA")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Pricing form ── */}
          <form onSubmit={handleSubmit}>
            <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
                <h2 className="text-sm font-bold text-slate-700">البنود المطلوب تسعيرها</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{data.items.length} بند</span>
                  {!isFormDisabled && (
                    <span className="text-xs text-slate-500 hidden sm:block">✓ = يشمل ضريبة القيمة المضافة</span>
                  )}
                </div>
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead>
                    <tr className="bg-slate-100 text-slate-500 text-xs font-semibold border-b border-slate-200">
                      <th className="px-3 py-2.5 w-8">#</th>
                      <th className="px-3 py-2.5">الوصف</th>
                      <th className="px-3 py-2.5 w-24">رقم القطعة</th>
                      <th className="px-3 py-2.5 w-16">الكمية</th>
                      <th className="px-3 py-2.5 w-16">الوحدة</th>
                      <th className="px-3 py-2.5 w-32">سعر الوحدة *</th>
                      <th className="px-3 py-2.5 w-24">الإجمالي</th>
                      <th className="px-3 py-2.5 w-28 text-center">
                        <span className="inline-flex flex-col items-center leading-tight">
                          <span>يشمل</span>
                          <span>الضريبة</span>
                        </span>
                      </th>
                      <th className="px-3 py-2.5 w-28">أيام التوريد</th>
                      <th className="px-3 py-2.5 w-32">ملاحظة البند</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item, idx) => {
                      const total = lineTotal(item.id, item.quantity);
                      const hasPrice = parseFloat(prices[item.id]?.unitPrice ?? "0") > 0;
                      const itemVat = prices[item.id]?.vatIncluded ?? false;
                      return (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-3 text-slate-400 text-xs">{idx + 1}</td>
                          <td className="px-3 py-3">
                            <span className="font-medium text-slate-800">{item.description}</span>
                            {item.customerItemCode && (
                              <span className="text-xs text-slate-400 block mt-0.5">{item.customerItemCode}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-slate-500 text-xs">{item.partNo || "—"}</td>
                          <td className="px-3 py-3 font-mono text-slate-700">{formatQty(item.quantity)}</td>
                          <td className="px-3 py-3 text-slate-500">{item.unit || "—"}</td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number" min="0" step="0.001" placeholder="0.000"
                              disabled={isFormDisabled}
                              value={prices[item.id]?.unitPrice ?? ""}
                              onChange={(e) => setPrice(item.id, "unitPrice", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-right font-mono focus:border-[#0064d9] focus:outline-none focus:ring-1 focus:ring-[#0064d9]/20 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
                              dir="ltr"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <span className={`font-mono text-sm ${hasPrice ? "text-[#0064d9] font-semibold" : "text-slate-300"}`}>
                              {hasPrice ? total.toFixed(3) : "—"}
                            </span>
                          </td>
                          {/* VAT checkbox per item */}
                          <td className="px-3 py-2.5 text-center">
                            <label className={`inline-flex items-center justify-center gap-1.5 cursor-pointer select-none ${isFormDisabled ? "cursor-default" : ""}`}>
                              <div
                                onClick={() => !isFormDisabled && setPrice(item.id, "vatIncluded", !itemVat)}
                                className={`h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                                  itemVat
                                    ? "bg-[#0064d9] border-[#0064d9]"
                                    : "bg-white border-slate-300 hover:border-[#0064d9]"
                                } ${isFormDisabled ? "opacity-60 cursor-default" : "cursor-pointer"}`}
                              >
                                {itemVat && <Check className="h-3.5 w-3.5 text-white" />}
                              </div>
                            </label>
                          </td>
                          {/* Delivery days per item */}
                          <td className="px-3 py-2.5">
                            <input
                              type="number" min="1" placeholder="أيام"
                              disabled={isFormDisabled}
                              value={prices[item.id]?.deliveryDays ?? ""}
                              onChange={(e) => setPrice(item.id, "deliveryDays", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-center font-mono focus:border-[#0064d9] focus:outline-none focus:ring-1 focus:ring-[#0064d9]/20 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
                              dir="ltr"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text" placeholder="ملاحظة..."
                              disabled={isFormDisabled}
                              value={prices[item.id]?.notes ?? ""}
                              onChange={(e) => setPrice(item.id, "notes", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-[#0064d9] focus:outline-none focus:ring-1 focus:ring-[#0064d9]/20 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={6} className="px-3 py-3 text-right font-bold text-slate-700 text-sm">الإجمالي الكلي</td>
                      <td className="px-3 py-3 font-bold font-mono text-[#0064d9] text-sm">
                        {grandTotal > 0 ? grandTotal.toFixed(3) : "—"}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-slate-100">
                {data.items.map((item, idx) => {
                  const total = lineTotal(item.id, item.quantity);
                  const hasPrice = parseFloat(prices[item.id]?.unitPrice ?? "0") > 0;
                  const itemVat = prices[item.id]?.vatIncluded ?? false;
                  return (
                    <div key={item.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs text-slate-400 shrink-0">#{idx + 1}</span>
                            {item.partNo && <span className="text-xs text-slate-400">{item.partNo}</span>}
                          </div>
                          <p className="font-semibold text-slate-800 text-sm">{item.description}</p>
                        </div>
                        <div className="text-left shrink-0">
                          <p className="text-xs text-slate-400">الكمية</p>
                          <p className="font-mono font-medium text-sm">{formatQty(item.quantity)} {item.unit}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1.5 block">سعر الوحدة</label>
                          <input
                            type="number" min="0" step="0.001" placeholder="0.000"
                            disabled={isFormDisabled}
                            value={prices[item.id]?.unitPrice ?? ""}
                            onChange={(e) => setPrice(item.id, "unitPrice", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:border-[#0064d9] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1.5 block">الإجمالي</label>
                          <div className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono ${hasPrice ? "text-[#0064d9] font-semibold" : "text-slate-300"}`}>
                            {hasPrice ? total.toFixed(3) : "—"}
                          </div>
                        </div>
                      </div>
                      {/* VAT + Delivery days per item on mobile */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1.5 block">أيام التوريد</label>
                          <input
                            type="number" min="1" placeholder="عدد الأيام"
                            disabled={isFormDisabled}
                            value={prices[item.id]?.deliveryDays ?? ""}
                            onChange={(e) => setPrice(item.id, "deliveryDays", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:border-[#0064d9] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1.5 block">يشمل ضريبة القيمة المضافة</label>
                          <div
                            onClick={() => !isFormDisabled && setPrice(item.id, "vatIncluded", !itemVat)}
                            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              isFormDisabled ? "opacity-60 cursor-default" : "cursor-pointer"
                            } ${itemVat ? "border-[#0064d9] bg-blue-50" : "border-slate-300 bg-white hover:border-slate-400"}`}
                          >
                            <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                              itemVat ? "bg-[#0064d9] border-[#0064d9]" : "bg-white border-slate-300"
                            }`}>
                              {itemVat && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className={`text-xs font-medium ${itemVat ? "text-[#0064d9]" : "text-slate-500"}`}>
                              {itemVat ? "شامل الضريبة" : "غير شامل"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">ملاحظة البند</label>
                        <input
                          type="text" placeholder="أي ملاحظة..."
                          disabled={isFormDisabled}
                          value={prices[item.id]?.notes ?? ""}
                          onChange={(e) => setPrice(item.id, "notes", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="px-4 py-3 bg-slate-50 flex items-center justify-between border-t-2 border-slate-200">
                  <span className="font-bold text-slate-700 text-sm">الإجمالي الكلي</span>
                  <span className={`font-mono font-bold text-sm ${grandTotal > 0 ? "text-[#0064d9]" : "text-slate-300"}`}>
                    {grandTotal > 0 ? grandTotal.toFixed(3) : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Response details card ── */}
            {!isFormDisabled && (
              <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-700 border-b pb-2">تفاصيل العرض العامة</h3>

                {/* Global VAT */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-600">ضريبة القيمة المضافة الإجمالية (VAT)</label>
                  <div className="flex gap-3">
                    <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-lg border text-sm transition-colors ${vatIncluded === "yes" ? "border-[#0064d9] bg-blue-50 text-[#0064d9] font-semibold" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                      <input type="radio" name="vat" value="yes" checked={vatIncluded === "yes"} onChange={() => setVatIncluded("yes")} className="hidden" />
                      شامل الضريبة (14%)
                    </label>
                    <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-lg border text-sm transition-colors ${vatIncluded === "no" ? "border-[#0064d9] bg-blue-50 text-[#0064d9] font-semibold" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                      <input type="radio" name="vat" value="no" checked={vatIncluded === "no"} onChange={() => setVatIncluded("no")} className="hidden" />
                      غير شامل الضريبة
                    </label>
                  </div>
                </div>

                {/* Global Delivery days */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-600">مدة التوريد الإجمالية (بالأيام)</label>
                  <input
                    type="number" min="1" placeholder="مثال: 14"
                    value={deliveryDays}
                    onChange={e => setDeliveryDays(e.target.value)}
                    className="w-full sm:w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none focus:ring-1 focus:ring-[#0064d9]/20"
                    dir="ltr"
                  />
                </div>

                {/* Payment terms + Offer validity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-600">
                      شروط الدفع <span className="text-slate-400 font-normal">(اختياري)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: 30% مقدماً، 70% عند التسليم"
                      value={paymentTerms}
                      onChange={e => setPaymentTerms(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none focus:ring-1 focus:ring-[#0064d9]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-600">
                      صلاحية العرض <span className="text-slate-400 font-normal">(بالأيام)</span>
                    </label>
                    <input
                      type="number" min="1"
                      placeholder="مثال: 30"
                      value={offerValidityDays}
                      onChange={e => setOfferValidityDays(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none focus:ring-1 focus:ring-[#0064d9]/20"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Notes / terms */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-600">ملاحظات إضافية <span className="text-slate-400 font-normal">(اختياري)</span></label>
                  <textarea
                    rows={3}
                    placeholder="أي شروط أو ملاحظات أخرى..."
                    value={responseNotes}
                    onChange={e => setResponseNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none focus:ring-1 focus:ring-[#0064d9]/20 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Submitted details (read-only view) */}
            {submitted && (
              <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-5 space-y-3 text-sm">
                <h3 className="font-bold text-slate-700 border-b pb-2 text-sm">تفاصيل العرض المُرسَل</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-xs text-slate-400">ضريبة القيمة المضافة</span>
                    <p className="font-medium">{data.vatIncluded === "yes" ? "شامل الضريبة (14%)" : "غير شامل الضريبة"}</p>
                  </div>
                  {data.deliveryDays && (
                    <div>
                      <span className="text-xs text-slate-400">مدة التوريد</span>
                      <p className="font-medium">{data.deliveryDays} يوم</p>
                    </div>
                  )}
                  {data.offerValidityDays && (
                    <div>
                      <span className="text-xs text-slate-400">صلاحية العرض</span>
                      <p className="font-medium">{data.offerValidityDays} يوم</p>
                    </div>
                  )}
                  {data.paymentTerms && (
                    <div>
                      <span className="text-xs text-slate-400">شروط الدفع</span>
                      <p className="font-medium">{data.paymentTerms}</p>
                    </div>
                  )}
                </div>
                {data.responseNotes && (
                  <div>
                    <span className="text-xs text-slate-400">ملاحظات إضافية</span>
                    <p className="text-slate-700 mt-1">{data.responseNotes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {submitError && (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-white shadow-sm p-4 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                {submitError}
              </div>
            )}

            {/* Submit */}
            {!submitted && !isExpired && (
              <div className="flex justify-end">
                <button
                  type="submit" disabled={submitting}
                  className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#0064d9]/30"
                  style={{ background: "#0064d9" }}
                >
                  <Send className="h-4 w-4" />
                  {submitting ? "جاري الإرسال..." : "إرسال عرض الأسعار"}
                </button>
              </div>
            )}
          </form>

          <p className="text-center text-xs text-slate-400 pb-2">
            هذا الرابط مخصص لكم — يرجى عدم مشاركته مع جهات أخرى
          </p>
        </div>
      </main>
    </div>
  );
}
