import React, { useState, useEffect, useMemo, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, X, Loader2, Truck, Trash2, CheckCircle2, XCircle,
  AlertTriangle, FileText, Printer, PackageCheck, Ban,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface Payment {
  paymentNo: string;
  amount: string;
  paymentDate: string;
}

interface SupplierOrderWithPayment {
  id: number;
  orderNo: string;
  supplierName: string;
  totalAmount: string;
  status: string;
  isPaid: boolean;
  payments: Payment[];
}

interface ExistingPermit {
  id: number;
  permitNo: string;
  deliveryDate: string;
}

interface CustomerOrder {
  id: number;
  orderNo: string;
  customerPoNo: string;
  customerName: string;
  orderDate: string;
  totalAmount: string;
}

interface CheckResult {
  customerOrder: CustomerOrder;
  supplierOrders: SupplierOrderWithPayment[];
  canIssuePermit: boolean;
  allPaid: boolean;
  existingPermits: ExistingPermit[];
  reason: string | null;
}

interface DeliveryPermit {
  id: number;
  permitNo: string;
  customerOrderNo: string;
  customerPoNo: string;
  customerName: string;
  supplierOrderNo: string;
  supplierName: string;
  deliveryDate: string;
  status: string;
  notes: string;
  rejectionReason?: string;
}

interface PrintItem {
  id: number;
  description: string;
  partNo: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  sortOrder: number;
}

function statusBadge(s: string) {
  if (s === "صادر") return "bg-green-100 text-green-700";
  if (s === "تم التسليم") return "bg-blue-100 text-blue-700";
  if (s === "مرفوض") return "bg-red-100 text-red-700";
  if (s === "ملغي") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function PrintPermitView({ permit, items }: { permit: DeliveryPermit; items: PrintItem[] }) {
  const grandTotal = items.reduce((sum, it) => sum + parseFloat(it.totalPrice || "0"), 0);
  return (
    <div
      id="print-permit-content"
      style={{
        fontFamily: "Arial, sans-serif",
        direction: "rtl",
        padding: "32px",
        maxWidth: "900px",
        margin: "0 auto",
        color: "#1e293b",
      }}
    >
      <div style={{ textAlign: "center", borderBottom: "2px solid #1e3a5f", paddingBottom: "16px", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "bold", color: "#1e3a5f", margin: 0 }}>إذن تسليم</h1>
        <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Delivery Permit</p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px", gap: "16px" }}>
        <div style={{ flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px" }}>
          <p style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", marginBottom: "10px", textTransform: "uppercase" }}>بيانات الإذن</p>
          <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "4px 0", color: "#64748b" }}>رقم الإذن:</td>
                <td style={{ padding: "4px 0", fontWeight: "bold", color: "#1e3a5f", fontFamily: "monospace" }}>{permit.permitNo}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px 0", color: "#64748b" }}>تاريخ التسليم:</td>
                <td style={{ padding: "4px 0", fontWeight: "600" }}>{permit.deliveryDate}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px 0", color: "#64748b" }}>الحالة:</td>
                <td style={{ padding: "4px 0", fontWeight: "600" }}>{permit.status}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px" }}>
          <p style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", marginBottom: "10px", textTransform: "uppercase" }}>بيانات العميل</p>
          <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "4px 0", color: "#64748b" }}>اسم العميل:</td>
                <td style={{ padding: "4px 0", fontWeight: "600" }}>{permit.customerName || "—"}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px 0", color: "#64748b" }}>رقم أمر العميل:</td>
                <td style={{ padding: "4px 0", fontFamily: "monospace" }}>{permit.customerOrderNo || "—"}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px 0", color: "#64748b" }}>رقم PO العميل:</td>
                <td style={{ padding: "4px 0", fontFamily: "monospace" }}>{permit.customerPoNo || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Table */}
      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", marginBottom: "10px", textTransform: "uppercase" }}>البنود</p>
        <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse", border: "1px solid #e2e8f0" }}>
          <thead>
            <tr style={{ background: "#1e3a5f", color: "#fff" }}>
              <th style={{ padding: "8px 6px", textAlign: "center", border: "1px solid #1e3a5f", width: "40px" }}>م</th>
              <th style={{ padding: "8px 6px", textAlign: "right", border: "1px solid #1e3a5f" }}>الوصف</th>
              <th style={{ padding: "8px 6px", textAlign: "center", border: "1px solid #1e3a5f", width: "90px" }}>رقم القطعة</th>
              <th style={{ padding: "8px 6px", textAlign: "center", border: "1px solid #1e3a5f", width: "60px" }}>الوحدة</th>
              <th style={{ padding: "8px 6px", textAlign: "center", border: "1px solid #1e3a5f", width: "70px" }}>كمية PO</th>
              <th style={{ padding: "8px 6px", textAlign: "center", border: "1px solid #1e3a5f", width: "90px" }}>سعر PO</th>
              <th style={{ padding: "8px 6px", textAlign: "center", border: "1px solid #1e3a5f", width: "90px" }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "16px", textAlign: "center", color: "#94a3b8", border: "1px solid #e2e8f0" }}>لا توجد بنود</td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item.id} style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={{ padding: "7px 6px", textAlign: "center", border: "1px solid #e2e8f0", fontWeight: "bold", color: "#1e3a5f" }}>{idx + 1}</td>
                  <td style={{ padding: "7px 6px", textAlign: "right", border: "1px solid #e2e8f0" }}>{item.description}</td>
                  <td style={{ padding: "7px 6px", textAlign: "center", border: "1px solid #e2e8f0", fontFamily: "monospace" }}>{item.partNo || "—"}</td>
                  <td style={{ padding: "7px 6px", textAlign: "center", border: "1px solid #e2e8f0" }}>{item.unit || "—"}</td>
                  <td style={{ padding: "7px 6px", textAlign: "center", border: "1px solid #e2e8f0" }}>{parseFloat(item.quantity || "0").toLocaleString("ar-EG")}</td>
                  <td style={{ padding: "7px 6px", textAlign: "center", border: "1px solid #e2e8f0" }}>{parseFloat(item.unitPrice || "0").toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: "7px 6px", textAlign: "center", border: "1px solid #e2e8f0", fontWeight: "600" }}>{parseFloat(item.totalPrice || "0").toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))
            )}
            {items.length > 0 && (
              <tr style={{ background: "#f1f5f9", fontWeight: "bold" }}>
                <td colSpan={6} style={{ padding: "8px 6px", textAlign: "center", border: "1px solid #e2e8f0", color: "#1e3a5f" }}>الإجمالي الكلي</td>
                <td style={{ padding: "8px 6px", textAlign: "center", border: "1px solid #e2e8f0", color: "#1e3a5f", fontSize: "13px" }}>
                  {grandTotal.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {permit.notes && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "14px", marginBottom: "24px" }}>
          <p style={{ fontSize: "11px", color: "#92400e", fontWeight: "bold", marginBottom: "6px" }}>ملاحظات</p>
          <p style={{ fontSize: "13px", color: "#78350f", margin: 0 }}>{permit.notes}</p>
        </div>
      )}

      {permit.rejectionReason && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "14px", marginBottom: "24px" }}>
          <p style={{ fontSize: "11px", color: "#991b1b", fontWeight: "bold", marginBottom: "6px" }}>سبب الرفض</p>
          <p style={{ fontSize: "13px", color: "#7f1d1d", margin: 0 }}>{permit.rejectionReason}</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginTop: "48px", borderTop: "1px solid #e2e8f0", paddingTop: "24px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ height: "48px", borderBottom: "1px solid #94a3b8", marginBottom: "8px" }}></div>
          <p style={{ fontSize: "12px", color: "#64748b" }}>توقيع مسؤول التسليم</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ height: "48px", borderBottom: "1px solid #94a3b8", marginBottom: "8px" }}></div>
          <p style={{ fontSize: "12px", color: "#64748b" }}>توقيع مستلم البضاعة</p>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "24px", fontSize: "11px", color: "#94a3b8" }}>
        تم إصدار هذا الإذن إلكترونياً — {new Date().toLocaleDateString("ar-EG")}
      </div>
    </div>
  );
}

