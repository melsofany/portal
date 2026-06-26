import { useState, useMemo } from "react";
  import AppLayout from "@/components/AppLayout";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Separator } from "@/components/ui/separator";
  import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  } from "@/components/ui/dialog";
  import {
    Sheet, SheetContent,
  } from "@/components/ui/sheet";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import {
    Search, Plus, Trash2, FileText, CheckCircle2, XCircle,
    AlertTriangle, Printer, TrendingUp, TrendingDown, Clock,
    Package, ChevronRight, RefreshCw, Filter,
    ReceiptText, Layers, BarChart3, Eye, ShieldCheck,
  } from "lucide-react";

  const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const BASE = `${API_BASE}/api/accounts`;

  async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
    const r = await fetch(url, { credentials: "include", ...opts });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || "حدث خطأ");
    return data;
  }

  /* ─── Types ─────────────────────────────────────────────────────────── */
  interface SupplierOrderRef {
    id: number; orderNo: string; supplierName: string;
    totalAmount: string; status: string;
  }
  interface OrderSummary {
    id: number; orderNo: string; customerPoNo: string; customerName: string;
    orderDate: string; totalAmount: string; status: string;
    totalCosts: number; supplierTotal: number;
    customerInsurance: number; customerInsuranceRate: number;
    manualCosts: number; supplierOrdersCount: number; invoice: Invoice | null;
    permitsCount: number; allDelivered: boolean;
    subtotal: number; vatAmount: number; vatRate: number; marginPct?: number;
  }
  interface OrderDetail extends OrderSummary {
    items: OrderItem[]; costs: OrderCost[];
    permits: Permit[]; supplierOrders: SupplierOrderRef[]; canInvoice: boolean;
  }
  interface OrderItem {
    id: number; description: string; partNo: string; unit: string;
    quantity: string; unitPrice: string; totalPrice: string;
  }
  interface OrderCost {
    id: number; costType: string; description: string; amount: string;
    vatRate: string; vatAmount: string; insuranceRate: string;
    insuranceAmount: string; totalAmount: string; referenceNo: string; notes: string;
  }
  interface Permit {
    id: number; permitNo: string; supplierOrderNo: string;
    supplierName: string; deliveryDate: string; status: string;
  }
  interface Invoice {
    id: number; invoiceNo: string; invoiceDate: string; subtotal: string;
    vatRate: string; vatAmount: string; totalAmount: string; totalCosts: string;
    netProfit: string; status: string; notes: string;
    customerOrderNo?: string; customerPoNo?: string; customerName?: string;
    items?: OrderItem[]; costs?: OrderCost[];
  }
  interface CompanyExpense {
    id: number; expenseType: string; description: string; amount: string;
    expenseDate: string; referenceNo: string; notes: string; createdAt: string;
  }

  const DEFAULT_VAT_RATE = 14;
  const CUSTOMER_INSURANCE_RATE = 3;

  const COST_TYPES = [
    { key: "shipping",   label: "شحن" },
    { key: "customs",    label: "جمارك ورسوم استيراد" },
    { key: "transport",  label: "نقل" },
    { key: "inspection", label: "تفتيش وشهادات" },
    { key: "other",      label: "تكلفة أخرى" },
  ];

  const COMPANY_EXPENSE_TYPES = [
    { key: "rent",         label: "إيجارات" },
    { key: "internet",     label: "باقات إنترنت" },
    { key: "domain",       label: "دومين واستضافة" },
    { key: "petty_cash",   label: "مصاريف نثرية" },
    { key: "operational",  label: "مصاريف تشغيل" },
    { key: "maintenance",  label: "صيانة" },
    { key: "salary",       label: "رواتب وأجور" },
    { key: "utilities",    label: "فواتير كهرباء وغاز ومياه" },
    { key: "insurance",    label: "تأمينات" },
    { key: "marketing",    label: "تسويق وإعلان" },
    { key: "travel",       label: "سفر وانتقالات" },
    { key: "other",        label: "مصاريف أخرى" },
  ];

  /* ─── Math ─────────────────────────────────────────────────────────────── */
  function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }
  function fmt(n: number | string, decimals = 2) {
    return round2(parseFloat(String(n || 0))).toLocaleString("ar-EG", {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    });
  }

  /* ─── SAP Status Styles ──────────────────────────────────────────────── */
  function statusBadge(s: string) {
    if (s === "صدرت الفاتورة" || s === "مدفوعة")
      return { bg: "#e8f5e9", color: "#1b5e20", border: "#a5d6a7", icon: <CheckCircle2 size={12}/> };
    if (s === "صادرة")
      return { bg: "#e3f2fd", color: "#0d47a1", border: "#90caf9", icon: <FileText size={12}/> };
    if (s === "ملغاة")
      return { bg: "#fce4ec", color: "#b71c1c", border: "#f48fb1", icon: <XCircle size={12}/> };
    if (s === "مفتوح" || s === "جاري")
      return { bg: "#fff8e1", color: "#e65100", border: "#ffe082", icon: <Clock size={12}/> };
    return { bg: "#f5f5f5", color: "#424242", border: "#bdbdbd", icon: <Package size={12}/> };
  }
  function permitBadge(s: string) {
    if (s === "تم التسليم") return { bg: "#e3f2fd", color: "#0d47a1", border: "#90caf9" };
    if (s === "مرفوض" || s === "ملغي") return { bg: "#fce4ec", color: "#b71c1c", border: "#f48fb1" };
    return { bg: "#fff8e1", color: "#e65100", border: "#ffe082" };
  }

  /* ─── PRINT INVOICE VIEW ─────────────────────────────────────────────────
   * فاتورة ضريبية — بنود أمر الشراء فقط + ١٤٪ — لا تكاليف داخلية
   */
  function PrintInvoiceView({ invoice, companyName = "شركتكم" }: {
    invoice: Invoice; companyName?: string;
  }) {
    const subtotal = round2(parseFloat(invoice.subtotal || "0"));
    const vatRate  = parseFloat(invoice.vatRate || "14");
    const vatAmt   = round2(parseFloat(invoice.vatAmount || "0"));
    const total    = round2(parseFloat(invoice.totalAmount || "0"));

    return (
      <div id="invoice-print" style={{
        fontFamily: "'Cairo', Arial, sans-serif", direction: "rtl",
        padding: "32px", maxWidth: "800px", margin: "0 auto", background: "#fff", color: "#1a1a1a",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #0a3d62", paddingBottom: "20px", marginBottom: "24px" }}>
          <div>
            <div style={{ fontSize: "22px", fontWeight: "900", color: "#0a3d62", marginBottom: "4px" }}>فاتورة ضريبية</div>
            <div style={{ fontSize: "12px", color: "#6a6d70" }}>Tax Invoice — ETA Compliant</div>
            <div style={{ marginTop: "10px", fontSize: "11px", color: "#6a6d70" }}>
              <div>مطابقة لمنظومة الفاتورة الإلكترونية المصرية (ETA)</div>
              <div>قانون ضريبة القيمة المضافة رقم ٦٧ لسنة ٢٠١٦</div>
            </div>
          </div>
          <div style={{ textAlign: "left", borderRight: "3px solid #0a3d62", paddingRight: "20px" }}>
            <div style={{ fontSize: "22px", fontWeight: "900", color: "#0a3d62" }}>{companyName}</div>
            <div style={{ fontSize: "12px", color: "#6a6d70", marginTop: "4px" }}>الشركة المُصدِرة للفاتورة</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "6px", padding: "14px" }}>
            <div style={{ fontSize: "10px", color: "#6a6d70", fontWeight: "bold", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>بيانات الفاتورة</div>
            <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ padding: "3px 0", color: "#6a6d70", width: "45%" }}>رقم الفاتورة</td><td style={{ fontWeight: "700", fontFamily: "monospace" }}>{invoice.invoiceNo}</td></tr>
                <tr><td style={{ padding: "3px 0", color: "#6a6d70" }}>تاريخ الإصدار</td><td>{invoice.invoiceDate}</td></tr>
                <tr><td style={{ padding: "3px 0", color: "#6a6d70" }}>الحالة</td><td><span style={{ background: "#e3f2fd", color: "#0d47a1", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "600" }}>{invoice.status}</span></td></tr>
                <tr><td style={{ padding: "3px 0", color: "#6a6d70" }}>نسبة الضريبة</td><td style={{ fontWeight: "700", color: "#0a3d62" }}>{vatRate}%</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "6px", padding: "14px" }}>
            <div style={{ fontSize: "10px", color: "#6a6d70", fontWeight: "bold", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>بيانات المشتري</div>
            <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ padding: "3px 0", color: "#6a6d70", width: "40%" }}>العميل</td><td style={{ fontWeight: "700" }}>{invoice.customerName || "—"}</td></tr>
                <tr><td style={{ padding: "3px 0", color: "#6a6d70" }}>رقم الأمر</td><td style={{ fontFamily: "monospace" }}>{invoice.customerOrderNo || "—"}</td></tr>
                <tr><td style={{ padding: "3px 0", color: "#6a6d70" }}>رقم PO العميل</td><td style={{ fontFamily: "monospace", fontWeight: "600" }}>{invoice.customerPoNo || "—"}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* بنود الفاتورة — من أمر الشراء فقط */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "11px", color: "#6a6d70", fontWeight: "bold", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>بنود الفاتورة</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#0a3d62", color: "white" }}>
                <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: "600", width: "36px" }}>#</th>
                <th style={{ padding: "9px 10px", textAlign: "right", fontWeight: "600" }}>الوصف</th>
                <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: "600", width: "100px" }}>رقم القطعة</th>
                <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: "600", width: "60px" }}>الوحدة</th>
                <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: "600", width: "80px" }}>الكمية</th>
                <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: "600", width: "110px" }}>سعر الوحدة</th>
                <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: "600", width: "120px" }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items && invoice.items.length > 0) ? invoice.items.map((it, i) => (
                <tr key={it.id} style={{ borderBottom: "1px solid #e9ecef", background: i % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                  <td style={{ padding: "8px 10px", color: "#6a6d70" }}>{i + 1}</td>
                  <td style={{ padding: "8px 10px" }}>{it.description}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center", fontFamily: "monospace", fontSize: "11px", color: "#495057" }}>{it.partNo || "—"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center", color: "#495057" }}>{it.unit || "—"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{fmt(it.quantity, 3)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{fmt(it.unitPrice, 3)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: "700" }}>{fmt(it.totalPrice)}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} style={{ padding: "16px", textAlign: "center", color: "#adb5bd", fontStyle: "italic" }}>لا توجد بنود</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* الإجماليات */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
          <table style={{ fontSize: "13px", borderCollapse: "collapse", minWidth: "320px", border: "1px solid #dee2e6", borderRadius: "6px", overflow: "hidden" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #dee2e6" }}>
                <td style={{ padding: "9px 16px", color: "#6a6d70", background: "#f8f9fa" }}>المجموع قبل الضريبة</td>
                <td style={{ padding: "9px 16px", fontWeight: "600", textAlign: "left", minWidth: "120px" }}>{fmt(subtotal)} ج.م</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #dee2e6" }}>
                <td style={{ padding: "9px 16px", color: "#6a6d70", background: "#f8f9fa" }}>ضريبة القيمة المضافة ({vatRate}%)</td>
                <td style={{ padding: "9px 16px", fontWeight: "600", textAlign: "left" }}>{fmt(vatAmt)} ج.م</td>
              </tr>
              <tr style={{ background: "#0a3d62", color: "white" }}>
                <td style={{ padding: "11px 16px", fontWeight: "700", fontSize: "14px" }}>إجمالي الفاتورة المستحق</td>
                <td style={{ padding: "11px 16px", fontWeight: "900", textAlign: "left", fontSize: "16px" }}>{fmt(total)} ج.م</td>
              </tr>
            </tbody>
          </table>
        </div>

        {invoice.notes && (
          <div style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "6px", padding: "12px", fontSize: "12px", color: "#495057", marginBottom: "24px" }}>
            <strong>ملاحظات:</strong> {invoice.notes}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginTop: "48px", borderTop: "2px solid #dee2e6", paddingTop: "24px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ height: "56px", borderBottom: "1px solid #adb5bd", marginBottom: "8px" }}></div>
            <div style={{ fontSize: "12px", color: "#6a6d70" }}>اعتماد المدير المالي</div>
            <div style={{ fontSize: "10px", color: "#adb5bd", marginTop: "2px" }}>CFO Approval</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ height: "56px", borderBottom: "1px solid #adb5bd", marginBottom: "8px" }}></div>
            <div style={{ fontSize: "12px", color: "#6a6d70" }}>توقيع العميل</div>
            <div style={{ fontSize: "10px", color: "#adb5bd", marginTop: "2px" }}>Customer Signature</div>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "10px", color: "#adb5bd", borderTop: "1px solid #f1f3f5", paddingTop: "14px" }}>
          صادرة إلكترونياً — مطابقة لمنظومة الفاتورة الإلكترونية المصرية (ETA) — قانون رقم ٦٧ لسنة ٢٠١٦ — {new Date().toLocaleDateString("ar-EG")}
        </div>
      </div>
    );
  }

  /* ─── Add Cost Dialog ─────────────────────────────────────────────────── */
  function AddCostDialog({ orderId, onClose }: { orderId: number; onClose: () => void }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({ costType: "shipping", description: "", amount: "", referenceNo: "", notes: "" });
    const [error, setError] = useState("");
    const mutation = useMutation({
      mutationFn: () => apiFetch(`${BASE}/orders/${orderId}/costs`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      }),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["acc-order", orderId] }); qc.invalidateQueries({ queryKey: ["acc-orders"] }); onClose(); },
      onError: (e: Error) => setError(e.message),
    });
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="text-sm font-semibold text-[#0a3d62]">إضافة تكلفة إضافية</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
              التكاليف الإضافية داخلية فقط — لا تظهر في فاتورة العميل
            </div>
            <div>
              <Label className="text-xs">نوع التكلفة</Label>
              <select className="w-full border rounded px-2 py-1.5 text-sm mt-1 bg-white" value={form.costType} onChange={e => setForm(p => ({ ...p, costType: e.target.value }))}>
                {COST_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">الوصف <span className="text-red-500">*</span></Label>
              <Input className="mt-1 text-sm h-8" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="مثال: شحن دولي — فاتورة مورد ABC" />
            </div>
            <div>
              <Label className="text-xs">المبلغ (ج.م) <span className="text-red-500">*</span></Label>
              <Input className="mt-1 text-sm h-8" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">رقم المرجع</Label>
              <Input className="mt-1 text-sm h-8" value={form.referenceNo} onChange={e => setForm(p => ({ ...p, referenceNo: e.target.value }))} placeholder="اختياري" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onClose}>إلغاء</Button>
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.description.trim() || !form.amount} className="bg-[#0a3d62] hover:bg-[#0c4f7e] text-white">
              {mutation.isPending ? "جارٍ الحفظ..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  /* ─── Issue Invoice Dialog ────────────────────────────────────────────── */
  function IssueInvoiceDialog({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
    const qc = useQueryClient();
    const today = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({ invoiceDate: today, vatRate: String(DEFAULT_VAT_RATE), notes: "" });
    const [error, setError] = useState("");
    // order.subtotal = pre-VAT customer order amount (from backend fin)
    // order.totalAmount = subtotal + VAT (already the invoice total)
    const subtotal  = round2(order.subtotal ?? 0);
    const vat       = parseFloat(form.vatRate || "14");
    const vatAmt    = round2(subtotal * (vat / 100));
    const total     = round2(subtotal + vatAmt);
    const insurance = round2(subtotal * (CUSTOMER_INSURANCE_RATE / 100));
    const profit    = round2(total - (order.totalCosts ?? 0));
    const mutation = useMutation({
      mutationFn: (body: object) => apiFetch(`${BASE}/orders/${order.id}/invoice`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["acc-order", order.id] });
        qc.invalidateQueries({ queryKey: ["acc-orders"] });
        qc.invalidateQueries({ queryKey: ["acc-invoices"] });
        onClose();
      },
      onError: (e: Error) => setError(e.message),
    });
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-[#0a3d62]">
              <ReceiptText size={16} className="text-[#0a6ed1]" /> إصدار فاتورة ضريبية
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
            <div className="bg-emerald-50 border border-emerald-200 rounded p-2.5 flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-xs text-emerald-800">
                <div className="font-semibold">جميع إذون التسليم مكتملة ✓</div>
                <div className="text-emerald-600 mt-0.5">{order.permits?.length ?? 0} إذن بحالة "تم التسليم"</div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
              <strong>وفق القانون المصري:</strong> الفاتورة تحتوي بنود أمر الشراء فقط + ١٤٪ ض.ق.م
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">تاريخ الفاتورة <span className="text-red-500">*</span></Label>
                <Input className="mt-1 text-sm h-8" type="date" value={form.invoiceDate} onChange={e => setForm(p => ({ ...p, invoiceDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">نسبة ض.ق.م %</Label>
                <Input className="mt-1 text-sm h-8" type="number" value={form.vatRate} onChange={e => setForm(p => ({ ...p, vatRate: e.target.value }))} />
              </div>
            </div>
            <div style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "6px", padding: "12px" }}>
              <div className="text-xs font-semibold text-[#0a3d62] mb-2 uppercase tracking-wide">ملخص الفاتورة</div>
              <div className="space-y-1.5">
                {[
                  { label: "قيمة بنود أمر الشراء", val: subtotal },
                  { label: `ضريبة القيمة المضافة (${vat}%)`, val: vatAmt },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-xs">
                    <span className="text-[#6a6d70]">{r.label}</span>
                    <span className="font-semibold">{fmt(r.val)} ج.م</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm font-bold text-[#0a3d62]">
                  <span>إجمالي الفاتورة للعميل</span><span>{fmt(total)} ج.م</span>
                </div>
                <Separator />
                <div className="text-xs font-semibold text-[#6a6d70] mt-1 mb-1">التكاليف الداخلية (لا تظهر للعميل)</div>
                {[
                  { label: `تأمينات أمر الشراء (${CUSTOMER_INSURANCE_RATE}% × قيمة البنود)`, val: insurance, color: "#7b1fa2" },
                  { label: "إجمالي أسعار بنود المورد (RAW)", val: order.supplierTotal ?? 0, color: "#d84315" },
                  { label: "تكاليف إضافية (شحن، جمارك...)", val: order.manualCosts ?? 0, color: "#d84315" },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-xs">
                    <span className="text-[#6a6d70]">{r.label}</span>
                    <span style={{ color: r.color, fontWeight: 600 }}>{fmt(r.val)} ج.م</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-xs">
                  <span className="text-[#6a6d70]">إجمالي التكاليف</span>
                  <span className="font-bold text-red-700">{fmt(order.totalCosts ?? 0)} ج.م</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#6a6d70]">صافي الربح المتوقع</span>
                  <span className={`font-bold ${profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(profit)} ج.م</span>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Input className="mt-1 text-sm h-8" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onClose}>إلغاء</Button>
            <Button size="sm" onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.invoiceDate} className="bg-[#0a3d62] hover:bg-[#0c4f7e] text-white">
              {mutation.isPending ? "جارٍ الإصدار..." : "إصدار الفاتورة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  /* ─── Invoice Detail Dialog ───────────────────────────────────────────── */
  function InvoiceDetailDialog({ invoiceId, onClose }: { invoiceId: number; onClose: () => void }) {
    const qc = useQueryClient();
    const { data: inv, isLoading } = useQuery<Invoice>({
      queryKey: ["acc-invoice", invoiceId],
      queryFn: () => apiFetch(`${BASE}/invoices/${invoiceId}`),
    });
    const statusMut = useMutation({
      mutationFn: (status: string) => apiFetch(`${BASE}/invoices/${invoiceId}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["acc-invoice", invoiceId] });
        qc.invalidateQueries({ queryKey: ["acc-invoices"] });
        qc.invalidateQueries({ queryKey: ["acc-orders"] });
      },
    });
    const deleteMut = useMutation({
      mutationFn: () => apiFetch(`${BASE}/invoices/${invoiceId}`, { method: "DELETE" }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["acc-invoices"] });
        qc.invalidateQueries({ queryKey: ["acc-orders"] });
        onClose();
      },
    });
    const handlePrint = () => {
      const el = document.getElementById("invoice-print");
      if (!el) return;
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>فاتورة</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
        <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Cairo',Arial,sans-serif}@media print{@page{size:A4;margin:10mm}}</style>
      </head><body>${el.outerHTML}</body></html>`);
      w.document.close();
      setTimeout(() => { w.print(); w.close(); }, 600);
    };
    if (isLoading || !inv) return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <div className="flex items-center justify-center h-40 text-[#6a6d70] text-sm">جارٍ التحميل...</div>
        </DialogContent>
      </Dialog>
    );
    const st = statusBadge(inv.status);
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[#0a3d62] text-sm font-semibold">
                <ReceiptText size={16} /> فاتورة {inv.invoiceNo}
              </span>
              <div className="flex items-center gap-2">
                <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                  {st.icon}{inv.status}
                </span>
                {inv.status === "صادرة" && (
                  <>
                    <Button size="sm" variant="outline" className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => statusMut.mutate("مدفوعة")} disabled={statusMut.isPending}>تحديد كمدفوعة</Button>
                    <Button size="sm" variant="outline" className="text-xs h-7 border-red-300 text-red-700 hover:bg-red-50" onClick={() => statusMut.mutate("ملغاة")} disabled={statusMut.isPending}>إلغاء</Button>
                  </>
                )}
                {(inv.status === "ملغاة") && (
                  <Button size="sm" variant="outline"
                    className="text-xs h-7 border-red-400 text-red-700 hover:bg-red-50 gap-1"
                    onClick={() => { if (window.confirm(`حذف الفاتورة ${inv.invoiceNo} نهائياً؟`)) deleteMut.mutate(); }}
                    disabled={deleteMut.isPending}>
                    <Trash2 size={12}/> حذف نهائي
                  </Button>
                )}
                <Button size="sm" className="text-xs h-7 bg-[#0a3d62] hover:bg-[#0c4f7e] text-white gap-1" onClick={handlePrint}>
                  <Printer size={13} /> طباعة
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <PrintInvoiceView invoice={inv} />
        </DialogContent>
      </Dialog>
    );
  }

  /* ─── Order Detail Sheet ──────────────────────────────────────────────── */
  function OrderDetailSheet({ orderId, onClose }: { orderId: number; onClose: () => void }) {
    const qc = useQueryClient();
    const [showAddCost, setShowAddCost] = useState(false);
    const [showIssueInv, setShowIssueInv] = useState(false);
    const [viewInvoiceId, setViewInvoiceId] = useState<number | null>(null);

    const { data: order, isLoading } = useQuery<OrderDetail>({
      queryKey: ["acc-order", orderId],
      queryFn: () => apiFetch(`${BASE}/orders/${orderId}`),
    });
    const deleteCost = useMutation({
      mutationFn: (id: number) => apiFetch(`${BASE}/costs/${id}`, { method: "DELETE" }),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["acc-order", orderId] }); qc.invalidateQueries({ queryKey: ["acc-orders"] }); },
    });

    if (isLoading || !order) return (
      <Sheet open onOpenChange={onClose}>
        <SheetContent side="left" className="w-full sm:max-w-3xl" style={{ direction: "rtl" }}>
          <div className="flex items-center justify-center h-full text-[#6a6d70] text-sm">جارٍ التحميل...</div>
        </SheetContent>
      </Sheet>
    );

    // FIX: use permits.length not permitsCount in detail view
    const permitsLen = order.permits?.length ?? 0;
    const subBadge = statusBadge(order.status);
    const canAct = !order.invoice;
    // order.totalAmount from API = subtotal + VAT (backend fin overrides DB field)
    // order.subtotal = pre-VAT amount, order.vatAmount = VAT amount
    const subtotalAmt = round2(order.subtotal ?? 0);
    const vatAmt = round2(order.vatAmount ?? 0);
    const invoiceTotal = round2(subtotalAmt + vatAmt); // = order.totalAmount
    const profit = round2(invoiceTotal - (order.totalCosts ?? 0));

    return (
      <>
        <Sheet open onOpenChange={onClose}>
          <SheetContent side="left" className="w-full sm:max-w-3xl overflow-y-auto p-0" style={{ direction: "rtl" }}>
            {/* SAP-style header */}
            <div style={{ background: "#0a3d62", color: "white", padding: "16px 24px" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-blue-200 mb-1">تفاصيل أمر الشراء</div>
                  <div className="font-bold text-lg">{order.orderNo}</div>
                  {order.customerPoNo && <div className="text-xs text-blue-200 mt-0.5">PO: {order.customerPoNo}</div>}
                </div>
                <span style={{ background: subBadge.bg, color: subBadge.color, border: `1px solid ${subBadge.border}`, padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                  {subBadge.icon}{order.status}
                </span>
              </div>
              {/* KPIs */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                {[
                  { label: "قيمة الأمر (قبل الضريبة)", val: `${fmt(subtotalAmt)} ج.م`, color: "#fff" },
                  { label: "إجمالي الفاتورة", val: `${fmt(invoiceTotal)} ج.م`, color: "#bbdefb" },
                  { label: "إجمالي التكاليف", val: `${fmt(order.totalCosts ?? 0)} ج.م`, color: "#ffccbc" },
                  { label: "صافي الربح", val: `${fmt(profit)} ج.م`, color: profit >= 0 ? "#c8e6c9" : "#ffcdd2" },
                ].map(k => (
                  <div key={k.label} style={{ background: "rgba(255,255,255,0.1)", borderRadius: "6px", padding: "8px 10px" }}>
                    <div style={{ color: "#bbdefb", fontSize: "10px", marginBottom: "2px" }}>{k.label}</div>
                    <div style={{ color: k.color, fontSize: "13px", fontWeight: "700" }}>{k.val}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Info row */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                {[
                  { label: "العميل", val: order.customerName || "—" },
                  { label: "تاريخ الأمر", val: order.orderDate },
                  // FIX: use permitsLen (from permits.length) instead of permitsCount
                  { label: "إذون التسليم", val: `${permitsLen} إذن — ${order.allDelivered ? "مكتملة ✓" : "جارية"}` },
                ].map(f => (
                  <div key={f.label} style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "4px", padding: "8px 10px" }}>
                    <div style={{ color: "#6a6d70", marginBottom: "2px" }}>{f.label}</div>
                    <div style={{ fontWeight: "600", color: "#32363a" }}>{f.val}</div>
                  </div>
                ))}
              </div>

              {/* Invoice status / actions */}
              {order.invoice ? (
                <div style={{ background: "#e3f2fd", border: "1px solid #90caf9", borderRadius: "6px", padding: "12px 14px" }}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[#0d47a1]">
                      <ReceiptText size={16} /> فاتورة {order.invoice.invoiceNo} — {order.invoice.status}
                    </span>
                    <Button size="sm" className="h-7 text-xs bg-[#0a3d62] hover:bg-[#0c4f7e] text-white gap-1" onClick={() => setViewInvoiceId(order.invoice!.id)}>
                      <Eye size={12} /> عرض الفاتورة
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-[#1565c0] grid grid-cols-3 gap-2">
                    <span>الإجمالي: <strong>{fmt(order.invoice.totalAmount)} ج.م</strong></span>
                    <span>ض.ق.م: <strong>{fmt(order.invoice.vatAmount)} ج.م</strong></span>
                    <span>صافي الربح: <strong className={parseFloat(order.invoice.netProfit||"0") >= 0 ? "text-emerald-700" : "text-red-700"}>{fmt(order.invoice.netProfit)} ج.م</strong></span>
                  </div>
                </div>
              ) : order.canInvoice ? (
                <div style={{ background: "#f3e5f5", border: "1px solid #ce93d8", borderRadius: "6px", padding: "12px 14px" }} className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-purple-900">جاهز لإصدار الفاتورة الضريبية ✓</div>
                  <Button size="sm" className="h-7 text-xs bg-purple-700 hover:bg-purple-800 text-white gap-1" onClick={() => setShowIssueInv(true)}>
                    <ReceiptText size={12} /> إصدار الفاتورة
                  </Button>
                </div>
              ) : (
                <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: "6px", padding: "10px 14px" }} className="flex items-center gap-2 text-xs text-amber-800">
                  <AlertTriangle size={14} className="shrink-0" />
                  يجب اكتمال جميع إذون التسليم قبل إصدار الفاتورة
                </div>
              )}

              {/* Order Items */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers size={14} className="text-[#0a6ed1]" />
                  <span className="text-xs font-semibold text-[#0a3d62] uppercase tracking-wide">بنود أمر الشراء (بنود الفاتورة للعميل)</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#e8edf2", color: "#32363a" }}>
                      <th style={{ padding: "7px 8px", textAlign: "right", fontWeight: "600" }}>#</th>
                      <th style={{ padding: "7px 8px", textAlign: "right", fontWeight: "600" }}>الوصف</th>
                      <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: "600" }}>رقم القطعة</th>
                      <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: "600" }}>الكمية</th>
                      <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: "600" }}>سعر الوحدة</th>
                      <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: "600" }}>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.length > 0 ? order.items.map((it, i) => (
                      <tr key={it.id} style={{ borderBottom: "1px solid #e9ecef", background: i % 2 ? "#f8f9fa" : "#fff" }}>
                        <td style={{ padding: "6px 8px", color: "#6a6d70" }}>{i + 1}</td>
                        <td style={{ padding: "6px 8px" }}>{it.description}</td>
                        <td style={{ padding: "6px 8px", textAlign: "center", fontFamily: "monospace", color: "#495057" }}>{it.partNo || "—"}</td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>{fmt(it.quantity, 3)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>{fmt(it.unitPrice, 3)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: "700" }}>{fmt(it.totalPrice)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} style={{ padding: "14px", textAlign: "center", color: "#adb5bd" }}>لا توجد بنود</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f8f9fa", borderTop: "1px solid #dee2e6" }}>
                      <td colSpan={5} style={{ padding: "7px 8px", textAlign: "right", color: "#6a6d70" }}>المجموع قبل الضريبة</td>
                      <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: "600", color: "#32363a" }}>{fmt(subtotalAmt)} ج.م</td>
                    </tr>
                    <tr style={{ background: "#fff8e1", borderTop: "1px solid #ffe082" }}>
                      <td colSpan={5} style={{ padding: "7px 8px", textAlign: "right", color: "#e65100" }}>
                        ضريبة القيمة المضافة ({order.vatRate ?? 14}%)
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: "600", color: "#e65100" }}>{fmt(vatAmt)} ج.م</td>
                    </tr>
                    <tr style={{ background: "#0a3d62" }}>
                      <td colSpan={5} style={{ padding: "8px", textAlign: "right", color: "white", fontWeight: "700" }}>إجمالي الفاتورة للعميل</td>
                      <td style={{ padding: "8px", textAlign: "center", color: "white", fontWeight: "900", fontSize: "14px" }}>{fmt(invoiceTotal)} ج.م</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Additional Costs — Internal */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <BarChart3 size={14} className="text-[#0a6ed1]" />
                    <span className="text-xs font-semibold text-[#0a3d62] uppercase tracking-wide">التكاليف الداخلية (لا تظهر للعميل)</span>
                  </div>
                  {canAct && (
                    <Button size="sm" variant="outline" className="h-6 text-xs border-[#0a6ed1] text-[#0a6ed1] hover:bg-blue-50 gap-1" onClick={() => setShowAddCost(true)}>
                      <Plus size={11} /> إضافة تكلفة
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {/* 3% Customer Insurance — AUTO calculated */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f3e5f5", border: "1px solid #ce93d8", borderRadius: "4px", padding: "8px 12px", fontSize: "12px" }}>
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={13} style={{ color: "#7b1fa2" }} />
                      <span style={{ color: "#6a6d70" }}>
                        تأمينات أمر الشراء ({CUSTOMER_INSURANCE_RATE}% × {fmt(subtotalAmt)} ج.م)
                      </span>
                      <span style={{ background: "#7b1fa2", color: "white", fontSize: "9px", padding: "1px 5px", borderRadius: "8px" }}>محسوب تلقائياً</span>
                    </div>
                    <span style={{ fontWeight: "700", color: "#7b1fa2" }}>{fmt(order.customerInsurance ?? round2(subtotalAmt * 0.03))} ج.م</span>
                  </div>

                  {/* Supplier cost */}
                  {(order.supplierOrdersCount ?? 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff8e1", border: "1px solid #ffe082", borderRadius: "4px", padding: "8px 12px", fontSize: "12px" }}>
                      <span style={{ color: "#6a6d70" }}>إجمالي أسعار بنود المورد ({order.supplierOrdersCount} أمر توريد)</span>
                      <span style={{ fontWeight: "700", color: "#d84315" }}>{fmt(order.supplierTotal ?? 0)} ج.م</span>
                    </div>
                  )}

                  {/* Manual costs */}
                  {order.costs.length > 0 && (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: "#e8edf2" }}>
                          <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: "600" }}>النوع</th>
                          <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: "600" }}>الوصف</th>
                          <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: "600" }}>المبلغ</th>
                          {canAct && <th style={{ padding: "6px 8px", width: "36px" }}></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {order.costs.map((c, i) => (
                          <tr key={c.id} style={{ borderBottom: "1px solid #e9ecef", background: i % 2 ? "#f8f9fa" : "#fff" }}>
                            <td style={{ padding: "6px 8px" }}>
                              <span style={{ background: "#fff8e1", color: "#e65100", border: "1px solid #ffe082", padding: "1px 6px", borderRadius: "8px", fontSize: "11px" }}>
                                {COST_TYPES.find(t => t.key === c.costType)?.label ?? c.costType}
                              </span>
                            </td>
                            <td style={{ padding: "6px 8px", color: "#495057" }}>{c.description}</td>
                            <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: "600" }}>{fmt(c.totalAmount)} ج.م</td>
                            {canAct && (
                              <td style={{ padding: "6px 8px", textAlign: "center" }}>
                                <button onClick={() => deleteCost.mutate(c.id)} style={{ color: "#bb0000", cursor: "pointer", background: "none", border: "none", padding: "2px" }}>
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {order.costs.length === 0 && (order.supplierOrdersCount ?? 0) === 0 && (
                    <div style={{ textAlign: "center", color: "#adb5bd", fontSize: "12px", padding: "10px", background: "#f8f9fa", border: "1px dashed #dee2e6", borderRadius: "4px" }}>لا توجد تكاليف مورد أو شحن</div>
                  )}
                </div>

                {/* Total cost summary */}
                <div style={{ background: "#e8edf2", borderRadius: "4px", padding: "8px 12px", marginTop: "8px", display: "grid", gridTemplateColumns: "1fr auto", fontSize: "12px", fontWeight: "700", color: "#32363a", gap: "4px" }}>
                  <span>إجمالي التكاليف الكلية</span>
                  <span style={{ color: "#d84315" }}>{fmt(order.totalCosts ?? 0)} ج.م</span>
                  <span style={{ fontWeight: "400", color: "#6a6d70", fontSize: "10px" }}>
                    مورد {fmt(order.supplierTotal ?? 0)} + تأمين {fmt(order.customerInsurance ?? 0)} + أخرى {fmt(order.manualCosts ?? 0)}
                  </span>
                  <span style={{ color: profit >= 0 ? "#1b5e20" : "#b71c1c", fontWeight: "700" }}>ربح: {fmt(profit)} ج.م</span>
                </div>
              </div>

              {/* Delivery Permits */}
              {order.permits.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle2 size={14} className="text-[#0a6ed1]" />
                    <span className="text-xs font-semibold text-[#0a3d62] uppercase tracking-wide">إذون التسليم ({permitsLen})</span>
                  </div>
                  <div className="space-y-1.5">
                    {order.permits.map(p => {
                      const pb = permitBadge(p.status);
                      return (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "4px", padding: "7px 10px", fontSize: "12px" }}>
                          <div style={{ fontFamily: "monospace", fontWeight: "600" }}>{p.permitNo}</div>
                          <div style={{ color: "#6a6d70" }}>{p.supplierName || "—"}</div>
                          <div style={{ color: "#6a6d70" }}>{p.deliveryDate}</div>
                          <span style={{ background: pb.bg, color: pb.color, border: `1px solid ${pb.border}`, padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" }}>{p.status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {showAddCost && <AddCostDialog orderId={orderId} onClose={() => setShowAddCost(false)} />}
        {showIssueInv && order && <IssueInvoiceDialog order={order} onClose={() => setShowIssueInv(false)} />}
        {viewInvoiceId && <InvoiceDetailDialog invoiceId={viewInvoiceId} onClose={() => setViewInvoiceId(null)} />}
      </>
    );
  }


  /* ─── Add Company Expense Dialog ──────────────────────────────────────── */
  function AddCompanyExpenseDialog({ onClose }: { onClose: () => void }) {
    const qc = useQueryClient();
    const today = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({ expenseType: COMPANY_EXPENSE_TYPES[0].key, description: "", amount: "", expenseDate: today, referenceNo: "", notes: "" });
    const [error, setError] = useState("");
    const mutation = useMutation({
      mutationFn: (body: object) => apiFetch(`${BASE}/expenses`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["acc-expenses"] }); onClose(); },
      onError: (e: Error) => setError(e.message),
    });
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-[#0a3d62]">إضافة مصروف عام للشركة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
            <div>
              <Label className="text-xs">نوع المصروف <span className="text-red-500">*</span></Label>
              <select className="mt-1 w-full border border-gray-300 rounded-md text-sm h-8 px-2" style={{ fontFamily: "'Cairo', Arial, sans-serif", direction: "rtl" }}
                value={form.expenseType} onChange={e => setForm(p => ({ ...p, expenseType: e.target.value }))}>
                {COMPANY_EXPENSE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">الوصف <span className="text-red-500">*</span></Label>
              <Input className="mt-1 text-sm h-8" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="وصف المصروف" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">المبلغ (ج.م) <span className="text-red-500">*</span></Label>
                <Input className="mt-1 text-sm h-8" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">التاريخ <span className="text-red-500">*</span></Label>
                <Input className="mt-1 text-sm h-8" type="date" value={form.expenseDate} onChange={e => setForm(p => ({ ...p, expenseDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">رقم المرجع</Label>
              <Input className="mt-1 text-sm h-8" value={form.referenceNo} onChange={e => setForm(p => ({ ...p, referenceNo: e.target.value }))} placeholder="اختياري" />
            </div>
            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Input className="mt-1 text-sm h-8" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="اختياري" />
            </div>
          </div>
          <DialogFooter>
            <button style={{ padding: "6px 14px", border: "1px solid #dee2e6", borderRadius: "4px", fontSize: "12px", cursor: "pointer", background: "#fff", fontFamily: "'Cairo', Arial, sans-serif" }} onClick={onClose}>إلغاء</button>
            <button style={{ padding: "6px 14px", background: "#0a3d62", color: "white", border: "none", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo', Arial, sans-serif" }}
              onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.description.trim() || !form.amount || !form.expenseDate}>
              {mutation.isPending ? "جارٍ الحفظ..." : "إضافة المصروف"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  /* ─── Main Page ───────────────────────────────────────────────────────── */
  export default function AccountsPage() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [viewInvoiceId, setViewInvoiceId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<"orders" | "invoices" | "expenses">("orders");

    const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery<OrderSummary[]>({
      queryKey: ["acc-orders"],
      queryFn: () => apiFetch(`${BASE}/orders`),
    });
    const { data: invoices = [], isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery<Invoice[]>({
      queryKey: ["acc-invoices"],
      queryFn: () => apiFetch(`${BASE}/invoices`),
    });
    const { data: expenses = [], isLoading: expensesLoading, refetch: refetchExpenses } = useQuery<CompanyExpense[]>({
      queryKey: ["acc-expenses"],
      queryFn: () => apiFetch(`${BASE}/expenses`),
    });
    const [showAddExpense, setShowAddExpense] = useState(false);
    const qcMain = useQueryClient();
    const deleteExpense = useMutation({
      mutationFn: (id: number) => apiFetch(`${BASE}/expenses/${id}`, { method: "DELETE" }),
      onSuccess: () => qcMain.invalidateQueries({ queryKey: ["acc-expenses"] }),
    });

    const filteredOrders = useMemo(() => {
      const q = search.toLowerCase();
      return orders.filter(o => {
        const matchSearch = !q || o.orderNo.toLowerCase().includes(q) || (o.customerPoNo ?? "").toLowerCase().includes(q) || (o.customerName ?? "").toLowerCase().includes(q);
        const matchStatus = statusFilter === "all" || o.status === statusFilter;
        return matchSearch && matchStatus;
      });
    }, [orders, search, statusFilter]);

    const filteredInvoices = useMemo(() => {
      const q = search.toLowerCase();
      return invoices.filter(inv => !q || inv.invoiceNo.toLowerCase().includes(q) || (inv.customerName ?? "").toLowerCase().includes(q) || (inv.customerPoNo ?? "").toLowerCase().includes(q));
    }, [invoices, search]);

    const kpi = useMemo(() => {
      const invoiced = orders.filter(o => o.invoice).length;
      const totalRevenue   = invoices.reduce((s, i) => s + parseFloat(i.totalAmount || "0"), 0);
      const totalProfit    = invoices.reduce((s, i) => s + parseFloat(i.netProfit  || "0"), 0);
      const totalExpenses  = expenses.reduce((s, e) => s + parseFloat(e.amount    || "0"), 0);
      const netAfterExp    = round2(totalProfit - totalExpenses);
      const pending = orders.filter(o => !o.invoice && o.allDelivered).length;
      return { total: orders.length, invoiced, pending, revenue: round2(totalRevenue), profit: round2(totalProfit), expenses: round2(totalExpenses), netAfterExp };
    }, [orders, invoices, expenses]);

    const statusOptions = useMemo(() => ["all", ...new Set(orders.map(o => o.status))], [orders]);

    return (
      <AppLayout>
        <div style={{ fontFamily: "'Cairo', Arial, sans-serif", direction: "rtl", minHeight: "100vh", background: "#f5f5f5" }}>

          {/* SAP Header */}
          <div style={{ background: "#0a3d62", color: "white", padding: "12px 24px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#bbdefb", marginBottom: "2px" }}>المحاسبة والفواتير</div>
                <h1 style={{ fontSize: "20px", fontWeight: "800", margin: 0 }}>منظومة الحسابات والفاتورة الإلكترونية</h1>
                <div style={{ fontSize: "10px", color: "#90caf9", marginTop: "2px" }}>
                  متوافق مع ETA المصرية — قانون ٦٧/٢٠١٦ — ض.ق.م ١٤٪ — تأمينات ٣٪
                </div>
              </div>
              <button onClick={() => { refetchOrders(); refetchInvoices(); refetchExpenses(); }} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", padding: "7px 12px", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                <RefreshCw size={13} /> تحديث
              </button>
            </div>

            {/* KPI Row */}
            <div style={{ display: "flex", gap: "1px", background: "rgba(255,255,255,0.1)", borderRadius: "6px 6px 0 0", overflow: "hidden" }}>
              {[
                { label: "أوامر الشراء", val: kpi.total, icon: <Package size={14}/> },
                { label: "صدرت الفاتورة", val: kpi.invoiced, icon: <ReceiptText size={14}/> },
                { label: "جاهزة للفوترة", val: kpi.pending, icon: <Clock size={14}/> },
                { label: "إجمالي الإيرادات", val: `${fmt(kpi.revenue)} ج.م`, icon: <TrendingUp size={14}/> },
                { label: "أرباح الفواتير", val: `${fmt(kpi.profit)} ج.م`, icon: <TrendingUp size={14}/>, color: "#fff" },
                { label: "المصاريف العامة", val: `- ${fmt(kpi.expenses)} ج.م`, icon: <TrendingDown size={14}/>, color: "#ffcdd2" },
                { label: "صافي الأرباح الفعلي", val: `${fmt(kpi.netAfterExp)} ج.م`, icon: kpi.netAfterExp >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>, color: kpi.netAfterExp >= 0 ? "#c8e6c9" : "#ffcdd2", bold: true },
              ].map(k => (
                <div key={k.label} style={{ flex: 1, background: (k as any).bold ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)", padding: "10px 14px", borderRight: (k as any).bold ? "2px solid rgba(255,255,255,0.3)" : undefined, borderLeft: (k as any).bold ? "2px solid rgba(255,255,255,0.3)" : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#bbdefb", fontSize: "10px", marginBottom: "3px" }}>
                    {k.icon} {k.label}
                  </div>
                  <div style={{ color: (k as any).color ?? "#fff", fontWeight: (k as any).bold ? "900" : "800", fontSize: (k as any).bold ? "16px" : "15px" }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex" }}>
              {([
                { key: "orders" as const, label: "أوامر الشراء", count: orders.length },
                { key: "invoices" as const, label: "الفواتير الضريبية", count: invoices.length },
                { key: "expenses" as const, label: "المصاريف العامة للشركة", count: expenses.length },
              ]).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                  padding: "9px 20px", fontSize: "12px", fontWeight: activeTab === tab.key ? "700" : "400",
                  background: activeTab === tab.key ? "#fff" : "transparent",
                  color: activeTab === tab.key ? "#0a3d62" : "#bbdefb",
                  border: "none", borderRadius: activeTab === tab.key ? "6px 6px 0 0" : "0",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                }}>
                  {tab.label}
                  <span style={{ background: activeTab === tab.key ? "#0a3d62" : "rgba(255,255,255,0.2)", color: "white", borderRadius: "10px", padding: "0 6px", fontSize: "10px" }}>{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div style={{ background: "#fff", borderBottom: "1px solid #dee2e6", padding: "10px 24px", display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "360px" }}>
              <Search size={14} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#6a6d70" }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={activeTab === "orders" ? "بحث في أوامر الشراء..." : activeTab === "invoices" ? "بحث في الفواتير..." : "بحث في المصاريف..."}
                style={{ width: "100%", padding: "7px 32px 7px 10px", border: "1px solid #dee2e6", borderRadius: "4px", fontSize: "12px", fontFamily: "'Cairo', Arial, sans-serif", direction: "rtl" }}
              />
            </div>
            {activeTab === "orders" && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <Filter size={13} style={{ color: "#6a6d70" }} />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  style={{ padding: "6px 10px", border: "1px solid #dee2e6", borderRadius: "4px", fontSize: "12px", fontFamily: "'Cairo', Arial, sans-serif", direction: "rtl", color: "#32363a" }}>
                  <option value="all">كل الحالات</option>
                  {statusOptions.filter(s => s !== "all").map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            {activeTab === "expenses" && (
              <button
                onClick={() => setShowAddExpense(true)}
                style={{ display: "flex", alignItems: "center", gap: "5px", background: "#0a3d62", color: "white", border: "none", borderRadius: "4px", padding: "7px 14px", fontSize: "12px", cursor: "pointer", fontFamily: "'Cairo', Arial, sans-serif" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                إضافة مصروف
              </button>
            )}
            <div style={{ marginRight: "auto", fontSize: "11px", color: "#6a6d70" }}>
              {activeTab === "orders" ? `${filteredOrders.length} أمر` : activeTab === "invoices" ? `${filteredInvoices.length} فاتورة` : `${expenses.length} مصروف`}
            </div>
          </div>

          {/* Tables */}
          <div style={{ padding: "0 24px 24px" }}>
            {activeTab === "orders" && (
              <div style={{ background: "#fff", border: "1px solid #dee2e6", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "auto" }}>
                {ordersLoading ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#6a6d70", fontSize: "13px" }}>جارٍ التحميل...</div>
                ) : filteredOrders.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#adb5bd", fontSize: "13px" }}>لا توجد أوامر شراء</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#e8edf2", color: "#32363a" }}>
                        {["رقم الأمر", "PO العميل", "العميل", "التاريخ", "قيمة الأمر", "إجمالي الفاتورة", "التأمينات ٣٪", "إجمالي التكاليف", "صافي الربح", "إذون", "الفاتورة", "الحالة", ""].map(h => (
                          <th key={h} style={{ padding: "9px 10px", textAlign: "right", fontWeight: "600", whiteSpace: "nowrap", borderBottom: "2px solid #dee2e6" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o, idx) => {
                        const sb = statusBadge(o.status);
                        // o.totalAmount from API = subtotal + VAT (backend overrides DB value)
                        // o.subtotal = pre-VAT amount from backend fin
                        const invTotal = round2((o.subtotal ?? 0) + (o.vatAmount ?? 0));
                        const profit = round2(invTotal - (o.totalCosts ?? 0));
                        const insurance = o.customerInsurance ?? round2((o.subtotal ?? 0) * 0.03);
                        return (
                          <tr key={o.id}
                            style={{ borderBottom: "1px solid #f1f3f5", background: idx % 2 === 0 ? "#fff" : "#fafbfc", cursor: "pointer" }}
                            onClick={() => setSelectedOrderId(o.id)}
                            onMouseEnter={e => (e.currentTarget.style.background = "#e3f2fd")}
                            onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafbfc")}>
                            <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: "700", color: "#0a3d62" }}>{o.orderNo}</td>
                            <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#495057" }}>{o.customerPoNo || "—"}</td>
                            <td style={{ padding: "8px 10px", fontWeight: "600" }}>{o.customerName || "—"}</td>
                            <td style={{ padding: "8px 10px", color: "#6a6d70" }}>{o.orderDate}</td>
                            <td style={{ padding: "8px 10px", fontWeight: "600" }}>{fmt(o.totalAmount)} ج.م</td>
                            <td style={{ padding: "8px 10px", fontWeight: "700", color: "#0a3d62" }}>{fmt(invTotal)} ج.م</td>
                            <td style={{ padding: "8px 10px", color: "#7b1fa2", fontWeight: "600" }}>{fmt(insurance)} ج.م</td>
                            <td style={{ padding: "8px 10px", color: "#d84315" }}>{fmt(o.totalCosts ?? 0)} ج.م</td>
                            <td style={{ padding: "8px 10px", fontWeight: "700", color: profit >= 0 ? "#1b5e20" : "#b71c1c" }}>{fmt(profit)} ج.م</td>
                            <td style={{ padding: "8px 10px", textAlign: "center" }}>
                              <span style={{ background: o.allDelivered ? "#e8f5e9" : "#fff8e1", color: o.allDelivered ? "#1b5e20" : "#e65100", padding: "2px 6px", borderRadius: "10px", fontSize: "10px" }}>
                                {o.permitsCount} {o.allDelivered ? "✓" : "جاري"}
                              </span>
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              {o.invoice ? (
                                <button onClick={e => { e.stopPropagation(); setViewInvoiceId(o.invoice!.id); }}
                                  style={{ background: "#e3f2fd", color: "#0d47a1", border: "1px solid #90caf9", borderRadius: "10px", padding: "2px 8px", fontSize: "10px", cursor: "pointer", fontFamily: "'Cairo', Arial, sans-serif", display: "flex", alignItems: "center", gap: "3px" }}>
                                  <Eye size={10} /> {o.invoice.invoiceNo}
                                </button>
                              ) : o.allDelivered ? (
                                <span style={{ background: "#f3e5f5", color: "#7b1fa2", border: "1px solid #ce93d8", borderRadius: "10px", padding: "2px 8px", fontSize: "10px" }}>جاهز</span>
                              ) : (
                                <span style={{ color: "#adb5bd", fontSize: "10px" }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <span style={{ background: sb.bg, color: sb.color, border: `1px solid ${sb.border}`, padding: "2px 7px", borderRadius: "10px", fontSize: "10px", fontWeight: "600", display: "flex", alignItems: "center", gap: "3px", width: "fit-content" }}>
                                {sb.icon}{o.status}
                              </span>
                            </td>
                            <td style={{ padding: "8px 10px" }}><ChevronRight size={14} style={{ color: "#6a6d70" }} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === "invoices" && (
              <div style={{ background: "#fff", border: "1px solid #dee2e6", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "auto" }}>
                {invoicesLoading ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#6a6d70", fontSize: "13px" }}>جارٍ التحميل...</div>
                ) : filteredInvoices.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#adb5bd", fontSize: "13px" }}>لا توجد فواتير</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#e8edf2", color: "#32363a" }}>
                        {["رقم الفاتورة", "تاريخ الإصدار", "العميل", "PO العميل", "المجموع قبل الضريبة", "ض.ق.م 14%", "إجمالي الفاتورة", "صافي الربح", "الحالة", ""].map(h => (
                          <th key={h} style={{ padding: "9px 10px", textAlign: "right", fontWeight: "600", whiteSpace: "nowrap", borderBottom: "2px solid #dee2e6" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv, idx) => {
                        const sb = statusBadge(inv.status);
                        const profit = parseFloat(inv.netProfit || "0");
                        return (
                          <tr key={inv.id}
                            style={{ borderBottom: "1px solid #f1f3f5", background: idx % 2 === 0 ? "#fff" : "#fafbfc", cursor: "pointer" }}
                            onClick={() => setViewInvoiceId(inv.id)}
                            onMouseEnter={e => (e.currentTarget.style.background = "#e3f2fd")}
                            onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafbfc")}>
                            <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: "700", color: "#0a3d62" }}>{inv.invoiceNo}</td>
                            <td style={{ padding: "8px 10px", color: "#6a6d70" }}>{inv.invoiceDate}</td>
                            <td style={{ padding: "8px 10px", fontWeight: "600" }}>{inv.customerName || "—"}</td>
                            <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#495057" }}>{inv.customerPoNo || "—"}</td>
                            <td style={{ padding: "8px 10px" }}>{fmt(inv.subtotal)} ج.م</td>
                            <td style={{ padding: "8px 10px", color: "#e65100" }}>{fmt(inv.vatAmount)} ج.م</td>
                            <td style={{ padding: "8px 10px", fontWeight: "700", color: "#0a3d62" }}>{fmt(inv.totalAmount)} ج.م</td>
                            <td style={{ padding: "8px 10px", fontWeight: "700", color: profit >= 0 ? "#1b5e20" : "#b71c1c" }}>{fmt(profit)} ج.م</td>
                            <td style={{ padding: "8px 10px" }}>
                              <span style={{ background: sb.bg, color: sb.color, border: `1px solid ${sb.border}`, padding: "2px 7px", borderRadius: "10px", fontSize: "10px", fontWeight: "600", display: "flex", alignItems: "center", gap: "3px", width: "fit-content" }}>
                                {sb.icon}{inv.status}
                              </span>
                            </td>
                            <td style={{ padding: "8px 10px" }}><ChevronRight size={14} style={{ color: "#6a6d70" }} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === "expenses" && (
              <div style={{ background: "#fff", border: "1px solid #dee2e6", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "auto" }}>
                {expensesLoading ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#6a6d70", fontSize: "13px" }}>جارٍ التحميل...</div>
                ) : expenses.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 40px" }}>
                    <div style={{ fontSize: "36px", marginBottom: "12px" }}>🏢</div>
                    <div style={{ color: "#adb5bd", fontSize: "13px", fontWeight: "600" }}>لا توجد مصاريف عامة مسجّلة</div>
                    <div style={{ color: "#ced4da", fontSize: "11px", marginTop: "6px" }}>اضغط "إضافة مصروف" لإضافة أول مصروف</div>
                  </div>
                ) : (
                  <>
                    <div style={{ background: "#f8f9fa", borderBottom: "1px solid #dee2e6", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "#6a6d70" }}>إجمالي المصاريف العامة</span>
                      <span style={{ fontSize: "14px", fontWeight: "800", color: "#b71c1c" }}>
                        {(() => { const total = expenses.reduce((s, e) => s + parseFloat(e.amount || "0"), 0); return fmt(total); })() } ج.م
                      </span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: "#e8edf2", color: "#32363a" }}>
                          {["نوع المصروف", "الوصف", "المبلغ", "التاريخ", "رقم المرجع", "ملاحظات", ""].map(h => (
                            <th key={h} style={{ padding: "9px 10px", textAlign: "right", fontWeight: "600", whiteSpace: "nowrap", borderBottom: "2px solid #dee2e6" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((exp, idx) => {
                          const typeLabel = COMPANY_EXPENSE_TYPES.find(t => t.key === exp.expenseType)?.label ?? exp.expenseType;
                          return (
                            <tr key={exp.id}
                              style={{ borderBottom: "1px solid #f1f3f5", background: idx % 2 === 0 ? "#fff" : "#fafbfc" }}>
                              <td style={{ padding: "8px 10px" }}>
                                <span style={{ background: "#e8edf2", color: "#0a3d62", border: "1px solid #dee2e6", borderRadius: "10px", padding: "2px 8px", fontSize: "11px", fontWeight: "600" }}>{typeLabel}</span>
                              </td>
                              <td style={{ padding: "8px 10px", fontWeight: "600" }}>{exp.description}</td>
                              <td style={{ padding: "8px 10px", fontWeight: "700", color: "#b71c1c" }}>{fmt(exp.amount)} ج.م</td>
                              <td style={{ padding: "8px 10px", color: "#6a6d70" }}>{exp.expenseDate}</td>
                              <td style={{ padding: "8px 10px", color: "#495057", fontFamily: "monospace" }}>{exp.referenceNo || "—"}</td>
                              <td style={{ padding: "8px 10px", color: "#6a6d70" }}>{exp.notes || "—"}</td>
                              <td style={{ padding: "8px 10px" }}>
                                <button
                                  onClick={() => { if (window.confirm("حذف هذا المصروف نهائياً؟")) deleteExpense.mutate(exp.id); }}
                                  style={{ background: "#fce4ec", color: "#b71c1c", border: "1px solid #f48fb1", borderRadius: "4px", padding: "3px 8px", fontSize: "11px", cursor: "pointer", fontFamily: "'Cairo', Arial, sans-serif" }}>
                                  حذف
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {showAddExpense && <AddCompanyExpenseDialog onClose={() => setShowAddExpense(false)} />}
        {selectedOrderId && <OrderDetailSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />}
        {viewInvoiceId && <InvoiceDetailDialog invoiceId={viewInvoiceId} onClose={() => setViewInvoiceId(null)} />}
      </AppLayout>
    );
  }
  