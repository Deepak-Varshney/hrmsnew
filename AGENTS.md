# HRMS — Agent Context

Read this before writing any code in this repo.

---

## What this is

A **multi-tenant SaaS HRMS** for the Indian market. One deployment serves many
customer organizations. Started life as a single-tenant HRMS and is being
retrofitted to multi-tenant — see **Migration status** below, because that
retrofit is the single most important thing to understand about this codebase.

**Owner:** Deepak Varshney (`deepakvarshney.com@gmail.com`) — also the sole
platform Super Admin.

---

## Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.0.10**, App Router, TypeScript | ⚠️ See "Next.js 16" below |
| Runtime | Node 22 | |
| DB | MongoDB + **Mongoose 9** | ⚠️ Mongoose 9, not 8 — API differs from most training data |
| UI | shadcn/ui on **Radix** + Tailwind v4 | Not Base UI. `components/ui/` |
| Auth | Custom JWT + server-side `Session` records | Bearer token in `Authorization` header, not cookies |
| Passwords | bcrypt | |
| Files | Cloudinary (planned) | HR docs MUST use `type: "authenticated"` + signed URLs |
| Email | Resend (planned) | |
| Icons | lucide-react | |
| Toasts | sonner | |
| Theming | next-themes + custom colour picker | |

**Deliberately NOT used:** Redis, BullMQ, or any queue. At the target scale
(~5,000 monthly active users) scheduled work runs through a single protected
cron route and bulk imports are client-chunked. Do not add a queue without a
concrete reason.

### Next.js 16

This is not the Next.js most training data describes. Before writing routing,
caching, server-action, or middleware code, **verify the current API** rather
than assuming. There is no bundled docs directory in `node_modules` for this
version, so check the official docs for 16.x or read the installed type
definitions. Heed deprecation warnings in build output rather than suppressing
them.

### Mongoose 9

Also newer than most training data. Verify plugin hooks, query middleware
signatures, and `Schema` option names against the installed package before
relying on recalled APIs.

---

## Directory layout

```
app/
├── api/                  route handlers (all mutations + data fetching)
│   ├── auth/             login, logout, register
│   ├── employees/        employee CRUD
│   ├── attendance/       punch, today, history, regularisation
│   ├── leave/            apply, balance, history
│   ├── team/             manager views: overview, attendance, leave, regularisation
│   ├── reports/          attendance, leave
│   ├── policies/  announcements/  settings/  audit/  me/
├── auth/                 login + register pages
├── dashboard/  employees/  attendance/  leave/  team/
├── reports/  policies/  announcements/  audit/  settings/
components/
├── ui/                   shadcn primitives
└── DashboardLayout, Navbar, Sidebar, AttendanceCalendar, Theme*
lib/
├── mongoose.ts           cached connection
├── auth.ts               hashing, session creation, token verification
├── requireAuth.ts        bearer token guard
├── requireRole.ts        ⚠️ legacy role guard — being replaced by lib/rbac/
└── utils.ts              cn()
model/                    Mongoose models (singular folder name, not "models")
scripts/                  seed scripts
```

---

## Roles & permissions

**Role ≠ Designation.** Keep these separate; conflating them is a rewrite.

- **Role** — permission level. Fixed set: `SUPER_ADMIN`, `ADMIN`, `MANAGER`,
  `EMPLOYEE`. Lives on `Membership`, not on `User`.
- **Designation** — job title (Associate, Executive, Developer, …). Per-org
  master data. Carries zero permission meaning.

A Developer can be a MANAGER; a Sr. Developer can be an EMPLOYEE.

### Scopes

| Role | Scope | Sees |
|---|---|---|
| `SUPER_ADMIN` | platform | All orgs. Only role that can restore or permanently delete. `User.isSuperAdmin` flag; has **no** Membership. Cannot be granted via UI. |
| `ADMIN` | own org | Everything in their org incl. PII. Can soft-delete anything in the org. Can invite other admins. Cannot restore or purge. |
| `MANAGER` | own team subtree | Direct + indirect reports via `reportsTo`. **No PII** (no Aadhaar/PAN/bank). No org masters. Cannot delete self. |
| `EMPLOYEE` | self | Own record, own docs, directory (limited fields). Restricted-field edits go through a change-request approval. |

Team subtree is resolved with `$graphLookup` on `reportsTo` and cached per
request in the tenant context.

---

## Non-negotiable conventions

These are enforced by plugins. Do not bypass them.

### 1. Every document carries `orgId`
Every tenant-owned model gets `orgId` plus a compound index leading with it
(`{ orgId, ... }`). Uniqueness is always scoped per-org, never global —
employee codes are unique within an org, not across the platform.

The `tenantScope` plugin auto-injects `orgId` from request context into every
`find`, `findOne`, `count`, `aggregate`, and `save`. **Never hand-write
`orgId` into a query** — let the plugin do it, so a forgotten filter can't
leak another tenant's data. System-level operations opt out explicitly.

