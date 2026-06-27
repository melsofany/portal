import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, Pencil, Sparkles, Search, X, Loader2, BookOpen, Upload, ChevronDown, ChevronUp } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type CanonicalItem = {
  id: number;
  internal_code: string;
  brand: string;
  category: string;
  description_ar: string;
  description_en: string;
  keywords: string[];
  notes: string;
};

const emptyForm = {
  internal_code: "",
  brand: "",
  category: "",
  description_ar: "",
  description_en: "",
  keywords: "",
  notes: "",
};

function kw(arr: string[]) { return arr?.join(", ") ?? ""; }

// ── Bulk import parser ────────────────────────────────────────────────────────
// Accepts CSV lines: internal_code, brand, category, description_ar, description_en, keywords, notes
// OR simple two-column: internal_code, description_ar
function parseBulkText(text: string): { items: any[]; errors: string[] } {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const items: any[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("//")) continue; // comments
    const cols = line.split("\t").length > 1 ? line.split("\t") : line.split(",");
    if (cols.length < 2) { errors.push(`سطر غير صالح: ${line.slice(0, 40)}`); continue; }
    const internal_code  = cols[0]?.trim() ?? "";
    const brand          = cols.length >= 7 ? (cols[1]?.trim() ?? "") : "";
    const category       = cols.length >= 7 ? (cols[2]?.trim() ?? "") : "";
    const description_ar = cols.length >= 7 ? (cols[3]?.trim() ?? "") : (cols[1]?.trim() ?? "");
    const description_en = cols.length >= 7 ? (cols[4]?.trim() ?? "") : (cols[2]?.trim() ?? "");
    const keywords       = cols.length >= 7 ? (cols[5]?.trim() ?? "").split("|").map(k => k.trim()).filter(Boolean) : [];
    const notes          = cols.length >= 7 ? (cols[6]?.trim() ?? "") : "";
    if (!internal_code) { errors.push(`كود مفقود: ${line.slice(0, 40)}`); continue; }
    items.push({ internal_code, brand, category, description_ar, description_en, keywords, notes });
  }
  return { items, errors };
}

