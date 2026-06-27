import React, { useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Building2, Save, Upload, X, Mail, MessageCircle,
  FileText, Landmark, Eye, EyeOff, Plus, Trash2, ShieldAlert,
  Users, Pencil, UserPlus, Lock, Power, PowerOff, CheckCircle,
  XCircle, RefreshCw, Shield, AlertTriangle, KeyRound, Wand2, BrainCircuit
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
  geminiApiKey: string;
}

interface AppUser {
  id: number; username: string; email: string | null; fullName: string | null;
  role: string; employeeId: number | null; permissions: string | null;
  isActive: boolean; photoUrl: string | null; failedLoginAttempts?: number;
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

type Tab = "company" | "sensitive" | "users" | "coding";

const emptyUserForm = {
  email: "", fullName: "", password: "",
  role: "user", employeeId: "", permissions: {} as Permissions,
  isActive: true, photoUrl: "",
};

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "company",   label: "بيانات الشركة",    icon: <Building2 className="h-4 w-4" /> },
  { key: "sensitive", label: "الإعدادات التقنية", icon: <ShieldAlert className="h-4 w-4" /> },
  { key: "users",     label: "المستخدمون",         icon: <Users className="h-4 w-4" /> },
  { key: "coding",    label: "التكويد الذكي",     icon: <BrainCircuit className="h-4 w-4" /> },
];

