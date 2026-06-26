import React, { useState, useRef } from "react";
  import AppLayout from "@/components/AppLayout";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import { Button } from "@/components/ui/button";
  import {
    Building2, Save, Upload, X, Mail, MessageCircle,
    FileText, Landmark, Eye, EyeOff, Plus, Trash2, ShieldAlert
  } from "lucide-react";
  import { API_BASE } from "@/lib/auth-context";

  function getAuthHeaders(): Record<string, string> {
    try {
      const token = localStorage.getItem("auth_token");
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }

  interface WhatsAppTemplate {
    name: string;
    language: string;
    body: string;
  }

  interface CompanySettings {
    id: number;
    name: string; logoUrl: string; address: string; phone: string;
    email: string; commercialReg: string; taxReg: string; website: string;
    smtpHost: string; smtpPort: string; smtpUser: string;
    smtpPass: string; smtpFromName: string;
    whatsappAccountId: string; whatsappPhoneNumber: string;
    whatsappToken: string; whatsappVerifyToken: string; whatsappTemplates: string;
    zatcaVatNumber: string; zatcaEnvironment: string; zatcaApiUrl: string;
    zatcaApiKey: string; zatcaCertificate: string; zatcaPrivateKey: string;
    bankName: string; bankIban: string; bankAccountNumber: string;
    bankSwift: string; bankApiUrl: string; bankApiKey: string; bankApiSecret: string;
  }

  type Tab = "company" | "sensitive";

  export default function CompanySettingsPage() {
    const queryClient = useQueryClient();
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("company");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data, isLoading } = useQuery<CompanySettings>({
      queryKey: ["company-settings"],
      queryFn: async () => {
        const res = await fetch(`${API_BASE}/api/settings`, {
          credentials: "include",
          headers: { ...getAuthHeaders() },
        });
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
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        return res.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["company-settings"] });
        setSaved(true);
        setSaveError(null);
        setTimeout(() => setSaved(false), 3000);
      },
      onError: (err: Error) => {
        setSaveError(err.message);
        setTimeout(() => setSaveError(null), 5000);
      },
    });

    function set(field: keyof CompanySettings, value: string) {
      setForm(prev => ({ ...prev, [field]: value }));
    }

    function handleSave() {
      mutation.mutate({ ...form, whatsappTemplates: JSON.stringify(templates) });
    }

    function toggleSecret(key: string) {
      setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    }

    function addTemplate() {
      setTemplates(prev => [...prev, { name: "", language: "ar", body: "" }]);
    }

    function updateTemplate(i: number, field: keyof WhatsAppTemplate, value: string) {
      setTemplates(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
    }

    function removeTemplate(i: number) {
      setTemplates(prev => prev.filter((_, idx) => idx !== i));
    }

    function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => set("logoUrl", ev.target?.result as string);
      reader.readAsDataURL(file);
    }

    if (isLoading) return <AppLayout><div className="text-center text-slate-400 py-16 text-sm">جاري التحميل...</div></AppLayout>;

    const SaveBtn = () => (
      <div className="flex flex-col items-end gap-1">
        <Button
          className={`${saved ? "bg-green-600 hover:bg-green-700" : "bg-[#0064d9] hover:bg-[#0854a0]"}`}
          onClick={handleSave} disabled={mutation.isPending}
        >
          <Save className="h-4 w-4 ml-2" />
          {mutation.isPending ? "جاري الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ"}
        </Button>
        {saveError && <span className="text-xs text-red-500">{saveError}</span>}
      </div>
    );

    return (
      <AppLayout>
        <div dir="rtl" className="max-w-3xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">الإعدادات</h1>
            <SaveBtn />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {([
              { id: "company", label: "بيانات الشركة", icon: Building2 },
              { id: "sensitive", label: "الإعدادات الحساسة", icon: ShieldAlert },
            ] as { id: Tab; label: string; icon: React.ElementType }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.id
                    ? "bg-white text-[#0064d9] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
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
                      <button onClick={() => set("logoUrl", "")} className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-slate-300" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 ml-1" /> رفع شعار
                    </Button>
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
                  <div className="col-span-2">
                    <Field label="اسم المُرسِل" value={form.smtpFromName ?? ""} onChange={v => set("smtpFromName", v)} placeholder="اسم شركتك" />
                  </div>
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
                    <span className="text-sm font-medium text-slate-700">قوالب الرسائل (Templates)</span>
                    <Button variant="outline" size="sm" onClick={addTemplate}>
                      <Plus className="h-3.5 w-3.5 ml-1" /> إضافة قالب
                    </Button>
                  </div>
                  {templates.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">لا توجد قوالب — اضغط "إضافة قالب"</p>
                  )}
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
                        <label className="text-sm font-medium text-slate-700">نص الرسالة (Body)</label>
                        <textarea value={tpl.body} onChange={e => updateTemplate(i, "body", e.target.value)} rows={3} dir="rtl" placeholder="مرحباً {{1}}، تم تأكيد طلبك رقم {{2}} ..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none resize-none" />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="منظومة الفاتورة الإلكترونية (ZATCA)" icon={<FileText className="h-4 w-4 text-purple-600" />}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="الرقم الضريبي (VAT Number)" value={form.zatcaVatNumber ?? ""} onChange={v => set("zatcaVatNumber", v)} dir="ltr" />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">البيئة</label>
                    <select value={form.zatcaEnvironment ?? "sandbox"} onChange={e => set("zatcaEnvironment", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none bg-white">
                      <option value="sandbox">تجريبية (Sandbox)</option>
                      <option value="simulation">محاكاة (Simulation)</option>
                      <option value="production">إنتاج (Production)</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Field label="API URL" value={form.zatcaApiUrl ?? ""} onChange={v => set("zatcaApiUrl", v)} placeholder="https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal" dir="ltr" />
                  </div>
                  <div className="col-span-2">
                    <SecretField label="API Key / CSID" fieldKey="zatcaKey" value={form.zatcaApiKey ?? ""} onChange={v => set("zatcaApiKey", v)} show={!!showSecrets["zatcaKey"]} onToggle={() => toggleSecret("zatcaKey")} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">الشهادة الرقمية (Certificate)</label>
                    <textarea value={form.zatcaCertificate ?? ""} onChange={e => set("zatcaCertificate", e.target.value)} rows={3} dir="ltr" placeholder="-----BEGIN CERTIFICATE-----" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#0064d9] focus:outline-none resize-none" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">المفتاح الخاص (Private Key)</label>
                    <textarea value={form.zatcaPrivateKey ?? ""} onChange={e => set("zatcaPrivateKey", e.target.value)} rows={3} dir="ltr" placeholder="-----BEGIN PRIVATE KEY-----" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#0064d9] focus:outline-none resize-none" />
                  </div>
                </div>
              </Section>

              <Section title="الإنترنت البنكي (Bank Integration)" icon={<Landmark className="h-4 w-4 text-blue-700" />}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="اسم البنك" value={form.bankName ?? ""} onChange={v => set("bankName", v)} placeholder="بنك الراجحي / SNB ..." />
                  <Field label="IBAN" value={form.bankIban ?? ""} onChange={v => set("bankIban", v)} placeholder="SA..." dir="ltr" />
                  <Field label="رقم الحساب" value={form.bankAccountNumber ?? ""} onChange={v => set("bankAccountNumber", v)} dir="ltr" />
                  <Field label="SWIFT / BIC" value={form.bankSwift ?? ""} onChange={v => set("bankSwift", v)} dir="ltr" />
                  <div className="col-span-2">
                    <Field label="API URL" value={form.bankApiUrl ?? ""} onChange={v => set("bankApiUrl", v)} placeholder="https://api.bank.com/..." dir="ltr" />
                  </div>
                  <SecretField label="API Key" fieldKey="bankKey" value={form.bankApiKey ?? ""} onChange={v => set("bankApiKey", v)} show={!!showSecrets["bankKey"]} onToggle={() => toggleSecret("bankKey")} />
                  <SecretField label="API Secret" fieldKey="bankSecret" value={form.bankApiSecret ?? ""} onChange={v => set("bankApiSecret", v)} show={!!showSecrets["bankSecret"]} onToggle={() => toggleSecret("bankSecret")} />
                </div>
              </Section>

              <div className="flex justify-end pb-4">
                <SaveBtn />
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-700 flex items-center gap-2">{icon}{title}</h2>
        {children}
      </div>
    );
  }

  function Field({ label, value, onChange, placeholder, dir }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; dir?: string;
  }) {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} dir={dir ?? "rtl"} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0064d9] focus:outline-none focus:ring-1 focus:ring-blue-200" />
      </div>
    );
  }

  function SecretField({ label, value, onChange, show, onToggle }: {
    label: string; fieldKey?: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
  }) {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <div className="relative">
          <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} dir="ltr" className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-9 text-sm font-mono focus:border-[#0064d9] focus:outline-none focus:ring-1 focus:ring-blue-200" />
          <button type="button" onClick={onToggle} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }
  