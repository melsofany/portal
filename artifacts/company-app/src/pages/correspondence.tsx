import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Plus, Search, Pencil, Trash2, X, Loader2, FileText,
  ArrowDownLeft, ArrowUpRight, Shield, ChevronDown, Filter,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as Record<string, string> ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
}

type DocType = "correspondence" | "memo" | "delegation";
type Direction = "incoming" | "outgoing" | "";
type Status = "open" | "pending" | "closed";
type Priority = "normal" | "urgent" | "confidential";

interface Doc {
  id: number;
  docNumber: string;
  type: DocType;
  direction: Direction | null;
  subject: string;
  fromTo: string | null;
  docDate: string | null;
  dueDate: string | null;
  status: Status;
  priority: Priority;
  notes: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<DocType, string> = {
  correspondence: "مخاطبة",
  memo: "مذكرة",
  delegation: "تفويض",
};
const DIR_LABELS: Record<string, string> = {
  incoming: "وارد",
  outgoing: "صادر",
};
const STATUS_LABELS: Record<Status, string> = {
  open: "مفتوح",
  pending: "معلق",
  closed: "مغلق",
};
const PRIORITY_LABELS: Record<Priority, string> = {
  normal: "عادي",
  urgent: "عاجل",
  confidential: "سري",
};

const STATUS_STYLE: Record<Status, string> = {
  open:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  closed:  "bg-slate-100 text-slate-500 border border-slate-200",
};
const PRIORITY_STYLE: Record<Priority, string> = {
  normal:       "bg-blue-50 text-blue-700 border border-blue-200",
  urgent:       "bg-red-50 text-red-700 border border-red-200",
  confidential: "bg-purple-50 text-purple-700 border border-purple-200",
};

const empty = (): Omit<Doc, "id" | "createdAt"> => ({
  docNumber: "",
  type: "correspondence",
  direction: "incoming",
  subject: "",
  fromTo: "",
  docDate: "",
  dueDate: "",
  status: "open",
  priority: "normal",
  notes: "",
  attachmentUrl: "",
  attachmentName: "",
});

export default function CorrespondencePage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDir, setFilterDir] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load docs on mount
  useState(() => {
    (async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/correspondence`);
        if (!res.ok) throw new Error("فشل في التحميل");
        setDocs(await res.json());
      } catch (e: any) {
        setError(e.message ?? "خطأ");
      } finally {
        setLoading(false);
      }
    })();
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(d => {
      if (filterType !== "all" && d.type !== filterType) return false;
      if (filterDir !== "all") {
        if (filterDir === "incoming" && d.direction !== "incoming") return false;
        if (filterDir === "outgoing" && d.direction !== "outgoing") return false;
      }
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (q) {
        return (
          d.docNumber.toLowerCase().includes(q) ||
          d.subject.toLowerCase().includes(q) ||
          (d.fromTo ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [docs, search, filterType, filterDir, filterStatus]);

  function openNew() {
    setEditing(null);
    setForm(empty());
    setFormErr(null);
    setModalOpen(true);
  }

  function openEdit(d: Doc) {
    setEditing(d);
    setForm({
      docNumber: d.docNumber,
      type: d.type,
      direction: d.direction ?? "",
      subject: d.subject,
      fromTo: d.fromTo ?? "",
      docDate: d.docDate ?? "",
      dueDate: d.dueDate ?? "",
      status: d.status,
      priority: d.priority,
      notes: d.notes ?? "",
      attachmentUrl: d.attachmentUrl ?? "",
      attachmentName: d.attachmentName ?? "",
    });
    setFormErr(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.docNumber.trim()) { setFormErr("رقم الوثيقة مطلوب"); return; }
    if (!form.subject.trim()) { setFormErr("الموضوع مطلوب"); return; }
    setSaving(true); setFormErr(null);
    try {
      const body = {
        ...form,
        direction: form.type === "delegation" ? null : (form.direction || null),
      };
      const url = editing
        ? `${API_BASE}/api/correspondence/${editing.id}`
        : `${API_BASE}/api/correspondence`;
      const res = await authFetch(url, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setFormErr(data.error ?? "حدث خطأ"); return; }
      if (editing) {
        setDocs(prev => prev.map(d => d.id === editing.id ? data : d));
      } else {
        setDocs(prev => [data, ...prev]);
      }
      setModalOpen(false);
    } catch {
      setFormErr("تعذر الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await authFetch(`${API_BASE}/api/correspondence/${deleteTarget.id}`, { method: "DELETE" });
      setDocs(prev => prev.filter(d => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  }

  const counters = useMemo(() => ({
    total:          docs.length,
    incoming:       docs.filter(d => d.direction === "incoming").length,
    outgoing:       docs.filter(d => d.direction === "outgoing").length,
    delegations:    docs.filter(d => d.type === "delegation").length,
    urgent:         docs.filter(d => d.priority === "urgent").length,
    open:           docs.filter(d => d.status === "open").length,
  }), [docs]);

  return (
    <AppLayout>
      <div dir="rtl" className="min-h-screen bg-[#f4f6f9]">
        {/* ── Header ── */}
        <div className="bg-[#0f2240] text-white px-6 py-4">
          <nav className="text-xs text-blue-300 mb-1 flex items-center gap-1">
            <span>الرئيسية</span>
            <span className="mx-1">›</span>
            <span className="text-white font-medium">المراسلات والوثائق</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">المراسلات والوثائق</h1>
              <p className="text-blue-300 text-xs mt-0.5">مخاطبات · مذاكرات · تفويضات · وارد · صادر</p>
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-2 bg-[#1e5fa8] hover:bg-[#1a52943] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow"
            >
              <Plus className="h-4 w-4" />
              إضافة وثيقة جديدة
            </button>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="px-6 py-4 grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "الإجمالي",    value: counters.total,       bg: "bg-[#1e3a5f]", text: "text-white" },
            { label: "واردة",       value: counters.incoming,    bg: "bg-emerald-600", text: "text-white" },
            { label: "صادرة",       value: counters.outgoing,    bg: "bg-blue-600",    text: "text-white" },
            { label: "تفويضات",     value: counters.delegations, bg: "bg-purple-600",  text: "text-white" },
            { label: "عاجل",        value: counters.urgent,      bg: "bg-red-600",     text: "text-white" },
            { label: "مفتوح",       value: counters.open,        bg: "bg-amber-500",   text: "text-white" },
          ].map((c, i) => (
            <div key={i} className={`${c.bg} ${c.text} rounded-xl px-4 py-3 text-center shadow-sm`}>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs opacity-80 mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="px-6 mb-4 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث برقم الوثيقة، الموضوع، من/إلى..."
              className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Type filter */}
          <div className="relative">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="appearance-none pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
            >
              <option value="all">كل الأنواع</option>
              <option value="correspondence">مخاطبة</option>
              <option value="memo">مذكرة</option>
              <option value="delegation">تفويض</option>
            </select>
            <ChevronDown className="absolute left-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Direction filter */}
          <div className="relative">
            <select
              value={filterDir}
              onChange={e => setFilterDir(e.target.value)}
              className="appearance-none pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
            >
              <option value="all">وارد وصادر</option>
              <option value="incoming">وارد فقط</option>
              <option value="outgoing">صادر فقط</option>
            </select>
            <ChevronDown className="absolute left-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="appearance-none pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
            >
              <option value="all">كل الحالات</option>
              <option value="open">مفتوح</option>
              <option value="pending">معلق</option>
              <option value="closed">مغلق</option>
            </select>
            <ChevronDown className="absolute left-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* ── Table ── */}
        <div className="px-6 pb-10">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>جاري التحميل...</span>
              </div>
            ) : error ? (
              <div className="py-20 text-center text-red-500 text-sm">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <FileText className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">لا توجد وثائق مطابقة</p>
                <button onClick={openNew} className="mt-4 text-sm text-blue-600 hover:underline">+ إضافة وثيقة جديدة</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="bg-[#eef1f5] border-b-2 border-slate-200">
                      {["رقم الوثيقة", "النوع", "الاتجاه", "الموضوع", "من / إلى", "التاريخ", "الأولوية", "الحالة", ""].map((h, i) => (
                        <th key={i} className="px-3 py-3 text-[11px] font-bold text-slate-600 whitespace-nowrap border-l border-slate-200 last:border-l-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((d, rowIdx) => (
                      <tr key={d.id} className={`transition-colors ${rowIdx % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"} hover:bg-blue-50/30`}>
                        <td className="px-3 py-3 border-l border-slate-100">
                          <span className="font-mono font-bold text-[#0f2240] text-[12px]">{d.docNumber}</span>
                        </td>
                        <td className="px-3 py-3 border-l border-slate-100">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                            {d.type === "correspondence" && <FileText className="h-3.5 w-3.5 text-blue-500" />}
                            {d.type === "memo" && <FileText className="h-3.5 w-3.5 text-amber-500" />}
                            {d.type === "delegation" && <Shield className="h-3.5 w-3.5 text-purple-500" />}
                            {TYPE_LABELS[d.type]}
                          </span>
                        </td>
                        <td className="px-3 py-3 border-l border-slate-100">
                          {d.direction ? (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${d.direction === "incoming" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                              {d.direction === "incoming"
                                ? <ArrowDownLeft className="h-3 w-3" />
                                : <ArrowUpRight className="h-3 w-3" />}
                              {DIR_LABELS[d.direction]}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 border-l border-slate-100 max-w-xs">
                          <span className="text-slate-800 text-[12px] font-medium line-clamp-1">{d.subject}</span>
                          {d.notes && <p className="text-slate-400 text-[10px] mt-0.5 line-clamp-1">{d.notes}</p>}
                        </td>
                        <td className="px-3 py-3 border-l border-slate-100 text-slate-500 text-[12px] whitespace-nowrap">
                          {d.fromTo || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 border-l border-slate-100 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                          {d.docDate || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 border-l border-slate-100">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLE[d.priority]}`}>
                            {PRIORITY_LABELS[d.priority]}
                          </span>
                        </td>
                        <td className="px-3 py-3 border-l border-slate-100">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[d.status]}`}>
                            {STATUS_LABELS[d.status]}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(d)} className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!loading && filtered.length > 0 && (
            <p className="text-[11px] text-slate-400 mt-2 text-left">
              عرض {filtered.length} من {docs.length} وثيقة
            </p>
          )}
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div dir="rtl" className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="bg-[#0f2240] text-white px-6 py-4 flex items-center justify-between">
              <h2 className="font-bold text-base">{editing ? "تعديل وثيقة" : "إضافة وثيقة جديدة"}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-white/10 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {formErr && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">
                  {formErr}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Doc Number */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">رقم الوثيقة <span className="text-red-500">*</span></label>
                  <input
                    value={form.docNumber}
                    onChange={e => setForm(f => ({ ...f, docNumber: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="مثال: COR-2026-001"
                  />
                </div>

                {/* Type */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">النوع <span className="text-red-500">*</span></label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as DocType, direction: e.target.value === "delegation" ? "" : f.direction }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  >
                    <option value="correspondence">مخاطبة</option>
                    <option value="memo">مذكرة</option>
                    <option value="delegation">تفويض</option>
                  </select>
                </div>

                {/* Direction — hidden for delegation */}
                {form.type !== "delegation" && (
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">الاتجاه</label>
                    <select
                      value={form.direction ?? ""}
                      onChange={e => setForm(f => ({ ...f, direction: e.target.value as Direction }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    >
                      <option value="incoming">وارد</option>
                      <option value="outgoing">صادر</option>
                    </select>
                  </div>
                )}

                {/* Priority */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">الأولوية</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  >
                    <option value="normal">عادي</option>
                    <option value="urgent">عاجل</option>
                    <option value="confidential">سري</option>
                  </select>
                </div>

                {/* Subject */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">الموضوع <span className="text-red-500">*</span></label>
                  <input
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="موضوع الوثيقة..."
                  />
                </div>

                {/* From/To */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {form.direction === "incoming" ? "من" : form.direction === "outgoing" ? "إلى" : "من / إلى"}
                  </label>
                  <input
                    value={form.fromTo ?? ""}
                    onChange={e => setForm(f => ({ ...f, fromTo: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="الجهة المُرسِلة أو المستقبِلة..."
                  />
                </div>

                {/* Doc Date */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">تاريخ الوثيقة</label>
                  <input
                    type="date"
                    value={form.docDate ?? ""}
                    onChange={e => setForm(f => ({ ...f, docDate: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                {/* Due Date */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">تاريخ الاستحقاق</label>
                  <input
                    type="date"
                    value={form.dueDate ?? ""}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                {/* Status */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">الحالة</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  >
                    <option value="open">مفتوح</option>
                    <option value="pending">معلق</option>
                    <option value="closed">مغلق</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ملاحظات</label>
                  <textarea
                    value={form.notes ?? ""}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    placeholder="أي ملاحظات إضافية..."
                  />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-[#0f2240] hover:bg-[#1e3a5f] text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editing ? "حفظ التعديلات" : "إضافة الوثيقة"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div dir="rtl" className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-7 w-7 text-red-500" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-1">حذف الوثيقة</h3>
            <p className="text-slate-500 text-sm mb-2">
              هل تريد حذف الوثيقة <span className="font-mono font-bold text-[#0f2240]">{deleteTarget.docNumber}</span> ؟
            </p>
            <p className="text-slate-400 text-xs mb-6">لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-5 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                نعم، احذف
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
