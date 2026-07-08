import { useState, useMemo, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Plus, Search, Pencil, Trash2, X, Loader2, FileText,
  ArrowDownLeft, ArrowUpRight, Shield, ChevronDown,
  Upload, ScanLine, CheckCircle2, AlertCircle, ImageIcon,
  Sparkles, Eye,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
}

function authFetchJson(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
}

type DocType  = "correspondence" | "memo" | "delegation";
type Direction = "incoming" | "outgoing" | "";
type Status   = "open" | "pending" | "closed";
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
const DIR_LABELS: Record<string, string> = { incoming: "وارد", outgoing: "صادر" };
const STATUS_LABELS: Record<Status, string> = { open: "مفتوح", pending: "معلق", closed: "مغلق" };
const PRIORITY_LABELS: Record<Priority, string> = { normal: "عادي", urgent: "عاجل", confidential: "سري" };

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

type FormData = {
  docNumber: string; type: DocType; direction: Direction;
  subject: string; fromTo: string; docDate: string; dueDate: string;
  status: Status; priority: Priority; notes: string;
  attachmentUrl: string; attachmentName: string;
};

const emptyForm = (): FormData => ({
  docNumber: "", type: "correspondence", direction: "outgoing",
  subject: "", fromTo: "", docDate: "", dueDate: "",
  status: "open", priority: "normal", notes: "",
  attachmentUrl: "", attachmentName: "",
});

