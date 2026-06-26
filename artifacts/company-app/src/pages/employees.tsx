import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Eye,
  FileText,
  Banknote,
  Phone,
  Mail,
  MapPin,
  Building2,
  CreditCard,
  AlertCircle,
  Upload,
  X,
  CheckCircle2,
  Clock,
  UserX,
  ChevronRight,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type Employee = {
  id: number;
  employeeNumber: string;
  fullName: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  address?: string;
  birthDate?: string;
  hireDate?: string;
  department?: string;
  jobTitle?: string;
  baseSalary?: string;
  allowances?: string;
  deductions?: string;
  bankName?: string;
  bankAccount?: string;
  status: string;
  contractType?: string;
  notes?: string;
  appointmentDocUrl?: string;
  appointmentDocName?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  createdAt: string;
  documents?: any[];
  salaryRecords?: SalaryRecord[];
};

type SalaryRecord = {
  id: number;
  employeeId: number;
  month: string;
  year: number;
  baseSalary: string;
  allowances: string;
  deductions: string;
  netSalary: string;
  paid: boolean;
  notes?: string;
  createdAt: string;
};

type Stats = {
  total: number;
  active: number;
  inactive: number;
  onLeave: number;
  totalSalary: number;
  departments: string[];
};

const MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "نشط", color: "bg-green-100 text-green-700" },
  inactive: { label: "غير نشط", color: "bg-red-100 text-red-700" },
  on_leave: { label: "في إجازة", color: "bg-yellow-100 text-yellow-700" },
};

const CONTRACT_MAP: Record<string, string> = {
  "full-time": "دوام كامل",
  "part-time": "دوام جزئي",
  contract: "عقد مؤقت",
};

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API_BASE}/api/employees${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  }).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });
}

