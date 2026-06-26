import React, { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Loader2,
  CreditCard,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface SupplierOrder {
  id: number;
  orderNo: string;
  supplierId: number | null;
  supplierName: string;
  orderDate: string;
  status: string;
  totalAmount: string;
  itemCount: number;
  notes: string;
}

interface SupplierPaymentMethod {
  id: number;
  supplierId: number;
  type: string;
  walletType: string | null;
  ownerName: string | null;
  phone: string | null;
  bankName: string | null;
  accountNumber: string | null;
}

interface SupplierPayment {
  id: number;
  paymentNo: string;
  supplierOrderId: number;
  orderNo: string;
  supplierName: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNo: string;
  receiptFileName: string;
  receiptFileType: string;
  notes: string;
  status: string;
  createdAt: string;
}

function paymentMethodLabel(m: SupplierPaymentMethod): string {
  if (m.type === "cash") return "نقدي" + (m.ownerName ? ` — ${m.ownerName}` : "");
  if (m.type === "wallet") return `${m.walletType ?? "محفظة إلكترونية"} — ${m.ownerName ?? ""}${m.phone ? ` (${m.phone})` : ""}`;
  if (m.type === "instapay") return `انستاباي — ${m.ownerName ?? ""}${m.phone ? ` (${m.phone})` : ""}`;
  if (m.type === "bank") return `${m.bankName ?? "بنك"} — ${m.ownerName ?? ""}${m.accountNumber ? ` / ${m.accountNumber}` : ""}`;
  return m.type;
}

function statusBadge(s: string) {
  if (s === "مدفوع") return "bg-green-100 text-green-700";
  if (s === "ملغي") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function orderStatusBadge(s: string) {
  if (s === "مفتوح") return "bg-blue-100 text-blue-700";
  if (s === "مكتمل") return "bg-green-100 text-green-700";
  if (s === "ملغي") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function fmt(v: string | number) {
  const n = parseFloat(String(v));
  if (isNaN(n)) return "0.000";
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export default function FinancePage() {
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  // dialog state
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [existingPaymentNo, setExistingPaymentNo] = useState("");
  const [checkingPaid, setCheckingPaid] = useState(false);

  const [supplierPaymentMethods, setSupplierPaymentMethods] = useState<SupplierPaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<{ data: string; name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [viewPayment, setViewPayment] = useState<SupplierPayment | null>(null);
  const [receiptData, setReceiptData] = useState("");
  const [receiptLoading, setReceiptLoading] = useState(false);

  async function loadPayments() {
    setIsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/supplier-payments`, { credentials: "include" });
      if (r.ok) setPayments(await r.json());
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadPayments(); }, []);

  async function openDialog() {
    setOpen(true);
    setOrdersLoading(true);
    setSelectedOrder(null);
    setAlreadyPaid(false);
    setExistingPaymentNo("");
    setAmount("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("");
    setReferenceNo("");
    setNotes("");
    setReceiptFile(null);
    setSaveError("");
    setOrderSearch("");
    setSupplierPaymentMethods([]);
    try {
      const r = await fetch(`${API_BASE}/api/supplier-orders`, { credentials: "include" });
      if (r.ok) setOrders(await r.json());
    } finally {
      setOrdersLoading(false);
    }
  }

  async function selectOrder(order: SupplierOrder) {
    setSelectedOrder(order);
    setAmount(parseFloat(order.totalAmount).toFixed(3));
    setCheckingPaid(true);
    setAlreadyPaid(false);
    setExistingPaymentNo("");
    setSupplierPaymentMethods([]);
    setPaymentMethod("");

    const checks: Promise<void>[] = [];

    // Check if already paid
    checks.push(
      fetch(`${API_BASE}/api/supplier-payments/check/${order.id}`, { credentials: "include" })
        .then(async (r) => {
          if (r.ok) {
            const data = await r.json();
            setAlreadyPaid(data.alreadyPaid);
            if (data.alreadyPaid && data.payments?.length > 0) {
              setExistingPaymentNo(data.payments[0].paymentNo);
            }
          }
        })
        .finally(() => setCheckingPaid(false))
    );

    // Fetch supplier payment methods if supplierId is known
    if (order.supplierId) {
      setLoadingMethods(true);
      checks.push(
        fetch(`${API_BASE}/api/suppliers/${order.supplierId}/payment-methods`, { credentials: "include" })
          .then(async (r) => {
            if (r.ok) {
              const methods: SupplierPaymentMethod[] = await r.json();
              setSupplierPaymentMethods(methods);
              if (methods.length > 0) {
                setPaymentMethod(paymentMethodLabel(methods[0]));
              }
            }
          })
          .finally(() => setLoadingMethods(false))
      );
    }

    await Promise.all(checks);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setReceiptFile({ data: (ev.target?.result as string) ?? "", name: file.name, type: file.type });
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!selectedOrder) { setSaveError("يرجى اختيار أمر الشراء"); return; }
    if (!paymentDate) { setSaveError("تاريخ الدفع مطلوب"); return; }
    if (!referenceNo.trim()) { setSaveError("رقم الإيصال / المرجع مطلوب"); return; }
    if (!paymentMethod) { setSaveError("يرجى اختيار طريقة الدفع"); return; }
    setSaving(true);
    setSaveError("");
    try {
      const r = await fetch(`${API_BASE}/api/supplier-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supplierOrderId: selectedOrder.id,
          amount,
          paymentDate,
          paymentMethod,
          referenceNo: referenceNo.trim(),
          receiptFileData: receiptFile?.data ?? "",
          receiptFileName: receiptFile?.name ?? "",
          receiptFileType: receiptFile?.type ?? "",
          notes,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setSaveError(data.error ?? "فشل في تسجيل الدفعة"); return; }
      setOpen(false);
      loadPayments();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/api/supplier-payments/${deleteId}`, { method: "DELETE", credentials: "include" });
      setDeleteId(null);
      loadPayments();
    } finally {
      setDeleting(false);
    }
  }

  async function openReceipt(payment: SupplierPayment) {
    setViewPayment(payment);
    setReceiptData("");
    if (payment.receiptFileName) {
      setReceiptLoading(true);
      try {
        const r = await fetch(`${API_BASE}/api/supplier-payments/${payment.id}`, { credentials: "include" });
        if (r.ok) { const d = await r.json(); setReceiptData(d.receiptFileData ?? ""); }
      } finally {
        setReceiptLoading(false);
      }
    }
  }

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.paymentNo.toLowerCase().includes(q) ||
      p.orderNo.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q) ||
      (p.referenceNo ?? "").toLowerCase().includes(q)
    );
  });

  const filteredOrders = orders.filter((o) => {
    const q = orderSearch.toLowerCase();
    return o.orderNo.toLowerCase().includes(q) || o.supplierName.toLowerCase().includes(q);
  });

  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-6" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">الماليات — دفع الموردين</h1>
            <p className="text-slate-500 text-sm mt-0.5">تسجيل المدفوعات لأوامر الشراء الصادرة</p>
          </div>
          <Button onClick={openDialog} className="bg-[#1e3a5f] hover:bg-[#162d4a] gap-2">
            <CreditCard className="h-4 w-4" />
            دفعة جديدة
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-5">
            <p className="text-xs text-slate-500 font-medium">إجمالي المدفوعات</p>
            <p className="text-2xl font-bold text-[#1e3a5f] mt-1">{fmt(totalPaid)}</p>
            <p className="text-xs text-slate-400 mt-0.5">جنيه مصري</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-5">
            <p className="text-xs text-slate-500 font-medium">عدد الدفعات</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{payments.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">دفعة مسجلة</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-5">
            <p className="text-xs text-slate-500 font-medium">موردين تم دفعهم</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {new Set(payments.map((p) => p.supplierName).filter(Boolean)).size}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">مورد مختلف</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالرقم أو المورد أو المرجع..." className="pr-9" />
        </div>

        {/* Table */}
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500">رقم الدفعة</th>
                <th className="px-4 py-3 font-medium text-slate-500">أمر الشراء</th>
                <th className="px-4 py-3 font-medium text-slate-500">المورد</th>
                <th className="px-4 py-3 font-medium text-slate-500">المبلغ (جنيه)</th>
                <th className="px-4 py-3 font-medium text-slate-500">تاريخ الدفع</th>
                <th className="px-4 py-3 font-medium text-slate-500">طريقة الدفع</th>
                <th className="px-4 py-3 font-medium text-slate-500">رقم الإيصال / المرجع</th>
                <th className="px-4 py-3 font-medium text-slate-500">الإيصال</th>
                <th className="px-4 py-3 font-medium text-slate-500">الحالة</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={10} className="py-12 text-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center text-slate-400">
                  لا توجد مدفوعات حتى الآن
                </td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-[#1e3a5f] text-xs">{p.paymentNo}</td>
                  <td className="px-4 py-3 text-slate-700">{p.orderNo}</td>
                  <td className="px-4 py-3 text-slate-700">{p.supplierName || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{fmt(p.amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{p.paymentDate}</td>
                  <td className="px-4 py-3 text-slate-600">{p.paymentMethod}</td>
                  <td className="px-4 py-3 font-mono text-slate-700 text-xs">{p.referenceNo || "—"}</td>
                  <td className="px-4 py-3">
                    {p.receiptFileName ? (
                      <button onClick={() => openReceipt(p)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                        <FileText className="h-3.5 w-3.5" /> عرض
                      </button>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setDeleteId(p.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── New Payment Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">تسجيل دفعة جديدة للمورد</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Step 1: PO selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-slate-700">أولاً: اختر أمر الشراء (PO)</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="بحث برقم أمر الشراء أو اسم المورد..." className="pr-9" />
              </div>

              {ordersLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل...
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {filteredOrders.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-sm">لا توجد أوامر شراء</div>
                  ) : filteredOrders.map((o) => (
                    <button key={o.id} onClick={() => selectOrder(o)}
                      className={`w-full text-right px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 ${
                        selectedOrder?.id === o.id ? "bg-blue-50 border-r-2 border-r-[#1e3a5f]" : ""
                      }`}>
                      <div>
                        <span className="font-medium text-slate-800 text-sm">{o.orderNo}</span>
                        <span className="text-slate-400 mx-2">|</span>
                        <span className="text-slate-600 text-sm">{o.supplierName || "—"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-700 text-sm">{fmt(o.totalAmount)} جنيه</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${orderStatusBadge(o.status)}`}>{o.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PO status indicators */}
            {(checkingPaid || loadingMethods) && (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> جاري التحقق من بيانات الدفع...
              </div>
            )}
            {!checkingPaid && alreadyPaid && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>تم دفع هذا الأمر مسبقاً — رقم الدفعة: <strong>{existingPaymentNo}</strong>. لا يمكن الدفع أكثر من مرة.</span>
              </div>
            )}
            {!checkingPaid && selectedOrder && !alreadyPaid && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>أمر الشراء <strong>{selectedOrder.orderNo}</strong> — إجمالي المستحق: <strong>{fmt(selectedOrder.totalAmount)} جنيه</strong></span>
              </div>
            )}

            {/* Step 2: Payment details */}
            {selectedOrder && !alreadyPaid && !checkingPaid && !loadingMethods && (
              <>
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <Label className="text-sm font-semibold text-slate-700">ثانياً: بيانات الدفع</Label>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">المبلغ المدفوع (جنيه) *</Label>
                      <Input type="number" step="0.001" value={amount}
                        onChange={(e) => setAmount(e.target.value)} placeholder="0.000" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">تاريخ الدفع *</Label>
                      <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs text-slate-500">طريقة الدفع *</Label>
                      {supplierPaymentMethods.length > 0 ? (
                        <>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                          >
                            {supplierPaymentMethods.map((m) => (
                              <option key={m.id} value={paymentMethodLabel(m)}>
                                {paymentMethodLabel(m)}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-slate-400">طرق الدفع المسجلة للمورد</p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-700 text-xs">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            لا توجد طرق دفع مسجلة لهذا المورد — يرجى إضافتها أولاً من صفحة الموردين
                          </div>
                          <Input
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            placeholder="أدخل طريقة الدفع يدوياً..."
                            className="mt-1"
                          />
                        </>
                      )}
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs text-slate-500">رقم الإيصال / المرجع *</Label>
                      <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)}
                        placeholder="مثال: RCP-001 أو TXN123456" />
                      <p className="text-xs text-slate-400">لا يمكن تكرار نفس الرقم في دفعتين</p>
                    </div>
                  </div>
                </div>

                {/* File upload */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">رفع الإيصال (صورة أو PDF)</Label>
                  {receiptFile ? (
                    <div className="flex items-center gap-3 border border-green-200 bg-green-50 rounded-lg p-3">
                      <FileText className="h-5 w-5 text-green-600 shrink-0" />
                      <span className="text-sm text-green-700 flex-1 truncate">{receiptFile.name}</span>
                      <button onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="text-red-400 hover:text-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-slate-200 rounded-lg p-5 text-center hover:border-[#1e3a5f] transition-colors group">
                      <Upload className="h-7 w-7 text-slate-300 mx-auto mb-1.5 group-hover:text-[#1e3a5f]" />
                      <p className="text-sm text-slate-500">اضغط لرفع الإيصال</p>
                      <p className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG</p>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">ملاحظات</Label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    placeholder="أي ملاحظات إضافية..."
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] resize-none" />
                </div>
              </>
            )}

            {saveError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {saveError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}
              disabled={saving || !selectedOrder || alreadyPaid || checkingPaid || loadingMethods}
              className="bg-[#1e3a5f] hover:bg-[#162d4a] gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              تسجيل الدفعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">حذف الدفعة</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">هل أنت متأكد من حذف هذه الدفعة؟ لا يمكن التراجع عن هذا الإجراء.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>إلغاء</Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white gap-2">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Receipt ── */}
      <Dialog open={!!viewPayment} onOpenChange={() => { setViewPayment(null); setReceiptData(""); }}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">إيصال الدفعة — {viewPayment?.paymentNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-slate-500">أمر الشراء:</span> <span className="font-medium">{viewPayment?.orderNo}</span></div>
              <div><span className="text-slate-500">المورد:</span> <span className="font-medium">{viewPayment?.supplierName}</span></div>
              <div><span className="text-slate-500">المبلغ:</span> <span className="font-semibold text-[#1e3a5f]">{viewPayment ? fmt(viewPayment.amount) : ""} جنيه</span></div>
              <div><span className="text-slate-500">تاريخ الدفع:</span> <span className="font-medium">{viewPayment?.paymentDate}</span></div>
              <div><span className="text-slate-500">طريقة الدفع:</span> <span className="font-medium">{viewPayment?.paymentMethod}</span></div>
              <div><span className="text-slate-500">رقم المرجع:</span> <span className="font-mono font-medium">{viewPayment?.referenceNo || "—"}</span></div>
            </div>
            {viewPayment?.notes && (
              <div><span className="text-slate-500">ملاحظات:</span> <span>{viewPayment.notes}</span></div>
            )}
            {viewPayment?.receiptFileName && (
              <div className="mt-3">
                <p className="text-slate-500 mb-2">الإيصال المرفق:</p>
                {receiptLoading ? (
                  <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل...</div>
                ) : receiptData ? (
                  receiptData.startsWith("data:image") ? (
                    <img src={receiptData} alt="receipt" className="max-w-full rounded-lg border border-slate-200" />
                  ) : (
                    <a href={receiptData} download={viewPayment.receiptFileName}
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
                      <FileText className="h-4 w-4" /> تنزيل {viewPayment.receiptFileName}
                    </a>
                  )
                ) : null}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setViewPayment(null); setReceiptData(""); }}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