export default function DeliveryPermitsPage() {
  const [permits, setPermits] = useState<DeliveryPermit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listSearch, setListSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [selectedSupplierOrderId, setSelectedSupplierOrderId] = useState<number | null>(null);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [printPermit, setPrintPermit] = useState<DeliveryPermit | null>(null);
  const [printItems, setPrintItems] = useState<PrintItem[]>([]);

  const [statusDialog, setStatusDialog] = useState<{ permit: DeliveryPermit; action: "تم التسليم" | "مرفوض" } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchPermits(); }, []);

  async function fetchPermits() {
    setIsLoading(true);
    try {
      const res = await fetch(API_BASE + "/api/delivery-permits", { credentials: "include" });
      if (!res.ok) { setPermits([]); return; }
      const data = await res.json();
      setPermits(Array.isArray(data) ? data : []);
    } catch { setPermits([]); }
    finally { setIsLoading(false); }
  }

  const filteredPermits = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return permits;
    return permits.filter(p =>
      p.permitNo?.toLowerCase().includes(q) ||
      p.customerOrderNo?.toLowerCase().includes(q) ||
      p.customerPoNo?.toLowerCase().includes(q) ||
      p.customerName?.toLowerCase().includes(q) ||
      p.supplierOrderNo?.toLowerCase().includes(q)
    );
  }, [permits, listSearch]);

  function resetDialog() {
    setSearchTerm("");
    setSearchError("");
    setCheckResult(null);
    setSelectedSupplierOrderId(null);
    setDeliveryDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setSaving(false);
    setSaveError("");
  }

  async function handleSearch() {
    const q = searchTerm.trim();
    if (!q) return;
    setSearching(true);
    setSearchError("");
    setCheckResult(null);
    setSelectedSupplierOrderId(null);

    try {
      const res = await fetch(
        API_BASE + "/api/customer-orders/search?q=" + encodeURIComponent(q),
        { credentials: "include" }
      );
      if (!res.ok) { setSearchError("فشل في البحث — تأكد من الاتصال بالخادم"); return; }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) { setSearchError("لم يتم العثور على أمر شراء بهذا الرقم"); return; }
      const order = data[0];
      if (!order?.id) { setSearchError("لم يتم العثور على أمر شراء بهذا الرقم"); return; }

      const checkRes = await fetch(
        API_BASE + "/api/delivery-permits/check-order/" + order.id,
        { credentials: "include" }
      );
      if (!checkRes.ok) {
        const errData = await checkRes.json().catch(() => ({}));
        setSearchError((errData as any).error ?? "فشل في جلب حالة الأمر");
        return;
      }
      const checkData: CheckResult = await checkRes.json();

      if (!checkData.customerOrder || !Array.isArray(checkData.supplierOrders)) {
        setSearchError("بيانات غير متوقعة من الخادم — حاول مرة أخرى");
        return;
      }

      setCheckResult(checkData);
      const paidOrder = checkData.supplierOrders.find(o => o.isPaid);
      if (paidOrder) setSelectedSupplierOrderId(paidOrder.id);
    } catch {
      setSearchError("حدث خطأ في الاتصال — حاول مرة أخرى");
    } finally {
      setSearching(false);
    }
  }

  async function handleSave() {
    if (!checkResult || !selectedSupplierOrderId || !deliveryDate) {
      setSaveError("يرجى اختيار أمر توريد وتحديد تاريخ التسليم");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(API_BASE + "/api/delivery-permits", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerOrderId: checkResult.customerOrder.id,
          supplierOrderId: selectedSupplierOrderId,
          deliveryDate,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? "فشل في الإنشاء"); return; }
      setOpen(false);
      fetchPermits();
    } catch { setSaveError("حدث خطأ أثناء الحفظ"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("هل أنت متأكد من حذف إذن التسليم هذا؟")) return;
    try {
      await fetch(API_BASE + "/api/delivery-permits/" + id, { method: "DELETE", credentials: "include" });
      fetchPermits();
    } catch { alert("فشل في الحذف"); }
  }

  async function handlePrint(permit: DeliveryPermit) {
    setPrintPermit(permit);
    setPrintItems([]);
    try {
      const res = await fetch(API_BASE + "/api/delivery-permits/" + permit.id + "/items", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPrintItems(Array.isArray(data) ? data : []);
      }
    } catch { /* print anyway with empty items */ }
    setTimeout(() => {
      window.print();
    }, 300);
  }

  async function handleStatusChange() {
    if (!statusDialog) return;
    const { permit, action } = statusDialog;

    if (action === "مرفوض" && !rejectionReason.trim()) {
      setStatusError("يرجى كتابة سبب الرفض");
      return;
    }

    setStatusSaving(true);
    setStatusError("");
    try {
      const res = await fetch(API_BASE + "/api/delivery-permits/" + permit.id + "/status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: action,
          rejectionReason: action === "مرفوض" ? rejectionReason.trim() : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setStatusError(data.error ?? "فشل في تحديث الحالة"); return; }
      setStatusDialog(null);
      setRejectionReason("");
      fetchPermits();
    } catch { setStatusError("حدث خطأ أثناء التحديث"); }
    finally { setStatusSaving(false); }
  }

  const supplierOrders = checkResult?.supplierOrders ?? [];
  const existingPermits = checkResult?.existingPermits ?? [];
  const selectedSO = supplierOrders.find(o => o.id === selectedSupplierOrderId);
  const canSubmit = !!(checkResult?.canIssuePermit && selectedSupplierOrderId && selectedSO?.isPaid);

  return (
    <AppLayout>
      <>
        {/* Print styles — hidden on screen, shown only when printing */}
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #print-permit-content, #print-permit-content * { visibility: visible !important; }
            #print-permit-content {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              z-index: 99999 !important;
            }
          }
        `}</style>

        {/* Hidden print area */}
        {printPermit && (
          <div style={{ display: "none" }} ref={printRef}>
            <PrintPermitView permit={printPermit} items={printItems} />
          </div>
        )}
        {/* Always-rendered print container (shown only on print) */}
        {printPermit && <PrintPermitView permit={printPermit} items={printItems} />}

        <div className="space-y-6" dir="rtl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">إذون التسليم</h1>
            <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={() => { resetDialog(); setOpen(true); }}>
              + إضافة إذن جديد
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text" value={listSearch} onChange={e => setListSearch(e.target.value)}
              placeholder="بحث بـ: رقم الإذن، رقم الأمر، رقم PO العميل، العميل..."
              className="w-full rounded-lg border border-slate-300 bg-white pr-9 pl-9 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
              dir="rtl"
            />
            {listSearch && (
              <button onClick={() => setListSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500">رقم الإذن</th>
                  <th className="px-4 py-3 font-medium text-slate-500">أمر العميل</th>
                  <th className="px-4 py-3 font-medium text-slate-500">PO العميل</th>
                  <th className="px-4 py-3 font-medium text-slate-500">العميل</th>
                  <th className="px-4 py-3 font-medium text-slate-500">أمر التوريد</th>
                  <th className="px-4 py-3 font-medium text-slate-500">تاريخ التسليم</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الحالة</th>
                  <th className="px-4 py-3 font-medium text-slate-500">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td className="p-8 text-slate-400 text-center" colSpan={8}>جاري التحميل...</td></tr>
                ) : permits.length === 0 ? (
                  <tr>
                    <td className="p-12 text-center" colSpan={8}>
                      <Truck className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">لا توجد إذونات تسليم حتى الآن</p>
                    </td>
                  </tr>
                ) : filteredPermits.length === 0 ? (
                  <tr><td className="p-8 text-center text-slate-500" colSpan={8}>لا توجد نتائج مطابقة</td></tr>
                ) : filteredPermits.map(permit => (
                  <tr key={permit.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-sm text-blue-700 font-bold">{permit.permitNo}</td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-700">{permit.customerOrderNo || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{permit.customerPoNo || "—"}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{permit.customerName || "—"}</td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-600">{permit.supplierOrderNo || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{permit.deliveryDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " + statusBadge(permit.status)}>
                          {permit.status}
                        </span>
                        {permit.status === "مرفوض" && permit.rejectionReason && (
                          <span className="text-xs text-red-500 max-w-[140px] truncate" title={permit.rejectionReason}>
                            {permit.rejectionReason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Print */}
                        <button
                          onClick={() => handlePrint(permit)}
                          title="طباعة الإذن"
                          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 px-2 py-1 rounded border border-slate-200 hover:border-blue-200 transition-colors"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>طباعة</span>
                        </button>

                        {/* Mark as Delivered */}
                        {permit.status === "صادر" && (
                          <button
                            onClick={() => { setStatusDialog({ permit, action: "تم التسليم" }); setRejectionReason(""); setStatusError(""); }}
                            className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors"
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                            <span>تم التسليم</span>
                          </button>
                        )}

                        {/* Mark as Rejected */}
                        {permit.status === "صادر" && (
                          <button
                            onClick={() => { setStatusDialog({ permit, action: "مرفوض" }); setRejectionReason(""); setStatusError(""); }}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200 transition-colors"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            <span>مرفوض</span>
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(permit.id)}
                          title="حذف"
                          className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listSearch && filteredPermits.length > 0 && (
              <div className="px-6 py-2 border-t bg-slate-50 text-xs text-slate-500">
                {filteredPermits.length} نتيجة من أصل {permits.length} إذن
              </div>
            )}
          </div>
        </div>

        {/* Create Permit Dialog */}
        <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#1e3a5f]" />
                إضافة إذن تسليم جديد
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                  <Label className="text-base font-semibold text-slate-700">ابحث برقم أمر الشراء أو رقم PO العميل</Label>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text" value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setSearchError(""); }}
                      onKeyDown={e => e.key === "Enter" && handleSearch()}
                      placeholder="CO-... أو رقم PO العميل"
                      className="w-full rounded-lg border border-slate-300 bg-white pr-9 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                      dir="ltr"
                    />
                  </div>
                  <Button onClick={handleSearch} disabled={searching || !searchTerm.trim()} className="bg-[#1e3a5f] hover:bg-[#162d4a]">
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "بحث"}
                  </Button>
                </div>
                {searchError && (
                  <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{searchError}</p>
                )}
              </div>

              {checkResult && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs text-blue-500 font-semibold mb-2 uppercase tracking-wide">أمر شراء العميل</p>
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
                      <div>
                        <span className="text-slate-500 text-xs">رقم الأمر (النظام): </span>
                        <span className="font-mono font-bold text-blue-800">{checkResult.customerOrder.orderNo}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">رقم PO العميل: </span>
                        <span className="font-medium text-slate-800">{checkResult.customerOrder.customerPoNo || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">العميل: </span>
                        <span className="font-medium text-slate-800">{checkResult.customerOrder.customerName || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">التاريخ: </span>
                        <span className="text-slate-700">{checkResult.customerOrder.orderDate}</span>
                      </div>
                    </div>
                  </div>

                  {existingPermits.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-amber-700">
                        <p className="font-semibold">تنبيه: يوجد إذن تسليم سابق لهذا الأمر</p>
                        {existingPermits.map(p => (
                          <p key={p.id} className="text-xs mt-1 font-mono">{p.permitNo} — {p.deliveryDate}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                      <Label className="text-base font-semibold text-slate-700">أوامر التوريد المرتبطة</Label>
                    </div>

                    {supplierOrders.length === 0 ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
                        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-red-700">لا يوجد أمر توريد مرتبط بهذا الأمر</p>
                          <p className="text-xs text-red-500 mt-0.5">يجب ربط أمر توريد بهذا الأمر أولاً</p>
                        </div>
                      </div>
                    ) : (
                      supplierOrders.map(so => (
                        <div
                          key={so.id}
                          onClick={() => so.isPaid ? setSelectedSupplierOrderId(so.id) : undefined}
                          className={[
                            "rounded-lg border p-4 transition-all",
                            so.isPaid ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                            selectedSupplierOrderId === so.id
                              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                              : so.isPaid
                                ? "border-green-200 bg-green-50 hover:border-green-400"
                                : "border-slate-200 bg-slate-50",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {so.isPaid
                                ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                                : <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />}
                              <div>
                                <p className="font-mono font-bold text-sm text-slate-800">{so.orderNo}</p>
                                <p className="text-xs text-slate-500">{so.supplierName || "—"}</p>
                              </div>
                            </div>
                            <span className={["inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                              so.isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"].join(" ")}>
                              {so.isPaid ? "✓ تم الدفع للمورد" : "✗ لم يتم الدفع بعد"}
                            </span>
                          </div>
                          {so.isPaid && so.payments.length > 0 && (
                            <div className="mt-2 mr-8 text-xs text-green-700 bg-green-100 rounded px-2 py-1">
                              رقم الدفعة: <span className="font-mono">{so.payments[0].paymentNo}</span> — {so.payments[0].paymentDate}
                            </div>
                          )}
                          {!so.isPaid && (
                            <p className="mt-2 mr-8 text-xs text-red-500">يجب سداد المورد أولاً قبل إصدار إذن التسليم</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {!checkResult.canIssuePermit && supplierOrders.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">لا يمكن إصدار إذن التسليم</p>
                        <p className="text-xs text-red-600 mt-1">{checkResult.reason ?? "يجب سداد المورد أولاً قبل تسليم البضاعة للعميل"}</p>
                      </div>
                    </div>
                  )}

                  {canSubmit && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                        <Label className="text-base font-semibold text-slate-700">تفاصيل التسليم</Label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border">
                        <div className="space-y-1.5">
                          <Label>تاريخ التسليم *</Label>
                          <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>ملاحظات (اختياري)</Label>
                          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي ملاحظات..." />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {saveError && (
                <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{saveError}</div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleSave} disabled={!canSubmit || saving}>
                {saving ? <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري الإنشاء...</> : "إصدار إذن التسليم"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Status Change Dialog */}
        <Dialog open={!!statusDialog} onOpenChange={v => { if (!v) { setStatusDialog(null); setRejectionReason(""); setStatusError(""); } }}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {statusDialog?.action === "تم التسليم"
                  ? <PackageCheck className="h-5 w-5 text-blue-600" />
                  : <Ban className="h-5 w-5 text-red-500" />}
                {statusDialog?.action === "تم التسليم" ? "تأكيد التسليم" : "تسجيل الرفض"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {statusDialog && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
                  <span className="text-slate-500">إذن رقم: </span>
                  <span className="font-mono font-bold text-blue-700">{statusDialog.permit.permitNo}</span>
                  <span className="text-slate-400 mx-2">—</span>
                  <span className="text-slate-700">{statusDialog.permit.customerName}</span>
                </div>
              )}

              {statusDialog?.action === "تم التسليم" && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
                  <PackageCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">تأكيد تسليم البضاعة</p>
                    <p className="text-xs text-blue-600 mt-1">سيتم تغيير حالة الإذن إلى "تم التسليم". هل أنت متأكد؟</p>
                  </div>
                </div>
              )}

              {statusDialog?.action === "مرفوض" && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                    <Ban className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">تسجيل رفض التسليم</p>
                      <p className="text-xs text-red-500 mt-1">يرجى كتابة سبب رفض الإذن بشكل واضح.</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      سبب الرفض <span className="text-red-500">*</span>
                    </Label>
                    <textarea
                      value={rejectionReason}
                      onChange={e => { setRejectionReason(e.target.value); setStatusError(""); }}
                      placeholder="اكتب سبب الرفض هنا..."
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-200 resize-none"
                      dir="rtl"
                    />
                  </div>
                </div>
              )}

              {statusError && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{statusError}</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setStatusDialog(null); setRejectionReason(""); setStatusError(""); }}>
                إلغاء
              </Button>
              <Button
                onClick={handleStatusChange}
                disabled={statusSaving}
                className={statusDialog?.action === "تم التسليم" ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"}
              >
                {statusSaving
                  ? <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري الحفظ...</>
                  : statusDialog?.action === "تم التسليم" ? "تأكيد التسليم" : "تسجيل الرفض"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </AppLayout>
  );
}