const emptyForm = (): Partial<Employee> => ({
  fullName: "",
  nationalId: "",
  phone: "",
  email: "",
  address: "",
  birthDate: "",
  hireDate: "",
  department: "",
  jobTitle: "",
  baseSalary: "",
  allowances: "0",
  deductions: "0",
  bankName: "",
  bankAccount: "",
  status: "active",
  contractType: "full-time",
  notes: "",
  appointmentDocUrl: "",
  appointmentDocName: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
});

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<Partial<Employee>>(emptyForm());
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    month: "يناير",
    year: new Date().getFullYear().toString(),
    baseSalary: "",
    allowances: "0",
    deductions: "0",
    paid: false,
    notes: "",
  });

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees", search, filterStatus, filterDept],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      return apiFetch(`/?${params}`);
    },
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["employees-stats"],
    queryFn: () => apiFetch("/stats"),
  });

  const { data: empDetail, refetch: refetchDetail } = useQuery<Employee>({
    queryKey: ["employee-detail", viewEmployee?.id],
    queryFn: () => apiFetch(`/${viewEmployee!.id}`),
    enabled: !!viewEmployee?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Employee>) =>
      apiFetch("/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-stats"] });
      setShowForm(false);
      setForm(emptyForm());
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Employee> }) =>
      apiFetch(`/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-stats"] });
      qc.invalidateQueries({ queryKey: ["employee-detail"] });
      setShowForm(false);
      setEditEmployee(null);
      setForm(emptyForm());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-stats"] });
      setDeleteConfirm(null);
    },
  });

  const addSalaryMutation = useMutation({
    mutationFn: ({ employeeId, data }: { employeeId: number; data: any }) =>
      apiFetch(`/${employeeId}/salary-records`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      refetchDetail();
      setShowSalaryForm(false);
      setSalaryForm({
        month: "يناير",
        year: new Date().getFullYear().toString(),
        baseSalary: "",
        allowances: "0",
        deductions: "0",
        paid: false,
        notes: "",
      });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ employeeId, recordId, data }: { employeeId: number; recordId: number; data: any }) =>
      apiFetch(`/${employeeId}/salary-records/${recordId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => refetchDetail(),
  });

  const filteredEmployees = employees.filter((e) => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (filterDept !== "all" && e.department !== filterDept) return false;
    return true;
  });

  function openAdd() {
    setEditEmployee(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(emp: Employee) {
    setEditEmployee(emp);
    setForm({ ...emp });
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.fullName?.trim()) return;
    if (editEmployee) {
      updateMutation.mutate({ id: editEmployee.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((f) => ({
        ...f,
        appointmentDocUrl: ev.target?.result as string,
        appointmentDocName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  }

  const departments = stats?.departments ?? [];

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">إدارة الموظفين</h1>
            <p className="text-sm text-slate-500 mt-0.5">محرك الموارد البشرية</p>
          </div>
          <Button
            onClick={openAdd}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a]"
          >
            <UserPlus className="h-4 w-4" />
            إضافة موظف
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<Users className="h-5 w-5 text-blue-500" />} label="إجمالي الموظفين" value={stats.total} bg="bg-blue-50" />
            <StatCard icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} label="نشطون" value={stats.active} bg="bg-green-50" />
            <StatCard icon={<Clock className="h-5 w-5 text-yellow-500" />} label="في إجازة" value={stats.onLeave} bg="bg-yellow-50" />
            <StatCard icon={<Banknote className="h-5 w-5 text-purple-500" />} label="إجمالي الرواتب" value={`${(stats.totalSalary ?? 0).toLocaleString()} ج`} bg="bg-purple-50" />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="بحث بالاسم أو الرقم الوظيفي..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9 text-sm"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 text-sm">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
              <SelectItem value="on_leave">في إجازة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-40 text-sm">
              <SelectValue placeholder="القسم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأقسام</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d!}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-slate-400">جاري التحميل...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">لا يوجد موظفون</p>
              <Button onClick={openAdd} variant="outline" className="mt-3 text-sm">+ إضافة أول موظف</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium text-slate-500">الرقم الوظيفي</th>
                    <th className="px-4 py-3 font-medium text-slate-500">الاسم</th>
                    <th className="px-4 py-3 font-medium text-slate-500">المسمى الوظيفي</th>
                    <th className="px-4 py-3 font-medium text-slate-500">القسم</th>
                    <th className="px-4 py-3 font-medium text-slate-500">الراتب الأساسي</th>
                    <th className="px-4 py-3 font-medium text-slate-500">الحالة</th>
                    <th className="px-4 py-3 font-medium text-slate-500">تاريخ التعيين</th>
                    <th className="px-4 py-3 font-medium text-slate-500">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const st = STATUS_MAP[emp.status] ?? STATUS_MAP.active;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-blue-700 font-semibold">{emp.employeeNumber}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{emp.fullName}</td>
                        <td className="px-4 py-3 text-slate-600">{emp.jobTitle || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{emp.department || "—"}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">
                          {emp.baseSalary ? `${parseFloat(emp.baseSalary).toLocaleString()} ج` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{emp.hireDate || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => { setViewEmployee(emp); }}
                              className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                              title="عرض"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEdit(emp)}
                              className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                              title="تعديل"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(emp)}
                              className="rounded p-1.5 text-red-500 hover:bg-red-50"
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
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
      </div>

      {/* Add/Edit Employee Modal */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditEmployee(null); setForm(emptyForm()); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editEmployee ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="personal">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="personal">البيانات الشخصية</TabsTrigger>
              <TabsTrigger value="job">بيانات الوظيفة</TabsTrigger>
              <TabsTrigger value="salary">بيانات الراتب</TabsTrigger>
              <TabsTrigger value="emergency">جهة الطوارئ</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="الاسم الكامل *">
                  <Input value={form.fullName ?? ""} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="محمد أحمد علي" />
                </FormField>
                <FormField label="رقم الهوية الوطنية">
                  <Input value={form.nationalId ?? ""} onChange={(e) => setForm((f) => ({ ...f, nationalId: e.target.value }))} placeholder="12345678901234" />
                </FormField>
                <FormField label="رقم الهاتف">
                  <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="01xxxxxxxxx" />
                </FormField>
                <FormField label="البريد الإلكتروني">
                  <Input value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@company.com" type="email" />
                </FormField>
                <FormField label="تاريخ الميلاد">
                  <Input value={form.birthDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))} type="date" />
                </FormField>
                <FormField label="العنوان">
                  <Input value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="المدينة، الشارع" />
                </FormField>
              </div>
            </TabsContent>

            <TabsContent value="job" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="المسمى الوظيفي">
                  <Input value={form.jobTitle ?? ""} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} placeholder="مهندس / محاسب / مدير..." />
                </FormField>
                <FormField label="القسم">
                  <Input value={form.department ?? ""} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="المالية / الهندسة / المبيعات" />
                </FormField>
                <FormField label="تاريخ التعيين">
                  <Input value={form.hireDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))} type="date" />
                </FormField>
                <FormField label="نوع العقد">
                  <Select value={form.contractType ?? "full-time"} onValueChange={(v) => setForm((f) => ({ ...f, contractType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">دوام كامل</SelectItem>
                      <SelectItem value="part-time">دوام جزئي</SelectItem>
                      <SelectItem value="contract">عقد مؤقت</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="الحالة">
                  <Select value={form.status ?? "active"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="inactive">غير نشط</SelectItem>
                      <SelectItem value="on_leave">في إجازة</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="ملاحظات">
                  <Textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات إضافية" rows={2} />
                </FormField>
              </div>

              <div className="border border-dashed border-slate-300 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  ورقة التعيين / عقد العمل
                </p>
                {form.appointmentDocName && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded px-3 py-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{form.appointmentDocName}</span>
                    <button onClick={() => setForm((f) => ({ ...f, appointmentDocUrl: "", appointmentDocName: "" }))} className="mr-auto text-red-400 hover:text-red-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                  <Upload className="h-4 w-4" />
                  {form.appointmentDocName ? "تغيير الملف" : "رفع الملف (PDF / صورة)"}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />
                </label>
              </div>
            </TabsContent>

            <TabsContent value="salary" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="الراتب الأساسي (جنيه)">
                  <Input value={form.baseSalary ?? ""} onChange={(e) => setForm((f) => ({ ...f, baseSalary: e.target.value }))} type="number" placeholder="5000" />
                </FormField>
                <FormField label="البدلات (جنيه)">
                  <Input value={form.allowances ?? "0"} onChange={(e) => setForm((f) => ({ ...f, allowances: e.target.value }))} type="number" placeholder="0" />
                </FormField>
                <FormField label="الاستقطاعات (جنيه)">
                  <Input value={form.deductions ?? "0"} onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))} type="number" placeholder="0" />
                </FormField>
                <FormField label="الراتب الصافي">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-green-700">
                    {(
                      (parseFloat(form.baseSalary ?? "0") || 0) +
                      (parseFloat(form.allowances ?? "0") || 0) -
                      (parseFloat(form.deductions ?? "0") || 0)
                    ).toLocaleString()} ج
                  </div>
                </FormField>
                <FormField label="البنك">
                  <Input value={form.bankName ?? ""} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} placeholder="بنك مصر / الأهلي..." />
                </FormField>
                <FormField label="رقم الحساب البنكي">
                  <Input value={form.bankAccount ?? ""} onChange={(e) => setForm((f) => ({ ...f, bankAccount: e.target.value }))} placeholder="IBAN / رقم الحساب" />
                </FormField>
              </div>
            </TabsContent>

            <TabsContent value="emergency" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="اسم جهة الطوارئ">
                  <Input value={form.emergencyContactName ?? ""} onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))} placeholder="أحمد محمد" />
                </FormField>
                <FormField label="هاتف جهة الطوارئ">
                  <Input value={form.emergencyContactPhone ?? ""} onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))} placeholder="01xxxxxxxxx" />
                </FormField>
                <FormField label="صلة القرابة">
                  <Input value={form.emergencyContactRelation ?? ""} onChange={(e) => setForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))} placeholder="زوج / أخ / أب..." />
                </FormField>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditEmployee(null); setForm(emptyForm()); }}>إلغاء</Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#162d4a]"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || !form.fullName?.trim()}
            >
              {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : editEmployee ? "حفظ التعديلات" : "إضافة الموظف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Employee Modal */}
      {viewEmployee && (
        <Dialog open={!!viewEmployee} onOpenChange={(o) => { if (!o) setViewEmployee(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e3a5f] text-white font-bold text-lg">
                  {(empDetail ?? viewEmployee).fullName[0]}
                </div>
                <div>
                  <div>{(empDetail ?? viewEmployee).fullName}</div>
                  <div className="text-xs font-mono text-blue-600">{(empDetail ?? viewEmployee).employeeNumber}</div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="info">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="info">البيانات</TabsTrigger>
                <TabsTrigger value="salary">الرواتب</TabsTrigger>
                <TabsTrigger value="docs">الوثائق</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4 space-y-4">
                {(() => {
                  const emp = empDetail ?? viewEmployee;
                  return (
                    <>
                      <SectionCard title="البيانات الشخصية">
                        <InfoRow icon={<Phone className="h-4 w-4" />} label="الهاتف" value={emp.phone} />
                        <InfoRow icon={<Mail className="h-4 w-4" />} label="البريد" value={emp.email} />
                        <InfoRow icon={<CreditCard className="h-4 w-4" />} label="الهوية" value={emp.nationalId} />
                        <InfoRow icon={<MapPin className="h-4 w-4" />} label="العنوان" value={emp.address} />
                        <InfoRow icon={null} label="تاريخ الميلاد" value={emp.birthDate} />
                      </SectionCard>
                      <SectionCard title="بيانات الوظيفة">
                        <InfoRow icon={<Building2 className="h-4 w-4" />} label="القسم" value={emp.department} />
                        <InfoRow icon={null} label="المسمى الوظيفي" value={emp.jobTitle} />
                        <InfoRow icon={null} label="نوع العقد" value={CONTRACT_MAP[emp.contractType ?? ""] ?? emp.contractType} />
                        <InfoRow icon={null} label="تاريخ التعيين" value={emp.hireDate} />
                        <InfoRow icon={null} label="الحالة" value={STATUS_MAP[emp.status]?.label ?? emp.status} />
                      </SectionCard>
                      <SectionCard title="بيانات الراتب">
                        <InfoRow icon={<Banknote className="h-4 w-4" />} label="الراتب الأساسي" value={emp.baseSalary ? `${parseFloat(emp.baseSalary).toLocaleString()} ج` : undefined} />
                        <InfoRow icon={null} label="البدلات" value={emp.allowances ? `${parseFloat(emp.allowances).toLocaleString()} ج` : undefined} />
                        <InfoRow icon={null} label="الاستقطاعات" value={emp.deductions ? `${parseFloat(emp.deductions).toLocaleString()} ج` : undefined} />
                        <InfoRow icon={null} label="الراتب الصافي" value={emp.baseSalary ? `${((parseFloat(emp.baseSalary)||0)+(parseFloat(emp.allowances??'0')||0)-(parseFloat(emp.deductions??'0')||0)).toLocaleString()} ج` : undefined} bold />
                        <InfoRow icon={null} label="البنك" value={emp.bankName} />
                        <InfoRow icon={null} label="رقم الحساب" value={emp.bankAccount} />
                      </SectionCard>
                      {emp.appointmentDocUrl && (
                        <SectionCard title="ورقة التعيين">
                          <a href={emp.appointmentDocUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                            <FileText className="h-4 w-4" />
                            {emp.appointmentDocName || "عرض الوثيقة"}
                          </a>
                        </SectionCard>
                      )}
                      {(emp.emergencyContactName || emp.emergencyContactPhone) && (
                        <SectionCard title="جهة الطوارئ">
                          <InfoRow icon={<AlertCircle className="h-4 w-4" />} label="الاسم" value={emp.emergencyContactName} />
                          <InfoRow icon={<Phone className="h-4 w-4" />} label="الهاتف" value={emp.emergencyContactPhone} />
                          <InfoRow icon={null} label="صلة القرابة" value={emp.emergencyContactRelation} />
                        </SectionCard>
                      )}
                    </>
                  );
                })()}
              </TabsContent>

              <TabsContent value="salary" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700">سجل الرواتب</h3>
                  <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={() => setShowSalaryForm(true)}>+ إضافة سجل</Button>
                </div>
                {(empDetail?.salaryRecords ?? []).length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">لا توجد سجلات رواتب</div>
                ) : (
                  <div className="space-y-2">
                    {(empDetail?.salaryRecords ?? []).map((sr) => (
                      <div key={sr.id} className="border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="font-medium text-slate-800 text-sm">{sr.month} {sr.year}</div>
                          <div className="text-xs text-slate-500">
                            أساسي: {parseFloat(sr.baseSalary).toLocaleString()} | بدلات: {parseFloat(sr.allowances).toLocaleString()} | خصومات: {parseFloat(sr.deductions).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <div className="font-bold text-green-700">{parseFloat(sr.netSalary).toLocaleString()} ج</div>
                            <div className="text-xs text-slate-400">صافي</div>
                          </div>
                          {sr.paid ? (
                            <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">مدفوع</span>
                          ) : (
                            <button
                              onClick={() => markPaidMutation.mutate({ employeeId: empDetail!.id, recordId: sr.id, data: { ...sr, paid: true } })}
                              className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 hover:bg-orange-200"
                            >
                              غير مدفوع
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="docs" className="mt-4 space-y-3">
                <h3 className="font-semibold text-slate-700">الوثائق والمستندات</h3>
                {empDetail?.appointmentDocUrl ? (
                  <div className="border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-700">ورقة التعيين / عقد العمل</div>
                      <div className="text-xs text-slate-400">{empDetail.appointmentDocName}</div>
                    </div>
                    <a href={empDetail.appointmentDocUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">عرض</a>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    <FileText className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                    لا توجد وثائق مرفوعة
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => openEdit(empDetail ?? viewEmployee)}>تعديل</Button>
              <Button variant="outline" onClick={() => setViewEmployee(null)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Salary Record Form */}
      {showSalaryForm && viewEmployee && (
        <Dialog open={showSalaryForm} onOpenChange={setShowSalaryForm}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة سجل راتب</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="الشهر">
                <Select value={salaryForm.month} onValueChange={(v) => setSalaryForm((f) => ({ ...f, month: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="السنة">
                <Input value={salaryForm.year} onChange={(e) => setSalaryForm((f) => ({ ...f, year: e.target.value }))} type="number" />
              </FormField>
              <FormField label="الراتب الأساسي">
                <Input value={salaryForm.baseSalary} onChange={(e) => setSalaryForm((f) => ({ ...f, baseSalary: e.target.value }))} type="number" placeholder={empDetail?.baseSalary ?? "0"} />
              </FormField>
              <FormField label="البدلات">
                <Input value={salaryForm.allowances} onChange={(e) => setSalaryForm((f) => ({ ...f, allowances: e.target.value }))} type="number" />
              </FormField>
              <FormField label="الخصومات">
                <Input value={salaryForm.deductions} onChange={(e) => setSalaryForm((f) => ({ ...f, deductions: e.target.value }))} type="number" />
              </FormField>
              <FormField label="الصافي">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-green-700">
                  {((parseFloat(salaryForm.baseSalary || empDetail?.baseSalary ?? "0") || 0) + (parseFloat(salaryForm.allowances) || 0) - (parseFloat(salaryForm.deductions) || 0)).toLocaleString()} ج
                </div>
              </FormField>
            </div>
            <FormField label="ملاحظات">
              <Textarea value={salaryForm.notes} onChange={(e) => setSalaryForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </FormField>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSalaryForm(false)}>إلغاء</Button>
              <Button
                className="bg-[#1e3a5f] hover:bg-[#162d4a]"
                onClick={() => addSalaryMutation.mutate({ employeeId: (empDetail ?? viewEmployee).id, data: { ...salaryForm, baseSalary: salaryForm.baseSalary || empDetail?.baseSalary } })}
                disabled={addSalaryMutation.isPending}
              >
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-red-600">تأكيد الحذف</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              هل تريد حذف الموظف <strong>{deleteConfirm.fullName}</strong>؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string | number; bg: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 ${bg} p-4 flex items-center gap-3`}>
      <div className="rounded-lg bg-white p-2 shadow-sm">{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-2">
      <h4 className="text-sm font-semibold text-slate-700 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value, bold }: { icon: React.ReactNode; label: string; value?: string | null; bold?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      {icon && <span className="text-slate-400">{icon}</span>}
      <span className="text-slate-500 min-w-[100px]">{label}:</span>
      <span className={`text-slate-800 ${bold ? "font-bold text-green-700" : ""}`}>{value}</span>
    </div>
  );
}
