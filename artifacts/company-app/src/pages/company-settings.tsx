import React, { useState, useRef } from "react";
  import AppLayout from "@/components/AppLayout";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import { Button } from "@/components/ui/button";
  import {
    Building2, Save, Upload, X, Mail, MessageCircle,
    FileText, Landmark, Eye, EyeOff, Plus, Trash2, ShieldAlert,
    Users, Pencil, Check, UserPlus
  } from "lucide-react";
  import { API_BASE } from "@/lib/auth-context";

  function getAuthHeaders(): Record<string, string> {
    try {
      const token = localStorage.getItem("auth_token");
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch { return {}; }
  }

  interface WhatsAppTemplate { name: string; language: string; body: string; }

  interface CompanySettings {
    id: number; name: string; logoUrl: string; address: string; phone: string;
    email: string; commercialReg: string; taxReg: string; website: string;
    smtpHost: string; smtpPort: string; smtpUser: string; smtpPass: string; smtpFromName: string;
    whatsappAccountId: string; whatsappPhoneNumber: string; whatsappToken: string;
    whatsappVerifyToken: string; whatsappTemplates: string;
    zatcaVatNumber: string; zatcaEnvironment: string; zatcaApiUrl: string;
    zatcaApiKey: string; zatcaCertificate: string; zatcaPrivateKey: string;
    bankName: string; bankIban: string; bankAccountNumber: string;
    bankSwift: string; bankApiUrl: string; bankApiKey: string; bankApiSecret: string;
  }

  interface AppUser {
    id: number; username: string; email: string | null; fullName: string | null;
    role: string; employeeId: number | null; permissions: string | null;
    isActive: boolean; photoUrl: string | null;
  }

  interface Employee {
    id: number; fullName: string; employeeNumber: string; email: string | null;
  }

  type Permissions = Record<string, boolean>;

  const ALL_PERMISSIONS: { key: string; label: string }[] = [
    { key: "dashboard",      label: "لوحة التحكم" },
    { key: "employees",      label: "الموظفين" },
    { key: "customers",      label: "العملاء" },
    { key: "suppliers",      label: "الموردين" },
    { key: "customerOrders", label: "طلبات العملاء" },
    { key: "supplierOrders", label: "طلبات الموردين" },
    { key: "quotations",     label: "عروض الأسعار" },
    { key: "finance",        label: "الحسابات والفواتير" },
    { key: "reports",        label: "التقارير" },
    { key: "settings",       label: "الإعدادات" },
  ];

  function parsePerms(raw: string | null): Permissions {
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  }

  type Tab = "company" | "sensitive" | "users";

  const emptyUserForm = {
    email: "", fullName: "", password: "",
    role: "user", employeeId: "", permissions: {} as Permissions,
    isActive: true, photoUrl: "",
  };

  export default function CompanySettingsPage() {
    const queryClient = useQueryClient();
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("company");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // ─── Company Settings ───
    const { data, isLoading } = useQuery<CompanySettings>({
      queryKey: ["company-settings"],
      queryFn: async () => {
        const res = await fetch(`${API_BASE}/api/settings`, { credentials: "include", headers: getAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      },
    });

    const [form, setForm] = useState<Partial<CompanySettings>>({});
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);

    React.useEffect(() => {
      if (data) {
        setForm(data);
        try { setTemplates(JSON.parse(data.whatsappTemplates || "[]")); } catch { setTemplates([]); }
      }
    }, [data]);

    const mutation = useMutation({
      mutationFn: async (payload: Partial<CompanySettings>) => {
        const res = await fetch(`${API_BASE}/api/settings`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
        return res.json();
      },
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["company-settings"] }); setSaved(true); setSaveError(null); setTimeout(() => setSaved(false), 3000); },
      onError: (err: Error) => { setSaveError(err.message); setTimeout(() => setSaveError(null), 5000); },
    });

    function set(field: keyof CompanySettings, value: string) { setForm(prev => ({ ...prev, [field]: value })); }
    function handleSave() { mutation.mutate({ ...form, whatsappTemplates: JSON.stringify(templates) }); }
    function toggleSecret(key: string) { setShowSecrets(prev => ({ ...prev, [key]: !prev[key] })); }
    function addTemplate() { setTemplates(prev => [...prev, { name: "", language: "ar", body: "" }]); }
    function updateTemplate(i: number, field: keyof WhatsAppTemplate, value: string) { setTemplates(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t)); }
    function removeTemplate(i: number) { setTemplates(prev => prev.filter((_, idx) => idx !== i)); }
    function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => set("logoUrl", ev.target?.result as string);
      reader.readAsDataURL(file);
    }
    function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => setUserForm(p => ({ ...p, photoUrl: ev.target?.result as string }));
      reader.readAsDataURL(file);
    }

    // ─── Users Management ───
    const { data: usersData, isLoading: usersLoading } = useQuery<AppUser[]>({
      queryKey: ["app-users"],
      queryFn: async () => {
        const res = await fetch(`${API_BASE}/api/users`, { credentials: "include", headers: getAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      },
      enabled: activeTab === "users",
    });

    const { data: employeesData } = useQuery<Employee[]>({
      queryKey: ["employees-list-for-users"],
      queryFn: async () => {
        const res = await fetch(`${API_BASE}/api/employees`, { credentials: "include", headers: getAuthHeaders() });
        if (!res.ok) return [];
        const d = await res.json();
        return Array.isArray(d) ? d : (d.data || []);
      },
      enabled: activeTab === "users",
    });

    const [userModal, setUserModal] = useState<{ open: boolean; editing: AppUser | null }>({ open: false, editing: null });
    const [userForm, setUserForm] = useState(emptyUserForm);
    const [userError, setUserError] = useState<string | null>(null);

    function openAddUser() {
      setUserForm({ ...emptyUserForm });
      setUserError(null);
      setUserModal({ open: true, editing: null });
    }

    function openEditUser(u: AppUser) {
      setUserForm({
        email: u.email || "", fullName: u.fullName || "",
        password: "", role: u.role,
        employeeId: u.employeeId ? String(u.employeeId) : "",
        permissions: parsePerms(u.permissions),
        isActive: u.isActive, photoUrl: u.photoUrl || "",
      });
      setUserError(null);
      setUserModal({ open: true, editing: u });
    }

    function closeUserModal() { setUserModal({ open: false, editing: null }); }

    function togglePerm(key: string) {
      setUserForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }));
    }

    function handleEmployeeSelect(empId: string) {
      const emp = (employeesData || []).find(x => String(x.id) === empId);
      setUserForm(p => ({
        ...p,
        employeeId: empId,
        fullName: emp ? emp.fullName : "",
        email: emp?.email || "",
      }));
    }

    const userMutation = useMutation({
      mutationFn: async (payload: typeof userForm & { id?: number }) => {
        const { id, ...body } = payload;
        const url = id ? `${API_BASE}/api/users/${id}` : `${API_BASE}/api/users`;
        const method = id ? "PUT" : "POST";
        const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(body) });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
        return res.json();
      },
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["app-users"] }); closeUserModal(); },
      onError: (err: Error) => setUserError(err.message),
    });

    const deleteUserMutation = useMutation({
      mutationFn: async (id: number) => {
        const res = await fetch(`${API_BASE}/api/users/${id}`, { method: "DELETE", credentials: "include", headers: getAuthHeaders() });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-users"] }),
    });

    function handleUserSave() {
      if (!userForm.employeeId) return setUserError("يجب اختيار موظف أولاً");
      if (!userModal.editing && !userForm.password.trim()) return setUserError("كلمة المرور مطلوبة");
      userMutation.mutate({ ...userForm, id: userModal.editing?.id });
    }

    if (isLoading) return <AppLayout><div className="text-center text-slate-400 py-16 text-sm">جاري التحميل...</div></AppLayout>;

    const SaveBtn = () => (
      <div className="flex flex-col items-end gap-1">
        <Button className={`${saved ? "bg-green-600 hover:bg-green-700" : "bg-[#0064d9] hover:bg-[#0854a0]"}`} onClick={handleSave} disabled={mutation.isPending}>
          <Save className="h-4 w-4 ml-2" />
          {mutation.isPending ? "جاري الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ"}
        </Button>
        {saveError && <span className="text-xs text-red-500">{saveError}</span>}
      </div>
    );

    return (
      <AppLayout>
        <div dir="rtl" className="max-w-4xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">الإعدادات</h1>
            {activeTab !== "users" && <SaveBtn />}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {([
              { id: "company",   label: "بيانات الشركة",     icon: Building2 },
              { id: "sensitive", label: "الإعدادات الحساسة", icon: ShieldAlert },
              { id: "users",     label: "إدارة المستخدمين",  icon: Users },
            ] as { id: Tab; label: string; icon: React.ElementType }[]).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? "bg-white text-[#0064d9] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <t.icon className="h-4 w-4" />{t.label}
              </button>
            ))}
          </div>

          {/* ── بيانات الشركة ── */}
          {activeTab === "company" && (
            <div className="space-y-5">
              <Section title="شعار الشركة" icon={<Building2 className="h-4 w-4 text-[#0064d9]" />}>
                <div className="flex items-center gap-4">
                  {form.logoUrl ? (
                    <div className="relative">
                      <img src={form.logoUrl} alt="شعار" className="h-20 w-auto max-w-[200px] object-contain rounded-lg border border-slate-200" />
                      <button onClick={() => set("logoUrl", "")} className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center"><Building2 className="h-8 w-8 text-slate-300" /></div>
                  )}
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 ml-1" /> رفع شعار</Button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                    <p className="text-xs text-slate-400">PNG أو JPG</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">أو رابط:</span>
                      <input type="url" placeholder="https://..." value={form.logoUrl?.startsWith("http") ? form.logoUrl : ""} onChange={e => set("logoUrl", e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none" dir="ltr" />
                    </div>
                  </div>
                </div>
              </Section>
              <Section title="بيانات الشركة">
                <div className="grid grid-cols-1 gap-4">
                  <Field label="اسم الشركة *" value={form.name ?? ""} onChange={v => set("name", v)} placeholder="شركة ..." />
                  <Field label="العنوان" value={form.address ?? ""} onChange={v => set("address", v)} />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="رقم الهاتف" value={form.phone ?? ""} onChange={v => set("phone", v)} dir="ltr" />
                    <Field label="البريد الإلكتروني" value={form.email ?? ""} onChange={v => set("email", v)} dir="ltr" />
                  </div>
                  <Field label="الموقع الإلكتروني" value={form.website ?? ""} onChange={v => set("website", v)} dir="ltr" />
                </div>
              </Section>
              <Section title="بيانات التسجيل">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="السجل التجاري" value={form.commercialReg ?? ""} onChange={v => set("commercialReg", v)} dir="ltr" />
                  <Field label="الرقم الضريبي (VAT)" value={form.taxReg ?? ""} onChange={v => set("taxReg", v)} dir="ltr" />
                </div>
              </Section>
            </div>
          )}

          {/* ── الإعدادات الحساسة ── */}
          {activeTab === "sensitive" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-700">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                هذه البيانات سرية — لا تشاركها مع أي شخص غير موثوق
              </div>
              <Section title="البريد الإلكتروني (SMTP)" icon={<Mail className="h-4 w-4 text-[#0064d9]" />}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="SMTP Host" value={form.smtpHost ?? ""} onChange={v => set("smtpHost", v)} placeholder="smtp.gmail.com" dir="ltr" />
                  <Field label="SMTP Port" value={form.smtpPort ?? ""} onChange={v => set("smtpPort", v)} placeholder="587" dir="ltr" />
                  <Field label="SMTP User" value={form.smtpUser ?? ""} onChange={v => set("smtpUser", v)} placeholder="user@gmail.com" dir="ltr" />
                  <SecretField label="SMTP Password" fieldKey="smtpPass" value={form.smtpPass ?? ""} onChange={v => set("smtpPass", v)} show={!!showSecrets["smtpPass"]} onToggle={() => toggleSecret("smtpPass")} />
                  <div className="col-span-2"><Field label="اسم المُرسِل" value={form.smtpFromName ?? ""} onChange={v => set("smtpFromName", v)} placeholder="اسم شركتك" /></div>
                </div>
              </Section>
              <Section title="واتساب (WhatsApp Business API)" icon={<MessageCircle className="h-4 w-4 text-green-600" />}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Account ID" value={form.whatsappAccountId ?? ""} onChange={v => set("whatsappAccountId", v)} dir="ltr" />
                  <Field label="Phone Number ID" value={form.whatsappPhoneNumber ?? ""} onChange={v => set("whatsappPhoneNumber", v)} dir="ltr" />
                  <SecretField label="Access Token" fieldKey="waToken" value={form.whatsappToken ?? ""} onChange={v => set("whatsappToken", v)} show={!!showSecrets["waToken"]} onToggle={() => toggleSecret("waToken")} />
                  <Field label="Verify Token" value={form.whatsappVerifyToken ?? ""} onChange={v => set("whatsappVerifyToken", v)} dir="ltr" />
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">قوالب الرسائل</span>
                    <Button variant="outline" size="sm" onClick={addTemplate}><Plus className="h-3.5 w-3.5 ml-1" /> إضافة قالب</Button>
                  </div>
                  {templates.length === 0 && <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">لا توجد قوالب</p>}
                  {templates.map((tpl, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">قالب #{i + 1}</span>
                        <button onClick={() => removeTemplate(i)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="اسم القالب" value={tpl.name} onChange={v => updateTemplate(i, "name", v)} placeholder="order_confirmation" dir="ltr" />
                        <Field label="اللغة" value={tpl.language} onChange={v => updateTemplate(i, "language", v)} placeholder="ar" dir="ltr" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">نص الرسالة</label>
                        <textarea value={tpl.body} onChange={e => updateTemplate(i, "body", e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" dir="rtl" />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="فاتورة زاتكا (ZATCA)" icon={<FileText className="h-4 w-4 text-[#0064d9]" />}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="رقم ضريبي (VAT)" value={form.zatcaVatNumber ?? ""} onChange={v => set("zatcaVatNumber", v)} dir="ltr" />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">البيئة</label>
                    <select value={form.zatcaEnvironment ?? ""} onChange={e => set("zatcaEnvironment", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" dir="ltr">
                      <option value="">اختر...</option>
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                  <Field label="API URL" value={form.zatcaApiUrl ?? ""} onChange={v => set("zatcaApiUrl", v)} dir="ltr" />
                  <SecretField label="API Key" fieldKey="zatcaKey" value={form.zatcaApiKey ?? ""} onChange={v => set("zatcaApiKey", v)} show={!!showSecrets["zatcaKey"]} onToggle={() => toggleSecret("zatcaKey")} />
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Certificate (PEM)</label>
                    <textarea value={form.zatcaCertificate ?? ""} onChange={e => set("zatcaCertificate", e.target.value)} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none" dir="ltr" placeholder="-----BEGIN CERTIFICATE-----" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Private Key (PEM)</label>
                    <textarea value={form.zatcaPrivateKey ?? ""} onChange={e => set("zatcaPrivateKey", e.target.value)} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none" dir="ltr" placeholder="-----BEGIN RSA PRIVATE KEY-----" />
                  </div>
                </div>
              </Section>
              <Section title="الحساب البنكي" icon={<Landmark className="h-4 w-4 text-[#0064d9]" />}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="اسم البنك" value={form.bankName ?? ""} onChange={v => set("bankName", v)} />
                  <Field label="IBAN" value={form.bankIban ?? ""} onChange={v => set("bankIban", v)} dir="ltr" />
                  <Field label="رقم الحساب" value={form.bankAccountNumber ?? ""} onChange={v => set("bankAccountNumber", v)} dir="ltr" />
                  <Field label="SWIFT Code" value={form.bankSwift ?? ""} onChange={v => set("bankSwift", v)} dir="ltr" />
                  <Field label="Bank API URL" value={form.bankApiUrl ?? ""} onChange={v => set("bankApiUrl", v)} dir="ltr" />
                  <SecretField label="Bank API Key" fieldKey="bankKey" value={form.bankApiKey ?? ""} onChange={v => set("bankApiKey", v)} show={!!showSecrets["bankKey"]} onToggle={() => toggleSecret("bankKey")} />
                  <div className="col-span-2">
                    <SecretField label="Bank API Secret" fieldKey="bankSecret" value={form.bankApiSecret ?? ""} onChange={v => set("bankApiSecret", v)} show={!!showSecrets["bankSecret"]} onToggle={() => toggleSecret("bankSecret")} />
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* ── إدارة المستخدمين ── */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">كل مستخدم يرتبط بموظف — يسجل الدخول ببريده الإلكتروني</p>
                <Button className="bg-[#0064d9] hover:bg-[#0854a0]" onClick={openAddUser}>
                  <UserPlus className="h-4 w-4 ml-2" /> إضافة مستخدم
                </Button>
              </div>

              {usersLoading ? (
                <div className="text-center text-slate-400 py-12 text-sm">جاري التحميل...</div>
              ) : (
                <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-medium text-slate-500">المستخدم</th>
                        <th className="px-4 py-3 font-medium text-slate-500">البريد الإلكتروني</th>
                        <th className="px-4 py-3 font-medium text-slate-500">الدور</th>
                        <th className="px-4 py-3 font-medium text-slate-500">الصلاحيات</th>
                        <th className="px-4 py-3 font-medium text-slate-500">الحالة</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(!usersData || usersData.length === 0) && (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">لا يوجد مستخدمون</td></tr>
                      )}
                      {usersData?.map(u => {
                        const perms = parsePerms(u.permissions);
                        const permCount = Object.values(perms).filter(Boolean).length;
                        return (
                          <tr key={u.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {u.photoUrl ? (
                                  <img src={u.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover border border-slate-200 shrink-0" />
                                ) : (
                                  <div className="h-9 w-9 rounded-full bg-[#0064d9]/10 flex items-center justify-center shrink-0">
                                    <span className="text-[#0064d9] font-bold text-sm">{(u.fullName || u.username)[0]?.toUpperCase()}</span>
                                  </div>
                                )}
                                <span className="font-medium text-slate-800">{u.fullName || u.username}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs font-mono">{u.email || "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                                {u.role === "admin" ? "مدير" : "مستخدم"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {u.role === "admin" ? <span className="text-purple-600 font-medium">كل الصلاحيات</span> : `${permCount} / ${ALL_PERMISSIONS.length}`}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                {u.isActive ? "نشط" : "معطل"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 justify-end">
                                <button onClick={() => openEditUser(u)} className="text-slate-400 hover:text-[#0064d9]"><Pencil className="h-4 w-4" /></button>
                                <button onClick={() => { if (confirm("هل أنت متأكد من حذف هذا المستخدم؟")) deleteUserMutation.mutate(u.id); }} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── User Modal ── */}
              {userModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                    <div className="flex items-center justify-between border-b border-slate-200 p-5">
                      <h3 className="text-lg font-bold text-slate-800">
                        {userModal.editing ? "تعديل مستخدم" : "إضافة مستخدم جديد"}
                      </h3>
                      <button onClick={closeUserModal} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
                    </div>

                    <div className="p-5 space-y-5">

                      {/* Photo */}
                      <div className="flex items-center gap-5">
                        {userForm.photoUrl ? (
                          <div className="relative">
                            <img src={userForm.photoUrl} alt="صورة" className="h-20 w-20 rounded-full object-cover border-2 border-slate-200" />
                            <button onClick={() => setUserForm(p => ({ ...p, photoUrl: "" }))} className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="h-20 w-20 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                            <Users className="h-7 w-7 text-slate-300" />
                          </div>
                        )}
                        <div>
                          <Button variant="outline" size="sm" type="button" onClick={() => photoInputRef.current?.click()}>
                            <Upload className="h-4 w-4 ml-1" /> رفع صورة
                          </Button>
                          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
                          <p className="text-xs text-slate-400 mt-1">صورة شخصية — PNG أو JPG</p>
                        </div>
                      </div>

                      {/* Employee selection */}
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">
                          الموظف <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={userForm.employeeId}
                          onChange={e => handleEmployeeSelect(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                          disabled={!!userModal.editing}
                        >
                          <option value="">— اختر موظف —</option>
                          {(employeesData || []).map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.fullName} ({emp.employeeNumber})
                            </option>
                          ))}
                        </select>
                        {userModal.editing && <p className="text-xs text-slate-400">لا يمكن تغيير الموظف المرتبط — احذف المستخدم وأعد إنشاءه</p>}
                      </div>

                      {/* Auto-filled info */}
                      {(userForm.fullName || userForm.email) && (
                        <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 space-y-1.5">
                          <p className="text-xs font-semibold text-blue-700">بيانات مجلوبة من الموظف</p>
                          <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                            <div><span className="text-slate-400 text-xs">الاسم: </span>{userForm.fullName}</div>
                            <div><span className="text-slate-400 text-xs">البريد (للدخول): </span><span className="font-mono text-xs">{userForm.email || "غير مسجل"}</span></div>
                          </div>
                          {!userForm.email && (
                            <p className="text-xs text-amber-600">⚠ هذا الموظف ليس لديه بريد إلكتروني — أضفه في بيانات الموظف أولاً</p>
                          )}
                        </div>
                      )}

                      {/* Password */}
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">
                          {userModal.editing ? "كلمة مرور جديدة (اتركها فارغة إذا لم تغيّر)" : "كلمة المرور *"}
                        </label>
                        <input type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" placeholder="••••••••" dir="ltr" />
                      </div>

                      {/* Role */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">الدور</label>
                        <div className="flex gap-4">
                          {[{ v: "user", label: "مستخدم عادي" }, { v: "admin", label: "مدير (كل الصلاحيات)" }].map(r => (
                            <label key={r.v} className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="role" value={r.v} checked={userForm.role === r.v} onChange={() => setUserForm(p => ({ ...p, role: r.v }))} />
                              <span className="text-sm text-slate-700">{r.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Active toggle */}
                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={userForm.isActive} onChange={e => setUserForm(p => ({ ...p, isActive: e.target.checked }))} className="sr-only peer" />
                          <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                        <span className="text-sm text-slate-700">الحساب نشط</span>
                      </div>

                      {/* Permissions */}
                      {userForm.role !== "admin" && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-slate-700">الصلاحيات</label>
                            <div className="flex gap-2">
                              <button onClick={() => setUserForm(p => ({ ...p, permissions: Object.fromEntries(ALL_PERMISSIONS.map(x => [x.key, true])) }))} className="text-xs text-blue-600 hover:underline">تحديد الكل</button>
                              <span className="text-slate-300">|</span>
                              <button onClick={() => setUserForm(p => ({ ...p, permissions: {} }))} className="text-xs text-slate-500 hover:underline">إلغاء الكل</button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {ALL_PERMISSIONS.map(p => (
                              <label key={p.key} onClick={() => togglePerm(p.key)}
                                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${userForm.permissions[p.key] ? "bg-[#0064d9] border-[#0064d9]" : "border-slate-300 bg-white"}`}>
                                  {userForm.permissions[p.key] && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <span className="text-sm text-slate-700">{p.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {userError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{userError}</div>}
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-slate-200 p-5">
                      <Button variant="outline" onClick={closeUserModal}>إلغاء</Button>
                      <Button className="bg-[#0064d9] hover:bg-[#0854a0]" onClick={handleUserSave} disabled={userMutation.isPending}>
                        {userMutation.isPending ? "جاري الحفظ..." : userModal.editing ? "حفظ التعديلات" : "إنشاء مستخدم"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
          {icon}
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        </div>
        <div className="p-5">{children}</div>
      </div>
    );
  }

  function Field({ label, value, onChange, placeholder, dir }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; dir?: string }) {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          dir={dir ?? "rtl"} />
      </div>
    );
  }

  function SecretField({ label, fieldKey, value, onChange, show, onToggle }: { label: string; fieldKey: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void }) {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <div className="relative">
          <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none pr-10 font-mono" dir="ltr" />
          <button type="button" onClick={onToggle} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }
  