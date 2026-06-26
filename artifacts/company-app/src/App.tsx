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

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (!user) return <Redirect to="/sign-in" />;
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
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/customers" component={() => <ProtectedRoute component={CustomersPage} />} />
      <Route path="/suppliers" component={() => <ProtectedRoute component={SuppliersPage} />} />
      <Route path="/items" component={() => <ProtectedRoute component={ItemsPage} />} />
      <Route path="/customer-quotations" component={() => <ProtectedRoute component={CustomerQuotationsPage} />} />
      <Route path="/supplier-quotations" component={() => <ProtectedRoute component={SupplierQuotationsPage} />} />
      <Route path="/customer-orders" component={() => <ProtectedRoute component={CustomerOrdersPage} />} />
      <Route path="/supplier-orders" component={() => <ProtectedRoute component={SupplierOrdersPage} />} />
      <Route path="/delivery-permits" component={() => <ProtectedRoute component={DeliveryPermitsPage} />} />
      <Route path="/accounts" component={() => <ProtectedRoute component={AccountsPage} />} />
      <Route path="/finance" component={() => <ProtectedRoute component={FinancePage} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={ReportsPage} />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} />} />
      <Route path="/employees" component={() => <ProtectedRoute component={EmployeesPage} />} />
      <Route path="/whatsapp" component={() => <ProtectedRoute component={WhatsAppPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={CompanySettingsPage} />} />
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
