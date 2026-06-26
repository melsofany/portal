# ALKHEDIVI Portal

نظام إدارة أعمال متكامل (ERP) باللغة العربية لشركة ALKHEDIVI — يشمل العملاء، الموردين، عروض الأسعار، أوامر الشراء، تصاريح التسليم، الحسابات، التقارير، والمزيد.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm --filter @workspace/company-app run dev` — run the React frontend (port 25341, proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild lib declarations (run after changing lib/* packages)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Wouter routing + TanStack Query + Tailwind CSS + shadcn/ui, Arabic RTL
- API: Express 5, JWT auth (bcrypt + jsonwebtoken), cookies + localStorage token
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/company-app/src/` — React frontend
  - `pages/` — one file per page (dashboard, customers, suppliers, orders, etc.)
  - `components/` — shared UI (AppLayout, sidebar, etc.)
  - `lib/auth-context.tsx` — JWT auth context + `API_BASE` constant
- `artifacts/api-server/src/` — Express backend
  - `routes/` — one file per resource (auth, customers, suppliers, customer-orders, accounts, dashboard, etc.)
  - `middlewares/authMiddleware.ts` — JWT bearer token verification
- `lib/db/src/schema/` — Drizzle ORM table definitions (source of truth for DB schema)
- `lib/api-client-react/src/` — generated React Query hooks + custom fetch
- `lib/api-spec/` — OpenAPI spec (source of truth for API contract)

## Architecture decisions

- JWT stored in both cookie and localStorage; `Authorization: Bearer` header sent on every request
- `setDefaultCredentials("include")` set globally so cookies are also sent cross-origin
- No standalone `items` table — items come from `customer_quotation_items` via the `/api/items` route
- Dashboard stats are computed on-the-fly from multiple tables (no dedicated stats table)
- All Arabic RTL — `dir="rtl"` on `<html>`, Tailwind configured for RTL

## Product

- **تسجيل الدخول**: admin@company.com / admin123
- **العملاء**: إدارة بيانات العملاء (6 عملاء تجريبيون)
- **الموردون**: إدارة الموردين وفئاتهم (5 موردين، 5 فئات)
- **عروض الأسعار**: عروض أسعار العملاء والموردين
- **أوامر الشراء**: تتبع أوامر العملاء والموردين (6 أوامر)
- **الحسابات والفواتير**: إصدار الفواتير وتتبع المدفوعات (3 فواتير)
- **الداشبورد**: إحصائيات مجمّعة من جميع الجداول

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/*` packages, always run `pnpm run typecheck:libs` before restarting the frontend workflow
- `setDefaultCredentials` was missing from the initial `lib/api-client-react` — added it to `custom-fetch.ts` manually
- `customer_orders` table has NO `quotation_id` column — order-quotation links live in `customer_order_items`
- Invoices have a FK to `customer_orders(id)` — always insert orders before invoices when seeding
- `python3` not available in shell — use `node` for JSON parsing in bash scripts

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Original app live at: https://portal-app-7n41.onrender.com/dashboard
- Source: https://github.com/melsofany/portal
