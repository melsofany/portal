import React, { useState, useEffect } from "react";
  import { useAuth, API_BASE } from "@/lib/auth-context";
  import { useLocation } from "wouter";
  import { Eye, EyeOff } from "lucide-react";

  export default function SignInPage() {
    const { login } = useAuth();
    const [, setLocation] = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [companyName, setCompanyName] = useState("نظام إدارة الأعمال");
    const [companyLogo, setCompanyLogo] = useState("");

    useEffect(() => {
      fetch(`${API_BASE}/api/settings/public`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.name) setCompanyName(d.name);
          if (d?.logoUrl) setCompanyLogo(d.logoUrl);
        })
        .catch(() => {});
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);
      try {
        await login(email, password);
        setLocation("/dashboard");
      } catch (err: any) {
        setError(err.message || "فشل تسجيل الدخول");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div
        className="flex min-h-[100dvh] flex-col"
        style={{ background: "#f2f2f2", fontFamily: "'72', '72full', Arial, Helvetica, sans-serif" }}
      >
        {/* Top header bar */}
        <header style={{ background: "#0064d9", height: "2.75rem", display: "flex", alignItems: "center", padding: "0 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            {companyLogo && (
              <img src={companyLogo} alt="شعار" style={{ height: "1.75rem", width: "auto", objectFit: "contain", borderRadius: "0.2rem" }} />
            )}
            <span style={{ color: "white", fontSize: "0.9375rem", fontWeight: 600 }}>{companyName}</span>
          </div>
        </header>

        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
          <div style={{ width: "100%", maxWidth: "26rem" }}>

            {/* Logo / title block */}
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt="شعار الشركة"
                  style={{ height: "4rem", width: "auto", maxWidth: "12rem", objectFit: "contain", margin: "0 auto 1rem", display: "block" }}
                />
              ) : (
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "3.5rem", height: "3.5rem", borderRadius: "50%", background: "#0064d9", marginBottom: "1rem" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="white" />
                  </svg>
                </div>
              )}
              <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#32363a", margin: 0 }}>تسجيل الدخول</h1>
              <p style={{ color: "#6a6d70", fontSize: "0.8125rem", marginTop: "0.375rem" }}>
                {companyName} — أدخل بياناتك للوصول إلى النظام
              </p>
            </div>

            {/* Card */}
            <div style={{ background: "white", border: "1px solid #d9d9d9", borderRadius: "0.5rem", padding: "2rem", boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.08)" }}>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <label htmlFor="email" style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#32363a" }}>
                    البريد الإلكتروني <span style={{ color: "#bb0000" }}>*</span>
                  </label>
                  <input
                    id="email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email" required dir="ltr" placeholder="example@company.com"
                    style={{ height: "2.25rem", padding: "0 0.625rem", border: "1px solid #89919a", borderRadius: "0.25rem", fontSize: "0.875rem", color: "#32363a", outline: "none", background: "white", width: "100%", boxSizing: "border-box", transition: "border-color 0.1s" }}
                    onFocus={(e) => (e.target.style.borderColor = "#0064d9")}
                    onBlur={(e) => (e.target.style.borderColor = "#89919a")}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <label htmlFor="password" style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#32363a" }}>
                    كلمة المرور <span style={{ color: "#bb0000" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="password" type={showPassword ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password" required dir="ltr"
                      style={{ height: "2.25rem", padding: "0 2.5rem 0 0.625rem", border: "1px solid #89919a", borderRadius: "0.25rem", fontSize: "0.875rem", color: "#32363a", outline: "none", background: "white", width: "100%", boxSizing: "border-box", transition: "border-color 0.1s" }}
                      onFocus={(e) => (e.target.style.borderColor = "#0064d9")}
                      onBlur={(e) => (e.target.style.borderColor = "#89919a")}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                      style={{ position: "absolute", top: "50%", right: "0.5rem", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6a6d70", padding: "0.25rem", display: "flex", alignItems: "center" }}
                      aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ background: "#ffeaea", border: "1px solid #bb0000", borderRadius: "0.25rem", padding: "0.5rem 0.75rem", color: "#bb0000", fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 600 }}>خطأ:</span> {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{ height: "2.25rem", background: loading ? "#89919a" : "#0064d9", color: "white", border: "none", borderRadius: "0.25rem", fontSize: "0.875rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", width: "100%", transition: "background 0.15s", marginTop: "0.25rem" }}
                  onMouseEnter={(e) => { if (!loading) (e.currentTarget.style.background = "#0854a0"); }}
                  onMouseLeave={(e) => { if (!loading) (e.currentTarget.style.background = "#0064d9"); }}
                >
                  {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
                </button>
              </form>
            </div>

            <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#6a6d70", marginTop: "1.5rem" }}>
              © {new Date().getFullYear()} {companyName} — جميع الحقوق محفوظة
            </p>
          </div>
        </main>
      </div>
    );
  }
  