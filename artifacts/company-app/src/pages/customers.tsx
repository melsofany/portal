import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useGetCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  getGetCustomersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const emptyForm = {
  name: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  commercialReg: "",
  taxReg: "",
  status: "نشط",
};

type FormData = typeof emptyForm;
type FormErrors = Partial<Record<keyof FormData | "server", string>>;

const PHONE_REGEX = /^\+201\d{9}$/;
const PHONE_ERROR = "يجب أن يبدأ الرقم بـ +201 ويليه 9 أرقام (مثال: +201022282802)";
const statusOptions = ["نشط", "غير نشط", "موقوف"];

function validatePhones(f: FormData): Partial<FormErrors> {
  const errs: Partial<FormErrors> = {};
  if (f.phone.trim() && !PHONE_REGEX.test(f.phone.trim())) errs.phone = PHONE_ERROR;
  if (f.whatsapp.trim() && !PHONE_REGEX.test(f.whatsapp.trim())) errs.whatsapp = PHONE_ERROR;
  return errs;
}

function CustomerFormFields({
  f,
  errs,
  onChange,
  onPhoneFocus,
}: {
  f: FormData;
  errs: FormErrors;
  onChange: (field: keyof FormData, value: string) => void;
  onPhoneFocus: (field: "phone" | "whatsapp") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 space-y-1.5">
        <Label>الاسم <span className="text-red-500">*</span></Label>
        <Input placeholder="أدخل اسم العميل" value={f.name}
          onChange={(e) => onChange("name", e.target.value)} />
        {errs.name && <p className="text-xs text-red-500">{errs.name}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>رقم الهاتف</Label>
        <Input placeholder="+201XXXXXXXXX" value={f.phone} dir="ltr"
          onFocus={() => onPhoneFocus("phone")}
          onChange={(e) => onChange("phone", e.target.value)} />
        {errs.phone && <p className="text-xs text-red-500">{errs.phone}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>رقم الواتساب</Label>
        <Input placeholder="+201XXXXXXXXX" value={f.whatsapp} dir="ltr"
          onFocus={() => onPhoneFocus("whatsapp")}
          onChange={(e) => onChange("whatsapp", e.target.value)} />
        {errs.whatsapp && <p className="text-xs text-red-500">{errs.whatsapp}</p>}
      </div>

      <div className="col-span-2 space-y-1.5">
        <Label>البريد الإلكتروني</Label>
        <Input type="email" placeholder="example@company.com" value={f.email}
          onChange={(e) => onChange("email", e.target.value)} />
        {errs.email && <p className="text-xs text-red-500">{errs.email}</p>}
      </div>

      <div className="col-span-2 space-y-1.5">
        <Label>العنوان</Label>
        <Input placeholder="المدينة، الحي، الشارع" value={f.address}
          onChange={(e) => onChange("address", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>رقم السجل التجاري (س.ت)</Label>
        <Input placeholder="10xxxxxxxx" value={f.commercialReg}
          onChange={(e) => onChange("commercialReg", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>رقم التسجيل الضريبي</Label>
        <Input placeholder="3xxxxxxxxxx" value={f.taxReg}
          onChange={(e) => onChange("taxReg", e.target.value)} />
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const { data: customersRaw, isLoading } = useGetCustomers();
  const customers = Array.isArray(customersRaw) ? customersRaw : [];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editErrors, setEditErrors] = useState<FormErrors>({});

  const createCustomer = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        setOpen(false);
        setForm(emptyForm);
      },
      onError: (err: any) => {
        setErrors((e) => ({ ...e, server: err?.data?.error ?? "حدث خطأ أثناء الحفظ" }));
      },
    },
  });

  const updateCustomer = useUpdateCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        setEditOpen(false);
        setEditId(null);
      },
      onError: (err: any) => {
        setEditErrors((e) => ({ ...e, server: err?.data?.error ?? "حدث خطأ أثناء الحفظ" }));
      },
    },
  });

  const deleteCustomer = useDeleteCustomer({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() }),
    },
  });

  function handleOpen() {
    setForm(emptyForm);
    setErrors({});
    setOpen(true);
  }

  function handleOpenEdit(c: (typeof customers)[number]) {
    setEditId(c.id);
    setEditForm({
      name: c.name ?? "",
      phone: c.phone ?? "",
      whatsapp: c.whatsapp ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      commercialReg: c.commercialReg ?? "",
      taxReg: c.taxReg ?? "",
      status: c.status ?? "نشط",
    });
    setEditErrors({});
    setEditOpen(true);
  }

  function handleChange(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined, server: undefined }));
  }

  function handleEditChange(field: keyof FormData, value: string) {
    setEditForm((f) => ({ ...f, [field]: value }));
    setEditErrors((e) => ({ ...e, [field]: undefined, server: undefined }));
  }

  function handlePhoneFocus(field: "phone" | "whatsapp", setter: typeof setForm) {
    setter((f) => ({ ...f, [field]: f[field] || "+201" }));
  }

  function handleSave() {
    const phoneErrs = validatePhones(form);
    if (!form.name.trim()) {
      setErrors({ name: "اسم العميل مطلوب", ...phoneErrs });
      return;
    }
    if (Object.keys(phoneErrs).length) { setErrors(phoneErrs); return; }
    createCustomer.mutate({
      data: {
        name: form.name.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        commercialReg: form.commercialReg.trim(),
        taxReg: form.taxReg.trim(),
      },
    });
  }

  function handleUpdate() {
    const phoneErrs = validatePhones(editForm);
    if (!editForm.name.trim()) {
      setEditErrors({ name: "اسم العميل مطلوب", ...phoneErrs });
      return;
    }
    if (Object.keys(phoneErrs).length) { setEditErrors(phoneErrs); return; }
    if (editId === null) return;
    updateCustomer.mutate({
      id: editId,
      data: {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        whatsapp: editForm.whatsapp.trim(),
        email: editForm.email.trim(),
        address: editForm.address.trim(),
        commercialReg: editForm.commercialReg.trim(),
        taxReg: editForm.taxReg.trim(),
        status: editForm.status,
      },
    });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">العملاء</h1>
          <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleOpen}>
            + إضافة عميل جديد
          </Button>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3 font-medium text-slate-500">الاسم</th>
                <th className="px-6 py-3 font-medium text-slate-500">الهاتف</th>
                <th className="px-6 py-3 font-medium text-slate-500">البريد الإلكتروني</th>
                <th className="px-6 py-3 font-medium text-slate-500">الحالة</th>
                <th className="px-6 py-3 font-medium text-slate-500">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="p-8 text-slate-400 text-center" colSpan={5}>جاري التحميل...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td className="p-8 text-slate-400 text-center" colSpan={5}>لا توجد بيانات حتى الآن</td></tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{c.name}</td>
                    <td className="px-6 py-4 text-slate-600" dir="ltr">{c.phone || "—"}</td>
                    <td className="px-6 py-4 text-slate-600">{c.email || "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        c.status === "نشط" ? "bg-green-100 text-green-700" :
                        c.status === "موقوف" ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => handleOpenEdit(c)}
                          className="text-xs text-blue-500 hover:text-blue-700">تعديل</button>
                        <button onClick={() => deleteCustomer.mutate({ id: c.id })}
                          className="text-xs text-red-400 hover:text-red-600">حذف</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── نافذة إضافة عميل ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">إضافة عميل جديد</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <CustomerFormFields
              f={form}
              errs={errors}
              onChange={handleChange}
              onPhoneFocus={(field) => handlePhoneFocus(field, setForm)}
            />
            {errors.server && (
              <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-2">
                <p className="text-sm text-red-600">{errors.server}</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 flex-row-reverse">
            <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleSave}
              disabled={createCustomer.isPending}>
              {createCustomer.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── نافذة تعديل عميل ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تعديل بيانات العميل</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <CustomerFormFields
              f={editForm}
              errs={editErrors}
              onChange={handleEditChange}
              onPhoneFocus={(field) => handlePhoneFocus(field, setEditForm)}
            />
            <div className="space-y-1.5">
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
            {editErrors.server && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2">
                <p className="text-sm text-red-600">{editErrors.server}</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 flex-row-reverse">
            <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleUpdate}
              disabled={updateCustomer.isPending}>
              {updateCustomer.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
