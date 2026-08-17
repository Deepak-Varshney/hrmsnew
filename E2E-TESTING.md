# End-to-end test plan

Manual walkthrough of every feature. Work top to bottom — later sections
assume the earlier ones passed.

Password is always the same as the email. Full account list in
[CREDENTIALS.md](CREDENTIALS.md).

> Supersedes `TESTING.md`, which documents the pre-multi-tenant app and still
> covers features that were dropped (regularisation, the separate manager
> portal).

**The negative tests matter more than the positive ones.** Anyone can check
that approving leave works. The ones that earn their keep are where something
is supposed to be *refused*.

---

## 0. Setup

```bash
npx tsx --env-file=.env scripts/seed-platform.ts --reset
npm run dev
```

- [ ] Seed prints 4 organisations, 70 employees
- [ ] `http://localhost:3000` loads the sign-in page

> **Restart the dev server after any schema change.** Mongoose caches compiled
> models on the connection, so edits to a model or plugin do not take effect on
> hot reload. This has already cost hours twice.

---

## 1. Authentication

| # | Do this | Expect |
|---|---|---|
| 1.1 | Sign in as `admin@gmail.com` with a wrong password | Rejected. **If any password works, stop — that's the auth bypass regression** |
| 1.2 | Sign in correctly | Dashboard, org name top-left |
| 1.3 | Reload five times | Still signed in, no flash of a login screen |
| 1.4 | Reload after an hour | Still signed in — session is 30 days, not 1 hour |
| 1.5 | Sign out, press browser Back | Cannot reach the dashboard |
| 1.6 | Open `/dashboard` in a private window | Redirected to sign-in |
| 1.7 | Sign in as `kabir.bose@demo.test` (exited) | Refused — membership suspended |

---

## 2. Tenant isolation — the critical section

A leak here is worse than any broken feature.

| # | Do this | Expect |
|---|---|---|
| 2.1 | `admin@gmail.com` → `/employees` headcount | **18** |
| 2.2 | `admin@northwind.test` | **20**, entirely different names |
| 2.3 | `admin@saffron.test` | **14** |
| 2.4 | `admin@kaveri.test` | **18** |
| 2.5 | Demo admin → `/settings` → Master data | Only Engineering, Sales, Finance, HR — **not** Operations, Fleet, Stores |
| 2.6 | Copy an employee id from Demo's URL, open it as `admin@northwind.test` | **404** |
| 2.7 | Compare `/payroll` totals across two orgs | Different figures |
| 2.8 | `/activity` as each admin | Only their own org |

If any of these show another tenant's data, the request-context store has
broken again — see the `globalThis` note in AGENTS.md.

---

## 3. Attendance

| # | Do this | Expect |
|---|---|---|
| 3.1 | Dashboard → Check in | Timer starts, status leaves "Not marked" |
| 3.2 | Reload | Still checked in, timer continues |
| 3.3 | Check out | Total hours recorded for today |
| 3.4 | `/attendance` → Calendar | Present / WFH / half day / absent visually distinct |
| 3.5 | Toggle to Log | Same month, per-day punch times and totals |
| 3.6 | Change month | Data changes, no full-page spinner |
| 3.7 | Month stats | Working days, late days, overtime all plausible |

---

## 4. Leave

| # | Do this | Expect |
|---|---|---|
| 4.1 | `employee@gmail.com` → `/leave` | Balances for CL, SL, EL, LOP |
| 4.2 | Apply for 3 days casual leave | Pending — **balance does not drop yet** |
| 4.3 | Apply again over the same dates | **Refused** — overlap guard |
| 4.4 | Apply for more days than the balance | **Refused** |
| 4.5 | Apply across a weekend | Weekend days not counted |
| 4.6 | `lead@gmail.com` → `/leave` → Team requests | Request listed |
| 4.7 | Approve it | Employee's balance now drops |
| 4.8 | `employee2@gmail.com` → look for Team requests | Tab absent |
| 4.9 | Employee cancels a pending request | Balance untouched, request gone |

---

## 5. Employees and PII

| # | Do this | Expect |
|---|---|---|
| 5.1 | Admin → `/employees`, search a name | Filters live |
| 5.2 | Filter by department and status | Counts change sensibly |
| 5.3 | Click any row | Record opens — **not a 404** |
| 5.4 | Statutory and bank card | PAN / UAN / account **masked** (`*****805K`) |
| 5.5 | `manager@gmail.com` opens a team member | Card says not visible to a manager |
| 5.6 | Manager opens someone outside their team by URL | Redirected to `/employees` |
| 5.7 | `employee@gmail.com` opens another person's record | Redirected |
| 5.8 | Employee opens their own record by id | Allowed |
| 5.9 | `lead@gmail.com` | Can view the team, **no** edit or delete controls |

On 5.5, check the network tab — the masked values should be **absent from the
response**, not merely hidden in the UI.

---

## 6. Change requests — self-service with approval

| # | Do this | Expect |
|---|---|---|
| 6.1 | `employee@gmail.com` → `/profile`, all six tabs | Employment, Personal, Work & pay, Documents, HR notices, Security |
| 6.2 | Change the photo | Saves immediately — the only field that skips approval |
| 6.3 | Change personal phone or address | **Does not save** — becomes a pending request, form goes read-only |
| 6.4 | Try a second edit while one is pending | Refused — one open request at a time |
| 6.5 | `admin@gmail.com` → `/requests` | Old value beside new value |
| 6.6 | Approve | Written to the employee record |
| 6.7 | Back as the employee | New value visible, form editable again |
| 6.8 | Repeat, but **reject** | Value unchanged, employee can edit again |

---

## 7. Payroll