// ── Scan step for incoming docs ───────────────────────────────────────────────
function ScanUploadStep({
  onExtracted,
  onManual,
}: {
  onExtracted: (data: Partial<FormData>, previewUrl: string, fileName: string) => void;
  onManual: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setScanError("يرجى رفع صورة (JPG، PNG، WebP) أو PDF");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setScanError("حجم الملف كبير جداً (الحد الأقصى 10 MB)");
      return;
    }

    setScanError(null);
    setScanning(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      if (file.type.startsWith("image/")) setPreview(base64);

      try {
        const res = await authFetchJson(`${API_BASE}/api/correspondence/scan`, {
          method: "POST",
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type === "application/pdf" ? "image/png" : file.type,
            docType: "correspondence",
          }),
        });
        const data = await res.json();
        if (!res.ok) { setScanError(data.error ?? "فشل التحليل"); setScanning(false); return; }

        onExtracted(
          {
            docNumber: data.docNumber ?? "",
            subject: data.subject ?? "",
            fromTo: data.fromTo ?? "",
            docDate: data.docDate ?? "",
            dueDate: data.dueDate ?? "",
            notes: data.notes ?? "",
            direction: "incoming",
            type: "correspondence",
            status: "open",
            priority: "normal",
            attachmentUrl: base64,
            attachmentName: file.name,
          },
          base64,
          file.name,
        );
      } catch {
        setScanError("تعذّر الاتصال بالخادم، حاول مجدداً");
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  return (
    <div className="p-8 flex flex-col items-center gap-6 min-h-[380px] justify-center">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !scanning && inputRef.current?.click()}
        className={`w-full max-w-md border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer select-none
          ${dragging ? "border-blue-400 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-blue-50/40"}
          ${scanning ? "pointer-events-none opacity-70" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
        />

        {scanning ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
              <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-blue-500" />
            </div>
            <p className="text-sm font-semibold text-blue-700">الذكاء الاصطناعي يقرأ الوثيقة...</p>
            <p className="text-xs text-slate-400">يتم استخراج البيانات تلقائياً</p>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center gap-3">
            <img src={preview} alt="معاينة" className="max-h-48 rounded-lg shadow border object-contain" />
            <p className="text-xs text-slate-500">انقر لرفع صورة مختلفة</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <ScanLine className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">ارفع scan الوثيقة الواردة</p>
              <p className="text-xs text-slate-400 mt-1">اسحب وأفلت، أو انقر للاختيار</p>
              <p className="text-xs text-slate-400">JPG · PNG · WebP · PDF — حتى 10 MB</p>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs px-3 py-1.5 rounded-full">
              <Sparkles className="h-3.5 w-3.5" />
              الذكاء الاصطناعي يملي البيانات تلقائياً
            </div>
          </div>
        )}
      </div>

      {scanError && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg w-full max-w-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {scanError}
        </div>
      )}

      <button
        onClick={onManual}
        className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
      >
        تخطّي — إدخال البيانات يدوياً
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CorrespondencePage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterDir, setFilterDir] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"choose" | "scan" | "form">("choose");
  const [chosenDir, setChosenDir] = useState<Direction>("incoming");
  const [chosenType, setChosenType] = useState<DocType>("correspondence");
  const [scanPreview, setScanPreview] = useState<string | null>(null);

  const [editing, setEditing] = useState<Doc | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [viewDoc, setViewDoc] = useState<Doc | null>(null);

  // Load docs
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/correspondence`);
        if (!res.ok) throw new Error("فشل في التحميل");
        setDocs(await res.json());
      } catch (e: any) {
        setPageError(e.message ?? "خطأ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(d => {
      if (filterType !== "all" && d.type !== filterType) return false;
      if (filterDir === "incoming" && d.direction !== "incoming") return false;
      if (filterDir === "outgoing" && d.direction !== "outgoing") return false;
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
    setScanPreview(null);
    setForm(emptyForm());
    setFormErr(null);
    setModalMode("choose");
    setModalOpen(true);
  }

  function openEdit(d: Doc) {
    setEditing(d);
    setScanPreview(d.attachmentUrl ?? null);
    setForm({
      docNumber: d.docNumber,
      type: d.type,
      direction: (d.direction ?? "") as Direction,
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
    setModalMode("form");
    setModalOpen(true);
  }

  // Called when AI finishes scanning
  function onScanExtracted(data: Partial<FormData>, previewUrl: string, fileName: string) {
    setScanPreview(previewUrl);
    setForm(f => ({
      ...f,
      ...data,
      type: chosenType,
      direction: "incoming",
      attachmentUrl: previewUrl,
      attachmentName: fileName,
    }));
    setModalMode("form");
  }

  // Choose direction/type first
  function proceedFromChoose() {
    const f = emptyForm();
    f.type = chosenType;
    f.direction = chosenDir;
    setForm(f);
    setFormErr(null);
    if (chosenDir === "incoming") {
      setModalMode("scan");
    } else {
      setScanPreview(null);
      setModalMode("form");
    }
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
      const res = await authFetchJson(url, {
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
    } finally {
      setDeleting(false);
    }
  }

  const counters = useMemo(() => ({
    total:       docs.length,
    incoming:    docs.filter(d => d.direction === "incoming").length,
    outgoing:    docs.filter(d => d.direction === "outgoing").length,
    delegations: docs.filter(d => d.type === "delegation").length,
    urgent:      docs.filter(d => d.priority === "urgent").length,
    open:        docs.filter(d => d.status === "open").length,
  }), [docs]);

  const modalTitle = editing
    ? "تعديل وثيقة"
    : modalMode === "choose"
    ? "وثيقة جديدة"
    : modalMode === "scan"
    ? "رفع وتحليل الوثيقة الواردة"
    : `${chosenDir === "incoming" ? "وارد" : chosenDir === "outgoing" ? "صادر" : ""} — ${TYPE_LABELS[chosenType] ?? "وثيقة"} جديدة`;

  return (
    <AppLayout>
      <div dir="rtl" className="min-h-screen bg-[#f4f6f9]">

        {/* ── Header ── */}
        <div className="bg-[#0f2240] text-white px-6 py-4">
          <nav className="text-xs text-blue-300 mb-1">
            <span>الرئيسية</span> <span className="mx-1">›</span>
            <span className="text-white font-medium">المراسلات والوثائق</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">المراسلات والوثائق</h1>
              <p className="text-blue-300 text-xs mt-0.5">مخاطبات · مذاكرات · تفويضات · وارد · صادر</p>
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-2 bg-[#1e5fa8] hover:bg-[#1a52a8] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow"
            >
              <Plus className="h-4 w-4" /> إضافة وثيقة جديدة
            </button>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="px-6 py-4 grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "الإجمالي",  value: counters.total,       bg: "bg-[#1e3a5f]" },
            { label: "واردة",     value: counters.incoming,    bg: "bg-emerald-600" },
            { label: "صادرة",     value: counters.outgoing,    bg: "bg-blue-600" },
            { label: "تفويضات",   value: counters.delegations, bg: "bg-purple-600" },
            { label: "عاجل",      value: counters.urgent,      bg: "bg-red-600" },
            { label: "مفتوح",     value: counters.open,        bg: "bg-amber-500" },
          ].map((c, i) => (
            <div key={i} className={`${c.bg} text-white rounded-xl px-4 py-3 text-center shadow-sm`}>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs opacity-80 mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="px-6 mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث برقم الوثيقة، الموضوع، من/إلى..."
              className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          {[
            { val: filterType, set: setFilterType, opts: [["all","كل الأنواع"],["correspondence","مخاطبة"],["memo","مذكرة"],["delegation","تفويض"]] },
            { val: filterDir,  set: setFilterDir,  opts: [["all","وارد وصادر"],["incoming","وارد فقط"],["outgoing","صادر فقط"]] },
            { val: filterStatus, set: setFilterStatus, opts: [["all","كل الحالات"],["open","مفتوح"],["pending","معلق"],["closed","مغلق"]] },
          ].map((f, i) => (
            <div key={i} className="relative">
              <select
                value={f.val} onChange={e => f.set(e.target.value)}
                className="appearance-none pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              >
                {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <ChevronDown className="absolute left-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="px-6 pb-10">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /><span>جاري التحميل...</span>
              </div>
            ) : pageError ? (
              <div className="py-20 text-center text-red-500 text-sm">{pageError}</div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <FileText className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">لا توجد وثائق مطابقة</p>
                <button onClick={openNew} className="mt-4 text-sm text-blue-600 hover:underline">+ إضافة وثيقة</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="bg-[#eef1f5] border-b-2 border-slate-200">
                      {["رقم الوثيقة","النوع","الاتجاه","الموضوع","من / إلى","التاريخ","الأولوية","الحالة",""].map((h,i) => (
                        <th key={i} className="px-3 py-3 text-[11px] font-bold text-slate-600 whitespace-nowrap border-l border-slate-200 last:border-l-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((d, ri) => (
                      <tr key={d.id} className={`transition-colors ${ri%2===0?"bg-white":"bg-[#fafbfc]"} hover:bg-blue-50/30`}>
                        <td className="px-3 py-3 border-l border-slate-100">
                          <span className="font-mono font-bold text-[#0f2240] text-[12px]">{d.docNumber}</span>
                        </td>
                        <td className="px-3 py-3 border-l border-slate-100">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                            {d.type==="delegation"
                              ? <Shield className="h-3.5 w-3.5 text-purple-500"/>
                              : <FileText className={`h-3.5 w-3.5 ${d.type==="memo"?"text-amber-500":"text-blue-500"}`}/>}
                            {TYPE_LABELS[d.type]}
                          </span>
                        </td>
                        <td className="px-3 py-3 border-l border-slate-100">
                          {d.direction ? (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${d.direction==="incoming"?"bg-emerald-50 text-emerald-700":"bg-blue-50 text-blue-700"}`}>
                              {d.direction==="incoming"?<ArrowDownLeft className="h-3 w-3"/>:<ArrowUpRight className="h-3 w-3"/>}
                              {DIR_LABELS[d.direction]}
                            </span>
                          ) : <span className="text-slate-300 text-[11px]">—</span>}
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
                            {d.attachmentUrl && (
                              <button onClick={() => setViewDoc(d)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors" title="عرض الصورة">
                                <Eye className="h-3.5 w-3.5"/>
                              </button>
                            )}
                            <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition-colors">
                              <Pencil className="h-3.5 w-3.5"/>
                            </button>
                            <button onClick={() => setDeleteTarget(d)} className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5"/>
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
            <p className="text-[11px] text-slate-400 mt-2 text-left">عرض {filtered.length} من {docs.length} وثيقة</p>
          )}
        </div>
      </div>

      {/* ════ Main Modal ════ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div dir="rtl" className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">

            {/* Modal header */}
            <div className="bg-[#0f2240] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {modalMode === "scan" && <ScanLine className="h-5 w-5 text-emerald-400"/>}
                {modalMode === "choose" && <Plus className="h-5 w-5"/>}
                {modalMode === "form" && <FileText className="h-5 w-5"/>}
                <h2 className="font-bold text-base">{modalTitle}</h2>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-white/10 transition-colors">
                <X className="h-5 w-5"/>
              </button>
            </div>

            {/* ── Step 1: choose type & direction ── */}
            {modalMode === "choose" && (
              <div className="p-8 flex flex-col gap-6 overflow-y-auto">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">نوع الوثيقة</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(["correspondence","memo","delegation"] as DocType[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setChosenType(t)}
                        className={`border-2 rounded-xl p-4 text-center transition-all ${chosenType===t?"border-[#0f2240] bg-[#0f2240]/5":"border-slate-200 hover:border-slate-300"}`}
                      >
                        <div className="flex justify-center mb-2">
                          {t==="delegation"
                            ? <Shield className={`h-7 w-7 ${chosenType===t?"text-purple-600":"text-slate-400"}`}/>
                            : <FileText className={`h-7 w-7 ${chosenType===t?"text-[#0f2240]":"text-slate-400"}`}/>}
                        </div>
                        <p className="font-semibold text-sm text-slate-700">{TYPE_LABELS[t]}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {chosenType !== "delegation" && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">الاتجاه</p>
                    <div className="grid grid-cols-2 gap-3">
                      {([["incoming","وارد","يُستقبل من جهة خارجية","bg-emerald-50","text-emerald-700","border-emerald-400"],
                         ["outgoing","صادر","يُرسل إلى جهة خارجية","bg-blue-50","text-blue-700","border-blue-400"]] as const).map(([val,label,desc,bg,fg,bc]) => (
                        <button
                          key={val}
                          onClick={() => setChosenDir(val)}
                          className={`border-2 rounded-xl p-4 text-right transition-all ${chosenDir===val?`${bc} ${bg}":"border-slate-200 hover:border-slate-300"}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {val==="incoming"
                              ? <ArrowDownLeft className={`h-5 w-5 ${chosenDir===val?fg:"text-slate-400"}`}/>
                              : <ArrowUpRight className={`h-5 w-5 ${chosenDir===val?fg:"text-slate-400"}`}/>}
                            <span className="font-bold text-sm text-slate-700">{label}</span>
                          </div>
                          <p className="text-xs text-slate-400">{desc}</p>
                          {val==="incoming" && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600">
                              <Sparkles className="h-3 w-3"/> تحليل تلقائي بالذكاء الاصطناعي
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={proceedFromChoose}
                    className="bg-[#0f2240] hover:bg-[#1e3a5f] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
                  >
                    {chosenDir === "incoming" && chosenType !== "delegation" ? "التالي — رفع الوثيقة" : "التالي — إدخال البيانات"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2a: scan upload ── */}
            {modalMode === "scan" && (
              <ScanUploadStep
                onExtracted={onScanExtracted}
                onManual={() => {
                  setScanPreview(null);
                  setForm(f => ({ ...f, type: chosenType, direction: "incoming" }));
                  setModalMode("form");
                }}
              />
            )}

            {/* ── Step 2b / Edit: form ── */}
            {modalMode === "form" && (
              <>
                <div className="flex flex-1 overflow-hidden">
                  {/* Scan preview sidebar */}
                  {scanPreview && scanPreview.startsWith("data:image") && (
                    <div className="w-72 shrink-0 bg-slate-50 border-l border-slate-200 p-4 flex flex-col gap-3 overflow-y-auto">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <ImageIcon className="h-3.5 w-3.5"/> الوثيقة الممسوحة
                      </div>
                      <img src={scanPreview} alt="scan" className="rounded-lg border shadow-sm object-contain max-h-80"/>
                      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] px-3 py-2 rounded-lg">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0"/>
                        البيانات مستخرجة بالذكاء الاصطناعي — راجعها وعدّل إذا لزم
                      </div>
                    </div>
                  )}

                  {/* Form body */}
                  <div className="flex-1 p-6 overflow-y-auto">
                    {formErr && (
                      <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0"/>{formErr}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {/* Doc Number */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          رقم الوثيقة <span className="text-red-500">*</span>
                          {form.direction==="incoming" && (
                            <span className="mr-1 text-emerald-600 font-normal text-[10px]">← مولَّد تلقائياً</span>
                          )}
                        </label>
                        <input
                          value={form.docNumber}
                          onChange={e => setForm(f => ({...f, docNumber: e.target.value}))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="مثال: COR-2026-0001"
                        />
                      </div>

                      {/* Type */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">النوع</label>
                        <select
                          value={form.type}
                          onChange={e => setForm(f => ({...f, type: e.target.value as DocType}))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                          <option value="correspondence">مخاطبة</option>
                          <option value="memo">مذكرة</option>
                          <option value="delegation">تفويض</option>
                        </select>
                      </div>

                      {/* Direction */}
                      {form.type !== "delegation" && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">الاتجاه</label>
                          <select
                            value={form.direction}
                            onChange={e => setForm(f => ({...f, direction: e.target.value as Direction}))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                          >
                            <option value="incoming">وارد</option>
                            <option value="outgoing">صادر</option>
                          </select>
                        </div>
                      )}

                      {/* Priority */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">الأولوية</label>
                        <select
                          value={form.priority}
                          onChange={e => setForm(f => ({...f, priority: e.target.value as Priority}))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                          <option value="normal">عادي</option>
                          <option value="urgent">عاجل</option>
                          <option value="confidential">سري</option>
                        </select>
                      </div>

                      {/* Subject */}
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          الموضوع <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={form.subject}
                          onChange={e => setForm(f => ({...f, subject: e.target.value}))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="موضوع الوثيقة..."
                        />
                      </div>

                      {/* From/To */}
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          {form.direction==="incoming" ? "من (الجهة المُرسِلة)" : form.direction==="outgoing" ? "إلى (الجهة المستقبِلة)" : "من / إلى"}
                        </label>
                        <input
                          value={form.fromTo}
                          onChange={e => setForm(f => ({...f, fromTo: e.target.value}))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="اسم الجهة..."
                        />
                      </div>

                      {/* Dates */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">تاريخ الوثيقة</label>
                        <input type="date" value={form.docDate}
                          onChange={e => setForm(f => ({...f, docDate: e.target.value}))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">تاريخ الاستحقاق / الرد</label>
                        <input type="date" value={form.dueDate}
                          onChange={e => setForm(f => ({...f, dueDate: e.target.value}))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">الحالة</label>
                        <select value={form.status}
                          onChange={e => setForm(f => ({...f, status: e.target.value as Status}))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                          value={form.notes} rows={3}
                          onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                          placeholder="أي ملاحظات إضافية..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                  <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
                    إلغاء
                  </button>
                  <button
                    onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 bg-[#0f2240] hover:bg-[#1e3a5f] text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin"/>}
                    {editing ? "حفظ التعديلات" : "حفظ الوثيقة"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════ Delete confirm ════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div dir="rtl" className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-7 w-7 text-red-500"/>
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-1">حذف الوثيقة</h3>
            <p className="text-slate-500 text-sm mb-1">
              هل تريد حذف الوثيقة <span className="font-mono font-bold text-[#0f2240]">{deleteTarget.docNumber}</span>؟
            </p>
            <p className="text-slate-400 text-xs mb-6">لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteTarget(null)} className="px-5 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">إلغاء</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin"/>} نعم، احذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ View scan ════ */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setViewDoc(null)}>
          <div dir="rtl" className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-slate-800 text-sm">{viewDoc.docNumber} — {viewDoc.subject}</p>
              <button onClick={() => setViewDoc(null)} className="p-1 rounded hover:bg-slate-100"><X className="h-5 w-5 text-slate-500"/></button>
            </div>
            <img src={viewDoc.attachmentUrl!} alt="وثيقة" className="w-full rounded-lg border object-contain max-h-[70vh]"/>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
