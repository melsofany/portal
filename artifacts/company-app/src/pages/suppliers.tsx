import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useGetSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useGetSupplierCategories,
  useCreateSupplierCategory,
  useDeleteSupplierCategory,
  useGetSupplierPaymentMethods,
  useCreateSupplierPaymentMethod,
  useUpdateSupplierPaymentMethod,
  useDeleteSupplierPaymentMethod,
  getGetSuppliersQueryKey,
  getGetSupplierCategoriesQueryKey,
  getGetSupplierPaymentMethodsQueryKey,
} from "@workspace/api-client-react";
import type { SupplierPaymentMethod } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

// ── Egyptian banks ──────────────────────────────────────────────────────────
const EGYPTIAN_BANKS = [
  { name: "البنك الأهلي المصري", abbr: "NBE", color: "#003087" },
  { name: "بنك مصر", abbr: "BM", color: "#c8102e" },
  { name: "بنك القاهرة", abbr: "BC", color: "#005ca9" },
  { name: "البنك التجاري الدولي CIB", abbr: "CIB", color: "#00529b" },
  { name: "بنك الإسكندرية", abbr: "Alex", color: "#1d6f42" },
  { name: "بنك HSBC مصر", abbr: "HSBC", color: "#db0011" },
  { name: "بنك QNB الأهلي", abbr: "QNB", color: "#5c068c" },
  { name: "البنك العربي الأفريقي الدولي", abbr: "AAIB", color: "#006341" },
  { name: "بنك أبو ظبي الأول - مصر", abbr: "FAB", color: "#00a3e0" },
  { name: "بنك التعمير والإسكان", abbr: "HDB", color: "#f37021" },
  { name: "البنك العربي", abbr: "Arab", color: "#004a97" },
  { name: "بنك مشرق - مصر", abbr: "Mash", color: "#e8082d" },
  { name: "بنك البركة مصر", abbr: "Brk", color: "#008000" },
  { name: "بنك SAIB", abbr: "SAIB", color: "#0047ab" },
  { name: "بنك الاستثمار العربي", abbr: "AIBD", color: "#4169e1" },
  { name: "البنك الأهلي اليوناني - Alpha Bank", abbr: "Alpha", color: "#0057a8" },
  { name: "بنك نكسد - Nexus Bank", abbr: "Nxs", color: "#2e8b57" },
];

const WALLET_TYPES = [
  "فودافون كاش",
  "أورانج كاش",
  "اتصالات كاش",
  "WE باي",
  "محفظة CIB",
  "محفظة بنك مصر",
  "فوري",
];

const emptyForm = {
  companyName: "",
  contactName: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  commercialReg: "",
  taxReg: "",
  status: "نشط",
};

type FormErrors = Partial<Record<keyof typeof emptyForm | "server", string>>;

const emptyPmForm = {
  type: "cash" as "cash" | "wallet" | "instapay" | "bank",
  walletType: "",
  ownerName: "",
  phone: "",
  bankName: "",
  accountNumber: "",
};

function paymentTypeLabel(type: string) {
  if (type === "cash") return "نقدي";
  if (type === "wallet") return "محفظة إلكترونية";
  if (type === "instapay") return "إنستاباي";
  if (type === "bank") return "حساب بنكي";
  return type;
}

function paymentTypeBadgeClass(type: string) {
  if (type === "cash") return "bg-green-100 text-green-700";
  if (type === "wallet") return "bg-purple-100 text-purple-700";
  if (type === "instapay") return "bg-blue-100 text-blue-700";
  if (type === "bank") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function PaymentMethodCard({ pm, onEdit, onDelete }: { pm: SupplierPaymentMethod; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="space-y-1 flex-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${paymentTypeBadgeClass(pm.type)}`}>
            {paymentTypeLabel(pm.type)}
          </span>
          {pm.type === "wallet" && pm.walletType && (
            <span className="text-xs text-slate-500">{pm.walletType}</span>
          )}
          {pm.type === "bank" && pm.bankName && (
            <BankBadge bankName={pm.bankName} />
          )}
        </div>
        {pm.ownerName && (
          <p className="text-sm text-slate-700">
            <span className="text-slate-400 text-xs">اسم صاحب الحساب: </span>{pm.ownerName}
          </p>
        )}
        {pm.phone && (
          <p className="text-sm font-mono text-slate-700 dir-ltr text-right" dir="ltr">{pm.phone}</p>
        )}
        {pm.accountNumber && (
          <p className="text-sm text-slate-700">
            <span className="text-slate-400 text-xs">رقم الحساب: </span>{pm.accountNumber}
          </p>
        )}
        {pm.type === "cash" && (
          <p className="text-sm text-slate-500">الدفع نقداً عند التسليم</p>
        )}
      </div>
      <div className="flex gap-3 mr-2 shrink-0">
        <button onClick={onEdit} className="text-xs text-blue-500 hover:text-blue-700">تعديل</button>
        <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600">حذف</button>
      </div>
    </div>
  );
}

function BankBadge({ bankName }: { bankName: string }) {
  const bank = EGYPTIAN_BANKS.find((b) => b.name === bankName);
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
      style={{ backgroundColor: bank?.color ?? "#555" }}
    >
      {bank?.abbr ?? bankName.slice(0, 4)}
    </span>
  );
}

