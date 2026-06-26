import { Link } from "wouter";
import { Building2 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4">
      <div className="mx-auto w-full max-w-md text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900 shadow-lg">
          <Building2 className="h-10 w-10 text-white" />
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground">
          مرحباً بك في البوابة
        </h1>
        <p className="mb-10 text-lg text-muted-foreground">
          سجل دخولك للوصول إلى لوحة التحكم.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-[#1e3a5f] px-8 text-sm font-medium text-white transition-colors hover:bg-[#162d4a]"
        >
          تسجيل الدخول
        </Link>
      </div>
      <div className="fixed bottom-8 text-sm text-muted-foreground">
        نظام داخلي آمن
      </div>
    </div>
  );
}
