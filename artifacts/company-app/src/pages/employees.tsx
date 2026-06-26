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
  CalendarDays,
  Stethoscope,
  Award,
  ShieldAlert,
  Plus,
  LogIn,
  LogOut,
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

type EmployeeLeave = {
  id: number;
  employeeId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  status: string;
  notes?: string;
  createdAt: string;
};

type EmployeeAttendance = {
  id: number;
  employeeId: number;
  attendanceDate: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
  hoursWorked?: string;
  notes?: string;
  createdAt: string;
};

type EmployeeBonus = {
  id: number;
  employeeId: number;
  bonusType: string;
  amount: string;
  reason?: string;
  bonusDate: string;
  paid: boolean;
  notes?: string;
  createdAt: string;
};

type EmployeePenalty = {
  id: number;
  employeeId: number;
  penaltyType: string;
  amount: string;
  reason: string;
  penaltyDate: string;
  deducted: boolean;
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

const LEAVE_TYPE_MAP: Record<string, string> = {
  annual: "إجازة سنوية",
  sick: "إجازة مرضية",
  emergency: "إجازة طارئة",
  maternity: "إجازة أمومة",
  unpaid: "إجازة بدون راتب",
  other: "أخرى",
};

const LEAVE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  approved: { label: "موافق عليها", color: "bg-green-100 text-green-700" },
  pending: { label: "في الانتظار", color: "bg-yellow-100 text-yellow-700" },
  rejected: { label: "مرفوضة", color: "bg-red-100 text-red-700" },
};

const ATT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  present: { label: "حاضر", color: "bg-green-100 text-green-700" },
  absent: { label: "غائب", color: "bg-red-100 text-red-700" },
  late: { label: "متأخر", color: "bg-orange-100 text-orange-700" },
  half_day: { label: "نصف يوم", color: "bg-blue-100 text-blue-700" },
  on_leave: { label: "في إجازة", color: "bg-purple-100 text-purple-700" },
};

const BONUS_TYPE_MAP: Record<string, string> = {
  performance: "مكافأة أداء",
  ramadan: "مكافأة رمضان",
  eid: "مكافأة عيد",
  incentive: "حافز",
  other: "أخرى",
};