function PaymentMethodForm({
  form,
  setForm,
  error,
  setError,
}: {
  form: typeof emptyPmForm;
  setForm: (f: typeof emptyPmForm) => void;
  error: string;
  setError: (e: string) => void;
}) {
  function handlePhoneFocus() {
    if (!form.phone.trim()) setForm({ ...form, phone: "+201" });
  }

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div className="space-y-1.5">
        <Label>نوع طريقة الدفع <span className="text-red-500">*</span></Label>
        <div className="grid grid-cols-2 gap-2">
          {(["cash", "wallet", "instapay", "bank"] as const).map((t) => (
            <label
              key={t}
              className={`flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                form.type === t
                  ? "border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f] font-medium"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="pm-type"
                value={t}
                checked={form.type === t}
                onChange={() => setForm({ ...emptyPmForm, type: t })}
                className="accent-[#1e3a5f]"
              />
              {paymentTypeLabel(t)}
            </label>
          ))}
        </div>
      </div>

      {/* Cash — no extra fields */}
      {form.type === "cash" && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          الدفع نقداً — لا توجد بيانات إضافية مطلوبة
        </div>
      )}

      {/* Wallet */}
      {form.type === "wallet" && (
        <>
          <div className="space-y-1.5">
            <Label>نوع المحفظة <span className="text-red-500">*</span></Label>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
              value={form.walletType}
              onChange={(e) => { setForm({ ...form, walletType: e.target.value }); setError(""); }}
            >
              <option value="">اختر نوع المحفظة</option>
              {WALLET_TYPES.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>اسم صاحب المحفظة <span className="text-red-500">*</span></Label>
            <Input
              placeholder="الاسم الكامل"
              value={form.ownerName}
              onChange={(e) => { setForm({ ...form, ownerName: e.target.value }); setError(""); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الهاتف <span className="text-red-500">*</span></Label>
            <Input
              placeholder="+201XXXXXXXXX"
              value={form.phone}
              dir="ltr"
              onFocus={handlePhoneFocus}
              onChange={(e) => { setForm({ ...form, phone: e.target.value }); setError(""); }}
            />
            <p className="text-xs text-slate-400">مثال: +201022282802</p>
          </div>
        </>
      )}

      {/* InstaPay */}
      {form.type === "instapay" && (
        <>
          <div className="space-y-1.5">
            <Label>اسم صاحب الحساب <span className="text-red-500">*</span></Label>
            <Input
              placeholder="الاسم الكامل"
              value={form.ownerName}
              onChange={(e) => { setForm({ ...form, ownerName: e.target.value }); setError(""); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>رقم التحويل <span className="text-red-500">*</span></Label>
            <Input
              placeholder="+201XXXXXXXXX"
              value={form.phone}
              dir="ltr"
              onFocus={handlePhoneFocus}
              onChange={(e) => { setForm({ ...form, phone: e.target.value }); setError(""); }}
            />
            <p className="text-xs text-slate-400">مثال: +201022282802</p>
          </div>
        </>
      )}

      {/* Bank */}
      {form.type === "bank" && (
        <>
          <div className="space-y-1.5">
            <Label>البنك <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border rounded-md p-2 bg-white">
              {EGYPTIAN_BANKS.map((bank) => (
                <label
                  key={bank.name}
                  className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 text-xs transition-colors ${
                    form.bankName === bank.name
                      ? "bg-slate-100 font-medium"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="pm-bank"
                    value={bank.name}
                    checked={form.bankName === bank.name}
                    onChange={() => { setForm({ ...form, bankName: bank.name }); setError(""); }}
                    className="accent-[#1e3a5f] shrink-0"
                  />
                  <span
                    className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold text-white shrink-0"
                    style={{ backgroundColor: bank.color }}
                  >
                    {bank.abbr}
                  </span>
                  <span className="leading-tight">{bank.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>رقم الحساب <span className="text-red-500">*</span></Label>
            <Input
              placeholder="أدخل رقم الحساب البنكي"
              value={form.accountNumber}
              onChange={(e) => { setForm({ ...form, accountNumber: e.target.value }); setError(""); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>اسم صاحب الحساب <span className="text-red-500">*</span></Label>
            <Input
              placeholder="الاسم الكامل كما هو في البنك"
              value={form.ownerName}
              onChange={(e) => { setForm({ ...form, ownerName: e.target.value }); setError(""); }}
            />
          </div>
        </>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}

function SupplierPaymentMethodsDialog({
  supplierId,
  supplierName,
  open,
  onOpenChange,
}: {
  supplierId: number;
  supplierName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const { data: methodsRaw, isLoading } = useGetSupplierPaymentMethods(supplierId, {
    query: { enabled: open && !!supplierId, queryKey: getGetSupplierPaymentMethodsQueryKey(supplierId) },
  });
  const methods = Array.isArray(methodsRaw) ? methodsRaw : [];

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyPmForm);
  const [addError, setAddError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editingPm, setEditingPm] = useState<SupplierPaymentMethod | null>(null);
  const [editForm, setEditForm] = useState(emptyPmForm);
  const [editError, setEditError] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetSupplierPaymentMethodsQueryKey(supplierId) });

  const createPm = useCreateSupplierPaymentMethod({
    mutation: {
      onSuccess: () => { invalidate(); setAddOpen(false); setAddForm(emptyPmForm); setAddError(""); },
      onError: (err: any) => setAddError(err?.response?.data?.error ?? "حدث خطأ"),
    },
  });

  const updatePm = useUpdateSupplierPaymentMethod({
    mutation: {
      onSuccess: () => { invalidate(); setEditOpen(false); setEditingPm(null); setEditError(""); },
      onError: (err: any) => setEditError(err?.response?.data?.error ?? "حدث خطأ"),
    },
  });

  const deletePm = useDeleteSupplierPaymentMethod({
    mutation: { onSuccess: invalidate },
  });

  function handleAdd() {
    createPm.mutate({ id: supplierId, data: addForm });
  }

  function handleUpdate() {
    if (!editingPm) return;
    updatePm.mutate({ id: supplierId, pmId: editingPm.id, data: editForm });
  }

  function handleOpenEdit(pm: SupplierPaymentMethod) {
    setEditingPm(pm);
    setEditForm({
      type: pm.type as any,
      walletType: pm.walletType ?? "",
      ownerName: pm.ownerName ?? "",
      phone: pm.phone ?? "",
      bankName: pm.bankName ?? "",
      accountNumber: pm.accountNumber ?? "",
    });
    setEditError("");
    setEditOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">بيانات الدفع — {supplierName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {isLoading ? (
              <p className="text-center text-sm text-slate-400 py-6">جاري التحميل...</p>
            ) : methods.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-200 py-8 text-center">
                <p className="text-sm text-slate-400">لا توجد طرق دفع مضافة بعد</p>
              </div>
            ) : (
              <div className="space-y-2">
                {methods.map((pm) => (
                  <PaymentMethodCard
                    key={pm.id}
                    pm={pm}
                    onEdit={() => handleOpenEdit(pm)}
                    onDelete={() => deletePm.mutate({ id: supplierId, pmId: pm.id })}
                  />
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 flex-row-reverse">
            <Button
              className="bg-[#1e3a5f] hover:bg-[#162d4a]"
              onClick={() => { setAddForm(emptyPmForm); setAddError(""); setAddOpen(true); }}
            >
              + إضافة طريقة دفع
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add PM Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">إضافة طريقة دفع جديدة</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <PaymentMethodForm form={addForm} setForm={setAddForm} error={addError} setError={setAddError} />
          </div>
          <DialogFooter className="flex gap-2 flex-row-reverse">
            <Button
              className="bg-[#1e3a5f] hover:bg-[#162d4a]"
              onClick={handleAdd}
              disabled={createPm.isPending}
            >
              {createPm.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit PM Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تعديل طريقة الدفع</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <PaymentMethodForm form={editForm} setForm={setEditForm} error={editError} setError={setEditError} />
          </div>
          <DialogFooter className="flex gap-2 flex-row-reverse">
            <Button
              className="bg-[#1e3a5f] hover:bg-[#162d4a]"
              onClick={handleUpdate}
              disabled={updatePm.isPending}
            >
              {updatePm.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();

  const { data: suppliersRaw, isLoading: loadingSuppliers } = useGetSuppliers();
  const { data: categoriesRaw, isLoading: loadingCategories } = useGetSupplierCategories();

  const suppliers = Array.isArray(suppliersRaw) ? suppliersRaw : [];
  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : [];

  // ── Add dialog ──
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  // ── Edit dialog ──
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editCategoryIds, setEditCategoryIds] = useState<number[]>([]);
  const [editErrors, setEditErrors] = useState<FormErrors>({});

  // ── Category dialog ──
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catError, setCatError] = useState("");

  // ── Payment methods dialog ──
  const [pmDialogSupplierId, setPmDialogSupplierId] = useState<number | null>(null);
  const [pmDialogSupplierName, setPmDialogSupplierName] = useState("");
  const [pmDialogOpen, setPmDialogOpen] = useState(false);

  const createSupplier = useCreateSupplier({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
        setOpen(false);
        setSelectedCategoryIds([]);
        setForm(emptyForm);
      },
      onError: (err: any) => {
        setErrors((e) => ({ ...e, server: err?.response?.data?.error ?? "حدث خطأ أثناء الحفظ" }));
      },
    },
  });

  const updateSupplier = useUpdateSupplier({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
        setEditOpen(false);
        setEditId(null);
      },
      onError: (err: any) => {
        setEditErrors((e) => ({ ...e, server: err?.response?.data?.error ?? "حدث خطأ أثناء الحفظ" }));
      },
    },
  });

  const deleteSupplier = useDeleteSupplier({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() }),
    },
  });

  const createCategory = useCreateSupplierCategory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSupplierCategoriesQueryKey() });
        setNewCatName("");
        setCatError("");
      },
      onError: (err: any) => {
        setCatError(err?.response?.data?.error ?? "حدث خطأ");
      },
    },
  });

  const deleteCategory = useDeleteSupplierCategory({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSupplierCategoriesQueryKey() }),
    },
  });

  const PHONE_REGEX = /^\+201\d{9}$/;
  const PHONE_ERROR = "يجب أن يبدأ الرقم بـ +201 ويليه 9 أرقام (مثال: +201022282802)";

  function validatePhoneFields(f: typeof emptyForm): Partial<FormErrors> {
    const errs: Partial<FormErrors> = {};
    if (f.phone.trim() && !PHONE_REGEX.test(f.phone.trim())) errs.phone = PHONE_ERROR;
    if (f.whatsapp.trim() && !PHONE_REGEX.test(f.whatsapp.trim())) errs.whatsapp = PHONE_ERROR;
    return errs;
  }

  function handlePhoneFocus(field: "phone" | "whatsapp", setter: typeof setForm) {
    setter((f) => ({ ...f, [field]: f[field] || "+201" }));
  }

  function handleOpen() {
    setForm(emptyForm);
    setSelectedCategoryIds([]);
    setErrors({});
    setOpen(true);
  }

  function handleChange(field: keyof typeof emptyForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined, server: undefined }));
  }

  function handleEditChange(field: keyof typeof emptyForm, value: string) {
    setEditForm((f) => ({ ...f, [field]: value }));
    setEditErrors((e) => ({ ...e, [field]: undefined, server: undefined }));
  }

  function toggleCategory(id: number) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleEditCategory(id: number) {
    setEditCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleOpenEdit(s: (typeof suppliers)[number]) {
    setEditId(s.id);
    setEditForm({
      companyName: s.companyName ?? "",
      contactName: s.contactName ?? "",
      phone: s.phone ?? "",
      whatsapp: s.whatsapp ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      commercialReg: s.commercialReg ?? "",
      taxReg: s.taxReg ?? "",
      status: s.status ?? "نشط",
    });
    setEditCategoryIds(s.categories?.map((c) => c.id) ?? []);
    setEditErrors({});
    setEditOpen(true);
  }

  function handleOpenPayments(s: (typeof suppliers)[number]) {
    setPmDialogSupplierId(s.id);
    setPmDialogSupplierName(s.companyName);
    setPmDialogOpen(true);
  }

  function handleSave() {
    const phoneErrs = validatePhoneFields(form);
    if (!form.companyName.trim()) {
      setErrors({ companyName: "اسم الشركة مطلوب", ...phoneErrs });
      return;
    }
    if (Object.keys(phoneErrs).length) {
      setErrors(phoneErrs);
      return;
    }
    createSupplier.mutate({
      data: {
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        commercialReg: form.commercialReg.trim(),
        taxReg: form.taxReg.trim(),
        categoryIds: selectedCategoryIds,
      },
    });
  }

  function handleUpdate() {
    const phoneErrs = validatePhoneFields(editForm);
    if (!editForm.companyName.trim()) {
      setEditErrors({ companyName: "اسم الشركة مطلوب", ...phoneErrs });
      return;
    }
    if (Object.keys(phoneErrs).length) {
      setEditErrors(phoneErrs);
      return;
    }
    if (editId === null) return;
    updateSupplier.mutate({
      id: editId,
      data: {
        companyName: editForm.companyName.trim(),
        contactName: editForm.contactName.trim(),
        phone: editForm.phone.trim(),
        whatsapp: editForm.whatsapp.trim(),
        email: editForm.email.trim(),
        address: editForm.address.trim(),
        commercialReg: editForm.commercialReg.trim(),
        taxReg: editForm.taxReg.trim(),
        status: editForm.status,
        categoryIds: editCategoryIds,
      },
    });
  }

  function handleAddCategory() {
    const name = newCatName.trim();
    if (!name) { setCatError("أدخل اسم التصنيف"); return; }
    createCategory.mutate({ data: { name } });
  }

  const statusOptions = ["نشط", "غير نشط", "موقوف"];

  function CategoryCheckboxList({
    selected,
    onToggle,
    prefix,
  }: {
    selected: number[];
    onToggle: (id: number) => void;
    prefix: string;
  }) {
    return categories.length === 0 ? (
      <p className="text-xs text-slate-400 border rounded-md px-3 py-2 bg-slate-50">
        لا توجد تصنيفات — اضغط "+ إضافة تصنيف جديد" أولاً
      </p>
    ) : (
      <div className="border rounded-md px-3 py-2 bg-white space-y-2 max-h-36 overflow-y-auto">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-2">
            <Checkbox
              id={`cat-${cat.id}-${prefix}`}
              checked={selected.includes(cat.id)}
              onCheckedChange={() => onToggle(cat.id)}
            />
            <label
              htmlFor={`cat-${cat.id}-${prefix}`}
              className="text-sm text-slate-700 cursor-pointer select-none"
            >
              {cat.name}
            </label>
          </div>
        ))}
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">الموردين</h1>
          <div className="flex gap-2">
            <Button variant="outline" className="border-slate-300 text-slate-600"
              onClick={() => { setNewCatName(""); setCatError(""); setCatDialogOpen(true); }}
              data-testid="button-manage-categories">
              إدارة التصنيفات
            </Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleOpen} data-testid="button-add-supplier">
              + إضافة مورد جديد
            </Button>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3 font-medium text-slate-500">اسم الشركة</th>
                <th className="px-6 py-3 font-medium text-slate-500">التصنيفات</th>
                <th className="px-6 py-3 font-medium text-slate-500">مسئول التواصل</th>
                <th className="px-6 py-3 font-medium text-slate-500">الهاتف</th>
                <th className="px-6 py-3 font-medium text-slate-500">الحالة</th>
                <th className="px-6 py-3 font-medium text-slate-500">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loadingSuppliers ? (
                <tr><td className="p-8 text-slate-400 text-center" colSpan={6}>جاري التحميل...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td className="p-8 text-slate-400 text-center" colSpan={6}>لا توجد بيانات حتى الآن</td></tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{s.companyName}</td>
                    <td className="px-6 py-4">
                      {s.categories && s.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.categories.map((cat) => (
                            <span key={cat.id} className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                              {cat.name}
                            </span>
                          ))}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{s.contactName || "—"}</td>
                    <td className="px-6 py-4 text-slate-600">{s.phone || "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        s.status === "نشط" ? "bg-green-100 text-green-700" :
                        s.status === "موقوف" ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3 justify-end items-center">
                        <button
                          onClick={() => handleOpenPayments(s)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium border border-emerald-200 rounded px-2 py-0.5 hover:bg-emerald-50 transition-colors"
                          title="بيانات الدفع"
                        >
                          بيانات الدفع
                        </button>
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="text-xs text-blue-500 hover:text-blue-700"
                          data-testid={`button-edit-supplier-${s.id}`}
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => deleteSupplier.mutate({ id: s.id })}
                          className="text-xs text-red-400 hover:text-red-600"
                          data-testid={`button-delete-supplier-${s.id}`}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── نافذة بيانات الدفع ── */}
      {pmDialogSupplierId !== null && (
        <SupplierPaymentMethodsDialog
          supplierId={pmDialogSupplierId}
          supplierName={pmDialogSupplierName}
          open={pmDialogOpen}
          onOpenChange={(v) => { setPmDialogOpen(v); if (!v) setPmDialogSupplierId(null); }}
        />
      )}

      {/* ── نافذة إدارة التصنيفات ── */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">إدارة تصنيفات الموردين</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input placeholder="اسم التصنيف الجديد" value={newCatName}
                onChange={(e) => { setNewCatName(e.target.value); setCatError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                data-testid="input-new-category" className="flex-1" />
              <Button className="bg-[#1e3a5f] hover:bg-[#162d4a] shrink-0"
                onClick={handleAddCategory} disabled={createCategory.isPending}
                data-testid="button-add-category">
                + إضافة
              </Button>
            </div>
            {catError && <p className="text-xs text-red-500">{catError}</p>}
            {loadingCategories ? (
              <p className="text-center text-sm text-slate-400">جاري التحميل...</p>
            ) : categories.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4">لا توجد تصنيفات بعد</p>
            ) : (
              <ul className="divide-y rounded-lg border border-slate-200 overflow-hidden">
                {categories.map((cat) => (
                  <li key={cat.id} className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50">
                    <span className="text-sm text-slate-700">{cat.name}</span>
                    <button onClick={() => deleteCategory.mutate({ id: cat.id })}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      data-testid={`button-delete-category-${cat.id}`}>
                      حذف
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── نافذة إضافة مورد ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">إضافة مورد جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="companyName">اسم الشركة <span className="text-red-500">*</span></Label>
                <Input id="companyName" placeholder="أدخل اسم الشركة" value={form.companyName}
                  onChange={(e) => handleChange("companyName", e.target.value)} data-testid="input-company-name" />
                {errors.companyName && <p className="text-xs text-red-500">{errors.companyName}</p>}
              </div>

              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>تصنيف المورد</Label>
                  <button type="button"
                    onClick={() => { setNewCatName(""); setCatError(""); setCatDialogOpen(true); }}
                    className="text-xs text-blue-600 hover:underline">
                    + إضافة تصنيف جديد
                  </button>
                </div>
                <CategoryCheckboxList selected={selectedCategoryIds} onToggle={toggleCategory} prefix="add" />
                {selectedCategoryIds.length > 0 && (
                  <p className="text-xs text-blue-600">تم اختيار {selectedCategoryIds.length} تصنيف</p>
                )}
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="contactName">اسم مسئول التواصل</Label>
                <Input id="contactName" placeholder="الاسم الكامل" value={form.contactName}
                  onChange={(e) => handleChange("contactName", e.target.value)} data-testid="input-contact-name" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input id="phone" placeholder="+201XXXXXXXXX" value={form.phone} dir="ltr"
                  onFocus={() => handlePhoneFocus("phone", setForm)}
                  onChange={(e) => handleChange("phone", e.target.value)} data-testid="input-phone" />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">رقم الواتساب</Label>
                <Input id="whatsapp" placeholder="+201XXXXXXXXX" value={form.whatsapp} dir="ltr"
                  onFocus={() => handlePhoneFocus("whatsapp", setForm)}
                  onChange={(e) => handleChange("whatsapp", e.target.value)} data-testid="input-whatsapp" />
                {errors.whatsapp && <p className="text-xs text-red-500">{errors.whatsapp}</p>}
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" type="email" placeholder="example@company.com" value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)} data-testid="input-email" />
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="address">العنوان</Label>
                <Input id="address" placeholder="المدينة، الحي، الشارع" value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)} data-testid="input-address" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="commercialReg">رقم السجل التجاري (س.ت)</Label>
                <Input id="commercialReg" placeholder="10xxxxxxxx" value={form.commercialReg}
                  onChange={(e) => handleChange("commercialReg", e.target.value)} data-testid="input-commercial-reg" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="taxReg">رقم التسجيل الضريبي</Label>
                <Input id="taxReg" placeholder="3xxxxxxxxxx" value={form.taxReg}
                  onChange={(e) => handleChange("taxReg", e.target.value)} data-testid="input-tax-reg" />
              </div>

              {errors.server && (
                <div className="col-span-2 rounded-md bg-red-50 border border-red-200 px-4 py-2">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex gap-2 flex-row-reverse">
            <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleSave}
              disabled={createSupplier.isPending} data-testid="button-save-supplier">
              {createSupplier.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── نافذة تعديل مورد ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تعديل بيانات المورد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>اسم الشركة <span className="text-red-500">*</span></Label>
                <Input placeholder="أدخل اسم الشركة" value={editForm.companyName}
                  onChange={(e) => handleEditChange("companyName", e.target.value)} />
                {editErrors.companyName && <p className="text-xs text-red-500">{editErrors.companyName}</p>}
              </div>

              <div className="col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>تصنيف المورد</Label>
                  <button type="button"
                    onClick={() => { setNewCatName(""); setCatError(""); setCatDialogOpen(true); }}
                    className="text-xs text-blue-600 hover:underline">
                    + إضافة تصنيف جديد
                  </button>
                </div>
                <CategoryCheckboxList selected={editCategoryIds} onToggle={toggleEditCategory} prefix="edit" />
                {editCategoryIds.length > 0 && (
                  <p className="text-xs text-blue-600">تم اختيار {editCategoryIds.length} تصنيف</p>
                )}
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>الحالة</Label>
                <div className="flex gap-3">
                  {statusOptions.map((s) => (
                    <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="edit-status" value={s}
                        checked={editForm.status === s}
                        onChange={() => handleEditChange("status", s)}
                        className="accent-[#1e3a5f]" />
                      <span className="text-sm text-slate-700">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>اسم مسئول التواصل</Label>
                <Input placeholder="الاسم الكامل" value={editForm.contactName}
                  onChange={(e) => handleEditChange("contactName", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>رقم الهاتف</Label>
                <Input placeholder="+201XXXXXXXXX" value={editForm.phone} dir="ltr"
                  onFocus={() => handlePhoneFocus("phone", setEditForm)}
                  onChange={(e) => handleEditChange("phone", e.target.value)} />
                {editErrors.phone && <p className="text-xs text-red-500">{editErrors.phone}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>رقم الواتساب</Label>
                <Input placeholder="+201XXXXXXXXX" value={editForm.whatsapp} dir="ltr"
                  onFocus={() => handlePhoneFocus("whatsapp", setEditForm)}
                  onChange={(e) => handleEditChange("whatsapp", e.target.value)} />
                {editErrors.whatsapp && <p className="text-xs text-red-500">{editErrors.whatsapp}</p>}
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" placeholder="example@company.com" value={editForm.email}
                  onChange={(e) => handleEditChange("email", e.target.value)} />
                {editErrors.email && <p className="text-xs text-red-500">{editErrors.email}</p>}
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>العنوان</Label>
                <Input placeholder="المدينة، الحي، الشارع" value={editForm.address}
                  onChange={(e) => handleEditChange("address", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>رقم السجل التجاري (س.ت)</Label>
                <Input placeholder="10xxxxxxxx" value={editForm.commercialReg}
                  onChange={(e) => handleEditChange("commercialReg", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>رقم التسجيل الضريبي</Label>
                <Input placeholder="3xxxxxxxxxx" value={editForm.taxReg}
                  onChange={(e) => handleEditChange("taxReg", e.target.value)} />
              </div>

              {editErrors.server && (
                <div className="col-span-2 rounded-md bg-red-50 border border-red-200 px-4 py-2">
                  <p className="text-sm text-red-600">{editErrors.server}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex gap-2 flex-row-reverse">
            <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleUpdate}
              disabled={updateSupplier.isPending}>
              {updateSupplier.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