| # | Do this | Expect |
|---|---|---|
| 7.1 | `/payroll` as admin | Gross, deductions, net, employee count |
| 7.2 | One payslip | Basic + HRA + conveyance + special = gross |
| 7.3 | PF on a ₹1,60,000 gross | **₹1,800** — 12% of the ₹15,000 ceiling |
| 7.4 | Professional tax, Demo Company | **₹200** (Karnataka) |
| 7.5 | Same on `admin@saffron.test` | **No PT at all** — Rajasthan levies none |
| 7.6 | `admin@kaveri.test` | Tamil Nadu's slab applied |
| 7.7 | Net pay in words | Indian format — lakh, not million |
| 7.8 | Switch months | Three months of history |
| 7.9 | Expand employer contributions | EPS capped at the ceiling |
| 7.10 | Generate the same month twice | Idempotent — no duplicate payslips |
| 7.11 | Download the bank file **before** approving | **Refused** |
| 7.12 | Approve, then download | CSV with account numbers and IFSC, no blanks |
| 7.13 | Try to edit an approved run | Refused |
| 7.14 | `/payroll` as an employee | Own payslip only — no register, no bank file |

---

## 8. Settings

| # | Do this | Expect |
|---|---|---|
| 8.1 | `/settings` as admin | Three tabs |
| 8.2 | Edit legal name, save, reload | Persisted |
| 8.3 | Try to edit the URL key | Disabled — it's the tenant key |
| 8.4 | Statutory → change a PF rate, save | Saved, and logged as critical in `/activity` |
| 8.5 | Make two PT slabs overlap | **Refused**, message names the rupee value |
| 8.6 | Leave a gap between slabs | **Refused** |
| 8.7 | Make the first slab start above zero | **Refused** |
| 8.8 | Master data → add a department | Appears with 0 people |
| 8.9 | Add another with the same code | **Refused** |
| 8.10 | Delete the empty one | Removed |
| 8.11 | Delete a department that has people | **Refused**, says how many |
| 8.12 | Deactivate one instead | Marked inactive, still listed |
| 8.13 | `/settings` as manager / lead / employee | Redirected to `/dashboard` — never a 500 |

---

## 9. Documents

| # | Do this | Expect |
|---|---|---|
| 9.1 | Employee → Profile → Documents → upload a PDF | Appears under personal |
| 9.2 | Open the download link | File opens |
| 9.3 | Copy that URL, wait 6 minutes, open again | **Expired** |
| 9.4 | Strip the signature from the URL | 404 |
| 9.5 | Delete your own upload | Allowed |
| 9.6 | Try to delete an HR-issued document | Refused |

---

## 10. Announcements, policies, activity

| # | Do this | Expect |
|---|---|---|
| 10.1 | `/announcements` | Pinned first, unread badge in the sidebar |
| 10.2 | Admin posts one | Visible to that org's employees only |
| 10.3 | `/policies` | Grouped by category |
| 10.4 | `/activity` as admin | Every action from section 1 onward is there |
| 10.5 | Filter by role | Narrows correctly |
| 10.6 | Look for an edit or delete control | **There is none** — append-only |
| 10.7 | `/activity` as an employee | Only their own actions |

---

## 11. Super admin console

| # | Do this | Expect |
|---|---|---|
| 11.1 | Sign in as `superadmin@gmail.com` | Lands on `/admin` |
| 11.2 | `/admin/orgs` | All 4 orgs with employee and admin counts |
| 11.3 | `/admin/activity` → Admins tab | What each org's admin did, and where |
| 11.4 | Filter by organisation | Narrows to that tenant |
| 11.5 | Org switcher → Northwind | Top bar amber, "Acting as admin" |
| 11.6 | While acting → `/employees` | **20** — Northwind only |
| 11.7 | While acting → `/admin` | Still **all 4** orgs, not just Northwind |
| 11.8 | Switch to Saffron | 14 people, Saffron's departments |
| 11.9 | Platform console → exit | Back to the platform view |
| 11.10 | `/admin/activity` | `admin.mode.entered` / `.left` logged as critical |

### Recycle bin

| # | Do this | Expect |
|---|---|---|
| 11.11 | Org admin deletes an employee | Gone from the roster |
| 11.12 | Super admin → `/admin/recycle-bin` | Listed with who deleted it and when |
| 11.13 | Restore | Back on the roster, intact |
| 11.14 | Delete again, purge with a **wrong** name | **Refused** |
| 11.15 | Purge with the exact displayed label | Destroyed |
| 11.16 | `/admin/activity` | `record.purged` with a full before-snapshot |
| 11.17 | Try to purge something not yet deleted | Refused |
| 11.18 | Org admin opens `/admin` | Denied |

---

## 12. Mobile

Device toolbar at 375 px.

| # | Check |
|---|---|
| 12.1 | Bottom tab bar appears, sidebar hidden |
| 12.2 | Only the content scrolls — top bar and tabs stay put |
| 12.3 | No horizontal scrolling on any page |
| 12.4 | Tables scroll inside their own container |
| 12.5 | Payslip readable without zooming |
| 12.6 | Check-in button reachable one-handed |

---

## 13. Not bugs — known gaps

Don't raise these:

- No Form 16, PF ECR or ESI return exports
- Payslip PDF is browser print-to-PDF, not generated
- Employee record is **read-only** — edits go through the profile + approval
- Statutory rates are **not CA-verified**
- No biometric, geofencing, shift rosters or reimbursements — out of scope
- Email-as-password is a local seeding convenience only

---

## Regression suite — before every deploy

The six that catch the most damage:

1. **1.1** — a wrong password is refused
2. **2.1–2.4** — four admins, four different headcounts
3. **5.4** — PII masked, and absent from the API response
4. **6.3** — an employee edit becomes a request, not a write
5. **7.11** — bank file refused before approval
6. **11.6 / 11.7** — admin mode scopes the product but not the console