### 2. Soft delete everywhere
No collection is ever hard-deleted through application code. Every model has
`deletedAt`, `deletedBy`, `deletedByRole`, `deletionReason`. The `softDelete`
plugin filters `{ deletedAt: null }` by default; recycle-bin views opt in with
`.withDeleted()`.

Permanent delete is Super Admin only, and it **must write a full snapshot of
the record to `ActivityLog` before destroying the data** — that log entry
becomes the only surviving trace.

Deletes are blocked (not cascaded) when dependents exist: an employee with
reportees, a department with employees, the last admin in an org.

### 3. Every action is logged
`ActivityLog` is append-only. There is no update or delete route for it, for
anyone, including Super Admin.

- CRUD is captured automatically by the `activityLog` plugin.
- Non-CRUD events (login, failed login, document download, PII reveal, export,
  impersonation, permission denied) call `logActivity()` explicitly.
- Actor name/email and entity label are **denormalized snapshots** — if the
  actor is later removed, the log must still be readable.
- `passwordHash`, `twoFactorSecret`, `aadhaar`, `pan`, `bank.accountNumber`
  are **never** written into `changes`. Record that the field changed, not the
  value.
- Sensitive actions get `severity: "critical"` (role change, admin created,
  PII reveal, export, purge, restore, impersonation).

### 4. PII is projected, not just route-guarded
`statutory` (Aadhaar/PAN/UAN/ESIC), `bank`, and salary fields are stripped in
a single shared `serializeEmployee(employee, viewer)` function. Every route
and server component calls it. **Never hand-roll the projection per
endpoint** — one forgotten route leaks thousands of Aadhaar numbers.

Aadhaar, PAN, and bank account number are encrypted at rest and displayed
masked; revealing one writes a `critical` ActivityLog entry every time.

### 5. Money and dates
Money in **paise as integers**, never floats. Dates stored **UTC**, rendered
in the org's IANA timezone.

---

## Migration status

This repo is mid-retrofit from single-tenant to multi-tenant. Expect
inconsistency and check which side of the line a file is on.

### Done — Phase 0 foundation (branch `feat/multi-tenant-foundation`)

