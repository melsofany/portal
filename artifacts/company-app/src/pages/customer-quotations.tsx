import { useState, useMemo, useEffect, useRef } from "react";
    import AppLayout from "@/components/AppLayout";
    import { Button } from "@/components/ui/button";
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
    import { Input } from "@/components/ui/input";
    import { Label } from "@/components/ui/label";
    import { Trash2, Plus, Pencil, DollarSign, X, Loader2, TrendingUp, Search, Sparkles, CheckCircle2, Eye, Printer } from "lucide-react";
    import {
      useGetCustomerQuotations,
      useCreateCustomerQuotation,
      useDeleteCustomerQuotation,
      useGetCustomers,
      getGetCustomerQuotationsQueryKey,
    } from "@workspace/api-client-react";
    import { useQueryClient } from "@tanstack/react-query";

    const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

    type LineItem = {
      id?: number;
      customerItemCode: string;
      description: string;
      partNo: string;
      unit: string;
      quantity: string;
      unitPrice?: string;
      customerNotes?: string;
      internalCode?: string;
    };

    const emptyItem = (): LineItem => ({
      customerItemCode: "",
      description: "",
      partNo: "",
      unit: "",
      quantity: "",
      unitPrice: "0",
      customerNotes: "",
      internalCode: "",
    });

    const emptyHeader = {
      customerId: "",
      responsibleName: "",
      requestDate: "",
      expiryDate: "",
      closeDate: "",
      customerOrderNo: "",
    };

    type HeaderErrors = Partial<Record<keyof typeof emptyHeader | "items" | "server", string>>;

    function ItemRow({
      item, index, onChange, onRemove, canRemove,
    }: {
      item: LineItem; index: number;
      onChange: (i: number, f: keyof LineItem, v: string) => void;
      onRemove: (i: number) => void; canRemove: boolean;
    }) {
      // Live suggestion while typing (optional preview before save)
      const [suggestion, setSuggestion] = useState<{ code: string; score: number } | null>(null);
      const [matching, setMatching] = useState(false);
      const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

      useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const desc = item.description.trim();
        if (!desc || desc.length < 5) { setSuggestion(null); return; }
        debounceRef.current = setTimeout(async () => {
          setMatching(true);
          try {
            const r = await fetch(`${API_BASE}/api/item-coding/match`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ description: desc }),
            });
            const data = await r.json();
            if (data.matched && (data.item?.internal_code || data.code)) {
              setSuggestion({ code: data.item?.internal_code ?? data.code, score: data.score ?? data.confidence ?? 0 });
            } else {
              setSuggestion(null);
            }
          } catch { setSuggestion(null); }
          finally { setMatching(false); }
        }, 900);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
      }, [item.description]);

      return (
        <tr className="border-t">
          <td className="px-2 py-1.5">
            <Input value={item.customerItemCode} onChange={e => onChange(index, "customerItemCode", e.target.value)} placeholder="كود البند" className="h-8 text-xs" />
          </td>
          <td className="px-2 py-1.5 min-w-[240px]">
            <div className="space-y-1">
              <Input value={item.description} onChange={e => onChange(index, "description", e.target.value)} placeholder="توصيف البند *" className="h-8 text-xs" />
              {/* Saved internal code badge (set server-side on save) */}
              {item.internalCode && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                    {item.internalCode}
                  </span>
                  <span className="text-xs text-emerald-500">كود إداري</span>
                </div>
              )}
              {/* Live AI suggestion while typing */}
              {!item.internalCode && matching && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />جاري البحث في القاموس...
                </p>
              )}
              {!item.internalCode && !matching && suggestion && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    <span className="font-mono font-bold">{suggestion.code}</span>
                    <span className="text-amber-400">({Math.round(suggestion.score * 100)}%)</span>
                  </span>
                  <span className="text-xs text-slate-400">سيُطبَّق تلقائياً عند الحفظ</span>
                </div>
              )}
            </div>
          </td>
          <td className="px-2 py-1.5"><Input value={item.partNo} onChange={e => onChange(index, "partNo", e.target.value)} placeholder="PART NO" className="h-8 text-xs" dir="ltr" /></td>
          <td className="px-2 py-1.5"><Input value={item.unit} onChange={e => onChange(index, "unit", e.target.value)} placeholder="الوحدة" className="h-8 text-xs" /></td>
          <td className="px-2 py-1.5"><Input value={item.quantity} onChange={e => onChange(index, "quantity", e.target.value)} placeholder="0" className="h-8 text-xs" type="number" min="0" dir="ltr" /></td>
          <td className="px-2 py-1.5 text-center">{canRemove && <button type="button" onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
        </tr>
      );
    }

    function fmtQty(val: string | number | null | undefined): string {
      if (val === null || val === undefined || val === "") return "";
      const n = parseFloat(String(val));
      if (isNaN(n)) return String(val ?? "");
      return n % 1 === 0 ? String(Math.round(n)) : String(parseFloat(n.toFixed(10)));
    }

    function statusBadge(s: string) {
      if (s === "مفتوح") return "bg-blue-100 text-blue-700";
      if (s === "مكتمل") return "bg-green-100 text-green-700";
      if (s === "ملغي") return "bg-red-100 text-red-700";
      if (s === "تم الرد من المورد") return "bg-amber-100 text-amber-700";
      return "bg-slate-100 text-slate-600";
    }

    export default function CustomerQuotationsPage() {
      const queryClient = useQueryClient();
      const { data: quotationsRaw, isLoading } = useGetCustomerQuotations();
      const { data: customersRaw } = useGetCustomers();

      const quotations = Array.isArray(quotationsRaw) ? quotationsRaw : [];
      const customers  = Array.isArray(customersRaw)  ? customersRaw  : [];

      // ── Search ──
      const [listSearch, setListSearch] = useState("");

      const filteredQuotations = useMemo(() => {
        const q = listSearch.trim().toLowerCase();
        if (!q) return quotations;
        return quotations.filter((cq: any) => {
          if (cq.quotationNo?.toLowerCase().includes(q)) return true;
          if (cq.customerName?.toLowerCase().includes(q)) return true;
          if (cq.customerOrderNo?.toLowerCase().includes(q)) return true;
          if (cq.responsibleName?.toLowerCase().includes(q)) return true;
          if (cq.status?.toLowerCase().includes(q)) return true;
          return false;
        });
      }, [quotations, listSearch]);

      // ── Add / Edit modal state ──
      const [open, setOpen]           = useState(false);
      const [editingId, setEditingId] = useState<number | null>(null);
      const [header, setHeader]       = useState(emptyHeader);
      const [items, setItems]         = useState<LineItem[]>([emptyItem()]);
      const [errors, setErrors]       = useState<HeaderErrors>({});
      const [saving, setSaving]       = useState(false);

      // ── View / Print modal state ──
      const [viewQ, setViewQ]           = useState<any | null>(null);
      const [viewItems, setViewItems]   = useState<any[]>([]);
      const [viewLoading, setViewLoading] = useState(false);
      const [companyInfo, setCompanyInfo] = useState<{ name: string; logoUrl: string; address: string; phone: string; email: string } | null>(null);

      // Fetch company info once
      useEffect(() => {
        fetch(`${API_BASE}/api/settings/public`).then(r => r.json()).then(d => setCompanyInfo(d)).catch(() => {});
      }, []);

      async function handleView(q: any) {
        setViewQ(q);
        setViewLoading(true);
        try {
          const res = await fetch(`${API_BASE}/api/customer-quotations/${q.id}`, { credentials: "include" });
          const data = await res.json();
          setViewItems(data.items ?? []);
        } catch { setViewItems([]); }
        finally { setViewLoading(false); }
      }

      function handlePrint() {
        window.print();
      }

      // ── Pricing modal state ──
      const [pricingQ, setPricingQ]         = useState<{ id: number; quotationNo: string } | null>(null);
      const [pricingItems, setPricingItems] = useState<{ id: number; description: string; partNo: string; unit: string; quantity: string; unitPrice: string; customerNotes: string; bestPrice: number | null; internalCode: string }[]>([]);
      const [pricingLoading, setPricingLoading] = useState(false);
      const [pricingSaving, setPricingSaving]   = useState(false);
      const [pricingError, setPricingError]     = useState("");

      const createQuotation = useCreateCustomerQuotation({
        mutation: {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCustomerQuotationsQueryKey() });
            setOpen(false); setHeader(emptyHeader); setItems([emptyItem()]); setErrors({});
          },
          onError: (err: any) => setErrors(e => ({ ...e, server: err?.response?.data?.error ?? "حدث خطأ" })),
        },
      });

      const deleteQuotation = useDeleteCustomerQuotation({
        mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCustomerQuotationsQueryKey() }) },
      });

      // ── Open Add ──
      function handleAdd() {
        setEditingId(null);
        setHeader(emptyHeader);
        setItems([emptyItem()]);
        setErrors({});
        setOpen(true);
      }

      // ── Open Edit ──
      async function handleEdit(id: number) {
        setEditingId(id);
        setErrors({});
        setSaving(false);
        try {
          const res = await fetch(`${API_BASE}/api/customer-quotations/${id}`, { credentials: "include" });
          const data = await res.json();
          setHeader({
            customerId: String(data.customerId ?? ""),
            responsibleName: data.responsibleName ?? "",
            requestDate: data.requestDate ?? "",
            expiryDate: data.expiryDate ?? "",
            closeDate: data.closeDate ?? "",
            customerOrderNo: data.customerOrderNo ?? "",
          });
          setItems((data.items ?? []).map((it: any) => ({
            id: it.id,
            customerItemCode: it.customerItemCode ?? "",
            description: it.description ?? "",
            partNo: it.partNo ?? "",
            unit: it.unit ?? "",
            quantity: String(it.quantity ?? ""),
            unitPrice: String(it.unitPrice ?? "0"),
            customerNotes: it.customerNotes ?? "",
            internalCode: it.internalCode ?? "",
          })));
        } catch { setErrors({ server: "فشل في تحميل بيانات الطلب" }); }
        setOpen(true);
      }

      function handleHeaderChange(field: keyof typeof emptyHeader, value: string) {
        setHeader(h => ({ ...h, [field]: value }));
        setErrors(e => ({ ...e, [field]: undefined, server: undefined }));
      }

      function handleItemChange(index: number, field: keyof LineItem, value: string) {
        setItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
      }

      async function handleSave() {
        const errs: HeaderErrors = {};
        if (!header.customerId) errs.customerId = "يجب اختيار العميل";
        if (!header.requestDate) errs.requestDate = "تاريخ الطلب مطلوب";
        const validItems = items.filter(it => it.description.trim());
        if (validItems.length === 0) errs.items = "يجب إضافة بند واحد على الأقل";
        if (Object.keys(errs).length) { setErrors(errs); return; }

        const body = {
          customerId: Number(header.customerId),
          responsibleName: header.responsibleName,
          requestDate: header.requestDate,
          expiryDate: header.expiryDate,
          closeDate: header.closeDate,
          customerOrderNo: header.customerOrderNo,
          items: validItems.map(it => ({
            customerItemCode: it.customerItemCode,
            description: it.description,
            partNo: it.partNo,
            unit: it.unit,
            quantity: Number(it.quantity) || 0,
            internalCode: it.internalCode ?? "",
          })),
        };

        if (editingId) {
          setSaving(true);
          try {
            const r = await fetch(`${API_BASE}/api/customer-quotations/${editingId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(body),
            });
            const data = await r.json();
            if (!r.ok) { setErrors({ server: data.error ?? "فشل في التعديل" }); return; }
            queryClient.invalidateQueries({ queryKey: getGetCustomerQuotationsQueryKey() });
            setOpen(false);
          } catch { setErrors({ server: "حدث خطأ أثناء الحفظ" }); }
          finally { setSaving(false); }
        } else {
          setSaving(true);
          try {
            const r = await fetch(`${API_BASE}/api/customer-quotations`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(body),
            });
            const data = await r.json();
            if (!r.ok) { setErrors({ server: data.error ?? "فشل في إنشاء الطلب" }); return; }
            queryClient.invalidateQueries({ queryKey: getGetCustomerQuotationsQueryKey() });
            setOpen(false); setHeader(emptyHeader); setItems([emptyItem()]); setErrors({});
          } catch { setErrors({ server: "حدث خطأ أثناء الحفظ" }); }
          finally { setSaving(false); }
        }
      }

      // ── Open Pricing ──
      async function handlePricing(q: { id: number; quotationNo: string }) {
        setPricingQ(q);
        setPricingLoading(true);
        setPricingError("");
        try {
          const [detailRes, bestRes] = await Promise.all([
            fetch(`${API_BASE}/api/customer-quotations/${q.id}`, { credentials: "include" }),
            fetch(`${API_BASE}/api/customer-quotations/${q.id}/best-supplier-prices`, { credentials: "include" }),
          ]);
          const detail = await detailRes.json();
          const best   = await bestRes.json();
          setPricingItems((detail.items ?? []).map((it: any) => ({
            id: it.id,
            description: it.description,
            partNo: it.partNo ?? "",
            unit: it.unit ?? "",
            quantity: String(it.quantity ?? ""),
            unitPrice: String(parseFloat(it.unitPrice ?? "0") > 0 ? parseFloat(it.unitPrice).toFixed(3) : ""),
            customerNotes: it.customerNotes ?? "",
            bestPrice: best[it.id]?.bestPrice ?? null,
            internalCode: it.internalCode ?? "",
          })));
        } catch { setPricingError("فشل في تحميل البيانات"); }
        finally { setPricingLoading(false); }
      }

      async function handleSavePricing() {
        if (!pricingQ) return;
        setPricingSaving(true); setPricingError("");
        try {
          const r = await fetch(`${API_BASE}/api/customer-quotations/${pricingQ.id}/pricing`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              prices: pricingItems.map(it => ({
                itemId: it.id,
                unitPrice: parseFloat(it.unitPrice) || 0,
                customerNotes: it.customerNotes,
              })),
            }),
          });
          const data = await r.json();
          if (!r.ok) { setPricingError(data.error ?? "فشل في الحفظ"); return; }
          queryClient.invalidateQueries({ queryKey: getGetCustomerQuotationsQueryKey() });
          setPricingQ(null);
        } catch { setPricingError("حدث خطأ أثناء الحفظ"); }
        finally { setPricingSaving(false); }
      }

      const isSaving = saving || createQuotation.isPending;

      return (
        <AppLayout>
          <div className="space-y-6" dir="rtl">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-slate-800">طلبات تسعير العملاء</h1>
              <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleAdd}>
                + إضافة طلب جديد
              </Button>
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="بحث بـ: رقم الطلب، اسم العميل، رقم أمر العميل، المسؤول، الحالة..."
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

            <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-3 font-medium text-slate-500">رقم الطلب</th>
                    <th className="px-6 py-3 font-medium text-slate-500">العميل</th>
                    <th className="px-6 py-3 font-medium text-slate-500">رقم طلب العميل</th>
                    <th className="px-6 py-3 font-medium text-slate-500">تاريخ الطلب</th>
                    <th className="px-6 py-3 font-medium text-slate-500">تاريخ الانتهاء</th>
                    <th className="px-6 py-3 font-medium text-slate-500">تاريخ إغلاق التسعير</th>
                    <th className="px-6 py-3 font-medium text-slate-500">الحالة</th>
                    <th className="px-6 py-3 font-medium text-slate-500">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td className="p-8 text-slate-400 text-center" colSpan={7}>جاري التحميل...</td></tr>
                  ) : quotations.length === 0 ? (
                    <tr><td className="p-8 text-slate-400 text-center" colSpan={7}>لا توجد بيانات حتى الآن</td></tr>
                  ) : filteredQuotations.length === 0 ? (
                    <tr>
                      <td className="p-8 text-center" colSpan={7}>
                        <Search className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">لا توجد نتائج مطابقة</p>
                        <p className="text-slate-400 text-sm mt-1">جرّب مصطلح بحث مختلف</p>
                      </td>
                    </tr>
                  ) : (
                    filteredQuotations.map((q: any) => (
                      <tr key={q.id} className="border-t hover:bg-slate-50">
                        <td className="px-6 py-4 font-mono text-sm text-slate-700">{q.quotationNo}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{q.customerName || "—"}</td>
                        <td className="px-6 py-4 text-slate-600">{q.customerOrderNo || "—"}</td>
                        <td className="px-6 py-4 text-slate-600">{q.requestDate}</td>
                        <td className="px-6 py-4 text-slate-600">{q.expiryDate || "—"}</td>
                        <td className="px-6 py-4 text-slate-600">{q.closeDate || "—"}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(q.status)}`}>
                            {q.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleView(q)}
                              className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 font-medium bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded border border-slate-200 transition-colors"
                              title="عرض وطباعة"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              عرض
                            </button>
                            {(q.status === "تم الرد من المورد" || q.status === "مكتمل") && (
                              <button
                                onClick={() => handlePricing({ id: q.id, quotationNo: q.quotationNo })}
                                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-200 transition-colors"
                                title="تسعير العميل"
                              >
                                <DollarSign className="h-3.5 w-3.5" />
                                تسعير
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(q.id)}
                              className="text-xs text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors"
                              title="تعديل"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => { if (confirm("هل أنت متأكد من حذف هذا الطلب؟")) deleteQuotation.mutate({ id: q.id }); }}
                              className="text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200 transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {listSearch && filteredQuotations.length > 0 && (
                <div className="px-6 py-2 border-t bg-slate-50 text-xs text-slate-500">
                  {filteredQuotations.length} نتيجة من أصل {quotations.length} طلب
                </div>
              )}
            </div>

            {/* ── Add/Edit Modal ── */}
            <Dialog open={open} onOpenChange={v => { if (!v) { setOpen(false); setErrors({}); } }}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                  <DialogTitle>{editingId ? "تعديل طلب تسعير" : "إضافة طلب تسعير جديد"}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Header fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>العميل *</Label>
                      <select
                        value={header.customerId}
                        onChange={e => handleHeaderChange("customerId", e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">-- اختر العميل --</option>
                        {customers.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {errors.customerId && <p className="text-xs text-red-500">{errors.customerId}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label>المسؤول</Label>
                      <Input value={header.responsibleName} onChange={e => handleHeaderChange("responsibleName", e.target.value)} placeholder="اسم المسؤول" />
                    </div>

                    <div className="space-y-1.5">
                      <Label>رقم أمر العميل</Label>
                      <Input value={header.customerOrderNo} onChange={e => handleHeaderChange("customerOrderNo", e.target.value)} placeholder="رقم أمر الشراء" />
                    </div>

                    <div className="space-y-1.5">
                      <Label>تاريخ الطلب *</Label>
                      <Input type="date" value={header.requestDate} onChange={e => handleHeaderChange("requestDate", e.target.value)} />
                      {errors.requestDate && <p className="text-xs text-red-500">{errors.requestDate}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label>تاريخ الانتهاء</Label>
                      <Input type="date" value={header.expiryDate} onChange={e => handleHeaderChange("expiryDate", e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                      <Label>تاريخ إغلاق طلب التسعير</Label>
                      <Input type="date" value={header.closeDate} onChange={e => handleHeaderChange("closeDate", e.target.value)} />
                    </div>
                  </div>

                  {/* Items table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>بنود الطلب</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, emptyItem()])}>
                        <Plus className="h-3.5 w-3.5 ml-1" /> إضافة بند
                      </Button>
                    </div>
                    {errors.items && <p className="text-xs text-red-500">{errors.items}</p>}
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-2 py-2 font-medium text-slate-500 text-xs">كود البند</th>
                            <th className="px-2 py-2 font-medium text-slate-500 text-xs">
                              التوصيف *
                            </th>
                            <th className="px-2 py-2 font-medium text-slate-500 text-xs">PART NO</th>
                            <th className="px-2 py-2 font-medium text-slate-500 text-xs">الوحدة</th>
                            <th className="px-2 py-2 font-medium text-slate-500 text-xs">الكمية</th>
                            <th className="px-2 py-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => (
                            <ItemRow
                              key={index}
                              item={item}
                              index={index}
                              onChange={handleItemChange}
                              onRemove={i => setItems(prev => prev.filter((_, idx) => idx !== i))}
                              canRemove={items.length > 1}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {errors.server && (
                    <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                      {errors.server}
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => { setOpen(false); setErrors({}); }}>إلغاء</Button>
                  <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <><Loader2 className="h-4 w-4 ml-2 animate-spin" /> جاري الحفظ والتكويد...</> : "حفظ وتكويد البنود"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* ── View / Print Modal ── */}
            {viewQ && (
              <Dialog open={!!viewQ} onOpenChange={v => { if (!v) setViewQ(null); }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:border-none" dir="rtl">
                  <style>{`
                    @media print {
                      body > *:not(.print-area) { display: none !important; }
                      [data-radix-dialog-overlay] { display: none !important; }
                      [role="dialog"] { position: static !important; transform: none !important; box-shadow: none !important; border: none !important; max-width: 100% !important; width: 100% !important; }
                      .no-print { display: none !important; }
                    }
                  `}</style>

                  <DialogHeader className="no-print">
                    <DialogTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-slate-600" />
                      عرض طلب التسعير — {viewQ.quotationNo}
                    </DialogTitle>
                  </DialogHeader>

                  {viewLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <div className="space-y-6 py-2">
                      {/* ── Company header ── */}
                      <div className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center gap-3">
                          {companyInfo?.logoUrl && (
                            <img src={companyInfo.logoUrl} alt="logo" className="h-16 w-auto object-contain" />
                          )}
                          <div>
                            <p className="text-lg font-bold text-slate-800">{companyInfo?.name || ""}</p>
                            {companyInfo?.address && <p className="text-xs text-slate-500">{companyInfo.address}</p>}
                            {companyInfo?.phone  && <p className="text-xs text-slate-500">📞 {companyInfo.phone}</p>}
                            {companyInfo?.email  && <p className="text-xs text-slate-500">✉ {companyInfo.email}</p>}
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-xl font-bold text-[#1e3a5f]">طلب تسعير</p>
                          <p className="text-sm font-mono text-slate-600 mt-1">{viewQ.quotationNo}</p>
                        </div>
                      </div>

                      {/* ── Quotation meta ── */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <span className="font-medium text-slate-500 w-32 shrink-0">العميل:</span>
                            <span className="text-slate-800 font-semibold">{viewQ.customerName || "—"}</span>
                          </div>
                          {viewQ.customerOrderNo && (
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-500 w-32 shrink-0">رقم أمر العميل:</span>
                              <span className="text-slate-700">{viewQ.customerOrderNo}</span>
                            </div>
                          )}
                          {viewQ.responsibleName && (
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-500 w-32 shrink-0">المسؤول:</span>
                              <span className="text-slate-700">{viewQ.responsibleName}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <span className="font-medium text-slate-500 w-32 shrink-0">تاريخ الطلب:</span>
                            <span className="text-slate-700">{viewQ.requestDate}</span>
                          </div>
                          {viewQ.expiryDate && (
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-500 w-32 shrink-0">تاريخ الانتهاء:</span>
                              <span className="text-slate-700">{viewQ.expiryDate}</span>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <span className="font-medium text-slate-500 w-32 shrink-0">الحالة:</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(viewQ.status)}`}>{viewQ.status}</span>
                          </div>
                        </div>
                      </div>

                      {/* ── Items table ── */}
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">بنود الطلب</p>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm text-right">
                            <thead className="bg-[#1e3a5f] text-white">
                              <tr>
                                <th className="px-3 py-2 font-medium text-xs text-center w-8">#</th>
                                <th className="px-3 py-2 font-medium text-xs">كود البند</th>
                                <th className="px-3 py-2 font-medium text-xs">التوصيف</th>
                                <th className="px-3 py-2 font-medium text-xs" dir="ltr">PART NO</th>
                                <th className="px-3 py-2 font-medium text-xs">الوحدة</th>
                                <th className="px-3 py-2 font-medium text-xs text-center">الكمية</th>
                              </tr>
                            </thead>
                            <tbody>
                              {viewItems.map((it: any, idx: number) => (
                                <tr key={it.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                  <td className="px-3 py-2 text-xs text-slate-400 text-center">{idx + 1}</td>
                                  <td className="px-3 py-2 text-xs text-slate-600">{it.customerItemCode || "—"}</td>
                                  <td className="px-3 py-2 text-xs text-slate-800 font-medium">{it.description}</td>
                                  <td className="px-3 py-2 text-xs text-slate-500" dir="ltr">{it.partNo || "—"}</td>
                                  <td className="px-3 py-2 text-xs text-slate-500">{it.unit || "—"}</td>
                                  <td className="px-3 py-2 text-xs text-slate-700 text-center font-medium" dir="ltr">{fmtQty(it.quantity)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 text-left">إجمالي البنود: {viewItems.length}</p>
                      </div>

                      {/* ── Footer note ── */}
                      <div className="border-t pt-3 text-xs text-slate-400 text-center">
                        هذا المستند صادر إلكترونياً — {new Date().toLocaleDateString("ar-EG")}
                      </div>
                    </div>
                  )}

                  <DialogFooter className="gap-2 no-print">
                    <Button variant="outline" onClick={() => setViewQ(null)}>إغلاق</Button>
                    <Button
                      className="bg-[#1e3a5f] hover:bg-[#162d4a] flex items-center gap-2"
                      onClick={handlePrint}
                      disabled={viewLoading}
                    >
                      <Printer className="h-4 w-4" />
                      طباعة
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* ── Pricing Modal ── */}
            {pricingQ && (
              <Dialog open={!!pricingQ} onOpenChange={v => { if (!v) setPricingQ(null); }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                      تسعير العميل — {pricingQ.quotationNo}
                    </DialogTitle>
                  </DialogHeader>

                  {pricingLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <div className="space-y-4 py-2">
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm text-right">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="px-3 py-2 font-medium text-slate-500 text-xs">الكود الإداري</th>
                              <th className="px-3 py-2 font-medium text-slate-500 text-xs">التوصيف</th>
                              <th className="px-3 py-2 font-medium text-slate-500 text-xs">PART NO</th>
                              <th className="px-3 py-2 font-medium text-slate-500 text-xs">الوحدة</th>
                              <th className="px-3 py-2 font-medium text-slate-500 text-xs">الكمية</th>
                              <th className="px-3 py-2 font-medium text-slate-500 text-xs">أفضل سعر مورد</th>
                              <th className="px-3 py-2 font-medium text-slate-500 text-xs">سعر العميل</th>
                              <th className="px-3 py-2 font-medium text-slate-500 text-xs">ملاحظات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pricingItems.map((it, idx) => (
                              <tr key={it.id} className="border-t">
                                <td className="px-3 py-2">
                                  {it.internalCode ? (
                                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                                      {it.internalCode}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-300">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-700">{it.description}</td>
                                <td className="px-3 py-2 text-xs text-slate-500" dir="ltr">{it.partNo || "—"}</td>
                                <td className="px-3 py-2 text-xs text-slate-500">{it.unit || "—"}</td>
                                <td className="px-3 py-2 text-xs text-slate-500" dir="ltr">{fmtQty(it.quantity)}</td>
                                <td className="px-3 py-2 text-xs">
                                  {it.bestPrice !== null ? (
                                    <span className="text-emerald-600 font-medium">{it.bestPrice.toFixed(3)}</span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    value={it.unitPrice}
                                    onChange={e => setPricingItems(prev => prev.map((p, i) => i === idx ? { ...p, unitPrice: e.target.value } : p))}
                                    placeholder="0.000"
                                    className="h-7 text-xs w-24"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    dir="ltr"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    value={it.customerNotes}
                                    onChange={e => setPricingItems(prev => prev.map((p, i) => i === idx ? { ...p, customerNotes: e.target.value } : p))}
                                    placeholder="ملاحظات..."
                                    className="h-7 text-xs"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {pricingError && (
                        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                          {pricingError}
                        </div>
                      )}
                    </div>
                  )}

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setPricingQ(null)}>إغلاق</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSavePricing} disabled={pricingSaving || pricingLoading}>
                      {pricingSaving ? <><Loader2 className="h-4 w-4 ml-2 animate-spin" /> جاري الحفظ...</> : "حفظ الأسعار"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </AppLayout>
      );
    }
