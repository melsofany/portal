import React, { useState, useMemo, useEffect } from "react";
  import AppLayout from "@/components/AppLayout";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
  import { Search, X, Plus, Trash2, Loader2, Package, CheckSquare, Square, Pencil } from "lucide-react";

  const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

  const STATUSES = ["مفتوح", "مكتمل", "ملغي"];

  interface OrderItem {
    quotationId: number | null;
    quotationNo: string;
    quotationItemId: number | null;
    description: string;
    partNo: string;
    unit: string;
    quantity: string;
    unitPrice: string;
    key: string;
  }

  interface Order {
    id: number;
    orderNo: string;
    customerPoNo: string;
    customerName: string;
    orderDate: string;
    status: string;
    totalAmount: string;
    itemCount: number;
  }

  interface CQItem {
    id: number;
    description: string;
    partNo: string;
    unit: string;
    quantity: string;
    unitPrice: string;
  }

  interface FoundCQ {
    id: number;
    quotationNo: string;
    customerName: string;
    items: CQItem[];
  }

  function statusBadge(s: string) {
    if (s === "مفتوح") return "bg-blue-100 text-blue-700";
    if (s === "مكتمل") return "bg-green-100 text-green-700";
    if (s === "ملغي") return "bg-red-100 text-red-700";
    return "bg-slate-100 text-slate-600";
  }

  export default function CustomerOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [listSearch, setListSearch] = useState("");

    // Dialog state
    const [open, setOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [loadingEdit, setLoadingEdit] = useState(false);
    const [customerPoNo, setCustomerPoNo] = useState("");
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
    const [notes, setNotes] = useState("");
    const [orderStatus, setOrderStatus] = useState("مفتود");

    // Quotation search
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [foundCQ, setFoundCQ] = useState<FoundCQ | null>(null);
    const [selectedItems, setSelectedItems] = useState<Record<number, { quantity: string; unitPrice: string; selected: boolean }>>({});

    // Order items
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    useEffect(() => { fetchOrders(); }, []);

    async function fetchOrders() {
      setIsLoading(true);
      try {
        const res = await fetch(API_BASE + "/api/customer-orders", { credentials: "include" });
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch { setOrders([]); }
      finally { setIsLoading(false); }
    }

    const filteredOrders = useMemo(() => {
      const q = listSearch.trim().toLowerCase();
      if (!q) return orders;
      return orders.filter(o =>
        o.orderNo?.toLowerCase().includes(q) ||
        o.customerPoNo?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.status?.toLowerCase().includes(q)
      );
    }, [orders, listSearch]);

    function resetDialog() {
      setEditId(null);
      setCustomerPoNo("");
      setOrderDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setOrderStatus("مفتوح");
      setSearchTerm(""); setFoundCQ(null); setSelectedItems({});
      setOrderItems([]); setSaveError(""); setFormErrors({});
    }

    function handleAdd() {
      resetDialog();
      setOpen(true);
    }

    async function handleEdit(order: Order) {
      resetDialog();
      setEditId(order.id);
      setLoadingEdit(true);
      setOpen(true);
      try {
        const res = await fetch(API_BASE + "/api/customer-orders/" + order.id, { credentials: "include" });
        const data = await res.json();
        setCustomerPoNo(data.customerPoNo ?? "");
        setOrderDate(data.orderDate ?? new Date().toISOString().split("T")[0]);
        setNotes(data.notes ?? "");
        setOrderStatus(data.status ?? "مفتوح");
        const loadedItems: OrderItem[] = (data.items ?? []).map((it: any, idx: number) => ({
          quotationId: it.quotationId ?? null,
          quotationNo: it.quotationNo ?? "",
          quotationItemId: it.quotationItemId ?? null,
          description: it.description ?? "",
          partNo: it.partNo ?? "",
          unit: it.unit ?? "",
          quantity: String(it.quantity ?? ""),
          unitPrice: String(it.unitPrice ?? ""),
          key: "loaded-" + (it.id ?? idx),
        }));
        setOrderItems(loadedItems);
      } catch { setSaveError("فشل في جلب بيانات الأمر"); }
      finally { setLoadingEdit(false); }
    }

    async function handleSearch() {
      if (!searchTerm.trim()) return;
      setSearching(true); setSearchError(""); setFoundCQ(null); setSelectedItems({});
      try {
        const res = await fetch(
          API_BASE + "/api/customer-quotations/search?q=" + encodeURIComponent(searchTerm.trim()),
          { credentials: "include" }
        );
        const data = await res.json();
        if (!data || (Array.isArray(data) && data.length === 0)) {
          setSearchError("لم يتم العثور على طلب تسعير بهذا الرقم");
          return;
        }
        const cq = Array.isArray(data) ? data[0] : data;
        setFoundCQ(cq);
        const init: Record<number, { quantity: string; unitPrice: string; selected: boolean }> = {};
        (cq.items as CQItem[]).forEach(it => {
          init[it.id] = {
            quantity: String(it.quantity || ""),
            unitPrice: it.unitPrice && parseFloat(it.unitPrice) > 0 ? parseFloat(it.unitPrice).toFixed(3) : "",
            selected: false,
          };
        });
        setSelectedItems(init);
      } catch { setSearchError("حدث خطأ أثناء البحث"); }
      finally { setSearching(false); }
    }

    function toggleItem(id: number) {
      setSelectedItems(p => ({ ...p, [id]: { ...p[id], selected: !p[id].selected } }));
    }

    function updateSelField(id: number, field: "quantity" | "unitPrice", v: string) {
      setSelectedItems(p => ({ ...p, [id]: { ...p[id], [field]: v } }));
    }

    function handleAddToOrder() {
      if (!foundCQ) return;
      const toAdd = foundCQ.items
        .filter(it => selectedItems[it.id]?.selected)
        .map(it => ({
          quotationId: foundCQ.id,
          quotationNo: foundCQ.quotationNo,
          quotationItemId: it.id,
          description: it.description,
          partNo: it.partNo,
          unit: it.unit,
          quantity: selectedItems[it.id]?.quantity || String(it.quantity),
          unitPrice: selectedItems[it.id]?.unitPrice || "0",
          key: foundCQ.id + "-" + it.id,
        }));
      if (toAdd.length === 0) { setSearchError("يجب اختيار بند واحد على الأقل"); return; }
      setOrderItems(prev => {
        const filtered = prev.filter(item => item.quotationId !== foundCQ.id);
        return [...filtered, ...toAdd];
      });
      setFoundCQ(null); setSearchTerm(""); setSearchError(""); setSelectedItems({});
    }

    function removeItem(key: string) {
      setOrderItems(prev => prev.filter(it => it.key !== key));
    }

    function updateItemField(key: string, field: "quantity" | "unitPrice", v: string) {
      setOrderItems(prev => prev.map(it => it.key === key ? { ...it, [field]: v } : it));
    }

    const totalAmount = orderItems.reduce((s, it) =>
      s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0
    );

    async function handleSave() {
      const errs: Record<string, string> = {};
      if (!customerPoNo.trim()) errs.customerPoNo = "رقم أمر الشراء مطلوب";
      if (!orderDate) errs.orderDate = "التاريخ مطلوب";
      if (orderItems.length === 0) errs.items = "يجب إضافة بند واحد على الأقل";
      if (Object.keys(errs).length) { setFormErrors(errs); return; }

      setSaving(true); setSaveError("");
      const payload = {
        customerPoNo, orderDate, notes, status: orderStatus,
        items: orderItems.map((it, idx) => ({
          quotationId: it.quotationId, quotationNo: it.quotationNo,
          quotationItemId: it.quotationItemId, description: it.description,
          partNo: it.partNo, unit: it.unit,
          quantity: parseFloat(it.quantity) || 0,
          unitPrice: parseFloat(it.unitPrice) || 0,
          sortOrder: idx,
        })),
      };

      try {
        const url = editId
          ? API_BASE + "/api/customer-orders/" + editId
          : API_BASE + "/api/customer-orders";
        const method = editId ? "PUT" : "POST";
        const res = await fetch(url, {
          method, credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) { setSaveError(data.error ?? "فشل في الحفظ"); return; }
        setOpen(false); fetchOrders();
      } catch { setSaveError("حدث خطأ أثناء الحفظ"); }
      finally { setSaving(false); }
    }

    async function handleDelete(id: number) {
      if (!confirm("هل أنت متأكد من حذف هذا الأمر؟")) return;
      try {
        await fetch(API_BASE + "/api/customer-orders/" + id, { method: "DELETE", credentials: "include" });
        fetchOrders();
      } catch { alert("فشل في الحذف"); }
    }

    const selectedCount = Object.values(selectedItems).filter(s => s.selected).length;
    const isEditing = editId !== null;

    return (
      <AppLayout>
        <div className="space-y-6" dir="rtl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">أوامر شراء العملاء</h1>
            <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleAdd}>
              + إضافة أمر شراء
            </Button>
          </div>

          {/* List Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text" value={listSearch} onChange={e => setListSearch(e.target.value)}
              placeholder="بحث بـ: رقم الأمر، رقم PO العميل، اسم العميل، الحالة..."
              className="w-full rounded-lg border border-slate-300 bg-white pr-9 pl-9 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
              dir="rtl"
            />
            {listSearch && (
              <button onClick={() => setListSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Orders Table */}
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-500">رقم الأمر</th>
                  <th className="px-6 py-3 font-medium text-slate-500">رقم PO العميل</th>
                  <th className="px-6 py-3 font-medium text-slate-500">العميل</th>
                  <th className="px-6 py-3 font-medium text-slate-500">التاريخ</th>
                  <th className="px-6 py-3 font-medium text-slate-500">عدد البنود</th>
                  <th className="px-6 py-3 font-medium text-slate-500">القيمة الإجمالية</th>
                  <th className="px-6 py-3 font-medium text-slate-500">الحالة</th>
                  <th className="px-6 py-3 font-medium text-slate-500">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td className="p-8 text-slate-400 text-center" colSpan={8}>جاري التحميل...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td className="p-8 text-slate-400 text-center" colSpan={8}>لا توجد بيانات حتى الآن</td></tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td className="p-8 text-center" colSpan={8}>
                      <Search className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">لا توجد نتائج مطابقة</p>
                    </td>
                  </tr>
                ) : filteredOrders.map(order => (
                  <tr key={order.id} className="border-t hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono text-sm text-blue-700 font-bold">{order.orderNo}</td>
                    <td className="px-6 py-4 text-slate-700">{order.customerPoNo || "—"}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{order.customerName || "—"}</td>
                    <td className="px-6 py-4 text-slate-600">{order.orderDate}</td>
                    <td className="px-6 py-4 text-slate-600 text-center">{order.itemCount ?? 0}</td>
                    <td className="px-6 py-4 text-slate-700 font-medium">
                      {parseFloat(order.totalAmount || "0") > 0
                        ? parseFloat(order.totalAmount).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " + statusBadge(order.status)}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleEdit(order)}
                          className="text-xs text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors"
                          title="تعديل"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200 transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listSearch && filteredOrders.length > 0 && (
              <div className="px-6 py-2 border-t bg-slate-50 text-xs text-slate-500">
                {filteredOrders.length} نتيجة من أصل {orders.length} أمر
              </div>
            )}
          </div>

          {/* Add/Edit Dialog */}
          <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {isEditing
                    ? <><Pencil className="h-5 w-5 text-[#1e3a5f]" />تعديل أمر شراء</>
                    : <><Package className="h-5 w-5 text-[#1e3a5f]" />إضافة أمر شراء جديد</>}
                </DialogTitle>
              </DialogHeader>

              {loadingEdit ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
                  <span className="mr-3 text-slate-500">جاري تحميل بيانات الأمر...</span>
                </div>
              ) : (
                <div className="space-y-5 py-2">
                  {/* Header fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border">
                    <div className="space-y-1.5">
                      <Label>رقم أمر الشراء (الوارد من العميل) *</Label>
                      <Input
                        value={customerPoNo}
                        onChange={e => { setCustomerPoNo(e.target.value); setFormErrors(p => ({ ...p, customerPoNo: "" })); }}
                        placeholder="مثال: PO-2025-001"
                        dir="ltr"
                      />
                      {formErrors.customerPoNo && <p className="text-xs text-red-500">{formErrors.customerPoNo}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label>تاريخ الأمر *</Label>
                      <Input
                        type="date" value={orderDate}
                        onChange={e => { setOrderDate(e.target.value); setFormErrors(p => ({ ...p, orderDate: "" })); }}
                      />
                      {formErrors.orderDate && <p className="text-xs text-red-500">{formErrors.orderDate}</p>}
                    </div>
                    {isEditing && (
                      <div className="space-y-1.5">
                        <Label>الحالة</Label>
                        <select
                          value={orderStatus}
                          onChange={e => setOrderStatus(e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label>ملاحظات (اختياري)</Label>
                      <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي ملاحظات إضافية..." />
                    </div>
                  </div>

                  {/* Quotation search */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                      <Label className="text-base font-semibold text-slate-700">ابحث برقم طلب تسعير العميل لإضافة بنود</Label>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          type="text" value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleSearch()}
                          placeholder="أدخل رقم طلب التسعير (CQ-...)"
                          className="w-full rounded-lg border border-slate-300 bg-white pr-9 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                          dir="ltr"
                        />
                      </div>
                      <Button onClick={handleSearch} disabled={searching || !searchTerm.trim()} className="bg-[#1e3a5f] hover:bg-[#162d4a]">
                        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "بحث"}
                      </Button>
                    </div>
                    {searchError && <p className="text-sm text-red-500">{searchError}</p>}

                    {/* Found CQ results */}
                    {foundCQ && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-blue-50 px-4 py-2.5 border-b flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-blue-800">{foundCQ.quotationNo}</span>
                            {foundCQ.customerName && <span className="text-blue-600 text-sm mr-2">— {foundCQ.customerName}</span>}
                          </div>
                          <span className="text-xs text-blue-500">{foundCQ.items.length} بند</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-right">
                            <thead className="bg-slate-50 border-b">
                              <tr>
                                <th className="px-3 py-2 w-8"></th>
                                <th className="px-3 py-2 font-medium text-slate-500 text-xs">التوصيف</th>
                                <th className="px-3 py-2 font-medium text-slate-500 text-xs">PART NO</th>
                                <th className="px-3 py-2 font-medium text-slate-500 text-xs">الوحدة</th>
                                <th className="px-3 py-2 font-medium text-slate-500 text-xs">الكمية</th>
                                <th className="px-3 py-2 font-medium text-slate-500 text-xs">سعر الوحدة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {foundCQ.items.map(it => {
                                const sel = selectedItems[it.id];
                                return (
                                  <tr
                                    key={it.id}
                                    className={"border-t transition-colors cursor-pointer " + (sel?.selected ? "bg-blue-50" : "hover:bg-slate-50")}
                                    onClick={() => toggleItem(it.id)}
                                  >
                                    <td className="px-3 py-2 text-center">
                                      {sel?.selected
                                        ? <CheckSquare className="h-4 w-4 text-blue-600 mx-auto" />
                                        : <Square className="h-4 w-4 text-slate-400 mx-auto" />}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-700">{it.description}</td>
                                    <td className="px-3 py-2 text-xs text-slate-500" dir="ltr">{it.partNo || "—"}</td>
                                    <td className="px-3 py-2 text-xs text-slate-500">{it.unit || "—"}</td>
                                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                      <Input
                                        value={sel?.quantity ?? String(it.quantity)}
                                        onChange={e => updateSelField(it.id, "quantity", e.target.value)}
                                        className="h-7 text-xs w-20" type="number" min="0" step="0.001" dir="ltr"
                                      />
                                    </td>
                                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                      <Input
                                        value={sel?.unitPrice ?? ""}
                                        onChange={e => updateSelField(it.id, "unitPrice", e.target.value)}
                                        placeholder="0.000"
                                        className="h-7 text-xs w-24" type="number" min="0" step="0.001" dir="ltr"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="p-3 border-t bg-slate-50 flex justify-between items-center">
                          <span className="text-xs text-slate-500">{selectedCount} بند محدد</span>
                          <Button size="sm" onClick={handleAddToOrder} disabled={selectedCount === 0} className="bg-[#1e3a5f] hover:bg-[#162d4a]">
                            <Plus className="h-3.5 w-3.5 ml-1" />
                            إضافة للأمر
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order items summary */}
                  {orderItems.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                        <Label className="text-base font-semibold text-slate-700">
                          بنود الأمر ({orderItems.length})
                        </Label>
                        <span className="mr-auto text-sm font-semibold text-slate-700">
                          الإجمالي: {totalAmount.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {formErrors.items && <p className="text-xs text-red-500">{formErrors.items}</p>}
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-right">
                            <thead className="bg-slate-50 border-b">
                              <tr>
                                <th className="px-3 py-2 font-medium text-slate-500 text-xs">طلب التسعير</th>
                                <th className="px-3 py-2 font-medium text-slate-500 text-xs">التوصيف</th>
                                <th className="px-3 py-2 font-medium text-slate-500 text-xs">الوحدة</th>
                                <th className="px-3 py-2 font-medium text-slate-500 text-xs">الكمية</th>
                                <th className="px-3 py-2 font-medium text-slate-500 text-xs">سعر الوحدة</th>
                                <th className="px-3 py-2 font-medium text-slate-500 text-xs">الإجمالي</th>
                                <th className="px-3 py-2 w-8"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderItems.map(it => {
                                const qty = parseFloat(it.quantity) || 0;
                                const price = parseFloat(it.unitPrice) || 0;
                                const total = qty * price;
                                return (
                                  <tr key={it.key} className="border-t hover:bg-slate-50">
                                    <td className="px-3 py-2 text-xs font-mono text-blue-600">{it.quotationNo || "—"}</td>
                                    <td className="px-3 py-2 text-xs text-slate-700">{it.description}</td>
                                    <td className="px-3 py-2 text-xs text-slate-500">{it.unit || "—"}</td>
                                    <td className="px-3 py-2">
                                      <Input
                                        value={it.quantity}
                                        onChange={e => updateItemField(it.key, "quantity", e.target.value)}
                                        className="h-7 text-xs w-20" type="number" min="0" step="0.001" dir="ltr"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <Input
                                        value={it.unitPrice}
                                        onChange={e => updateItemField(it.key, "unitPrice", e.target.value)}
                                        className="h-7 text-xs w-24" type="number" min="0" step="0.001" dir="ltr"
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-xs font-medium text-slate-700">
                                      {total > 0 ? total.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <button onClick={() => removeItem(it.key)} className="text-red-400 hover:text-red-600">
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                        يمكنك البحث عن طلب تسعير آخر وإضافة بنوده أيضاً
                      </p>
                    </div>
                  )}

                  {saveError && (
                    <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                      {saveError}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleSave} disabled={saving || loadingEdit}>
                  {saving
                    ? <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري الحفظ...</>
                    : isEditing ? "حفظ التعديلات" : "حفظ الأمر"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    );
  }
  