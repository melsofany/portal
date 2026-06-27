import React from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth, API_BASE } from "./lib/auth-context";
import { setBaseUrl, setAuthTokenGetter, setDefaultCredentials } from "@workspace/api-client-react";

import SignInPage from "./pages/sign-in";
import RfqResponsePage from "./pages/rfq-response";
import DashboardPage from "./pages/dashboard";
import CustomersPage from "./pages/customers";
import SuppliersPage from "./pages/suppliers";
import ItemsPage from "./pages/items";
import CustomerQuotationsPage from "./pages/customer-quotations";
import SupplierQuotationsPage from "./pages/supplier-quotations";
import CustomerOrdersPage from "./pages/customer-orders";
import SupplierOrdersPage from "./pages/supplier-orders";
import DeliveryPermitsPage from "./pages/delivery-permits";
import AccountsPage from "./pages/accounts";
import FinancePage from "./pages/finance";
import ReportsPage from "./pages/reports";
import UsersPage from "./pages/users";
import EmployeesPage from "./pages/employees";
import WhatsAppPage from "./pages/whatsapp";
import PrivacyPolicyPage from "./pages/privacy-policy";
import CompanySettingsPage from "./pages/company-settings";
import ItemCodingPage from "./pages/item-coding";

setBaseUrl(API_BASE || null);
setAuthTokenGetter(() => {
  try { return localStorage.getItem("auth_token"); } catch { return null; }
});
setDefaultCredentials("include");

const queryClient = new QueryClient();

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center text-slate-400">
      جاري التحميل...
    </div>
  );
}

function Forbidden() {
  return (
    <div dir="rtl" className="flex h-screen flex-col items-center justify-center gap-4 text-slate-500">
      <div className="text-6xl">🚫</div>
      <h1 className="text-2xl font-bold text-slate-700">غير مصرح لك</h1>
      <p className="text-sm">ليس لديك صلاحية الوصول لهذه الصفحة.</p>
      <a href="/dashboard" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
        العودة للرئيسية
      </a>
    </div>
  );
}

/**
 * ProtectedRoute:
 * - permission: the key to check in user.permissions (admin bypasses all)
 * - adminOnly: only admin role is allowed regardless of permissions
 */
function ProtectedRoute({
  component: Component,
  permission,
  adminOnly,
}: {
  component: React.ComponentType;
  permission?: string;
  adminOnly?: boolean;
}) {
  const { user, isLoading, hasPermission } = useAuth();
  if (isLoading) return <Spinner />;
  if (!user) return <Redirect to="/sign-in" />;
  if (adminOnly && user.role !== "admin") return <Forbidden />;
  if (permission && !hasPermission(permission)) return <Forbidden />;
  return <Component />;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner />;

  return (
    <Switch>
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/login" component={() => <Redirect to="/sign-in" />} />
      <Route path="/rfq/:token" component={RfqResponsePage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/" component={() => (user ? <Redirect to="/dashboard" /> : <Redirect to="/sign-in" />)} />

      <Route path="/dashboard"           component={() => <ProtectedRoute component={DashboardPage}            permission="dashboard"      />} />
      <Route path="/customers"           component={() => <ProtectedRoute component={CustomersPage}            permission="customers"      />} />
      <Route path="/suppliers"           component={() => <ProtectedRoute component={SuppliersPage}            permission="suppliers"      />} />
      <Route path="/items"               component={() => <ProtectedRoute component={ItemsPage}                permission="suppliers"      />} />
      <Route path="/item-coding"         component={() => <ProtectedRoute component={ItemCodingPage}           permission="quotations"     />} />
      <Route path="/customer-quotations" component={() => <ProtectedRoute component={CustomerQuotationsPage}   permission="quotations"     />} />
      <Route path="/supplier-quotations" component={() => <ProtectedRoute component={SupplierQuotationsPage}   permission="quotations"     />} />
      <Route path="/customer-orders"     component={() => <ProtectedRoute component={CustomerOrdersPage}       permission="customerOrders" />} />
      <Route path="/supplier-orders"     component={() => <ProtectedRoute component={SupplierOrdersPage}       permission="supplierOrders" />} />
      <Route path="/delivery-permits"    component={() => <ProtectedRoute component={DeliveryPermitsPage}      permission="customerOrders" />} />
      <Route path="/accounts"            component={() => <ProtectedRoute component={AccountsPage}             permission="finance"        />} />
      <Route path="/finance"             component={() => <ProtectedRoute component={FinancePage}              permission="finance"        />} />
      <Route path="/reports"             component={() => <ProtectedRoute component={ReportsPage}              permission="reports"        />} />
      <Route path="/employees"           component={() => <ProtectedRoute component={EmployeesPage}            permission="employees"      />} />
      <Route path="/whatsapp"            component={() => <ProtectedRoute component={WhatsAppPage}             adminOnly                   />} />
      <Route path="/users"               component={() => <ProtectedRoute component={UsersPage}                adminOnly                   />} />
      <Route path="/settings"            component={() => <ProtectedRoute component={CompanySettingsPage}      permission="settings"       />} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
