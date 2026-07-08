import React, { ReactNode, useState, useRef, useEffect } from "react";
    import { useAuth } from "@/lib/auth-context";
    import { Link, useLocation } from "wouter";
    import { useQuery } from "@tanstack/react-query";
    import {
      LayoutDashboard, Users, Truck, FileText, ShoppingCart,
      PackageCheck, ReceiptText, Wallet, BarChart3, UserCog,
      MessageCircle, Building2, LogOut, List, Menu, X, Settings,
      Camera, KeyRound, Eye, EyeOff, Check, Loader2, Mail,
    } from "lucide-react";
    import {
      Dialog, DialogContent, DialogHeader, DialogTitle,
    } from "@/components/ui/dialog";

    const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

    // permission: the key to check; "admin" means admin-role only; undefined means always visible
    const ALL_NAV_ITEMS = [
      { label: "لوحة التحكم",         path: "/dashboard",           icon: LayoutDashboard, permission: "dashboard"      },
      { label: "العملاء",              path: "/customers",           icon: Users,           permission: "customers"      },
      { label: "الموردين",             path: "/suppliers",           icon: Truck,           permission: "suppliers"      },
      { label: "البنود",               path: "/items",               icon: List,            permission: "suppliers"      },
      { label: "طلبات تسعير العملاء", path: "/customer-quotations", icon: FileText,        permission: "quotations"     },
      { label: "طلبات تسعير الموردين",path: "/supplier-quotations", icon: FileText,        permission: "quotations"     },
      { label: "أوامر شراء العملاء",  path: "/customer-orders",     icon: ShoppingCart,    permission: "customerOrders" },
      { label: "أوامر شراء الموردين", path: "/supplier-orders",     icon: PackageCheck,    permission: "supplierOrders" },
      { label: "إذون التسليم",         path: "/delivery-permits",    icon: ReceiptText,     permission: "customerOrders" },
      { label: "الحسابات",             path: "/accounts",            icon: Wallet,          permission: "finance"        },
      { label: "الماليات",             path: "/finance",             icon: BarChart3,       permission: "finance"        },
      { label: "التقارير",             path: "/reports",             icon: BarChart3,       permission: "reports"        },
      { label: "الموظفين",             path: "/employees",           icon: UserCog,         permission: "employees"      },
      { label: "الواتساب",             path: "/whatsapp",            icon: MessageCircle,   permission: "admin"          },
      { label: "المراسلات والوثائق",   path: "/correspondence",     icon: Mail,            permission: "correspondence" },
      { label: "الإعدادات",            path: "/settings",            icon: Settings,        permission: "settings"       },
    ];

    interface CompanySettings { id: number; name: string; logoUrl: string; }

    function UserAvatar({ photoUrl, name, size = "md", onClick, clickable }: {
      photoUrl?: string | null;
      name?: string | null;
      size?: "sm" | "md";
      onClick?: () => void;
      clickable?: boolean;
    }) {
      const dim = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
      const initial = (name || "U")[0]?.toUpperCase();
      const cursorClass = clickable ? "cursor-pointer ring-2 ring-transparent hover:ring-blue-400 transition-all" : "";
      if (photoUrl) {
        return (
          <img
            src={photoUrl} alt={name || ""}
            onClick={onClick}
            className={`${dim} rounded-full object-cover shrink-0 border-2 border-white/20 ${cursorClass}`}
          />
        );
      }
      return (
        <div
          onClick={onClick}
          className={`${dim} rounded-full bg-blue-600 flex items-center justify-center font-medium text-white shrink-0 ${cursorClass}`}
        >
          {initial}
        </div>
      );
    }

    function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
      const { user, updateUser } = useAuth();
      const fileRef = useRef<HTMLInputElement>(null);
      const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
      const [newPassword, setNewPassword] = useState("");
      const [confirmPassword, setConfirmPassword] = useState("");
      const [showPass, setShowPass] = useState(false);
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [success, setSuccess] = useState(false);

      useEffect(() => {
        if (!open) {
          setPreviewPhoto(null);
          setNewPassword("");
          setConfirmPassword("");
          setError(null);
          setSuccess(false);
          setSaving(false);
        }
      }, [open]);

      const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { setError("حجم الصورة أكبر من 2MB"); return; }
        const reader = new FileReader();
        reader.onload = (ev) => setPreviewPhoto(ev.target?.result as string);
        reader.readAsDataURL(file);
        setError(null);
      };

      const handleSave = async () => {
        if (!previewPhoto && !newPassword) { setError("لم تقم بأي تعديل"); return; }
        if (newPassword && newPassword.length < 6) { setError("كلمة المرور قصيرة جداً (6 أحرف على الأقل)"); return; }
        if (newPassword && newPassword !== confirmPassword) { setError("كلمة المرور غير متطابقة"); return; }

        setSaving(true);
        setError(null);
        try {
          const body: Record<string, string> = {};
          if (previewPhoto) body.photoUrl = previewPhoto;
          if (newPassword) body.password = newPassword;

          const storedToken = localStorage.getItem("auth_token");
          const res = await fetch(`${API_BASE}/api/auth/profile`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
            },
            credentials: "include",
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "فشل الحفظ");
          }
          const updated = await res.json();
          updateUser({ photoUrl: updated.photoUrl ?? "" });
          setSuccess(true);
          setTimeout(() => { onClose(); }, 1400);
        } catch (err: any) {
          setError(err.message || "حدث خطأ غير متوقع");
        } finally {
          setSaving(false);
        }
      };

      const currentPhoto = previewPhoto || user?.photoUrl || null;
      const initial = (user?.fullName || user?.username || "U")[0]?.toUpperCase();

      return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
          <DialogContent className="sm:max-w-sm w-[92vw]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right text-base">تعديل الملف الشخصي</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center gap-5 py-2">
              {/* Photo section */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  {currentPhoto ? (
                    <img src={currentPhoto} alt="صورة شخصية" className="h-20 w-20 rounded-full object-cover border-2 border-slate-200" />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white">
                      {initial}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="absolute bottom-0 left-0 rounded-full bg-blue-600 p-1.5 text-white shadow hover:bg-blue-700 transition-colors"
                    title="تغيير الصورة"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                {previewPhoto && (
                  <span className="text-xs text-blue-600 font-medium">✓ تم اختيار صورة جديدة</span>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-slate-500 hover:text-blue-600 underline"
                >
                  تغيير الصورة الشخصية
                </button>
              </div>

              {/* Divider */}
              <div className="w-full border-t border-slate-100" />

              {/* Password section */}
              <div className="w-full space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  <span>تغيير كلمة المرور</span>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="كلمة المرور الجديدة"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 pr-3 pl-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPassword && (
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="تأكيد كلمة المرور"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  )}
                </div>
              </div>

              {/* Error / Success */}
              {error && (
                <p className="w-full text-xs text-red-600 bg-red-50 rounded px-3 py-2 text-center">{error}</p>
              )}
              {success && (
                <p className="w-full text-xs text-green-700 bg-green-50 rounded px-3 py-2 flex items-center justify-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> تم الحفظ بنجاح
                </p>
              )}

              {/* Buttons */}
              <div className="flex w-full gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || success}
                  className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 rounded-md border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    export default function AppLayout({ children }: { children: ReactNode }) {
      const { user, logout, hasPermission } = useAuth();
      const [location] = useLocation();
      const [sidebarOpen, setSidebarOpen] = useState(false);
      const [profileOpen, setProfileOpen] = useState(false);

      // Filter nav items: admin sees all, others see only permitted items
      const navItems = ALL_NAV_ITEMS.filter((item) => {
        if (item.permission === "admin") return user?.role === "admin";
        return hasPermission(item.permission);
      });

      const currentPage = navItems.find((item) => location.startsWith(item.path))?.label || "";

      const { data: companySettings } = useQuery<CompanySettings>({
        queryKey: ["company-settings"],
        queryFn: () => fetch(`${API_BASE}/api/settings`, { credentials: "include" }).then((r) => r.json()),
        staleTime: 1000 * 60 * 5,
      });

      const companyName = companySettings?.name || "Company Portal";
      const companyLogo = companySettings?.logoUrl || "";

      useEffect(() => { setSidebarOpen(false); }, [location]);

      useEffect(() => {
        if (!sidebarOpen) return;
        const handler = (e: MouseEvent) => {
          const sidebar = document.getElementById("app-sidebar");
          if (sidebar && !sidebar.contains(e.target as Node)) setSidebarOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
      }, [sidebarOpen]);

      const LogoArea = ({ compact }: { compact?: boolean }) => (
        <div className="flex h-14 items-center gap-2 border-b border-slate-700/50 px-4">
          {companyLogo ? (
            <img src={companyLogo} alt="شعار الشركة" className={`shrink-0 object-contain ${compact ? "h-8 w-8" : "h-9 w-auto max-w-[36px]"}`} />
          ) : (
            <Building2 className="h-6 w-6 shrink-0 text-blue-400" />
          )}
          {!compact && <span className="text-base font-bold text-white tracking-wide truncate">{companyName}</span>}
        </div>
      );

      const UserFooter = ({ compact }: { compact?: boolean }) => (
        <div className="border-t border-slate-700/50 p-3">
          {compact ? (
            <div className="flex flex-col items-center gap-2">
              <UserAvatar
                photoUrl={user?.photoUrl} name={user?.fullName || user?.username} size="sm"
                clickable onClick={() => setProfileOpen(true)}
              />
              <button onClick={logout} className="rounded p-1.5 text-slate-400 hover:bg-[#162d4a] hover:text-white" title="تسجيل الخروج">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <UserAvatar
                photoUrl={user?.photoUrl} name={user?.fullName || user?.username}
                clickable onClick={() => setProfileOpen(true)}
              />
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-sm font-medium text-white">{user?.fullName || user?.username}</span>
                <span className="truncate text-xs text-slate-400">{user?.role === "admin" ? "مدير" : "مستخدم"}</span>
              </div>
              <button onClick={logout} className="rounded p-1.5 text-slate-400 hover:bg-[#162d4a] hover:text-white" title="تسجيل الخروج">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      );

      const SidebarContent = ({ compact }: { compact?: boolean }) => (
        <>
          <LogoArea compact={compact} />
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className={`space-y-1 ${compact ? "px-1" : "px-2"}`}>
              {navItems.map((item) => {
                const isActive = location.startsWith(item.path);
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      title={compact ? item.label : undefined}
                      className={`flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors ${compact ? "justify-center px-2" : "px-3"} ${isActive ? "bg-[#1e3a5f] text-white border-r-2 border-blue-400" : "hover:bg-[#162d4a] hover:text-white"}`}
                    >
                      <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                      {!compact && item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <UserFooter compact={compact} />
        </>
      );

      return (
        <div dir="rtl" className="flex h-[100dvh] w-full overflow-hidden bg-[#f1f5f9] text-slate-900">

          {/* Desktop sidebar */}
          <aside className="hidden lg:flex w-64 flex-col bg-[#0f2240] text-slate-300">
            <SidebarContent />
          </aside>

          {/* Tablet sidebar */}
          <aside className="hidden md:flex lg:hidden w-16 flex-col bg-[#0f2240] text-slate-300">
            <SidebarContent compact />
          </aside>

          {/* Mobile overlay */}
          {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" aria-hidden="true" />}
          <aside
            id="app-sidebar"
            className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-[#0f2240] text-slate-300 shadow-2xl transition-transform duration-300 md:hidden ${sidebarOpen ? "translate-x-0" : "translate-x-full"}`}
          >
            <div className="flex h-14 items-center justify-between border-b border-slate-700/50 px-4">
              <div className="flex items-center gap-2">
                {companyLogo ? (
                  <img src={companyLogo} alt="شعار" className="h-8 w-auto max-w-[32px] object-contain" />
                ) : (
                  <Building2 className="h-6 w-6 text-blue-400" />
                )}
                <span className="text-base font-bold text-white truncate max-w-[160px]">{companyName}</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="rounded p-1.5 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
              <ul className="space-y-1 px-2">
                {navItems.map((item) => {
                  const isActive = location.startsWith(item.path);
                  return (
                    <li key={item.path}>
                      <Link href={item.path}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-[#1e3a5f] text-white border-r-2 border-blue-400" : "hover:bg-[#162d4a] hover:text-white"}`}
                      >
                        <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <UserFooter />
          </aside>

          {/* Main content */}
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <header className="flex h-14 items-center justify-between border-b bg-white px-4 shadow-sm gap-3">
              <button className="md:hidden rounded p-1.5 text-slate-600 hover:bg-slate-100" onClick={() => setSidebarOpen(true)} aria-label="فتح القائمة">
                <Menu className="h-5 w-5" />
              </button>

              <h1 className="text-base font-bold text-slate-800 truncate">{currentPage}</h1>

              {/* User info in header — avatar is clickable */}
              <div className="hidden sm:flex items-center gap-2.5 shrink-0">
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-700 leading-tight">{user?.fullName || user?.username || "المستخدم"}</p>
                  <p className="text-xs text-slate-400 leading-tight">{user?.role === "admin" ? "مدير" : "مستخدم"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                  title="تعديل الملف الشخصي"
                >
                  <UserAvatar photoUrl={user?.photoUrl} name={user?.fullName || user?.username} size="md" clickable />
                </button>
              </div>
            </header>

            <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
              <div className="mx-auto max-w-7xl">{children}</div>
            </main>
          </div>

          {/* Profile dialog */}
          <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
        </div>
      );
    }
    