const PENALTY_TYPE_MAP: Record<string, string> = {
  absence: "غياب",
  late: "تأخير",
  violation: "مخالفة",
  behavior: "سلوك",
  other: "أخرى",
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
  const [formTab, setFormTab] = useState("personal");
  const [formError, setFormError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null);

  // Salary form
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ month: "يناير", year: new Date().getFullYear().toString(), baseSalary: "", allowances: "0", deductions: "0", paid: false, notes: "" });

  // Leave form
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveType: "annual", startDate: "", endDate: "", totalDays: "1", reason: "", status: "approved", notes: "" });

  // Attendance form
  const [showAttForm, setShowAttForm] = useState(false);
  const [attForm, setAttForm] = useState({ attendanceDate: new Date().toISOString().split("T")[0], checkIn: "", checkOut: "", status: "present", hoursWorked: "", notes: "" });

  // Bonus form
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [bonusForm, setBonusForm] = useState({ bonusType: "performance", amount: "", reason: "", bonusDate: new Date().toISOString().split("T")[0], paid: false, notes: "" });

  // Penalty form
  const [showPenaltyForm, setShowPenaltyForm] = useState(false);
  const [penaltyForm, setPenaltyForm] = useState({ penaltyType: "other", amount: "", reason: "", penaltyDate: new Date().toISOString().split("T")[0], deducted: false, notes: "" });

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

  const empId = (empDetail ?? viewEmployee)?.id;

  const { data: leaves = [], refetch: refetchLeaves } = useQuery<EmployeeLeave[]>({
    queryKey: ["employee-leaves", empId],
    queryFn: () => apiFetch(`/${empId}/leaves`),
    enabled: !!empId,
  });

  const { data: attendance = [], refetch: refetchAttendance } = useQuery<EmployeeAttendance[]>({
    queryKey: ["employee-attendance", empId],
    queryFn: () => apiFetch(`/${empId}/attendance`),
    enabled: !!empId,
  });

  const { data: bonuses = [], refetch: refetchBonuses } = useQuery<EmployeeBonus[]>({
    queryKey: ["employee-bonuses", empId],
    queryFn: () => apiFetch(`/${empId}/bonuses`),
    enabled: !!empId,
  });

  const { data: penalties = [], refetch: refetchPenalties } = useQuery<EmployeePenalty[]>({
    queryKey: ["employee-penalties", empId],
    queryFn: () => apiFetch(`/${empId}/penalties`),
    enabled: !!empId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Employee>) => apiFetch("/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); qc.invalidateQueries({ queryKey: ["employees-stats"] }); setShowForm(false); setForm(emptyForm()); setFormError(""); },
    onError: (err: any) => { setFormError(err?.message ?? "حدث خطأ أثناء إضافة الموظف."); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Employee> }) => apiFetch(`/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); qc.invalidateQueries({ queryKey: ["employees-stats"] }); qc.invalidateQueries({ queryKey: ["employee-detail"] }); setShowForm(false); setEditEmployee(null); setForm(emptyForm()); setFormError(""); },
    onError: (err: any) => { setFormError(err?.message ?? "حدث خطأ أثناء تعديل بيانات الموظف."); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); qc.invalidateQueries({ queryKey: ["employees-stats"] }); setDeleteConfirm(null); },
  });

  const addSalaryMutation = useMutation({
    mutationFn: ({ employeeId, data }: { employeeId: number; data: any }) => apiFetch(`/${employeeId}/salary-records`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { refetchDetail(); setShowSalaryForm(false); setSalaryForm({ month: "يناير", year: new Date().getFullYear().toString(), baseSalary: "", allowances: "0", deductions: "0", paid: false, notes: "" }); },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ employeeId, recordId, data }: { employeeId: number; recordId: number; data: any }) => apiFetch(`/${employeeId}/salary-records/${recordId}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => refetchDetail(),
  });

  const addLeaveMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/${empId}/leaves`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { refetchLeaves(); setShowLeaveForm(false); setLeaveForm({ leaveType: "annual", startDate: "", endDate: "", totalDays: "1", reason: "", status: "approved", notes: "" }); },
  });

  const deleteLeaveMutation = useMutation({
    mutationFn: (leaveId: number) => apiFetch(`/${empId}/leaves/${leaveId}`, { method: "DELETE" }),
    onSuccess: () => refetchLeaves(),
  });

  const addAttMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/${empId}/attendance`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { refetchAttendance(); setShowAttForm(false); setAttForm({ attendanceDate: new Date().toISOString().split("T")[0], checkIn: "", checkOut: "", status: "present", hoursWorked: "", notes: "" }); },
  });

  const deleteAttMutation = useMutation({
    mutationFn: (attId: number) => apiFetch(`/${empId}/attendance/${attId}`, { method: "DELETE" }),
    onSuccess: () => refetchAttendance(),
  });

  const addBonusMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/${empId}/bonuses`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { refetchBonuses(); setShowBonusForm(false); setBonusForm({ bonusType: "performance", amount: "", reason: "", bonusDate: new Date().toISOString().split("T")[0], paid: false, notes: "" }); },
  });

  const markBonusPaidMutation = useMutation({
    mutationFn: ({ bonusId, data }: { bonusId: number; data: any }) => apiFetch(`/${empId}/bonuses/${bonusId}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => refetchBonuses(),
  });

  const deleteBonusMutation = useMutation({
    mutationFn: (bonusId: number) => apiFetch(`/${empId}/bonuses/${bonusId}`, { method: "DELETE" }),
    onSuccess: () => refetchBonuses(),
  });

  const addPenaltyMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/${empId}/penalties`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { refetchPenalties(); setShowPenaltyForm(false); setPenaltyForm({ penaltyType: "other", amount: "", reason: "", penaltyDate: new Date().toISOString().split("T")[0], deducted: false, notes: "" }); },
  });

  const deletePenaltyMutation = useMutation({
    mutationFn: (penaltyId: number) => apiFetch(`/${empId}/penalties/${penaltyId}`, { method: "DELETE" }),
    onSuccess: () => refetchPenalties(),
  });

  const filteredEmployees = employees.filter((e) => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (filterDept !== "all" && e.department !== filterDept) return false;
    return true;
  });

  function openAdd() { setEditEmployee(null); setForm(emptyForm()); setFormTab("personal"); setFormError(""); setShowForm(true); }
  function openEdit(emp: Employee) { setEditEmployee(emp); setForm({ ...emp }); setFormTab("personal"); setFormError(""); setShowForm(true); }

  function handleSubmit() {
    if (!form.fullName?.trim()) { setFormTab("personal"); setFormError("الاسم الكامل مطلوب."); return; }
    setFormError("");
    if (editEmployee) { updateMutation.mutate({ id: editEmployee.id, data: form }); }
    else { createMutation.mutate(form); }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setForm((f) => ({ ...f, appointmentDocUrl: ev.target?.result as string, appointmentDocName: file.name })); };
    reader.readAsDataURL(file);
  }

  const departments = stats?.departments ?? [];

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">إدارة الموظفين</h1>
            <p className="text-sm text-slate-500 mt-0.5">محرك الموارد البشرية</p>
          </div>
          <Button onClick={openAdd} className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a]">
            <UserPlus className="h-4 w-4" />
            إضافة موظف
          </Button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<Users className="h-5 w-5 text-blue-500" />} label="إجمالي الموظفين" value={stats.total} bg="bg-blue-50" />
            <StatCard icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} label="نشطون" value={stats.active} bg="bg-green-50" />
            <StatCard icon={<Clock className="h-5 w-5 text-yellow-500" />} label="في إجازة" value={stats.onLeave} bg="bg-yellow-50" />
            <StatCard icon={<Banknote className="h-5 w-5 text-purple-500" />} label="إجمالي الرواتب" value={`${(stats.totalSalary ?? 0).toLocaleString()} ج`} bg="bg-purple-50" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="بحث بالاسم أو الرقم الوظيفي..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9 text-sm" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 text-sm"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
              <SelectItem value="on_leave">في إجازة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-40 text-sm"><SelectValue placeholder="القسم" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأقسام</SelectItem>
              {departments.map((d) => <SelectItem key={d} value={d!}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

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
                        <td className="px-4 py-3 text-slate-700 font-medium">{emp.baseSalary ? `${parseFloat(emp.baseSalary).toLocaleString()} ج` : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{emp.hireDate || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setViewEmployee(emp); }} className="rounded p-1.5 text-blue-600 hover:bg-blue-50" title="عرض"><Eye className="h-4 w-4" /></button>
                            <button onClick={() => openEdit(emp)} className="rounded p-1.5 text-slate-600 hover:bg-slate-100" title="تعديل"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => setDeleteConfirm(emp)} className="rounded p-1.5 text-red-500 hover:bg-red-50" title="حذف"><Trash2 className="h-4 w-4" /></button>
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
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditEmployee(null); setForm(emptyForm()); setFormTab("personal"); setFormError(""); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editEmployee ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</DialogTitle>
          </DialogHeader>
          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />{formError}
            </div>
          )}
          <Tabs value={formTab} onValueChange={setFormTab}>
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="personal">البيانات الشخصية</TabsTrigger>
              <TabsTrigger value="job">بيانات الوظيفة</TabsTrigger>
              <TabsTrigger value="salary">بيانات الراتب</TabsTrigger>
              <TabsTrigger value="emergency">جهة الطوارئ</TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="الاسم الكامل *"><Input value={form.fullName ?? ""} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="محمد أحمد علي" /></FormField>
                <FormField label="رقم الهوية الوطنية"><Input value={form.nationalId ?? ""} onChange={(e) => setForm((f) => ({ ...f, nationalId: e.target.value }))} placeholder="12345678901234" /></FormField>
                <FormField label="رقم الهاتف"><Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="01xxxxxxxxx" /></FormField>
                <FormField label="البريد الإلكتروني"><Input value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@company.com" type="email" /></FormField>
                <FormField label="تاريخ الميلاد"><Input value={form.birthDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))} type="date" /></FormField>
                <FormField label="العنوان"><Input value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="المدينة، الشارع" /></FormField>
              </div>
            </TabsContent>
            <TabsContent value="job" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="المسمى الوظيفي"><Input value={form.jobTitle ?? ""} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} placeholder="مهندس / محاسب / مدير..." /></FormField>
                <FormField label="القسم"><Input value={form.department ?? ""} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="المالية / الهندسة / المبيعات" /></FormField>
                <FormField label="تاريخ التعيين"><Input value={form.hireDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))} type="date" /></FormField>
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
                <FormField label="ملاحظات"><Textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات إضافية" rows={2} /></FormField>
              </div>
              <div className="border border-dashed border-slate-300 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-slate-700 flex items-center gap-2"><FileText className="h-4 w-4 text-blue-500" />ورقة التعيين / عقد العمل</p>
                {form.appointmentDocName && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded px-3 py-2">
                    <CheckCircle2 className="h-4 w-4" /><span>{form.appointmentDocName}</span>
                    <button onClick={() => setForm((f) => ({ ...f, appointmentDocUrl: "", appointmentDocName: "" }))} className="mr-auto text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                  <Upload className="h-4 w-4" />{form.appointmentDocName ? "تغيير الملف" : "رفع الملف (PDF / صورة)"}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />
                </label>
              </div>
            </TabsContent>
            <TabsContent value="salary" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="الراتب الأساسي (جنيه)"><Input value={form.baseSalary ?? ""} onChange={(e) => setForm((f) => ({ ...f, baseSalary: e.target.value }))} type="number" placeholder="5000" /></FormField>
                <FormField label="البدلات (جنيه)"><Input value={form.allowances ?? "0"} onChange={(e) => setForm((f) => ({ ...f, allowances: e.target.value }))} type="number" placeholder="0" /></FormField>
                <FormField label="الاستقطاعات (جنيه)"><Input value={form.deductions ?? "0"} onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))} type="number" placeholder="0" /></FormField>
                <FormField label="الراتب الصافي">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-green-700">
                    {((parseFloat(form.baseSalary ?? "0") || 0) + (parseFloat(form.allowances ?? "0") || 0) - (parseFloat(form.deductions ?? "0") || 0)).toLocaleString()} ج
                  </div>
                </FormField>
                <FormField label="البنك"><Input value={form.bankName ?? ""} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} placeholder="بنك مصر / الأهلي..." /></FormField>
                <FormField label="رقم الحساب البنكي"><Input value={form.bankAccount ?? ""} onChange={(e) => setForm((f) => ({ ...f, bankAccount: e.target.value }))} placeholder="IBAN / رقم الحساب" /></FormField>
              </div>
            </TabsContent>
            <TabsContent value="emergency" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="اسم جهة الطوارئ"><Input value={form.emergencyContactName ?? ""} onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))} placeholder="أحمد محمد" /></FormField>
                <FormField label="هاتف جهة الطوارئ"><Input value={form.emergencyContactPhone ?? ""} onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))} placeholder="01xxxxxxxxx" /></FormField>
                <FormField label="صلة القرابة"><Input value={form.emergencyContactRelation ?? ""} onChange={(e) => setForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))} placeholder="زوج / أخ / أب..." /></FormField>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditEmployee(null); setForm(emptyForm()); setFormTab("personal"); setFormError(""); }}>إلغاء</Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending || !form.fullName?.trim()}>
              {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : editEmployee ? "حفظ التعديلات" : "إضافة الموظف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Employee Modal */}
      {viewEmployee && (
        <Dialog open={!!viewEmployee} onOpenChange={(o) => { if (!o) setViewEmployee(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
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
              <TabsList className="w-full grid grid-cols-7 text-xs">
                <TabsTrigger value="info">البيانات</TabsTrigger>
                <TabsTrigger value="salary">الرواتب</TabsTrigger>
                <TabsTrigger value="leaves">الإجازات</TabsTrigger>
                <TabsTrigger value="sick">المرض</TabsTrigger>
                <TabsTrigger value="attendance">الحضور</TabsTrigger>
                <TabsTrigger value="bonuses">المكافآت</TabsTrigger>
                <TabsTrigger value="penalties">الجزاءات</TabsTrigger>
              </TabsList>

              {/* ===== البيانات ===== */}
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
                      </SectionCard>
                    </>
                  );
                })()}
              </TabsContent>

              {/* ===== الرواتب ===== */}
              <TabsContent value="salary" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700">سجل الرواتب</h3>
                  <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={() => setShowSalaryForm(true)}><Plus className="h-3.5 w-3.5 ml-1" />إضافة سجل</Button>
                </div>
                {(empDetail?.salaryRecords ?? []).length === 0 ? (
                  <EmptyState icon={<Banknote className="h-10 w-10" />} text="لا توجد سجلات رواتب" />
                ) : (
                  <div className="space-y-2">
                    {(empDetail?.salaryRecords ?? []).map((sr) => (
                      <div key={sr.id} className="border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="font-medium text-slate-800 text-sm">{sr.month} {sr.year}</div>
                          <div className="text-xs text-slate-500">أساسي: {parseFloat(sr.baseSalary).toLocaleString()} | بدلات: {parseFloat(sr.allowances).toLocaleString()} | خصومات: {parseFloat(sr.deductions).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <div className="font-bold text-green-700">{parseFloat(sr.netSalary).toLocaleString()} ج</div>
                            <div className="text-xs text-slate-400">صافي</div>
                          </div>
                          {sr.paid ? (
                            <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">مدفوع</span>
                          ) : (
                            <button onClick={() => markPaidMutation.mutate({ employeeId: empDetail!.id, recordId: sr.id, data: { ...sr, paid: true } })} className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 hover:bg-orange-200">غير مدفوع</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ===== الإجازات السنوية ===== */}
              <TabsContent value="leaves" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-500" />سجل الإجازات</h3>
                  <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={() => { setLeaveForm((f) => ({ ...f, leaveType: "annual" })); setShowLeaveForm(true); }}><Plus className="h-3.5 w-3.5 ml-1" />إضافة إجازة</Button>
                </div>
                {leaves.filter(l => l.leaveType !== "sick").length === 0 ? (
                  <EmptyState icon={<CalendarDays className="h-10 w-10" />} text="لا توجد إجازات مسجلة" />
                ) : (
                  <div className="space-y-2">
                    {leaves.filter(l => l.leaveType !== "sick").map((lv) => {
                      const st = LEAVE_STATUS_MAP[lv.status] ?? LEAVE_STATUS_MAP.approved;
                      return (
                        <div key={lv.id} className="border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <div className="font-medium text-slate-800 text-sm">{LEAVE_TYPE_MAP[lv.leaveType] ?? lv.leaveType}</div>
                            <div className="text-xs text-slate-500">{lv.startDate} ← {lv.endDate} ({lv.totalDays} يوم)</div>
                            {lv.reason && <div className="text-xs text-slate-400 mt-0.5">{lv.reason}</div>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs rounded-full px-2 py-0.5 ${st.color}`}>{st.label}</span>
                            <button onClick={() => deleteLeaveMutation.mutate(lv.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ===== المرض ===== */}
              <TabsContent value="sick" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2"><Stethoscope className="h-4 w-4 text-red-500" />إجازات مرضية</h3>
                  <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => { setLeaveForm((f) => ({ ...f, leaveType: "sick" })); setShowLeaveForm(true); }}><Plus className="h-3.5 w-3.5 ml-1" />إضافة إجازة مرضية</Button>
                </div>
                {leaves.filter(l => l.leaveType === "sick").length === 0 ? (
                  <EmptyState icon={<Stethoscope className="h-10 w-10" />} text="لا توجد إجازات مرضية مسجلة" />
                ) : (
                  <div className="space-y-2">
                    {leaves.filter(l => l.leaveType === "sick").map((lv) => (
                      <div key={lv.id} className="border border-red-100 rounded-lg px-4 py-3 flex items-center justify-between hover:bg-red-50">
                        <div>
                          <div className="font-medium text-slate-800 text-sm flex items-center gap-2"><Stethoscope className="h-3.5 w-3.5 text-red-500" />إجازة مرضية</div>
                          <div className="text-xs text-slate-500">{lv.startDate} ← {lv.endDate} ({lv.totalDays} يوم)</div>
                          {lv.reason && <div className="text-xs text-slate-400 mt-0.5">{lv.reason}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">{lv.totalDays} يوم</span>
                          <button onClick={() => deleteLeaveMutation.mutate(lv.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 shrink-0" />
                  إجمالي أيام المرض: <strong>{leaves.filter(l => l.leaveType === "sick").reduce((s, l) => s + l.totalDays, 0)} يوم</strong>
                </div>
              </TabsContent>

              {/* ===== الحضور والانصراف ===== */}
              <TabsContent value="attendance" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2"><Clock className="h-4 w-4 text-green-500" />سجل الحضور والانصراف</h3>
                  <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={() => setShowAttForm(true)}><Plus className="h-3.5 w-3.5 ml-1" />تسجيل يوم</Button>
                </div>
                {attendance.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-green-50 rounded-lg p-2">
                      <div className="font-bold text-green-700 text-lg">{attendance.filter(a => a.status === "present").length}</div>
                      <div className="text-green-600">أيام حضور</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2">
                      <div className="font-bold text-red-700 text-lg">{attendance.filter(a => a.status === "absent").length}</div>
                      <div className="text-red-600">أيام غياب</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2">
                      <div className="font-bold text-orange-700 text-lg">{attendance.filter(a => a.status === "late").length}</div>
                      <div className="text-orange-600">أيام تأخير</div>
                    </div>
                  </div>
                )}
                {attendance.length === 0 ? (
                  <EmptyState icon={<Clock className="h-10 w-10" />} text="لا توجد سجلات حضور" />
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {attendance.map((att) => {
                      const st = ATT_STATUS_MAP[att.status] ?? ATT_STATUS_MAP.present;
                      return (
                        <div key={att.id} className="border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="font-medium text-slate-800 text-sm">{att.attendanceDate}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-3">
                                {att.checkIn && <span className="flex items-center gap-1"><LogIn className="h-3 w-3 text-green-500" />{att.checkIn}</span>}
                                {att.checkOut && <span className="flex items-center gap-1"><LogOut className="h-3 w-3 text-red-500" />{att.checkOut}</span>}
                                {att.hoursWorked && <span>{att.hoursWorked} ساعة</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs rounded-full px-2 py-0.5 ${st.color}`}>{st.label}</span>
                            <button onClick={() => deleteAttMutation.mutate(att.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ===== المكافآت ===== */}
              <TabsContent value="bonuses" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2"><Award className="h-4 w-4 text-yellow-500" />سجل المكافآت</h3>
                  <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700" onClick={() => setShowBonusForm(true)}><Plus className="h-3.5 w-3.5 ml-1" />إضافة مكافأة</Button>
                </div>
                {bonuses.length > 0 && (
                  <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800 flex items-center gap-2">
                    <Award className="h-4 w-4 shrink-0" />
                    إجمالي المكافآت: <strong>{bonuses.reduce((s, b) => s + parseFloat(b.amount), 0).toLocaleString()} ج</strong>
                  </div>
                )}
                {bonuses.length === 0 ? (
                  <EmptyState icon={<Award className="h-10 w-10" />} text="لا توجد مكافآت مسجلة" />
                ) : (
                  <div className="space-y-2">
                    {bonuses.map((bn) => (
                      <div key={bn.id} className="border border-yellow-100 rounded-lg px-4 py-3 flex items-center justify-between hover:bg-yellow-50">
                        <div>
                          <div className="font-medium text-slate-800 text-sm">{BONUS_TYPE_MAP[bn.bonusType] ?? bn.bonusType}</div>
                          <div className="text-xs text-slate-500">{bn.bonusDate} {bn.reason && `— ${bn.reason}`}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-yellow-700">{parseFloat(bn.amount).toLocaleString()} ج</div>
                          {bn.paid ? (
                            <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">مدفوع</span>
                          ) : (
                            <button onClick={() => markBonusPaidMutation.mutate({ bonusId: bn.id, data: { ...bn, paid: true } })} className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 hover:bg-orange-200">صرف</button>
                          )}
                          <button onClick={() => deleteBonusMutation.mutate(bn.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ===== الجزاءات ===== */}
              <TabsContent value="penalties" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-500" />سجل الجزاءات</h3>
                  <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => setShowPenaltyForm(true)}><Plus className="h-3.5 w-3.5 ml-1" />إضافة جزاء</Button>
                </div>
                {penalties.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3 text-sm text-red-800 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    إجمالي الجزاءات: <strong>{penalties.reduce((s, p) => s + parseFloat(p.amount), 0).toLocaleString()} ج</strong>
                  </div>
                )}
                {penalties.length === 0 ? (
                  <EmptyState icon={<ShieldAlert className="h-10 w-10" />} text="لا توجد جزاءات مسجلة" />
                ) : (
                  <div className="space-y-2">
                    {penalties.map((pn) => (
                      <div key={pn.id} className="border border-red-100 rounded-lg px-4 py-3 flex items-center justify-between hover:bg-red-50">
                        <div>
                          <div className="font-medium text-slate-800 text-sm">{PENALTY_TYPE_MAP[pn.penaltyType] ?? pn.penaltyType}</div>
                          <div className="text-xs text-slate-500">{pn.penaltyDate} — {pn.reason}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-red-700">{parseFloat(pn.amount).toLocaleString()} ج</div>
                          {pn.deducted ? (
                            <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">مخصوم</span>
                          ) : (
                            <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">معلق</span>
                          )}
                          <button onClick={() => deletePenaltyMutation.mutate(pn.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
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

      {/* Salary Form */}
      {showSalaryForm && (
        <Dialog open={showSalaryForm} onOpenChange={setShowSalaryForm}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>إضافة سجل راتب</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="الشهر">
                <Select value={salaryForm.month} onValueChange={(v) => setSalaryForm((f) => ({ ...f, month: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label="السنة"><Input value={salaryForm.year} onChange={(e) => setSalaryForm((f) => ({ ...f, year: e.target.value }))} type="number" /></FormField>
              <FormField label="الراتب الأساسي"><Input value={salaryForm.baseSalary} onChange={(e) => setSalaryForm((f) => ({ ...f, baseSalary: e.target.value }))} type="number" placeholder={empDetail?.baseSalary ?? "0"} /></FormField>
              <FormField label="البدلات"><Input value={salaryForm.allowances} onChange={(e) => setSalaryForm((f) => ({ ...f, allowances: e.target.value }))} type="number" /></FormField>
              <FormField label="الخصومات"><Input value={salaryForm.deductions} onChange={(e) => setSalaryForm((f) => ({ ...f, deductions: e.target.value }))} type="number" /></FormField>
              <FormField label="الصافي">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-green-700">
                  {((parseFloat(salaryForm.baseSalary || (empDetail?.baseSalary ?? "0")) || 0) + (parseFloat(salaryForm.allowances) || 0) - (parseFloat(salaryForm.deductions) || 0)).toLocaleString()} ج
                </div>
              </FormField>
            </div>
            <FormField label="ملاحظات"><Textarea value={salaryForm.notes} onChange={(e) => setSalaryForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></FormField>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSalaryForm(false)}>إلغاء</Button>
              <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={() => addSalaryMutation.mutate({ employeeId: empId!, data: { ...salaryForm, baseSalary: salaryForm.baseSalary || empDetail?.baseSalary } })} disabled={addSalaryMutation.isPending}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Leave Form */}
      {showLeaveForm && (
        <Dialog open={showLeaveForm} onOpenChange={setShowLeaveForm}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>{leaveForm.leaveType === "sick" ? "إضافة إجازة مرضية" : "إضافة إجازة"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="نوع الإجازة">
                <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm((f) => ({ ...f, leaveType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">سنوية</SelectItem>
                    <SelectItem value="sick">مرضية</SelectItem>
                    <SelectItem value="emergency">طارئة</SelectItem>
                    <SelectItem value="maternity">أمومة</SelectItem>
                    <SelectItem value="unpaid">بدون راتب</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="الحالة">
                <Select value={leaveForm.status} onValueChange={(v) => setLeaveForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">موافق عليها</SelectItem>
                    <SelectItem value="pending">في الانتظار</SelectItem>
                    <SelectItem value="rejected">مرفوضة</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="تاريخ البداية"><Input value={leaveForm.startDate} onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value }))} type="date" /></FormField>
              <FormField label="تاريخ النهاية"><Input value={leaveForm.endDate} onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))} type="date" /></FormField>
              <FormField label="عدد الأيام"><Input value={leaveForm.totalDays} onChange={(e) => setLeaveForm((f) => ({ ...f, totalDays: e.target.value }))} type="number" min="1" /></FormField>
              <FormField label="السبب"><Input value={leaveForm.reason} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} placeholder="سبب الإجازة" /></FormField>
            </div>
            <FormField label="ملاحظات"><Textarea value={leaveForm.notes} onChange={(e) => setLeaveForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></FormField>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLeaveForm(false)}>إلغاء</Button>
              <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={() => addLeaveMutation.mutate(leaveForm)} disabled={addLeaveMutation.isPending || !leaveForm.startDate || !leaveForm.endDate}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Attendance Form */}
      {showAttForm && (
        <Dialog open={showAttForm} onOpenChange={setShowAttForm}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>تسجيل حضور / غياب</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="التاريخ"><Input value={attForm.attendanceDate} onChange={(e) => setAttForm((f) => ({ ...f, attendanceDate: e.target.value }))} type="date" /></FormField>
              <FormField label="الحالة">
                <Select value={attForm.status} onValueChange={(v) => setAttForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">حاضر</SelectItem>
                    <SelectItem value="absent">غائب</SelectItem>
                    <SelectItem value="late">متأخر</SelectItem>
                    <SelectItem value="half_day">نصف يوم</SelectItem>
                    <SelectItem value="on_leave">في إجازة</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="وقت الحضور"><Input value={attForm.checkIn} onChange={(e) => setAttForm((f) => ({ ...f, checkIn: e.target.value }))} type="time" /></FormField>
              <FormField label="وقت الانصراف"><Input value={attForm.checkOut} onChange={(e) => setAttForm((f) => ({ ...f, checkOut: e.target.value }))} type="time" /></FormField>
              <FormField label="ساعات العمل"><Input value={attForm.hoursWorked} onChange={(e) => setAttForm((f) => ({ ...f, hoursWorked: e.target.value }))} type="number" placeholder="8" /></FormField>
              <FormField label="ملاحظات"><Input value={attForm.notes} onChange={(e) => setAttForm((f) => ({ ...f, notes: e.target.value }))} placeholder="ملاحظة..." /></FormField>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAttForm(false)}>إلغاء</Button>
              <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]" onClick={() => addAttMutation.mutate(attForm)} disabled={addAttMutation.isPending}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Bonus Form */}
      {showBonusForm && (
        <Dialog open={showBonusForm} onOpenChange={setShowBonusForm}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>إضافة مكافأة</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="نوع المكافأة">
                <Select value={bonusForm.bonusType} onValueChange={(v) => setBonusForm((f) => ({ ...f, bonusType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="performance">مكافأة أداء</SelectItem>
                    <SelectItem value="ramadan">مكافأة رمضان</SelectItem>
                    <SelectItem value="eid">مكافأة عيد</SelectItem>
                    <SelectItem value="incentive">حافز</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="المبلغ (جنيه)"><Input value={bonusForm.amount} onChange={(e) => setBonusForm((f) => ({ ...f, amount: e.target.value }))} type="number" placeholder="500" /></FormField>
              <FormField label="التاريخ"><Input value={bonusForm.bonusDate} onChange={(e) => setBonusForm((f) => ({ ...f, bonusDate: e.target.value }))} type="date" /></FormField>
              <FormField label="السبب"><Input value={bonusForm.reason} onChange={(e) => setBonusForm((f) => ({ ...f, reason: e.target.value }))} placeholder="سبب المكافأة" /></FormField>
            </div>
            <FormField label="ملاحظات"><Textarea value={bonusForm.notes} onChange={(e) => setBonusForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></FormField>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBonusForm(false)}>إلغاء</Button>
              <Button className="bg-yellow-600 hover:bg-yellow-700" onClick={() => addBonusMutation.mutate(bonusForm)} disabled={addBonusMutation.isPending || !bonusForm.amount}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Penalty Form */}
      {showPenaltyForm && (
        <Dialog open={showPenaltyForm} onOpenChange={setShowPenaltyForm}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>إضافة جزاء</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="نوع الجزاء">
                <Select value={penaltyForm.penaltyType} onValueChange={(v) => setPenaltyForm((f) => ({ ...f, penaltyType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="absence">غياب</SelectItem>
                    <SelectItem value="late">تأخير</SelectItem>
                    <SelectItem value="violation">مخالفة</SelectItem>
                    <SelectItem value="behavior">سلوك</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="المبلغ (جنيه)"><Input value={penaltyForm.amount} onChange={(e) => setPenaltyForm((f) => ({ ...f, amount: e.target.value }))} type="number" placeholder="100" /></FormField>
              <FormField label="التاريخ"><Input value={penaltyForm.penaltyDate} onChange={(e) => setPenaltyForm((f) => ({ ...f, penaltyDate: e.target.value }))} type="date" /></FormField>
              <FormField label="السبب *"><Input value={penaltyForm.reason} onChange={(e) => setPenaltyForm((f) => ({ ...f, reason: e.target.value }))} placeholder="سبب الجزاء" /></FormField>
            </div>
            <FormField label="ملاحظات"><Textarea value={penaltyForm.notes} onChange={(e) => setPenaltyForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></FormField>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPenaltyForm(false)}>إلغاء</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => addPenaltyMutation.mutate(penaltyForm)} disabled={addPenaltyMutation.isPending || !penaltyForm.amount || !penaltyForm.reason}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader><DialogTitle className="text-red-600">تأكيد الحذف</DialogTitle></DialogHeader>
            <p className="text-sm text-slate-600">هل تريد حذف الموظف <strong>{deleteConfirm.fullName}</strong>؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "جاري الحذف..." : "حذف"}</Button>
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

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-8 text-slate-300">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}
