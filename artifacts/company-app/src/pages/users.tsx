import React from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";

export default function UsersPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">المستخدمين</h1>
          <Button className="bg-[#1e3a5f] hover:bg-[#162d4a]">+ إضافة مستخدم جديد</Button>
        </div>
        
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3 font-medium text-slate-500">الاسم</th>
                <th className="px-6 py-3 font-medium text-slate-500">البريد الإلكتروني</th>
                <th className="px-6 py-3 font-medium text-slate-500">الدور</th>
                <th className="px-6 py-3 font-medium text-slate-500">الحالة</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-8 text-slate-400 text-center" colSpan={4}>لا توجد بيانات حتى الآن</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
