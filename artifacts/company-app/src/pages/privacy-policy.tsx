import React from "react";

export default function PrivacyPolicyPage() {
  const today = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div dir="rtl" className="min-h-screen bg-white font-sans text-slate-800">
      {/* Header */}
      <header className="bg-[#0064d9] text-white py-10 px-6 text-center">
        <h1 className="text-3xl font-bold mb-2">سياسة الخصوصية</h1>
        <p className="text-blue-100 text-sm">Privacy Policy</p>
        <p className="text-blue-200 text-xs mt-2">آخر تحديث: {today}</p>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* Intro */}
        <section>
          <p className="text-slate-600 leading-relaxed text-base">
            نحن في <strong>نظام إدارة الأعمال</strong> نلتزم بحماية خصوصيتكم وبياناتكم الشخصية.
            توضح هذه السياسة كيفية جمع المعلومات واستخدامها وحمايتها عند استخدام تطبيقنا،
            بما في ذلك خدمة إرسال الرسائل عبر WhatsApp Business API المقدمة من Meta.
          </p>
        </section>

        <hr className="border-slate-200" />

        {/* 1 */}
        <section>
          <h2 className="text-xl font-bold text-[#0064d9] mb-3">١. البيانات التي نجمعها</h2>
          <ul className="space-y-2 text-slate-600 text-sm leading-relaxed list-none">
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span><strong>بيانات الموردين والعملاء:</strong> الاسم، اسم الشركة، رقم الهاتف، رقم واتساب، البريد الإلكتروني، العنوان — يُدخلها موظفو الشركة يدوياً.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span><strong>بيانات طلبات التسعير:</strong> أوصاف البنود، الكميات، الأسعار، والمراسلات المتعلقة بها.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span><strong>بيانات المستخدمين:</strong> اسم المستخدم والبريد الإلكتروني لموظفي الشركة الذين يصلون إلى النظام.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span><strong>سجلات الرسائل:</strong> عند إرسال رسالة واتساب عبر WhatsApp Business API، نحتفظ بسجل بتاريخ ووقت الإرسال ورقم المستلم.</span></li>
          </ul>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-xl font-bold text-[#0064d9] mb-3">٢. كيف نستخدم البيانات</h2>
          <ul className="space-y-2 text-slate-600 text-sm leading-relaxed list-none">
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span>إرسال طلبات التسعير للموردين عبر WhatsApp Business API أو البريد الإلكتروني.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span>إدارة علاقات الموردين والعملاء ومتابعة عروض الأسعار والطلبات.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span>توليد التقارير الداخلية وتحليل الأسعار لدعم القرارات التجارية.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span><strong>لا نستخدم البيانات</strong> لأغراض التسويق أو بيعها لأطراف ثالثة.</span></li>
          </ul>
        </section>

        {/* 3 — WhatsApp specific */}
        <section className="bg-green-50 border border-green-200 rounded-xl p-6">
          <h2 className="text-xl font-bold text-green-800 mb-3">٣. استخدام WhatsApp Business API</h2>
          <p className="text-green-900 text-sm leading-relaxed mb-3">
            يستخدم هذا التطبيق <strong>WhatsApp Business API</strong> المقدمة من Meta Platforms, Inc.
            لإرسال رسائل تجارية للموردين المسجلين في النظام فقط. فيما يلي تفاصيل الاستخدام:
          </p>
          <ul className="space-y-2 text-green-900 text-sm leading-relaxed list-none">
            <li className="flex gap-2"><span className="font-bold shrink-0">•</span><span><strong>نوع الرسائل:</strong> رسائل تجارية فقط (طلبات تسعير، متابعة عروض أسعار). لا يتم إرسال رسائل تسويقية أو إعلانية.</span></li>
            <li className="flex gap-2"><span className="font-bold shrink-0">•</span><span><strong>المستلمون:</strong> موردون تجاريون أبدوا موافقتهم على تلقي المراسلات التجارية من خلال علاقتهم التجارية القائمة معنا.</span></li>
            <li className="flex gap-2"><span className="font-bold shrink-0">•</span><span><strong>البيانات المُرسَلة عبر API:</strong> رقم هاتف المستلم ونص الرسالة فقط. لا يتم مشاركة أي بيانات شخصية إضافية مع Meta بخلاف ما هو مطلوب لتشغيل الخدمة.</span></li>
            <li className="flex gap-2"><span className="font-bold shrink-0">•</span><span><strong>الاحتفاظ بالبيانات:</strong> يتم الاحتفاظ بسجلات الإرسال لمدة لا تتجاوز <strong>12 شهراً</strong> ثم حذفها تلقائياً.</span></li>
            <li className="flex gap-2"><span className="font-bold shrink-0">•</span><span><strong>سياسة Meta:</strong> يخضع استخدام الخدمة لـ <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" className="underline text-green-700">سياسة WhatsApp Business</a> وشروط Meta للمنصة.</span></li>
          </ul>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-xl font-bold text-[#0064d9] mb-3">٤. مشاركة البيانات مع أطراف ثالثة</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-2">
            <strong>لا نبيع أو نؤجر أو نشارك بياناتكم</strong> مع أطراف ثالثة لأغراض تجارية. قد نشارك البيانات فقط في الحالات التالية:
          </p>
          <ul className="space-y-2 text-slate-600 text-sm leading-relaxed list-none">
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span><strong>Meta / WhatsApp:</strong> بيانات الرسائل اللازمة لتشغيل WhatsApp Business API وفق شروطها.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span><strong>مزودو الاستضافة:</strong> البيانات مخزنة على خوادم آمنة لتشغيل الخدمة.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span><strong>المتطلبات القانونية:</strong> في حال صدور أمر قضائي أو متطلب قانوني ملزم.</span></li>
          </ul>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-xl font-bold text-[#0064d9] mb-3">٥. أمان البيانات</h2>
          <ul className="space-y-2 text-slate-600 text-sm leading-relaxed list-none">
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span>يتم تشفير الاتصالات باستخدام بروتوكول HTTPS/TLS.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span>يتم تخزين البيانات في قاعدة بيانات محمية بكلمة مرور ومقيّدة الوصول.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span>الوصول إلى النظام مقيّد بحسابات مستخدمين معتمدة فقط.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span>يتم مراجعة إجراءات الأمان بصفة دورية.</span></li>
          </ul>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-xl font-bold text-[#0064d9] mb-3">٦. الاحتفاظ بالبيانات وحذفها</h2>
          <ul className="space-y-2 text-slate-600 text-sm leading-relaxed list-none">
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span>بيانات الموردين والعملاء: تُحتفظ بها طوال فترة العلاقة التجارية + 3 سنوات.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span>سجلات الرسائل: تُحذف تلقائياً بعد 12 شهراً.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span>يمكن طلب حذف بياناتكم في أي وقت عبر التواصل معنا.</span></li>
          </ul>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-xl font-bold text-[#0064d9] mb-3">٧. حقوقكم</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-2">يحق لكم:</p>
          <ul className="space-y-2 text-slate-600 text-sm leading-relaxed list-none">
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span><strong>الاطلاع:</strong> معرفة البيانات التي نحتفظ بها عنكم.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span><strong>التصحيح:</strong> تصحيح أي بيانات غير دقيقة.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span><strong>الحذف:</strong> طلب حذف بياناتكم الشخصية.</span></li>
            <li className="flex gap-2"><span className="text-[#0064d9] font-bold shrink-0">•</span><span><strong>الإلغاء:</strong> إلغاء موافقتكم على تلقي الرسائل في أي وقت.</span></li>
          </ul>
          <p className="text-slate-500 text-xs mt-3">لممارسة هذه الحقوق، تواصلوا معنا عبر البريد الإلكتروني أدناه.</p>
        </section>

        {/* 8 — Data deletion */}
        <section className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="text-xl font-bold text-red-800 mb-3">٨. طلب حذف البيانات (Data Deletion)</h2>
          <p className="text-red-900 text-sm leading-relaxed mb-3">
            وفقاً لمتطلبات Meta وسياسة WhatsApp Business، يمكن لأي مستخدم أو مورد طلب حذف بياناته الشخصية من نظامنا.
          </p>
          <p className="text-red-900 text-sm leading-relaxed mb-2">
            <strong>للتقديم بطلب الحذف:</strong> أرسل بريداً إلكترونياً يتضمن اسمك ورقم هاتفك إلى:
          </p>
          <div className="bg-white border border-red-200 rounded-lg px-4 py-3 text-center">
            <a href="mailto:privacy@company.com" className="text-[#0064d9] font-bold text-base underline">
              privacy@company.com
            </a>
          </div>
          <p className="text-red-700 text-xs mt-3">
            سيتم معالجة الطلب خلال <strong>30 يوم عمل</strong> وسنرسل لكم تأكيداً بالحذف.
          </p>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-xl font-bold text-[#0064d9] mb-3">٩. ملفات تعريف الارتباط (Cookies)</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            يستخدم التطبيق ملف تعريف ارتباط واحد (<code className="bg-slate-100 px-1 rounded text-xs">auth_token</code>) لتسجيل الدخول والمصادقة فقط.
            لا نستخدم ملفات تتبع أو تحليلات أو إعلانات.
          </p>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-xl font-bold text-[#0064d9] mb-3">١٠. التغييرات على سياسة الخصوصية</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            قد نُحدّث هذه السياسة من وقت لآخر. سيتم إخطار المستخدمين بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار داخل التطبيق.
            يُعدّ استمرار استخدامكم للتطبيق موافقةً على السياسة المحدّثة.
          </p>
        </section>

        {/* Contact */}
        <section className="bg-slate-50 border border-slate-200 rounded-xl p-6">
          <h2 className="text-xl font-bold text-slate-700 mb-3">التواصل معنا</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-4">
            لأي استفسارات تتعلق بسياسة الخصوصية أو طلبات البيانات، تواصل معنا:
          </p>
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex gap-3 items-center">
              <span className="font-semibold w-32 shrink-0">البريد الإلكتروني:</span>
              <a href="mailto:privacy@company.com" className="text-[#0064d9] underline">privacy@company.com</a>
            </div>
            <div className="flex gap-3 items-center">
              <span className="font-semibold w-32 shrink-0">الشركة:</span>
              <span>نظام إدارة الأعمال</span>
            </div>
          </div>
        </section>

        <hr className="border-slate-200" />
        <p className="text-center text-xs text-slate-400 pb-4">
          © {new Date().getFullYear()} نظام إدارة الأعمال — جميع الحقوق محفوظة
        </p>
      </main>
    </div>
  );
}
