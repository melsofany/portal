import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetCustomers, useGetSuppliers } from "@workspace/api-client-react";
import { API_BASE } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import {
  Users,
  Truck,
  ShoppingCart,
  FileText,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function getToken(): string | null {
  try { return localStorage.getItem("auth_token"); } catch { return null; }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

// ── types ─────────────────────────────────────────────────────────────────────

interface CustomerOrder {
  id: number;
  orderNo: string;
  customerName?: string;
  status: string;
  totalAmount?: string | null;
  createdAt: string;
  itemCount?: number;
}

interface Invoice {
  id: number;
  invoiceNo: string;
  status: string;
  totalAmount?: string | null;
  netProfit?: string | null;
  invoiceDate: string;
  customerName?: string;
}

// ── status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  "مفتوح":          "bg-blue-50 text-blue-700 ring-blue-700/20",
  "قيد التنفيذ":    "bg-amber-50 text-amber-700 ring-amber-700/20",
  "صدرت الفاتورة":  "bg-purple-50 text-purple-700 ring-purple-700/20",
  "مكتمل":          "bg-emerald-50 text-emerald-700 ring-emerald-700/20",
  "ملغى":           "bg-red-50 text-red-700 ring-red-700/20",
  "مسودة":          "bg-slate-50 text-slate-600 ring-slate-500/20",
  "صادرة":          "bg-indigo-50 text-indigo-700 ring-indigo-700/20",
  "مدفوعة":         "bg-emerald-50 text-emerald-700 ring-emerald-700/20",
  "ملغاة":          "bg-red-50 text-red-700 ring-red-700/20",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-50 text-slate-600 ring-slate-500/20";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-100 ${className}`} />;
}

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bg: string;
  loading?: boolean;
  sub?: string;
}

function KpiCard({ label, value, icon: Icon, color, bg, loading, sub }: KpiProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-20" />
        ) : (
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        )}
        {sub && !loading && (
          <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ── number format ─────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 0 });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: customers, isLoading: cLoading } = useGetCustomers({});
  const { data: suppliers, isLoading: sLoading } = useGetSuppliers({});

  const { data: orders, isLoading: oLoading } = useQuery<CustomerOrder[]>({
    queryKey: ["customer-orders"],
    queryFn: () => apiFetch("/api/customer-orders"),
  });

  const { data: invoices, isLoading: iLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: () => apiFetch("/api/accounts/invoices"),
  });

  // ── derived stats ────────────────────────────────────────────────────────

  const totalCustomers = customers?.length ?? 0;
  const activeSuppliers = suppliers?.filter((s: any) => s.status === "نشط").length ?? 0;

  const openOrders = orders?.filter(
    (o) => !["مكتمل", "ملغى"].includes(o.status)
  ).length ?? 0;

  const paidRevenue = invoices
    ?.filter((i) => i.status === "مدفوعة")
    .reduce((sum, i) => sum + parseFloat(i.totalAmount ?? "0"), 0) ?? 0;

  const totalProfit = invoices
    ?.filter((i) => i.status === "مدفوعة")
    .reduce((sum, i) => sum + parseFloat(i.netProfit ?? "0"), 0) ?? 0;

  const pendingInvoices = invoices?.filter((i) =>
    ["مسودة", "صادرة"].includes(i.status)
  ).length ?? 0;

  // latest 6 orders
  const recentOrders = [...(orders ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // latest 5 invoices
  const recentInvoices = [...(invoices ?? [])]
    .sort((a, b) => b.id - a.id)
    .slice(0, 5);

  const kpis: KpiProps[] = [
    {
      label: "إجمالي العملاء",
      value: totalCustomers,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      loading: cLoading,
    },
    {
      label: "الموردين النشطين",
      value: activeSuppliers,
      icon: Truck,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      loading: sLoading,
      sub: suppliers ? `من أصل ${suppliers.length}` : undefined,
    },
    {
      label: "الطلبات المفتوحة",
      value: openOrders,
      icon: ShoppingCart,
      color: "text-amber-600",
      bg: "bg-amber-50",
      loading: oLoading,
      sub: orders ? `إجمالي ${orders.length} طلب` : undefined,
    },
    {
      label: "الإيرادات المحصّلة",
      value: paidRevenue ? `${fmt(paidRevenue)} ج.م` : "—",
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
      loading: iLoading,
      sub:
        totalProfit > 0
          ? `صافي ربح: ${fmt(totalProfit)} ج.م`
          : undefined,
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>

        {/* ── Two-column: orders + invoices ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* recent orders */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-800">آخر أوامر الشراء</h2>
              {oLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              {!oLoading && orders && (
                <span className="text-xs text-slate-400">{orders.length} أمر</span>
              )}
            </div>

            {oLoading ? (
              <div className="space-y-3 p-5">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                <ShoppingCart className="h-8 w-8 opacity-30" />
                <p className="text-sm">لا توجد طلبات بعد</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-5 py-3">رقم الأمر</th>
                      <th className="px-5 py-3">العميل</th>
                      <th className="px-5 py-3">القيمة</th>
                      <th className="px-5 py-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700">
                    {recentOrders.map((o) => (
                      <tr key={o.id} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-5 py-3.5 font-medium text-slate-900">{o.orderNo}</td>
                        <td className="max-w-[140px] truncate px-5 py-3.5 text-slate-600">
                          {o.customerName || "—"}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {o.totalAmount && parseFloat(o.totalAmount) > 0
                            ? `${fmt(parseFloat(o.totalAmount))} ج.م`
                            : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* recent invoices */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-800">آخر الفواتير</h2>
              {iLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              {!iLoading && invoices && (
                <div className="flex items-center gap-3">
                  {pendingInvoices > 0 && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {pendingInvoices} معلّقة
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{invoices.length} فاتورة</span>
                </div>
              )}
            </div>

            {iLoading ? (
              <div className="space-y-3 p-5">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                <FileText className="h-8 w-8 opacity-30" />
                <p className="text-sm">لا توجد فواتير بعد</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-5 py-3">رقم الفاتورة</th>
                      <th className="px-5 py-3">الإجمالي</th>
                      <th className="px-5 py-3">صافي الربح</th>
                      <th className="px-5 py-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700">
                    {recentInvoices.map((inv) => {
                      const profit = parseFloat(inv.netProfit ?? "0");
                      return (
                        <tr key={inv.id} className="transition-colors hover:bg-slate-50/60">
                          <td className="px-5 py-3.5 font-medium text-slate-900">{inv.invoiceNo}</td>
                          <td className="px-5 py-3.5 text-slate-600">
                            {inv.totalAmount && parseFloat(inv.totalAmount) > 0
                              ? `${fmt(parseFloat(inv.totalAmount))} ج.م`
                              : "—"}
                          </td>
                          <td className={`px-5 py-3.5 font-medium ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {inv.netProfit != null
                              ? `${profit >= 0 ? "+" : ""}${fmt(profit)} ج.م`
                              : "—"}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={inv.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Status summary bar ── */}
        {!oLoading && orders && orders.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">توزيع حالات الطلبات</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(
                orders.reduce<Record<string, number>>((acc, o) => {
                  acc[o.status] = (acc[o.status] ?? 0) + 1;
                  return acc;
                }, {})
              )
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    {status === "مكتمل" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : status === "مفتوح" ? (
                      <Clock className="h-4 w-4 text-blue-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-sm font-medium text-slate-700">{status}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
