import React, { ReactNode, useState, useEffect } from "react";
  import { useAuth } from "@/lib/auth-context";
  import { Link, useLocation } from "wouter";
  import { useQuery } from "@tanstack/react-query";
  import {
    LayoutDashboard, Users, Truck, FileText, ShoppingCart,
    PackageCheck, ReceiptText, Wallet, BarChart3, UserCog,
    MessageCircle, Building2, LogOut, List, Menu, X, Settings,
  } from "lucide-react";

  const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

  const navItems = [
    { label: "لوحة التحكم",         path: "/dashboard",           icon: LayoutDashboard },
    { label: "العملاء",              path: "/customers",           icon: Users },
    { label: "الموردين",             path: "/suppliers",           icon: Truck },
    { label: "البنود",               path: "/items",               icon: List },
    { label: "طلبات تسعير العملاء", path: "/customer-quotations", icon: FileText },
    { label: "طلبات تسعير الموردين",path: "/supplier-quotations", icon: FileText },
    { label: "أوامر شراء العملاء",  path: "/customer-orders",     icon: ShoppingCart },
    { label: "أوامر شراء الموردين", path: "/supplier-orders",     icon: PackageCheck },
    { label: "إذون التسليم",         path: "/delivery-permits",    icon: ReceiptText },
    { label: "الحسابات",             path: "/accounts",            icon: Wallet },
    { label: "الماليات",             path: "/finance",             icon: BarChart3 },
    { label: "التقارير",             path: "/reports",             icon: BarChart3 },
    { label: "الموظفين",             path: "/employees",           icon: UserCog },
    { label: "الواتساب",             path: "/whatsapp",            icon: MessageCircle },
    { label: "الإعدادات",            path: "/settings",            icon: Settings },
  ];

  interface CompanySettings { id: number; name: string; logoUrl: string; }

  function UserAvatar({ photoUrl, name, size = "md" }: { photoUrl?: string | null; name?: string | null; size?: "sm" | "md" }) {
    const dim = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
    const initial = (name || "U")[0]?.toUpperCase();
    if (photoUrl) {
      return <img src={photoUrl} alt={name || ""} className={`${dim} rounded-full object-cover shrink-0 border-2 border-white/20`} />;
    }
    return (
      <div className={`${dim} rounded-full bg-blue-600 flex items-center justify-center font-medium text-white shrink-0`}>
        {initial}
      </div>
    );
  }

  export default function AppLayout({ children }: { children: ReactNode }) {
    const { user, logout } = useAuth();
    const [location] = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
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
            <UserAvatar photoUrl={user?.photoUrl} name={user?.fullName || user?.username} size="sm" />
            <button onClick={logout} className="rounded p-1.5 text-slate-400 hover:bg-[#162d4a] hover:text-white" title="تسجيل الخروج">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <UserAvatar photoUrl={user?.photoUrl} name={user?.fullName || user?.username} />
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

        {/* Tablet sidebar — icons only */}
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

            {/* User info in header */}
            <div className="hidden sm:flex items-center gap-2.5 shrink-0">
              <div className="text-left">
                <p className="text-sm font-medium text-slate-700 leading-tight">{user?.fullName || user?.username || "المستخدم"}</p>
                <p className="text-xs text-slate-400 leading-tight">{user?.role === "admin" ? "مدير" : "مستخدم"}</p>
              </div>
              <UserAvatar photoUrl={user?.photoUrl} name={user?.fullName || user?.username} size="md" />
            </div>
          </header>

          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    );
  }
  