- **Auth bypass fixed** — `app/api/auth/login/route.ts` had its password check
  commented out on `main` (commit `423e827`, "quick bypass login for testing
  only"). Any password authenticated any user. Restored.

| Area | Files |
|---|---|
| Request context | `lib/context.ts` — `runWithContext`, `runAsSystem`, `runUnscoped`, `runInOrg` |
| Plugins | `lib/db/plugins/{tenantScope,softDelete,activityLog}.ts`, barrel exports `tenantModel` / `platformModel` |
| Activity | `lib/activity.ts` — `logActivity()`, redaction list, severity map |
| Encryption | `lib/crypto.ts` — AES-256-GCM `encryptedString` field helper |
| RBAC | `lib/rbac/{permissions,guard,scope,serialize}.ts` |
| Models (new) | `Organization`, `Membership`, `ActivityLog`, `Department`, `Designation`, `Location`, `Grade`, `EmploymentHistory` |
| Models (rewritten) | `User` (global + `isSuperAdmin`), `Employee` (full schema) |
| Seed | `scripts/seed-super-admin.ts`, `npm run seed:super-admin` |
| Env | `env.template` — adds `FIELD_ENCRYPTION_KEY`, `SUPER_ADMIN_*`, `CRON_SECRET`, Cloudinary, Resend |

`npm run typecheck` passes.

### Done — wiring (Phase 0b)

| Area | Files |
|---|---|
| Route context | `lib/withContext.ts` — `withContext()` for handlers, `withCronAuth()` for scheduled jobs |
| Employee services | `lib/services/employee.ts` — code generation, reporting-cycle guard, delete guards, history recording |
| Migration | `scripts/migrate-to-multi-tenant.ts`, `npm run migrate:multi-tenant -- --dry-run` |
| Retrofitted routes | `app/api/employees/route.ts`, `app/api/employees/[id]/route.ts` |

`npm run typecheck` and `npm run build` both pass.

### Data fetching — server components first

Auth lives in an **httpOnly cookie** (`hrms_session`), not just localStorage,
because server components cannot read localStorage. The bearer header still
works, so existing client fetches keep functioning.

Pages load their own data in-process. Do not fetch our own API over HTTP from
a server component:

```tsx
// app/employees/page.tsx — server component
export default async function Page({ searchParams }) {
  const params = await searchParams;                  // Next 16: a Promise
  const { session, data } = await loadWithSession(async () => {
    return { list: await listEmployees({ search: params.search }) };
  });
  return (
    <AppShell session={plain(session)}>
      <EmployeesClient employees={plain(data.list.employees)} />
    </AppShell>
  );
}
```

- `loadWithSession` / `withServerContext` (`lib/session.ts`) establish tenant
  context from the cookie, so models, plugins, and RBAC behave exactly as they
  do inside a route handler.
- **Query logic lives in `lib/services/*Queries.ts`**, called by both the page
  and its API route. Duplicating the query is how a page and its API drift into
  showing different rows.
- Mongoose documents carry ObjectIds and Dates, which cannot cross the RSC
  boundary — pass them through a `plain()` JSON round-trip.
- **Filters belong in the URL**, not component state, so the server re-renders
  and a filtered view can be linked to.
- `AppShell` is presentational and takes `session` as a prop. It does not
  fetch. An earlier version fetched `/api/me` and signed the user out on *any*
  failed response, so a transient 500 read as an expired session.

### Route conventions — follow this shape

```ts
export const GET = withContext(async (req, { params }) => {
  const scope  = can("employee.read");                 // platform|org|team|self
  const filter = await employeeFilterForScope(scope);  // → Mongo filter
  const rows   = await Employee.find(filter);          // orgId auto-injected
  return NextResponse.json({ employees: serializeEmployees(rows) });
}, { permission: "employee.read" });
```

- `withContext` resolves the org from, in order: `orgSlug` route param →
  `x-org-slug` header → `?org=` query → the user's only membership. That last
  fallback is what keeps the current flat routes working mid-migration.
- Assert the permission via the `permission` option, then narrow rows with the
  returned scope. Out-of-scope records return **404, not 403** — a 403 confirms
  the record exists.
- Never return a raw employee. Always `serializeEmployee()`.
- Throw `ValidationError` / `ConflictError` / `ForbiddenError`; `withContext`
  maps them to 400 / 409 / 403 and everything else to a generic 500.

### Next

1. **Run the migration** — `npm run migrate:multi-tenant -- --dry-run` first.
   Until it runs, no existing document has an `orgId` and the retrofitted
   employee routes will return nothing.
2. **Retrofit the remaining ~28 routes** under `app/api/` — attendance, leave,
   team, reports, policies, announcements, settings, audit, me. All still use
   `requireHR`/`requireAdmin` and are unscoped.
3. **Apply `tenantModel` to the legacy models** — Attendance, Leave,
   LeaveBalance, Policy, Announcement, Regularisation, Settings. Deliberately
   *not* done yet: adding the plugin before a model's routes are wrapped in
   `withContext` would break them, since queries would filter on an orgId that
   is not in context. Do it per-model, alongside its routes.
4. **Update the frontend** to send Employee ids rather than User ids, then
   delete the `findEmployeeByEitherId` fallback.
5. Route restructure to `/[orgSlug]/...` + `/admin/...` (super admin console).
6. Recycle bin + purge (`lib/db/purge.ts` — must snapshot to ActivityLog
   before destroying).
7. Replace `model/AuditLog.ts` reads with `ActivityLog`, then retire it.

### Legacy — needs migrating, do not extend
- `model/User.ts` — has `role: Employee|Manager|HR|Admin` inline. Role moves
  to `Membership`; there is no `HR` role in the new model (it maps to `ADMIN`).
- `model/AuditLog.ts` — superseded by `ActivityLog`. No orgId, no severity, no
  auto-capture, no denormalized actor.
- `model/Employee.ts` — 10 thin fields. Being expanded substantially.
- `lib/requireRole.ts` — `requireHR`/`requireAdmin` string checks. Replaced by
  the RBAC engine.
- **No model has `orgId` or soft-delete yet.** Every existing model and every
  existing API route needs retrofitting.

### Not built yet
Payroll (India statutory), performance, expenses, helpdesk, onboarding
checklists, assets, org chart, recycle bin UI, super admin console,
AI screening interview.

---

## AI features

Deferred. When they arrive, **all AI runs on Google Gemini** (Vertex AI,
`asia-south1` region for DPDP data residency). Do not introduce OpenAI or
Anthropic SDKs.

---

## Gotchas

- Model folder is `model/`, singular. Import alias is `@/model/X`.
- `lib/auth.ts` throws at import time if `JWT_SECRET` is unset. The error text
  says `.env.local` but the repo actually uses `.env`.
- Auth is **Bearer token**, not cookies. Tokens are client-stored.
  Single active session per user — logging in elsewhere kills the old session.
- `Employee.managerId` currently references **`User`**, not `Employee`. This is
  inconsistent with the org-chart design and needs reconciling during migration.
- Both `package-lock.json` and `pnpm-lock.yaml` are committed. The repo is
  currently used with **npm**. Pick one and delete the other.
- `scripts/` has both `seed-admin.js` and `seed-admin.ts`. The `package.json`
  script points at the `.js`.

---

## Working agreements

- **Never** append a `Co-Authored-By` trailer to commits. Deepak is sole author.
- Branch for anything non-trivial; `main` is deployable.
- Region-restricted or geo-gated behaviour keys off request geo (IP / edge
  headers), never a country field on a user or employee record.
- Before adding a dependency, check it earns its place — this stack is
  deliberately small.