export default function ItemCodingPage() {
  const [items, setItems]       = useState<CanonicalItem[]>([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState("");
  const [open, setOpen]         = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  // Test matching
  const [testDesc, setTestDesc]       = useState("");
  const [testResult, setTestResult]   = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Bulk import
  const [bulkOpen, setBulkOpen]     = useState(false);
  const [bulkText, setBulkText]     = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
  const [showFormat, setShowFormat] = useState(false);

  async function loadItems() {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/item-coding/canonical`, { credentials: "include" });
      setItems(await r.json());
    } finally { setLoading(false); }
  }

  useEffect(() => { loadItems(); }, []);

  const filtered = items.filter(it => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      it.internal_code.toLowerCase().includes(q) ||
      it.brand.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q) ||
      it.description_ar.includes(q) ||
      it.description_en.toLowerCase().includes(q)
    );
  });

  function openAdd() { setEditId(null); setForm(emptyForm); setError(""); setOpen(true); }
  function openEdit(it: CanonicalItem) {
    setEditId(it.id);
    setForm({
      internal_code: it.internal_code,
      brand: it.brand,
      category: it.category,
      description_ar: it.description_ar,
      description_en: it.description_en,
      keywords: kw(it.keywords),
      notes: it.notes,
    });
    setError(""); setOpen(true);
  }

  async function handleSave() {
    setError(""); setSaving(true);
    const body = { ...form, keywords: form.keywords.split(",").map(k => k.trim()).filter(Boolean) };
    try {
      const url = editId ? `${API_BASE}/api/item-coding/canonical/${editId}` : `${API_BASE}/api/item-coding/canonical`;
      const r = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "حدث خطأ"); return; }
      await loadItems();
      setOpen(false);
    } catch { setError("حدث خطأ أثناء الحفظ"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("هل أنت متأكد من حذف هذا الصنف؟")) return;
    const r = await fetch(`${API_BASE}/api/item-coding/canonical/${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) setItems(prev => prev.filter(it => it.id !== id));
  }

  async function handleTest() {
    if (!testDesc.trim()) return;
    setTestLoading(true); setTestResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/item-coding/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: testDesc }),
      });
      setTestResult(await r.json());
    } finally { setTestLoading(false); }
  }

  async function handleBulkImport() {
    if (!bulkText.trim()) return;
    const { items: parsed, errors: parseErrors } = parseBulkText(bulkText);
    if (!parsed.length) {
      setBulkResult({ inserted: 0, skipped: 0, errors: parseErrors.length ? parseErrors : ["لا توجد بنود صالحة للاستيراد"] });
      return;
    }
    setBulkSaving(true); setBulkResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/item-coding/canonical/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: parsed }),
      });
      const data = await r.json();
      if (!r.ok) { setBulkResult({ inserted: 0, skipped: 0, errors: [data.error ?? "فشل الاستيراد"] }); return; }
      setBulkResult({ ...data, errors: [...(parseErrors ?? []), ...(data.errors ?? [])] });
      await loadItems();
    } catch { setBulkResult({ inserted: 0, skipped: 0, errors: ["حدث خطأ في الاتصال"] }); }
    finally { setBulkSaving(false); }
  }

  return (
    <AppLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-amber-500" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">تكويد البنود بالذكاء الاصطناعي</h1>
              <p className="text-sm text-slate-500 mt-0.5">إدارة قاموس الأصناف القياسية — يُستخدم لاقتراح الكود تلقائياً عند إدخال الطلبات</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setBulkOpen(true); setBulkResult(null); setBulkText(""); }}>
              <Upload className="h-4 w-4 ml-1" /> استيراد بالجملة
            </Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={openAdd}>
              <Plus className="h-4 w-4 ml-1" /> إضافة صنف قياسي
            </Button>
          </div>
        </div>

        {/* Test matching box */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> اختبار المحرك — أدخل أي توصيف وشاهد الكود المقترح
          </p>
          <div className="flex gap-2">
            <input
              value={testDesc}
              onChange={e => setTestDesc(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleTest()}
              placeholder="مثال: كونتاكتور شنايدر 32 أمبير، 3 فاز، 220 فولت"
              className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
            <Button onClick={handleTest} disabled={testLoading || !testDesc.trim()} className="bg-amber-500 hover:bg-amber-600 text-white">
              {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "اختبار"}
            </Button>
          </div>
          {testResult && (
            <div className={`rounded-lg px-4 py-3 text-sm ${testResult.matched ? "bg-emerald-50 border border-emerald-200" : "bg-slate-100 border border-slate-200"}`}>
              {testResult.matched ? (
                <div className="space-y-1">
                  <p className="font-bold text-emerald-700">
                    ✓ تم الإيجاد — الكود: <span className="font-mono">{testResult.code}</span>
                    <span className="text-emerald-500 mr-2">({Math.round(testResult.confidence * 100)}% تطابق)</span>
                  </p>
                  <p className="text-slate-600">الصنف: {testResult.item?.description_ar || testResult.item?.description_en}</p>
                  {testResult.alternatives?.length > 0 && (
                    <p className="text-xs text-slate-400">بدائل: {testResult.alternatives.map((a: any) => `${a.code} (${Math.round(a.confidence * 100)}%)`).join(" · ")}</p>
                  )}
                </div>
              ) : (
                <p className="text-slate-500">
                  {testResult.code
                    ? `أقرب صنف: ${testResult.code} (${Math.round(testResult.confidence * 100)}% — أقل من حد المطابقة 25%)`
                    : "لم يُعثر على تطابق — تأكد من إضافة الصنف للقاموس أولاً"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالكود أو الماركة أو التوصيف..."
            className="w-full rounded-lg border border-slate-300 bg-white pr-9 pl-9 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>جاري التحميل...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">القاموس فارغ حتى الآن</p>
              <p className="text-slate-400 text-sm mt-1">أضف الأصناف القياسية حتى يبدأ المحرك في اقتراح الأكواد تلقائياً</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="outline" onClick={() => { setBulkOpen(true); setBulkResult(null); setBulkText(""); }}>
                  <Upload className="h-4 w-4 ml-1" /> استيراد بالجملة
                </Button>
                <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={openAdd}>
                  <Plus className="h-4 w-4 ml-1" /> إضافة أول صنف
                </Button>
              </div>
            </div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500">الكود الداخلي</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الماركة</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الفئة</th>
                  <th className="px-4 py-3 font-medium text-slate-500">التوصيف العربي</th>
                  <th className="px-4 py-3 font-medium text-slate-500">التوصيف الإنجليزي</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(it => (
                  <tr key={it.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-[#1e3a5f]">{it.internal_code}</td>
                    <td className="px-4 py-3 text-slate-600">{it.brand || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{it.category || "—"}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{it.description_ar || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate" dir="ltr">{it.description_en || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(it)} className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded border border-blue-200">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(it.id)} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded border border-red-200">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {search && filtered.length > 0 && (
            <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-500">
              {filtered.length} نتيجة من {items.length} صنف
            </div>
          )}
        </div>

        {/* Add/Edit modal */}
        <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editId ? "تعديل صنف قياسي" : "إضافة صنف قياسي جديد"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>الكود الداخلي *</Label>
                  <Input value={form.internal_code} onChange={e => setForm(f => ({ ...f, internal_code: e.target.value }))} placeholder="LC1D32M7" dir="ltr" className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>الماركة</Label>
                  <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Schneider Electric" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>الفئة</Label>
                  <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="كونتاكتورات / Contactors" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>التوصيف العربي *</Label>
                <textarea
                  value={form.description_ar}
                  onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))}
                  placeholder="كونتاكتور شنايدر تي سيز D، 32 أمبير، ثلاثي الأوجه، ملف 220 فولت AC"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>التوصيف الإنجليزي</Label>
                <textarea
                  value={form.description_en}
                  onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
                  placeholder="Schneider Electric TeSys D Contactor, 32A, 3P, 220VAC Coil"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>كلمات مفتاحية (مفصولة بفاصلة)</Label>
                <Input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="magnetic contactor, مفتاح مغناطيسي, كونتاكتور, TeSys" />
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات اختيارية" />
              </div>
              {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري الحفظ...</> : "حفظ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk import modal */}
        <Dialog open={bulkOpen} onOpenChange={v => { if (!v) setBulkOpen(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-slate-500" /> استيراد أصناف بالجملة
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Format help */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => setShowFormat(v => !v)}
                >
                  <span>تعليمات التنسيق</span>
                  {showFormat ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showFormat && (
                  <div className="px-4 pb-4 text-xs text-slate-600 space-y-2 border-t border-slate-200 pt-3">
                    <p className="font-medium">كل سطر = صنف واحد، الأعمدة مفصولة بفاصلة أو tab:</p>
                    <p className="font-semibold text-slate-700 mt-1">التنسيق الكامل (7 أعمدة):</p>
                    <code className="block bg-white border rounded px-2 py-1 font-mono text-slate-600 break-all" dir="ltr">
                      الكود, الماركة, الفئة, التوصيف_عربي, التوصيف_انجليزي, كلمات_مفتاحية(مفصولة|بشرطة), ملاحظات
                    </code>
                    <p className="font-semibold text-slate-700 mt-1">التنسيق المختصر (عمودان):</p>
                    <code className="block bg-white border rounded px-2 py-1 font-mono text-slate-600" dir="ltr">
                      الكود, التوصيف_العربي
                    </code>
                    <p className="mt-1 text-amber-700 bg-amber-50 rounded px-2 py-1">
                      الأكواد الموجودة مسبقاً سيتم تحديثها تلقائياً.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>البيانات</Label>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={"LC1D32M7, Schneider Electric, كونتاكتورات, كونتاكتور شنايدر 32A ثلاثي 220V, Schneider Contactor 32A 3P 220VAC, motor|contactor|كونتاكتور,\nLC1D25M7, Schneider Electric, كونتاكتورات, كونتاكتور شنايدر 25A ثلاثي 220V, Schneider Contactor 25A 3P 220VAC, motor|contactor|كونتاكتور,"}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[200px] font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  dir="ltr"
                />
              </div>

              {bulkResult && (
                <div className={`rounded-lg px-4 py-3 text-sm space-y-1 ${bulkResult.inserted > 0 ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-200"}`}>
                  {bulkResult.inserted > 0 && (
                    <p className="text-emerald-700 font-medium">✓ تم استيراد {bulkResult.inserted} صنف بنجاح</p>
                  )}
                  {bulkResult.skipped > 0 && (
                    <p className="text-slate-500">تم تخطي {bulkResult.skipped} سطر (بيانات ناقصة)</p>
                  )}
                  {bulkResult.errors.length > 0 && (
                    <div className="text-red-600 text-xs">
                      <p className="font-medium mb-1">أخطاء:</p>
                      {bulkResult.errors.map((e, i) => <p key={i}>• {e}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setBulkOpen(false)}>إغلاق</Button>
              <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleBulkImport} disabled={bulkSaving || !bulkText.trim()}>
                {bulkSaving ? <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري الاستيراد...</> : <><Upload className="h-4 w-4 ml-1" />استيراد</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
