import { useState } from "react";
  import AppLayout from "@/components/AppLayout";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
  import { Trash2, Plus, Pencil, Sparkles, Search, X, Loader2, BookOpen } from "lucide-react";

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

  export default function ItemCodingPage() {
    const [items, setItems] = useState<CanonicalItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Test matching state
    const [testDesc, setTestDesc] = useState("");
    const [testResult, setTestResult] = useState<any>(null);
    const [testLoading, setTestLoading] = useState(false);

    async function loadItems() {
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE}/api/item-coding/canonical`, { credentials: "include" });
        setItems(await r.json());
        setLoaded(true);
      } finally { setLoading(false); }
    }

    // Load on mount
    if (!loaded && !loading) loadItems();

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

    function openAdd() {
      setEditId(null); setForm(emptyForm); setError(""); setOpen(true);
    }
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
      const body = {
        ...form,
        keywords: form.keywords.split(",").map(k => k.trim()).filter(Boolean),
      };
      try {
        const url = editId
          ? `${API_BASE}/api/item-coding/canonical/${editId}`
          : `${API_BASE}/api/item-coding/canonical`;
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
      const r = await fetch(`${API_BASE}/api/item-coding/canonical/${id}`, {
        method: "DELETE", credentials: "include"
      });
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

    return (
      <AppLayout>
        <div className="space-y-6" dir="rtl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-amber-500" />
              <div>
                <h1 className="text-2xl font-bold text-slate-800">تكويد البنود بالذكاء الاصطناعي</h1>
                <p className="text-sm text-slate-500 mt-0.5">إدارة قاموس الأصناف القياسية — يُستخدم لاقتراح الكود تلقائياً عند إدخال الطلبات</p>
              </div>
            </div>
            <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={openAdd}>
              <Plus className="h-4 w-4 ml-1" /> إضافة صنف قياسي
            </Button>
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
                      <p className="text-xs text-slate-400">بدائل: {testResult.alternatives.map((a: any) => `${a.code} (${Math.round(a.confidence*100)}%)`).join(" · ")}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500">لم يُعثر على تطابق — تأكد من إضافة الصنف للقاموس أولاً</p>
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
                <Button className="mt-4 bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={openAdd}>
                  <Plus className="h-4 w-4 ml-1" /> إضافة أول صنف
                </Button>
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
                    <Input
                      value={form.internal_code}
                      onChange={e => setForm(f => ({ ...f, internal_code: e.target.value }))}
                      placeholder="مثال: LC1D32M7"
                      dir="ltr"
                      className="font-mono"
                    />
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
                  <Label>التوصيف الإنجليزي *</Label>
                  <textarea
                    value={form.description_en}
                    onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
                    placeholder="Schneider Electric TeSys D Contactor, 32A, 3P, 220VAC Coil"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>كلمات مفتاحية إضافية (مفصولة بفاصلة)</Label>
                  <Input
                    value={form.keywords}
                    onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                    placeholder="magnetic contactor, مفتاح مغناطيسي, كونتاكتور, TeSys"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ملاحظات</Label>
                  <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات اختيارية" />
                </div>
                {error && (
                  <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري الحفظ...</> : "حفظ"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    );
  }
  