import React, { useState, useMemo, useEffect } from "react";
  import AppLayout from "@/components/AppLayout";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
  import { Search, X, Trash2, Loader2, Truck, CheckSquare, Square, Pencil, MessageCircle, Mail, Tag, Plus } from "lucide-react";

  const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const STATUSES = ["مفتوح", "مكتمل", "ملغي"];

  interface Supplier { id: number; companyName: string; phone: string; whatsapp: string; email: string; }
  interface COItem { id: number; description: string; partNo: string; unit: string; quantity: string; unitPrice: string; }
  interface FoundCO { id: number; orderNo: string; customerName: string; customerPoNo: string; items: COItem[]; }
  interface OrderItem {
    customerOrderId: number | null; customerOrderNo: string; customerOrderItemId: number | null;
    description: string; partNo: string; unit: string; quantity: string; unitPrice: string; key: string;
  }
  interface Order {
    id: number; orderNo: string; supplierName: string; supplierEmail: string; supplierWhatsapp: string;
    orderDate: string; status: string; totalAmount: string; itemCount: number; notes: string;
  }
  interface RfqPriceItem { rfqItemId: number; description: string; partNo: string; unit: string; unitPrice: string; }
  interface RfqPriceResult { found: boolean; rfqNo: string | null; rfqSupplierId: number | null; responseStatus: string; items: RfqPriceItem[]; }

  function statusBadge(s: string) {
    if (s === "مفتوح") return "bg-blue-100 text-blue-700";
    if (s === "مكتمل") return "bg-green-100 text-green-700";
    if (s === "ملغي") return "bg-red-100 text-red-700";
    return "bg-slate-100 text-slate-600";
  }

  function buildPreviewMsg(orderNo: string, orderDate: string, supplierName: string, rfqNo: string, items: OrderItem[], notes: string): string {
    const lines: string[] = [];
    lines.push("طلب توريد رقم: " + orderNo);
    lines.push("التاريخ: " + orderDate);
    if (supplierName) lines.push("إلى: " + supplierName);
    if (rfqNo) lines.push("رقم طلب التسعير: " + rfqNo);
    lines.push(""); lines.push("البنود:");
    items.forEach((it, i) => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unitPrice) || 0;
      let line = (i + 1) + ". " + it.description;
      if (it.partNo) line += " | Part: " + it.partNo;
      line += " | كمية: " + qty;
      if (price > 0) line += " | سعر: " + price.toFixed(3);
      if (it.customerOrderNo) line += " | أمر: " + it.customerOrderNo;
      lines.push(line);
    });
    const total = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);
    if (total > 0) { lines.push(""); lines.push("الإجمالي: " + total.toFixed(3)); }
    if (notes) { lines.push(""); lines.push("ملاحظات: " + notes); }
    return lines.join("\n");
  }

  function matchRfqPrice(coItem: COItem, rfqItems: RfqPriceItem[]): string {
    const desc = (coItem.description || "").trim().toLowerCase();
    const part = (coItem.partNo || "").trim().toLowerCase();
    let match = rfqItems.find(r => r.description.trim().toLowerCase() === desc);
    if (!match && part) match = rfqItems.find(r => (r.partNo || "").trim().toLowerCase() === part);
    if (!match) match = rfqItems.find(r =>
      r.description.trim().toLowerCase().includes(desc) || desc.includes(r.description.trim().toLowerCase())
    );
    if (match && parseFloat(match.unitPrice) > 0) return parseFloat(match.unitPrice).toFixed(3);
    return "";
  }

  export default function SupplierOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [listSearch, setListSearch] = useState("");
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    const [open, setOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [loadingEdit, setLoadingEdit] = useState(false);
    const [supplierId, setSupplierId] = useState<number | "">("");
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
    const [notes, setNotes] = useState("");
    const [orderStatus, setOrderStatus] = useState("مفتوح");

    // CO search
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [foundCO, setFoundCO] = useState<FoundCO | null>(null);
    const [selectedItems, setSelectedItems] = useState<Record<number, { quantity: string; unitPrice: string; selected: boolean }>>({});
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

    // RFQ prices (session-only, not persisted)
    const [rfqLoading, setRfqLoading] = useState(false);
    const [rfqResult, setRfqResult] = useState<RfqPriceResult | null>(null);

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const [sendOpen, setSendOpen] = useState(false);
    const [sendOrder, setSendOrder] = useState<Order | null>(null);
    const [sendItems, setSendItems] = useState<OrderItem[]>([]);
    const [sendRfqNo, setSendRfqNo] = useState("");
    const [loadingSendItems, setLoadingSendItems] = useState(false);
    const [sendingWa, setSendingWa] = useState(false);
    const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

    useEffect(() => { fetchOrders(); fetchSuppliers(); }, []);

    async function fetchOrders() {
      setIsLoading(true);
      try {
        const res = await fetch(API_BASE + "/api/supplier-orders", { credentials: "include" });
        const data = await res.json();
        setOrders(Array.isArray(data) ? data as Order[] : []);
      } catch { setOrders([]); } finally { setIsLoading(false); }
    }

    async function fetchSuppliers() {
      try {
        const res = await fetch(API_BASE + "/api/suppliers", { credentials: "include" });
        const data = await res.json();
        setSuppliers(Array.isArray(data) ? data : (data.suppliers ?? []));
      } catch {}
    }

    async function fetchRfqPrices(sid: number | "", co: FoundCO | null) {
      if (!sid || !co) { setRfqResult(null); return; }
      setRfqLoading(true);
      try {
        const res = await fetch(
          API_BASE + "/api/supplier-orders/find-rfq-prices?supplierId=" + sid + "&customerOrderId=" + co.id,
          { credentials: "include" }
        );
        const data: RfqPriceResult = await res.json();
        setRfqResult(data);
        if (data.found && data.items.length > 0) {
          setSelectedItems(prev => {
            const updated = { ...prev };
            co.items.forEach(coItem => {
              const price = matchRfqPrice(coItem, data.items);
              if (price) updated[coItem.id] = { ...updated[coItem.id], unitPrice: price };
            });
            return updated;
          });
        }
      } catch { setRfqResult(null); } finally { setRfqLoading(false); }
    }

    const filteredOrders = useMemo(() => {
      const q = listSearch.trim().toLowerCase();
      if (!q) return orders;
      return orders.filter(o =>
        o.orderNo?.toLowerCase().includes(q) ||
        o.supplierName?.toLowerCase().includes(q) ||
        o.status?.toLowerCase().includes(q)
      );
    }, [orders, listSearch]);

    function resetDialog() {
      setEditId(null); setSupplierId(""); setOrderDate(new Date().toISOString().split("T")[0]);
      setNotes(""); setOrderStatus("مفتوح");
      setSearchTerm(""); setFoundCO(null); setSelectedItems({});
      setOrderItems([]); setSaveError(""); setFormErrors({}); setRfqResult(null);
    }

    function handleAdd() { resetDialog(); setOpen(true); }

    async function handleEdit(order: Order) {
      resetDialog(); setEditId(order.id); setLoadingEdit(true); setOpen(true);
      try {
        const res = await fetch(API_BASE + "/api/supplier-orders/" + order.id, { credentials: "include" });
        const data = await res.json();
        setSupplierId(data.supplierId ?? "");
        setOrderDate(data.orderDate ?? new Date().toISOString().split("T")[0]);
        setNotes(data.notes ?? ""); setOrderStatus(data.status ?? "مفتوح");
        setOrderItems((data.items ?? []).map((it: any, idx: number) => ({
          customerOrderId: it.customerOrderId ?? null, customerOrderNo: it.customerOrderNo ?? "",
          customerOrderItemId: it.customerOrderItemId ?? null, description: it.description ?? "",
          partNo: it.partNo ?? "", unit: it.unit ?? "",
          quantity: String(it.quantity ?? ""), unitPrice: String(it.unitPrice ?? ""),
          key: "loaded-" + (it.id ?? idx),
        })));
      } catch { setSaveError("فشل في جلب بيانات الطلب"); } finally { setLoadingEdit(false); }
    }

    async function handleSearchCO() {
      if (!searchTerm.trim()) return;
      setSearching(true); setSearchError(""); setFoundCO(null); setSelectedItems({}); setRfqResult(null);
      try {
        const res = await fetch(
          API_BASE + "/api/customer-orders/search?q=" + encodeURIComponent(searchTerm.trim()),
          { credentials: "include" }
        );
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) { setSearchError("لم يتم العثور على أمر شراء بهذا الرقم"); return; }
        const co = data[0];
        setFoundCO(co);
        const init: Record<number, { quantity: string; unitPrice: string; selected: boolean }> = {};
        (co.items as COItem[]).forEach(it => {
          init[it.id] = {
            quantity: String(it.quantity || ""),
            unitPrice: it.unitPrice && parseFloat(it.unitPrice) > 0 ? parseFloat(it.unitPrice).toFixed(3) : "",
            selected: false,
          };
        });
        setSelectedItems(init);
        if (supplierId) fetchRfqPrices(supplierId, co);
      } catch { setSearchError("حدث خطأ أثناء البحث"); } finally { setSearching(false); }
    }

    function handleSupplierChange(val: number | "") {
      setSupplierId(val);
      if (foundCO) fetchRfqPrices(val, foundCO);
    }

    function toggleItem(id: number) { setSelectedItems(p => ({ ...p, [id]: { ...p[id], selected: !p[id].selected } })); }
    function updateSelField(id: number, field: "quantity" | "unitPrice", v: string) {
      setSelectedItems(p => ({ ...p, [id]: { ...p[id], [field]: v } }));
    }

    function handleAddToOrder() {
      if (!foundCO) return;
      const toAdd = foundCO.items.filter(it => selectedItems[it.id]?.selected).map(it => ({
        customerOrderId: foundCO.id, customerOrderNo: foundCO.orderNo,
        customerOrderItemId: it.id, description: it.description, partNo: it.partNo, unit: it.unit,
        quantity: selectedItems[it.id]?.quantity || String(it.quantity),
        unitPrice: selectedItems[it.id]?.unitPrice || "0",
        key: foundCO.id + "-" + it.id,
      }));
      if (toAdd.length === 0) { setSearchError("يجب اختيار بند واحد على الأقل"); return; }
      setOrderItems(prev => [...prev.filter(i => i.customerOrderId !== foundCO.id), ...toAdd]);
      setFoundCO(null); setSearchTerm(""); setSearchError(""); setSelectedItems({}); setRfqResult(null);
    }

    function removeItem(key: string) { setOrderItems(prev => prev.filter(it => it.key !== key)); }
    function updateItemField(key: string, field: "quantity" | "unitPrice", v: string) {
      setOrderItems(prev => prev.map(it => it.key === key ? { ...it, [field]: v } : it));
    }

    const totalAmount = orderItems.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);
    const selectedCount = Object.values(selectedItems).filter(s => s.selected).length;
    const isEditing = editId !== null;
    const selectedSup = suppliers.find(s => s.id === Number(supplierId));

    async function handleSave() {
      const errs: Record<string, string> = {};
      if (!orderDate) errs.orderDate = "التاريخ مطلوب";
      if (orderItems.length === 0) errs.items = "يجب إضافة بند واحد على الأقل";
      if (Object.keys(errs).length) { setFormErrors(errs); return; }
      setSaving(true); setSaveError("");
      try {
        const url = editId ? API_BASE + "/api/supplier-orders/" + editId : API_BASE + "/api/supplier-orders";
        const res = await fetch(url, {
          method: editId ? "PUT" : "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierId: supplierId || null, orderDate, notes, status: orderStatus,
            items: orderItems.map((it, idx) => ({
              customerOrderId: it.customerOrderId, customerOrderNo: it.customerOrderNo,
              customerOrderItemId: it.customerOrderItemId, description: it.description,
              partNo: it.partNo, unit: it.unit,
              quantity: parseFloat(it.quantity) || 0,
              unitPrice: parseFloat(it.unitPrice) || 0,
              sortOrder: idx,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) { setSaveError(data.error ?? "فشل في الحفظ"); return; }
        setOpen(false); fetchOrders();
      } catch { setSaveError("حدث خطأ أثناء الحفظ"); } finally { setSaving(false); }
    }

    async function handleDelete(id: number) {
      if (!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
      try { await fetch(API_BASE + "/api/supplier-orders/" + id, { method: "DELETE", credentials: "include" }); fetchOrders(); }
      catch { alert("فشل في الحذف"); }
    }

    async function openSend(order: Order) {
      setSendOrder(order); setSendOpen(true); setLoadingSendItems(true); setSendResult(null); setSendingWa(false); setSendRfqNo("");
      try {
        const res = await fetch(API_BASE + "/api/supplier-orders/" + order.id, { credentials: "include" });
        const data = await res.json();
        const items = (data.items ?? []).map((it: any, idx: number) => ({
          customerOrderId: it.customerOrderId ?? null, customerOrderNo: it.customerOrderNo ?? "",
          customerOrderItemId: it.customerOrderItemId ?? null, description: it.description ?? "",
          partNo: it.partNo ?? "", unit: it.unit ?? "",
          quantity: String(it.quantity ?? ""), unitPrice: String(it.unitPrice ?? ""), key: String(it.id ?? idx),
        }));
        setSendItems(items);
        // Also fetch rfqNo for preview
        if (order.supplierId) {
          const coId = items.find((it: OrderItem) => it.customerOrderId)?.customerOrderId;
          if (coId) {
            const rfqRes = await fetch(
              API_BASE + "/api/supplier-orders/find-rfq-prices?supplierId=" + order.supplierId + "&customerOrderId=" + coId,
              { credentials: "include" }
            );
            const rfqData = await rfqRes.json();
            if (rfqData.found) setSendRfqNo(rfqData.rfqNo ?? "");
          }
        }
      } catch {} finally { setLoadingSendItems(false); }
    }

    async function doWhatsapp() {
      if (!sendOrder) return;
      setSendingWa(true); setSendResult(null);
      try {
        const res = await fetch(API_BASE + "/api/supplier-orders/" + sendOrder.id + "/send-whatsapp", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        setSendResult(res.ok
          ? { ok: true, msg: "تم إرسال الرسالة بنجاح عبر واتسآب بيزنس ✓" }
          : { ok: false, msg: data.error ?? "فشل في الإرسال" });
      } catch { setSendResult({ ok: false, msg: "حدث خطأ في الاتصال بالخادم" }); }
      finally { setSendingWa(false); }
    }

    function doEmail() {
      if (!sendOrder?.supplierEmail) { alert("لا يوجد بريد إلكتروني لهذا المورد"); return; }
      const subject = "طلب توريد " + sendOrder.orderNo;
      const body = buildPreviewMsg(sendOrder.orderNo, sendOrder.orderDate, sendOrder.supplierName, sendRfqNo, sendItems, sendOrder.notes);
      window.open("mailto:" + sendOrder.supplierEmail + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body), "_blank");
    }

    return (
      <AppLayout>
        <div className="space-y-6" dir="rtl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">طلبات توريد الموردين</h1>
            <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleAdd}>+ إضافة طلب توريد</Button>
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input type="text" value={listSearch} onChange={e => setListSearch(e.target.value)}
              placeholder="بحث بـ: رقم الطلب، اسم المورد، الحالة..."
              className="w-full rounded-lg border border-slate-300 bg-white pr-9 pl-9 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200" dir="rtl" />
            {listSearch && <button onClick={() => setListSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
          </div>

          <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-500">رقم الطلب</th>
                  <th className="px-6 py-3 font-medium text-slate-500">المورد</th>
                  <th className="px-6 py-3 font-medium text-slate-500">التاريخ</th>
                  <th className="px-6 py-3 font-medium text-slate-500">عدد البنود</th>
                  <th className="px-6 py-3 font-medium text-slate-500">الإجمالي</th>
                  <th className="px-6 py-3 font-medium text-slate-500">الحالة</th>
                  <th className="px-6 py-3 font-medium text-slate-500">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td className="p-8 text-slate-400 text-center" colSpan={7}>جاري التحميل...</td></tr>
                ) : filteredOrders.length === 0 ? (
                  <tr><td className="p-8 text-slate-400 text-center" colSpan={7}>{orders.length === 0 ? "لا توجد بيانات حتى الآن" : "لا توجد نتائج مطابقة"}</td></tr>
                ) : filteredOrders.map(order => (
                  <tr key={order.id} className="border-t hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono text-sm text-blue-700 font-bold">{order.orderNo}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{order.supplierName || "—"}</td>
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
                        <button onClick={() => openSend(order)}
                          className="text-xs text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded border border-green-200 transition-colors" title="إرسال">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleEdit(order)}
                          className="text-xs text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors" title="تعديل">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(order.id)}
                          className="text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200 transition-colors" title="حذف">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add/Edit Dialog */}
          <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {isEditing ? <><Pencil className="h-5 w-5 text-blue-600" /> تعديل طلب التوريد</> : <><Truck className="h-5 w-5 text-[#1e3a5f]" /> إضافة طلب توريد جديد</>}
                </DialogTitle>
              </DialogHeader>

              {loadingEdit ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>المورد</Label>
                      <select value={supplierId}
                        onChange={e => handleSupplierChange(e.target.value ? Number(e.target.value) : "")}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200 mt-1">
                        <option value="">اختر المورد...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.companyName}</option>)}
                      </select>
                      {selectedSup && <p className="text-xs text-slate-500 mt-1">واتسآب: {selectedSup.whatsapp || selectedSup.phone} · إيميل: {selectedSup.email}</p>}
                    </div>
                    <div>
                      <Label>تاريخ الطلب *</Label>
                      <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="mt-1" />
                      {formErrors.orderDate && <p className="text-red-500 text-xs mt-1">{formErrors.orderDate}</p>}
                    </div>
                  </div>

                  <div>
                    <Label>ملاحظات</Label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="أي تعليمات إضافية للمورد..."
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200 mt-1 min-h-[60px]" />
                  </div>

                  {isEditing && (
                    <div>
                      <Label>الحالة</Label>
                      <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm mt-1">
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}

                  {/* CO Search */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                      <span className="bg-[#1e3a5f] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
                      ابحث برقم أمر الشراء للعميل
                    </p>
                    <div className="flex gap-2">
                      <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSearchCO()}
                        placeholder="أدخل رقم أمر الشراء (CO-...) أو رقم PO للعميل..."
                        className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200" dir="rtl" />
                      <Button variant="outline" onClick={handleSearchCO} disabled={searching || !searchTerm.trim()}>
                        {searching ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                        بحث
                      </Button>
                    </div>
                    {searchError && <p className="text-red-500 text-xs">{searchError}</p>}

                    {rfqLoading && (
                      <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                        <Loader2 className="animate-spin h-4 w-4" /> جاري جلب أسعار طلب التسعير...
                      </div>
                    )}
                    {!rfqLoading && rfqResult?.found && (
                      <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                        <Tag className="h-4 w-4 text-green-600 shrink-0" />
                        تم جلب الأسعار من طلب التسعير: <strong className="font-mono">{rfqResult.rfqNo}</strong>
                      </div>
                    )}
                    {!rfqLoading && rfqResult && !rfqResult.found && supplierId && foundCO && (
                      <div className="text-amber-600 text-xs bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                        لا يوجد طلب تسعير مرتبط — يمكنك إدخال الأسعار يدوياً
                      </div>
                    )}

                    {foundCO && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500">
                          أمر: <strong>{foundCO.orderNo}</strong>
                          {foundCO.customerPoNo && <> | PO: <strong>{foundCO.customerPoNo}</strong></>}
                          {foundCO.customerName && <> | العميل: {foundCO.customerName}</>}
                        </p>
                        <p className="text-xs font-medium text-slate-600">اختر البنود المطلوبة:</p>
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {foundCO.items.map(it => {
                            const sel = selectedItems[it.id];
                            return (
                              <div key={it.id} onClick={() => toggleItem(it.id)}
                                className={"rounded-lg border px-3 py-2 cursor-pointer transition-all " +
                                  (sel?.selected ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50")}>
                                <div className="flex items-start gap-2">
                                  {sel?.selected ? <CheckSquare className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" /> : <Square className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 leading-tight">{it.description}</p>
                                    <div className="flex gap-3 mt-0.5 text-xs text-slate-500">
                                      {it.partNo && <span>Part: {it.partNo}</span>}
                                      {it.unit && <span>وحدة: {it.unit}</span>}
                                    </div>
                                  </div>
                                </div>
                                {sel?.selected && (
                                  <div className="mt-2 grid grid-cols-2 gap-2" onClick={e => e.stopPropagation()}>
                                    <div>
                                      <label className="text-xs text-slate-500">الكمية</label>
                                      <input type="number" value={sel.quantity}
                                        onChange={e => updateSelField(it.id, "quantity", e.target.value)}
                                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm mt-0.5 focus:outline-none focus:border-blue-400" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-500 flex items-center gap-1">
                                        سعر الوحدة
                                        {rfqResult?.found && sel.unitPrice && parseFloat(sel.unitPrice) > 0 && (
                                          <span className="text-green-600 font-medium">(من التسعير ✓)</span>
                                        )}
                                      </label>
                                      <input type="number" value={sel.unitPrice}
                                        onChange={e => updateSelField(it.id, "unitPrice", e.target.value)}
                                        className={"w-full rounded border px-2 py-1 text-sm mt-0.5 focus:outline-none " +
                                          (rfqResult?.found && sel.unitPrice && parseFloat(sel.unitPrice) > 0
                                            ? "border-green-400 bg-green-50 focus:border-green-500 text-green-800"
                                            : "border-slate-300 focus:border-blue-400")} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xs text-slate-500">{selectedCount} بند محدد</span>
                          <Button size="sm" onClick={handleAddToOrder} disabled={selectedCount === 0} className="bg-[#1e3a5f] hover:bg-[#162d4a]">
                            <Plus className="h-4 w-4 mr-1" /> إضافة للطلب
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order Items */}
                  {orderItems.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                        <span className="bg-[#1e3a5f] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
                        بنود الطلب ({orderItems.length})
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm text-right">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="px-3 py-2 text-slate-500 font-medium">البيان</th>
                              <th className="px-3 py-2 text-slate-500 font-medium">أمر العميل</th>
                              <th className="px-3 py-2 text-slate-500 font-medium w-24">الكمية</th>
                              <th className="px-3 py-2 text-slate-500 font-medium w-28">سعر الوحدة</th>
                              <th className="px-3 py-2 text-slate-500 font-medium w-24">الإجمالي</th>
                              <th className="px-2 py-2 w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderItems.map(it => (
                              <tr key={it.key} className="border-t">
                                <td className="px-3 py-2">
                                  <p className="font-medium text-slate-800">{it.description}</p>
                                  {it.partNo && <p className="text-xs text-slate-400">Part: {it.partNo}</p>}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-500 font-mono">{it.customerOrderNo || "—"}</td>
                                <td className="px-3 py-2">
                                  <input type="number" value={it.quantity}
                                    onChange={e => updateItemField(it.key, "quantity", e.target.value)}
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-400" />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" value={it.unitPrice}
                                    onChange={e => updateItemField(it.key, "unitPrice", e.target.value)}
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:border-blue-400" />
                                </td>
                                <td className="px-3 py-2 text-slate-700 font-medium text-xs">
                                  {((parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0)).toFixed(3)}
                                </td>
                                <td className="px-2 py-2">
                                  <button onClick={() => removeItem(it.key)} className="text-red-400 hover:text-red-600">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t bg-slate-50">
                            <tr>
                              <td colSpan={4} className="px-3 py-2 text-right font-semibold text-slate-700">الإجمالي</td>
                              <td className="px-3 py-2 font-bold text-slate-800">{totalAmount.toFixed(3)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {formErrors.items && <p className="text-red-500 text-xs">{formErrors.items}</p>}
                    </div>
                  )}

                  {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
                </div>
              )}

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-[#1e3a5f] hover:bg-[#162d4a]">
                  {saving ? <><Loader2 className="animate-spin h-4 w-4 mr-2" /> جاري الحفظ...</> : "حفظ الطلب"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Send Dialog */}
          <Dialog open={sendOpen} onOpenChange={v => { if (!v) setSendOpen(false); }}>
            <DialogContent className="max-w-lg" dir="rtl">
              <DialogHeader><DialogTitle>إرسال طلب التوريد</DialogTitle></DialogHeader>
              {sendOrder && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-sm">
                    <p><span className="text-slate-500">رقم الطلب: </span><strong className="font-mono">{sendOrder.orderNo}</strong></p>
                    <p><span className="text-slate-500">المورد: </span>{sendOrder.supplierName || "—"}</p>
                    {sendRfqNo && <p><span className="text-slate-500">رقم طلب التسعير: </span><strong className="font-mono text-amber-700">{sendRfqNo}</strong></p>}
                    <p><span className="text-slate-500">واتسآب: </span>{sendOrder.supplierWhatsapp || "—"}</p>
                    <p><span className="text-slate-500">إيميل: </span>{sendOrder.supplierEmail || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-1">معاينة الرسالة:</p>
                    {loadingSendItems ? (
                      <div className="flex justify-center py-4"><Loader2 className="animate-spin h-5 w-5 text-slate-400" /></div>
                    ) : (
                      <pre className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto font-sans">
                        {buildPreviewMsg(sendOrder.orderNo, sendOrder.orderDate, sendOrder.supplierName, sendRfqNo, sendItems, sendOrder.notes)}
                      </pre>
                    )}
                  </div>
                  {sendResult && (
                    <p className={"text-sm font-medium " + (sendResult.ok ? "text-green-600" : "text-red-500")}>{sendResult.msg}</p>
                  )}
                  <div className="flex gap-3">
                    <Button onClick={doWhatsapp} disabled={sendingWa || !sendOrder.supplierWhatsapp}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                      {sendingWa ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <MessageCircle className="h-4 w-4 mr-2" />}
                      واتسآب بيزنس
                    </Button>
                    <Button variant="outline" onClick={doEmail} disabled={!sendOrder.supplierEmail} className="flex-1">
                      <Mail className="h-4 w-4 mr-2" /> إيميل
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    );
  }
  