export default function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("company");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [recodesConfirm, setRecodesConfirm] = useState(false);
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

  async function runBackfill(force = false) {
    setBackfilling(true);
    setBackfillMsg(null);
    setRecodesConfirm(false);
    // Save geminiApiKey first so backfill endpoint can read it
    if (form.geminiApiKey) await mutation.mutateAsync({ ...form, whatsappTemplates: JSON.stringify(templates) }).catch(() => {});
    try {
      const r = await fetch(`${API_BASE}/api/items/backfill-codes`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ force }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "خطأ");
      const note = force ? " (إعادة كاملة)" : "";
      setBackfillMsg(`✓ تم تكويد ${data.coded} بند من أصل ${data.total} (فشل: ${data.failed})${note}`);
    } catch (err: any) {
      setBackfillMsg(`✗ ${err.message}`);
    } finally {
      setBackfilling(false);
    }
  }
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

  // Password change dialog state
  const [pwdDialog, setPwdDialog] = useState<{ open: boolean; user: AppUser | null }>({ open: false, user: null });
  const [newPassword, setNewPassword] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

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

  function openChangePassword(u: AppUser) {
    setPwdDialog({ open: true, user: u });
    setNewPassword("");
    setPwdError(null);
    setShowNewPwd(false);
  }

  const toggleUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`${API_BASE}/api/users/${userId}/toggle`, {
        method: "PATCH", credentials: "include", headers: getAuthHeaders(),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-users"] }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: number; password: string }) => {
      const res = await fetch(`${API_BASE}/api/users/${userId}/password`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
      return res.json();
    },
    onSuccess: () => {
      setPwdDialog({ open: false, user: null });
      setNewPassword("");
      queryClient.invalidateQueries({ queryKey: ["app-users"] });
    },
    onError: (err: Error) => setPwdError(err.message),
  });

  const userMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { id, ...body } = payload;
      const url = id ? `${API_BASE}/api/users/${id}` : `${API_BASE}/api/users`;
      const method = id ? "PUT" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-users"] });
      setUserModal({ open: false, editing: null });
    },
    onError: (err: Error) => setUserError(err.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/api/users/${id}`, { method: "DELETE", credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("فشل الحذف");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-users"] }),
  });

  function handleUserSubmit() {
    setUserError(null);
    if (!userModal.editing && !userForm.password) { setUserError("كلمة المرور مطلوبة"); return; }
    if (!userForm.employeeId) { setUserError("يجب تحديد الموظف"); return; }
    const payload: Record<string, unknown> = {
      employeeId: Number(userForm.employeeId),
      role: userForm.role,
      permissions: userForm.permissions,
      isActive: userForm.isActive,
      photoUrl: userForm.photoUrl,
    };
    if (userForm.password) payload.password = userForm.password;
    if (userModal.editing) payload.id = userModal.editing.id;
    userMutation.mutate(payload);
  }

  function togglePerm(key: string) {
    setUserForm(p => ({ ...p, permissions: { ...p.permissions, [key]: !p.permissions[key] } }));
  }

  const activeUsers = usersData?.filter(u => u.isActive).length ?? 0;
  const inactiveUsers = usersData?.filter(u => !u.isActive).length ?? 0;

  return (
    <AppLayout>
      <div dir="rtl" className="h-full flex flex-col gap-0">
        {/* ── SAP-style Page Header ── */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[#1e3a5f] tracking-tight">إعدادات النظام</h1>
              <p className="text-xs text-slate-500 mt-0.5">تخصيص بيانات الشركة والنظام وإدارة المستخدمين</p>
            </div>
            {(activeTab === "company" || activeTab === "sensitive" || activeTab === "coding") && (
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-3 py-1.5">
                    <CheckCircle className="h-3.5 w-3.5" /> تم الحفظ
                  </span>
                )}
                {saveError && (
                  <span className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5">
                    <XCircle className="h-3.5 w-3.5" /> {saveError}
                  </span>
                )}
                <Button
                  onClick={handleSave}
                  disabled={mutation.isPending || isLoading}
                  className="bg-[#0064d9] hover:bg-[#0854a0] h-8 px-4 text-sm gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {mutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── SAP-style Tab Bar ── */}
        <div className="bg-white border-b border-slate-200 px-6">
          <nav className="flex gap-0">
            {TAB_CONFIG.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-[#0064d9] text-[#0064d9] bg-blue-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.key === "users" && usersData && (
                  <span className="mr-1 inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-bold rounded-full bg-[#0064d9] text-white">
                    {usersData.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-auto bg-slate-50/60 p-6">
          {/* ── بيانات الشركة ── */}
          {activeTab === "company" && (
            <div className="space-y-4 max-w-4xl">
              {isLoading && <div className="text-center py-12 text-slate-400 text-sm">جاري التحميل...</div>}
              {!isLoading && (
                <>
                  <SapSection title="بيانات الشركة الأساسية" icon={<Building2 className="h-4 w-4 text-[#0064d9]" />}>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {/* Logo */}
                      <div className="col-span-2 flex items-center gap-5 pb-2">
                        <div className="relative h-20 w-20 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                          {form.logoUrl ? (
                            <>
                              <img src={form.logoUrl} alt="شعار" className="h-full w-full object-contain p-1" />
                              <button onClick={() => set("logoUrl", "")} className="absolute top-0.5 left-0.5 bg-white/90 rounded p-0.5 text-red-500 hover:text-red-700"><X className="h-3.5 w-3.5" /></button>
                            </>
                          ) : (
                            <Upload className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-1">شعار الشركة</p>
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                          <button onClick={() => fileInputRef.current?.click()} className="text-xs text-[#0064d9] border border-[#0064d9] rounded px-3 py-1.5 hover:bg-blue-50">
                            {form.logoUrl ? "تغيير الشعار" : "رفع شعار"}
                          </button>
                        </div>
                      </div>
                      <SapField label="اسم الشركة" value={form.name ?? ""} onChange={v => set("name", v)} required />
                      <SapField label="الموقع الإلكتروني" value={form.website ?? ""} onChange={v => set("website", v)} dir="ltr" />
                      <SapField label="البريد الإلكتروني" value={form.email ?? ""} onChange={v => set("email", v)} dir="ltr" />
                      <SapField label="رقم الهاتف" value={form.phone ?? ""} onChange={v => set("phone", v)} />
                      <SapField label="العنوان" value={form.address ?? ""} onChange={v => set("address", v)} />
                      <SapField label="السجل التجاري" value={form.commercialReg ?? ""} onChange={v => set("commercialReg", v)} />
                      <SapField label="الرقم الضريبي" value={form.taxReg ?? ""} onChange={v => set("taxReg", v)} />
                    </div>
                  </SapSection>

                  <SapSection title="إعدادات البريد (SMTP)" icon={<Mail className="h-4 w-4 text-[#0064d9]" />}>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <SapField label="SMTP Host" value={form.smtpHost ?? ""} onChange={v => set("smtpHost", v)} dir="ltr" />
                      <SapField label="SMTP Port" value={form.smtpPort ?? ""} onChange={v => set("smtpPort", v)} dir="ltr" />
                      <SapField label="SMTP User" value={form.smtpUser ?? ""} onChange={v => set("smtpUser", v)} dir="ltr" />
                      <SapSecretField label="SMTP Password" fieldKey="smtpPass" value={form.smtpPass ?? ""} onChange={v => set("smtpPass", v)} show={!!showSecrets["smtpPass"]} onToggle={() => toggleSecret("smtpPass")} />
                      <div className="col-span-2">
                        <SapField label="اسم المرسل" value={form.smtpFromName ?? ""} onChange={v => set("smtpFromName", v)} />
                      </div>
                    </div>
                  </SapSection>
                </>
              )}
            </div>
          )}

          {/* ── الإعدادات التقنية ── */}
          {activeTab === "sensitive" && (
            <div className="space-y-4 max-w-4xl">
              <SapSection title="واتساب للأعمال" icon={<MessageCircle className="h-4 w-4 text-[#25d366]" />}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <SapField label="Account ID" value={form.whatsappAccountId ?? ""} onChange={v => set("whatsappAccountId", v)} dir="ltr" />
                  <SapField label="Phone Number" value={form.whatsappPhoneNumber ?? ""} onChange={v => set("whatsappPhoneNumber", v)} dir="ltr" />
                  <SapSecretField label="Access Token" fieldKey="waToken" value={form.whatsappToken ?? ""} onChange={v => set("whatsappToken", v)} show={!!showSecrets["waToken"]} onToggle={() => toggleSecret("waToken")} />
                  <SapField label="Verify Token" value={form.whatsappVerifyToken ?? ""} onChange={v => set("whatsappVerifyToken", v)} dir="ltr" />
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700">قوالب الرسائل</span>
                    <button onClick={addTemplate} className="flex items-center gap-1.5 text-xs text-[#0064d9] border border-[#0064d9] rounded px-2.5 py-1 hover:bg-blue-50">
                      <Plus className="h-3.5 w-3.5" /> إضافة قالب
                    </button>
                  </div>
                  <div className="space-y-3">
                    {templates.map((t, i) => (
                      <div key={i} className="relative rounded-lg border border-slate-200 bg-slate-50 p-3 grid grid-cols-3 gap-3">
                        <SapField label="اسم القالب" value={t.name} onChange={v => updateTemplate(i, "name", v)} />
                        <SapField label="اللغة" value={t.language} onChange={v => updateTemplate(i, "language", v)} />
                        <button onClick={() => removeTemplate(i)} className="absolute top-2 left-2 text-slate-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        <div className="col-span-3 space-y-1">
                          <label className="text-xs font-medium text-slate-600">نص القالب</label>
                          <textarea value={t.body} onChange={e => updateTemplate(i, "body", e.target.value)} rows={2} className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-[#0064d9] focus:outline-none resize-none" />
                        </div>
                      </div>
                    ))}
                    {templates.length === 0 && <p className="text-xs text-slate-400 text-center py-4">لا توجد قوالب — اضغط "إضافة قالب" لإضافة واحد</p>}
                  </div>
                </div>
              </SapSection>

              <SapSection title="فاتورة زاتكا" icon={<FileText className="h-4 w-4 text-[#0064d9]" />}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <SapField label="رقم ضريبة القيمة المضافة" value={form.zatcaVatNumber ?? ""} onChange={v => set("zatcaVatNumber", v)} />
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">البيئة</label>
                    <select value={form.zatcaEnvironment ?? "sandbox"} onChange={e => set("zatcaEnvironment", e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none">
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                  <SapField label="API URL" value={form.zatcaApiUrl ?? ""} onChange={v => set("zatcaApiUrl", v)} dir="ltr" />
                  <SapSecretField label="API Key" fieldKey="zatcaKey" value={form.zatcaApiKey ?? ""} onChange={v => set("zatcaApiKey", v)} show={!!showSecrets["zatcaKey"]} onToggle={() => toggleSecret("zatcaKey")} />
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-medium text-slate-600">Certificate (PEM)</label>
                    <textarea value={form.zatcaCertificate ?? ""} onChange={e => set("zatcaCertificate", e.target.value)} rows={4} className="w-full rounded border border-slate-300 px-3 py-2 text-xs font-mono focus:border-[#0064d9] focus:outline-none" dir="ltr" placeholder="-----BEGIN CERTIFICATE-----" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-medium text-slate-600">Private Key (PEM)</label>
                    <textarea value={form.zatcaPrivateKey ?? ""} onChange={e => set("zatcaPrivateKey", e.target.value)} rows={4} className="w-full rounded border border-slate-300 px-3 py-2 text-xs font-mono focus:border-[#0064d9] focus:outline-none" dir="ltr" placeholder="-----BEGIN RSA PRIVATE KEY-----" />
                  </div>
                </div>
              </SapSection>

              <SapSection title="الحساب البنكي" icon={<Landmark className="h-4 w-4 text-[#0064d9]" />}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <SapField label="اسم البنك" value={form.bankName ?? ""} onChange={v => set("bankName", v)} />
                  <SapField label="IBAN" value={form.bankIban ?? ""} onChange={v => set("bankIban", v)} dir="ltr" />
                  <SapField label="رقم الحساب" value={form.bankAccountNumber ?? ""} onChange={v => set("bankAccountNumber", v)} dir="ltr" />
                  <SapField label="SWIFT Code" value={form.bankSwift ?? ""} onChange={v => set("bankSwift", v)} dir="ltr" />
                  <SapField label="Bank API URL" value={form.bankApiUrl ?? ""} onChange={v => set("bankApiUrl", v)} dir="ltr" />
                  <SapSecretField label="Bank API Key" fieldKey="bankKey" value={form.bankApiKey ?? ""} onChange={v => set("bankApiKey", v)} show={!!showSecrets["bankKey"]} onToggle={() => toggleSecret("bankKey")} />
                  <div className="col-span-2">
                    <SapSecretField label="Bank API Secret" fieldKey="bankSecret" value={form.bankApiSecret ?? ""} onChange={v => set("bankApiSecret", v)} show={!!showSecrets["bankSecret"]} onToggle={() => toggleSecret("bankSecret")} />
                  </div>
                </div>
              </SapSection>

              <SapSection title="محرك الذكاء الاصطناعي (Gemini)" icon={<BrainCircuit className="h-4 w-4 text-violet-600" />}>
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    بعد إدخال المفتاح واضغط "حفظ التعديلات"، سيستخدم النظام Gemini لاستخراج خصائص المنتج (ماركة، فئة، جهد، تيار…) بدقة أعلى من القواعد الثابتة.
                    يمكن الحصول على مفتاح مجاني من <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-violet-600 underline">Google AI Studio</a>.
                  </p>
                  <SapSecretField
                    label="Gemini API Key"
                    fieldKey="geminiKey"
                    value={form.geminiApiKey ?? ""}
                    onChange={v => set("geminiApiKey", v)}
                    show={!!showSecrets["geminiKey"]}
                    onToggle={() => toggleSecret("geminiKey")}
                  />
                  {form.geminiApiKey?.trim() ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                      <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                      المفتاح مضبوط — سيُفعَّل Gemini عند التكويد
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      بدون مفتاح — سيُستخدم المحرك القائم على القواعد فقط
                    </div>
                  )}
                </div>
              </SapSection>
            </div>
          )}

          {/* ── التكويد الذكي ── */}
          {activeTab === "coding" && (
            <div className="space-y-4 max-w-2xl">
              <SapSection title="تكويد البنود" icon={<Wand2 className="h-4 w-4 text-[#0064d9]" />}>
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    يعطي النظام لكل بند رقماً إدارياً موحداً (مثل <code className="font-mono bg-slate-100 px-1 rounded">000001</code>)
                    بناءً على Part No أولاً ثم وصف المنتج. البنود المتطابقة تحصل على نفس الرقم.
                  </p>

                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => runBackfill(false)}
                      disabled={backfilling}
                      className="flex items-center gap-2 rounded bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 transition-colors"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      {backfilling ? "جاري التكويد…" : "كود البنود الجديدة"}
                    </button>

                    {!recodesConfirm ? (
                      <button
                        onClick={() => setRecodesConfirm(true)}
                        disabled={backfilling}
                        className="flex items-center gap-2 rounded bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        إعادة تكويد الكل
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-rose-50 border border-rose-300 rounded px-3 py-2 text-xs">
                        <span className="text-rose-700 font-semibold">سيتم مسح جميع الأكواد والبدء من الصفر. تأكيد؟</span>
                        <button onClick={() => runBackfill(true)} disabled={backfilling}
                          className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-2 py-0.5 rounded disabled:opacity-60">
                          {backfilling ? "…" : "نعم"}
                        </button>
                        <button onClick={() => setRecodesConfirm(false)} className="text-slate-500 hover:text-slate-700">إلغاء</button>
                      </div>
                    )}
                  </div>

                  {backfillMsg && (
                    <div className={`text-xs px-3 py-2 rounded border font-medium ${backfillMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                      {backfillMsg}
                    </div>
                  )}
                </div>
              </SapSection>
            </div>
          )}

          {/* ── إدارة المستخدمين ── */}
          {activeTab === "users" && (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Users className="h-5 w-5 text-[#0064d9]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{usersData?.length ?? "—"}</p>
                    <p className="text-xs text-slate-500">إجمالي المستخدمين</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{activeUsers}</p>
                    <p className="text-xs text-slate-500">نشطون</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{inactiveUsers}</p>
                    <p className="text-xs text-slate-500">معطلون</p>
                  </div>
                </div>
              </div>

              {/* Toolbar */}
              <div className="bg-white border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#0064d9]" />
                    <span className="text-sm font-semibold text-slate-700">قائمة المستخدمين</span>
                    <span className="text-xs text-slate-400">— كل مستخدم يرتبط بموظف ويسجل الدخول ببريده الإلكتروني</span>
                  </div>
                  <Button className="bg-[#0064d9] hover:bg-[#0854a0] h-8 px-3 text-xs gap-1.5" onClick={openAddUser}>
                    <UserPlus className="h-3.5 w-3.5" /> إضافة مستخدم
                  </Button>
                </div>

                {/* Table */}
                {usersLoading ? (
                  <div className="text-center text-slate-400 py-12 text-sm">جاري التحميل...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">المستخدم</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">البريد</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">الدور</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">الصلاحيات</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">الحالة</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">محاولات خاطئة</th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(!usersData || usersData.length === 0) && (
                          <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">لا يوجد مستخدمون — اضغط "إضافة مستخدم" لإنشاء أول حساب</td></tr>
                        )}
                        {usersData?.map(u => {
                          const perms = parsePerms(u.permissions);
                          const permCount = Object.values(perms).filter(Boolean).length;
                          const failed = u.failedLoginAttempts ?? 0;
                          return (
                            <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors ${!u.isActive ? "bg-red-50/30" : ""}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  {u.photoUrl ? (
                                    <img src={u.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover border border-slate-200 shrink-0" />
                                  ) : (
                                    <div className="h-8 w-8 rounded-full bg-[#0064d9]/10 flex items-center justify-center shrink-0">
                                      <span className="text-[#0064d9] font-bold text-xs">{(u.fullName || u.username)[0]?.toUpperCase()}</span>
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-medium text-slate-800 text-sm leading-tight">{u.fullName || u.username}</p>
                                    <p className="text-[11px] text-slate-400 font-mono leading-tight">{u.username}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-500 text-xs font-mono">{u.email || "—"}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                                  {u.role === "admin" && <Shield className="h-3 w-3" />}
                                  {u.role === "admin" ? "مدير" : "مستخدم"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500">
                                {u.role === "admin" ? <span className="text-purple-600 font-medium">كل الصلاحيات</span> : `${permCount} / ${ALL_PERMISSIONS.length}`}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                                  {u.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                  {u.isActive ? "نشط" : "معطل"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {failed > 0 ? (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${failed >= 4 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                    <AlertTriangle className="h-3 w-3" />
                                    {failed} / 4
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-300">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  {/* Edit */}
                                  <button
                                    onClick={() => openEditUser(u)}
                                    title="تعديل"
                                    className="p-1.5 rounded text-slate-400 hover:text-[#0064d9] hover:bg-blue-50 transition-colors"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  {/* Change Password */}
                                  <button
                                    onClick={() => openChangePassword(u)}
                                    title="تغيير كلمة المرور"
                                    className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                  >
                                    <KeyRound className="h-3.5 w-3.5" />
                                  </button>
                                  {/* Toggle Active */}
                                  <button
                                    onClick={() => {
                                      const action = u.isActive ? "إيقاف" : "تفعيل";
                                      if (confirm(`هل أنت متأكد من ${action} هذا المستخدم؟`)) {
                                        toggleUserMutation.mutate(u.id);
                                      }
                                    }}
                                    title={u.isActive ? "إيقاف المستخدم" : "تفعيل المستخدم"}
                                    className={`p-1.5 rounded transition-colors ${u.isActive ? "text-slate-400 hover:text-red-600 hover:bg-red-50" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"}`}
                                  >
                                    {u.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                  </button>
                                  {/* Delete */}
                                  <button
                                    onClick={() => { if (confirm("هل أنت متأكد من حذف هذا المستخدم نهائياً؟")) deleteUserMutation.mutate(u.id); }}
                                    title="حذف"
                                    className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Notice */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <span>يتم إيقاف الحساب تلقائياً عند إدخال كلمة المرور بشكل خاطئ <strong>4 مرات متتالية</strong>. يمكن إعادة التفعيل يدوياً من هذه الصفحة.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════ User Form Modal ════ */}
      {userModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-[#1e3a5f]">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-300" />
                {userModal.editing ? "تعديل بيانات المستخدم" : "إضافة مستخدم جديد"}
              </h2>
              <button onClick={() => setUserModal({ open: false, editing: null })} className="text-white/60 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {userError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  <XCircle className="h-4 w-4 shrink-0" /> {userError}
                </div>
              )}

              {/* Employee selection */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">الموظف <span className="text-red-500">*</span></label>
                <select
                  value={userForm.employeeId}
                  onChange={e => setUserForm(p => ({ ...p, employeeId: e.target.value }))}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none"
                  disabled={!!userModal.editing}
                >
                  <option value="">— اختر موظفاً —</option>
                  {employeesData?.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.employeeNumber})</option>
                  ))}
                </select>
                {userModal.editing && <p className="text-[11px] text-slate-400">لا يمكن تغيير الموظف المرتبط بعد الإنشاء</p>}
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">الدور</label>
                <select
                  value={userForm.role}
                  onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none"
                >
                  <option value="user">مستخدم</option>
                  <option value="admin">مدير</option>
                </select>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">
                  كلمة المرور {!userModal.editing && <span className="text-red-500">*</span>}
                  {userModal.editing && <span className="text-slate-400 font-normal"> (اتركها فارغة إذا لم تريد التغيير)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showSecrets["newPwd"] ? "text" : "password"}
                    value={userForm.password}
                    onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="6 أحرف على الأقل"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none pr-10"
                    dir="ltr"
                  />
                  <button type="button" onClick={() => toggleSecret("newPwd")} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    {showSecrets["newPwd"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Permissions */}
              {userForm.role !== "admin" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600">الصلاحيات</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_PERMISSIONS.map(p => (
                      <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input type="checkbox" checked={!!userForm.permissions[p.key]} onChange={() => togglePerm(p.key)}
                          className="h-3.5 w-3.5 rounded accent-[#0064d9]" />
                        <span className="text-slate-700">{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {userForm.role === "admin" && (
                <p className="text-xs text-purple-600 bg-purple-50 border border-purple-100 rounded px-3 py-2 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> المدير يملك كل الصلاحيات تلقائياً
                </p>
              )}

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setUserForm(p => ({ ...p, isActive: !p.isActive }))}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${userForm.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${userForm.isActive ? "translate-x-1" : "translate-x-5"}`} />
                </button>
                <span className="text-sm text-slate-700">{userForm.isActive ? "الحساب نشط" : "الحساب معطل"}</span>
              </div>

              {/* Photo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">صورة المستخدم</label>
                <div className="flex items-center gap-3">
                  {userForm.photoUrl ? (
                    <div className="relative">
                      <img src={userForm.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover border border-slate-200" />
                      <button onClick={() => setUserForm(p => ({ ...p, photoUrl: "" }))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X className="h-2.5 w-2.5" /></button>
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center">
                      <Upload className="h-4 w-4 text-slate-400" />
                    </div>
                  )}
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
                  <button type="button" onClick={() => photoInputRef.current?.click()} className="text-xs text-[#0064d9] border border-[#0064d9] rounded px-3 py-1.5 hover:bg-blue-50">
                    {userForm.photoUrl ? "تغيير الصورة" : "رفع صورة"}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setUserModal({ open: false, editing: null })} className="text-sm text-slate-600 border border-slate-300 rounded px-4 py-2 hover:bg-slate-100">
                إلغاء
              </button>
              <Button
                onClick={handleUserSubmit}
                disabled={userMutation.isPending}
                className="bg-[#0064d9] hover:bg-[#0854a0] h-9 px-5 text-sm"
              >
                {userMutation.isPending ? "جاري الحفظ..." : userModal.editing ? "حفظ التعديلات" : "إنشاء المستخدم"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ════ Change Password Dialog ════ */}
      {pwdDialog.open && pwdDialog.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm" dir="rtl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-[#1e3a5f]">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-300" />
                تغيير كلمة المرور
              </h2>
              <button onClick={() => setPwdDialog({ open: false, user: null })} className="text-white/60 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600">
                تغيير كلمة مرور: <strong className="text-slate-800">{pwdDialog.user.fullName || pwdDialog.user.username}</strong>
              </p>
              {pwdError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  <XCircle className="h-4 w-4 shrink-0" /> {pwdError}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">كلمة المرور الجديدة <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type={showNewPwd ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="6 أحرف على الأقل"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none pr-10"
                    dir="ltr"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowNewPwd(p => !p)} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                <RefreshCw className="h-3 w-3 shrink-0" />
                سيتم إعادة ضبط عداد المحاولات الخاطئة بعد تغيير كلمة المرور
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setPwdDialog({ open: false, user: null })} className="text-sm text-slate-600 border border-slate-300 rounded px-4 py-2 hover:bg-slate-100">
                إلغاء
              </button>
              <Button
                onClick={() => {
                  if (!newPassword || newPassword.length < 6) { setPwdError("كلمة المرور قصيرة جداً (6 أحرف على الأقل)"); return; }
                  changePasswordMutation.mutate({ userId: pwdDialog.user!.id, password: newPassword });
                }}
                disabled={changePasswordMutation.isPending}
                className="bg-[#0064d9] hover:bg-[#0854a0] h-9 px-5 text-sm gap-1.5"
              >
                <Lock className="h-3.5 w-3.5" />
                {changePasswordMutation.isPending ? "جاري الحفظ..." : "تغيير كلمة المرور"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ── SAP-style Sub-components ──

function SapSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
        {icon}
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function SapField({ label, value, onChange, placeholder, dir, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; dir?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir ?? "rtl"}
        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none focus:ring-1 focus:ring-[#0064d9]/20 transition-colors"
      />
    </div>
  );
}

function SapSecretField({ label, fieldKey, value, onChange, show, onToggle }: {
  label: string; fieldKey: string; value: string;
  onChange: (v: string) => void; show: boolean; onToggle: () => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none focus:ring-1 focus:ring-[#0064d9]/20 pr-9 font-mono transition-colors"
          dir="ltr"
        />
        <button type="button" onClick={onToggle} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
