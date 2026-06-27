import React, { useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
    ...opts,
  }).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "خطأ في الطلب");
    return data;
  });
}

interface CanonicalItem {
  id: number;
  internal_code: string;
  brand: string;
  category: string;
  description_ar: string;
  description_en: string;
  keywords: string[];
  notes: string;
  fingerprint: Record<string, string>;
  fingerprint_hash: string;
  created_at: string;
}

interface MatchResult {
  matched: boolean;
  score: number;
  decision: "auto_link" | "confirm" | "new";
  item: CanonicalItem | null;
  fingerprint: Record<string, string>;
}

const DECISION_CONFIG = {
  auto_link: { label: "ربط تلقائي", color: "bg-emerald-100 text-emerald-800 border-emerald-200", bar: "bg-emerald-500" },
  confirm:   { label: "يحتاج تأكيد", color: "bg-amber-100 text-amber-800 border-amber-200",   bar: "bg-amber-400"  },
  new:       { label: "كود جديد",    color: "bg-blue-100 text-blue-800 border-blue-200",        bar: "bg-blue-500"   },
};

const FP_LABELS: Record<string, string> = {
  category: "الفئة", brand: "الماركة", series: "السلسلة",
  current: "التيار", poles: "الأقطاب", voltage: "الجهد",
  partNumber: "رقم الموديل", power: "القدرة", frequency: "التردد",
  mounting: "التركيب", auxiliary: "اتصالات مساعدة", type: "النوع",
};

