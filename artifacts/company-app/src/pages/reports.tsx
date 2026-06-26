import React from "react";
import AppLayout from "@/components/AppLayout";
import { FileText } from "lucide-react";

export default function ReportsPage() {
  const reports = [
    { title: "تقرير المبيعات", desc: "تحليل شامل لمبيعات العملاء والإيرادات" },
    { title: "تقرير المشتريات", desc: "تفاصيل أوامر شراء الموردين والمصروفات" },
    { title: "تقرير الحسابات", desc: "كشف حساب تفصيلي للأرصدة والمعاملات" },
    { title: "تقرير المخزون", desc: "حالة المخزون، الوارد والمنصرف" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">التقارير</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {reports.map((report, i) => (
            <button 
              key={i} 
              className="flex flex-col items-center text-center p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">{report.title}</h3>
              <p className="text-sm text-slate-500">{report.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