// ── Item Form Modal ────────────────────────────────────────────────────────────
function ItemModal({
  item, onClose, onSaved,
}: {
  item: CanonicalItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    brand:          item?.brand ?? "",
    category:       item?.category ?? "",
    description_ar: item?.description_ar ?? "",
    description_en: item?.description_en ?? "",
    keywords:       (item?.keywords ?? []).join(", "),
    notes:          item?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const handle = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description_ar.trim() && !form.description_en.trim()) {
      setError("أدخل توصيفاً عربياً أو إنجليزياً على الأقل"); return;
    }
    setSaving(true); setError("");
    try {
      const body = {
        ...form,
        keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      };
      if (isEdit) {
        await apiFetch(`/api/item-coding/canonical/${item!.id}`, { method: "PUT",  body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/item-coding/canonical",              { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-base font-bold text-slate-800">{isEdit ? "تعديل البند" : "إضافة بند جديد"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الماركة</label>
              <input value={form.brand} onChange={handle("brand")} placeholder="Schneider, ABB…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الفئة</label>
              <input value={form.category} onChange={handle("category")} placeholder="Contactor, Relay…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">التوصيف العربي</label>
            <textarea value={form.description_ar} onChange={handle("description_ar")} rows={2}
              placeholder="كونتاكتور شنايدر تي سيز D، 32 أمبير…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">التوصيف الإنجليزي</label>
            <textarea value={form.description_en} onChange={handle("description_en")} rows={2}
              placeholder="Schneider Electric TeSys D Contactor 32A 3P 220VAC…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">كلمات مفتاحية (مفصولة بفاصلة)</label>
            <input value={form.keywords} onChange={handle("keywords")} placeholder="contactor, 32A, LC1D32M7"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">ملاحظات</label>
            <input value={form.notes} onChange={handle("notes")}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {saving ? "جاري الحفظ…" : isEdit ? "حفظ التعديلات" : "إضافة البند"}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Fingerprint Badge ──────────────────────────────────────────────────────────
function FingerprintBadges({ fp }: { fp: Record<string, string> }) {
  const entries = Object.entries(fp).filter(([, v]) => v);
  if (!entries.length) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          <span className="text-slate-400">{FP_LABELS[k] ?? k}:</span>
          <span className="font-medium">{v}</span>
        </span>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ItemCodingPage() {
  const qc = useQueryClient();
  const { hasPermission, user } = useAuth();
  const canEdit = hasPermission("settings") || user?.role === "admin";

  const { data: items = [], isLoading } = useQuery<CanonicalItem[]>({
    queryKey: ["canonical-items"],
    queryFn: () => apiFetch("/api/item-coding/canonical"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/item-coding/canonical/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canonical-items"] }),
  });

  // Match tester state
  const [testDesc,    setTestDesc]    = useState("");
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matching,    setMatching]    = useState(false);

  // Modal state
  const [modalItem, setModalItem] = useState<CanonicalItem | null | undefined>(undefined);

  // Search
  const [search, setSearch] = useState("");
  const filtered = items.filter((it) =>
    !search || [it.internal_code, it.brand, it.category, it.description_ar, it.description_en]
      .some((f) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const runMatch = async () => {
    if (!testDesc.trim()) return;
    setMatching(true); setMatchResult(null);
    try {
      const res = await apiFetch("/api/item-coding/match", { method: "POST", body: JSON.stringify({ description: testDesc }) });
      setMatchResult(res);
    } catch { /* ignore */ } finally { setMatching(false); }
  };

  const confirmLink = async () => {
    if (!matchResult?.item) return;
    setMatchResult(null);
    setTestDesc("");
  };

  const createNew = async () => {
    if (!matchResult) return;
    await apiFetch("/api/item-coding/canonical", {
      method: "POST",
      body: JSON.stringify({
        description_en: testDesc,
        brand:    matchResult.fingerprint.brand ?? "",
        category: matchResult.fingerprint.category ?? "",
      }),
    });
    qc.invalidateQueries({ queryKey: ["canonical-items"] });
    setMatchResult(null);
    setTestDesc("");
  };

  const decision = matchResult ? DECISION_CONFIG[matchResult.decision] : null;

  return (
    <AppLayout>
      <div dir="rtl" className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">تكويد البنود</h1>
            <p className="text-sm text-slate-500 mt-0.5">محرك المطابقة الذكي — بصمة المنتج والكود الإداري الموحد</p>
          </div>
          {canEdit && (
            <button onClick={() => setModalItem(null)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm">
              + إضافة بند
            </button>
          )}
        </div>

        {/* Match Tester ─────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700 mb-3">اختبار المطابقة</h2>
          <div className="flex gap-3">
            <textarea
              value={testDesc}
              onChange={(e) => setTestDesc(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) runMatch(); }}
              rows={3}
              placeholder="أدخل توصيف البند هنا… مثال: كونتاكتور شنايدر LC1D32M7 3P 32A 220VAC&#10;(Ctrl+Enter للبحث)"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
            />
            <button
              onClick={runMatch}
              disabled={matching || !testDesc.trim()}
              className="self-start rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shadow-sm">
              {matching ? "جاري البحث…" : "مطابقة"}
            </button>
          </div>

          {/* Result ── */}
          {matchResult && (
            <div className={`mt-4 rounded-xl border p-4 ${decision!.color}`}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold border ${decision!.color}`}>
                    {decision!.label}
                  </span>
                  <span className="text-sm font-bold">{matchResult.score}% تطابق</span>
                </div>
                {matchResult.item && (
                  <span className="font-mono text-sm font-bold tracking-widest bg-white/60 rounded-lg px-3 py-1 border">
                    {matchResult.item.internal_code}
                  </span>
                )}
              </div>

              {/* Score bar */}
              <div className="h-2 rounded-full bg-white/50 mb-3">
                <div className={`h-2 rounded-full transition-all ${decision!.bar}`} style={{ width: `${matchResult.score}%` }} />
              </div>

              {/* Fingerprint extracted */}
              {Object.keys(matchResult.fingerprint).length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium mb-1.5 opacity-70">الخصائص المستخرجة:</p>
                  <FingerprintBadges fp={matchResult.fingerprint} />
                </div>
              )}

              {/* Matched item details */}
              {matchResult.item && (
                <div className="rounded-xl bg-white/60 border border-white/80 p-3 mb-3">
                  <p className="text-xs font-medium mb-1 opacity-70">البند المطابق:</p>
                  <p className="text-sm font-semibold">{matchResult.item.description_en || matchResult.item.description_ar}</p>
                  {matchResult.item.description_ar && matchResult.item.description_en && (
                    <p className="text-xs opacity-60 mt-0.5">{matchResult.item.description_ar}</p>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {matchResult.item.brand    && <span className="text-xs bg-white rounded px-2 py-0.5 border">{matchResult.item.brand}</span>}
                    {matchResult.item.category && <span className="text-xs bg-white rounded px-2 py-0.5 border">{matchResult.item.category}</span>}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {matchResult.decision === "auto_link" && (
                  <button onClick={confirmLink}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors">
                    ✓ تأكيد الربط
                  </button>
                )}
                {matchResult.decision === "confirm" && (
                  <>
                    <button onClick={confirmLink}
                      className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 transition-colors">
                      نعم، نفس المنتج — ربط بالكود الموجود
                    </button>
                    <button onClick={createNew}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors">
                      لا، إنشاء كود جديد
                    </button>
                  </>
                )}
                {matchResult.decision === "new" && (
                  <button onClick={createNew}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors">
                    + إنشاء كود إداري جديد
                  </button>
                )}
                <button onClick={() => { setMatchResult(null); setTestDesc(""); }}
                  className="rounded-lg border border-current/20 px-4 py-2 text-xs font-medium hover:bg-white/30 transition-colors">
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>

        {/* How it works ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { pct: "≥ 95%", label: "ربط تلقائي", desc: "نفس المنتج بالتأكيد", color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
            { pct: "70–94%", label: "يحتاج تأكيد", desc: "قد يكون نفس المنتج", color: "border-amber-200 bg-amber-50 text-amber-700" },
            { pct: "< 70%",  label: "كود جديد",    desc: "منتج مختلف",          color: "border-blue-200 bg-blue-50 text-blue-700" },
          ].map((t) => (
            <div key={t.pct} className={`rounded-xl border p-3 text-center ${t.color}`}>
              <div className="text-lg font-black mb-0.5">{t.pct}</div>
              <div className="text-xs font-bold">{t.label}</div>
              <div className="text-xs opacity-70 mt-0.5">{t.desc}</div>
            </div>
          ))}
        </div>

        {/* Items Table ───────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-bold text-slate-700">قاعدة البنود المرجعية</h2>
              <p className="text-xs text-slate-400 mt-0.5">{items.length} بند مسجل</p>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في البنود…"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-64"
            />
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-slate-400 text-sm">جاري التحميل…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">
              {search ? "لا توجد نتائج مطابقة" : "لا توجد بنود بعد"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold text-slate-500 text-right">
                    <th className="px-4 py-3 whitespace-nowrap">الكود الإداري</th>
                    <th className="px-4 py-3 whitespace-nowrap">الفئة / الماركة</th>
                    <th className="px-4 py-3">التوصيف</th>
                    <th className="px-4 py-3">بصمة المنتج</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold tracking-widest bg-slate-100 rounded-lg px-2.5 py-1.5 text-slate-700 border border-slate-200">
                          {item.internal_code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {item.category && (
                            <span className="inline-block rounded-full bg-blue-100 text-blue-700 text-xs px-2 py-0.5 font-medium">
                              {item.category}
                            </span>
                          )}
                          {item.brand && (
                            <div className="text-xs text-slate-500">{item.brand}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {item.description_en && (
                          <p className="text-sm text-slate-800 font-medium leading-snug truncate">{item.description_en}</p>
                        )}
                        {item.description_ar && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description_ar}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <FingerprintBadges fp={item.fingerprint ?? {}} />
                        {item.fingerprint_hash && (
                          <div className="text-xs text-slate-400 mt-1 font-mono">#{item.fingerprint_hash}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {canEdit && (
                            <>
                              <button
                                onClick={() => setModalItem(item)}
                                className="rounded-lg p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="تعديل">
                                ✎
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`حذف الكود ${item.internal_code}؟`))
                                    deleteMutation.mutate(item.id);
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="حذف">
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalItem !== undefined && (
        <ItemModal
          item={modalItem}
          onClose={() => setModalItem(undefined)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["canonical-items"] })}
        />
      )}
    </AppLayout>
  );
}
