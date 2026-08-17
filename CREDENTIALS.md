# Test credentials

**The password is always the same as the email address.**

Local development only. Regenerate at any time with:

```bash
npx tsx --env-file=.env scripts/seed-platform.ts --reset
```

To reprint this list from whatever is currently in the database:

```bash
npx tsx --env-file=.env scripts/list-logins.ts
```

---

## Start here

| Login | Role | Sees |
|---|---|---|
| `superadmin@gmail.com` | Super admin | Every organisation. Platform console at `/admin`. |
| `admin@gmail.com` | Admin | All of Demo Company, including PII and payroll. |
| `manager@gmail.com` | Manager | Own reporting subtree, may modify it. |
| `lead@gmail.com` | Lead | Own subtree, read-only on people, approves leave. |
| `employee@gmail.com` | Employee | Self only. |
| `employee2@gmail.com` | Employee | Self only. Second employee for approval flows. |

Those six are all in **Demo Company**. The other three tenants use
`admin@<slug>.test` and `<first>.<last>@<slug>.test`.

---

## Demo Company — `/demo` · Karnataka · 18 people

| Login | Name | Role | Team |
|---|---|---|---|
| `admin@gmail.com` | Aarav Sharma | ADMIN | Human Resources |
| `manager@gmail.com` | Aditi Verma | MANAGER | Engineering |
| `lead@gmail.com` | Ananya Nair | LEAD | Engineering |
| `gauri.agarwal@demo.test` | Gauri Agarwal | LEAD | Sales |
| `kavya.khan@demo.test` | Kavya Khan | LEAD | Finance |
| `employee@gmail.com` | Arjun Iyer | EMPLOYEE | Engineering |
| `employee2@gmail.com` | Bhavna Reddy | EMPLOYEE | Engineering |
| `chirag.menon@demo.test` | Chirag Menon | EMPLOYEE | Engineering |
| `deepa.patel@demo.test` | Deepa Patel | EMPLOYEE | Engineering |
| `devansh.shah@demo.test` | Devansh Shah | EMPLOYEE | Engineering |
| `farhan.gupta@demo.test` | Farhan Gupta | EMPLOYEE | Engineering |
| `harsh.joshi@demo.test` | Harsh Joshi | EMPLOYEE | Sales |
| `ishaan.kulkarni@demo.test` | Ishaan Kulkarni | EMPLOYEE | Sales |
| `jaya.desai@demo.test` | Jaya Desai | EMPLOYEE | Sales |
| `lakshmi.singh@demo.test` | Lakshmi Singh | EMPLOYEE | Finance |
| `manish.pillai@demo.test` | Manish Pillai | EMPLOYEE | Finance |
| `meera.goyal@demo.test` | Meera Goyal | EMPLOYEE | Finance |
| `kabir.bose@demo.test` | Kabir Bose | — | Sales — **exited, cannot sign in** |

Reporting chain: Aarav (admin) → Aditi (manager) → Ananya (lead) → six engineers.

---

## Northwind Logistics — `/northwind` · Maharashtra · 20 people

| Login | Name | Role | Team |
|---|---|---|---|
| `admin@northwind.test` | Naveen Mehta | ADMIN | Human Resources |
| `nisha.saxena@northwind.test` | Nisha Saxena | MANAGER | Operations |
| `omkar.rao@northwind.test` | Omkar Rao | LEAD | Operations |
| `shreya.tiwari@northwind.test` | Shreya Tiwari | LEAD | Fleet |
| `vikram.nair@northwind.test` | Vikram Nair | LEAD | Accounts |
| `pooja.chauhan@northwind.test` | Pooja Chauhan | EMPLOYEE | Operations |
| `pranav.bhatt@northwind.test` | Pranav Bhatt | EMPLOYEE | Operations |
| `priya.kapoor@northwind.test` | Priya Kapoor | EMPLOYEE | Operations |
| `rahul.malhotra@northwind.test` | Rahul Malhotra | EMPLOYEE | Operations |
| `riya.sinha@northwind.test` | Riya Sinha | EMPLOYEE | Operations |
| `rohit.das@northwind.test` | Rohit Das | EMPLOYEE | Operations |
| `sanjay.mishra@northwind.test` | Sanjay Mishra | EMPLOYEE | Operations |
| `sneha.yadav@northwind.test` | Sneha Yadav | EMPLOYEE | Fleet |
| `tara.naidu@northwind.test` | Tara Naidu | EMPLOYEE | Fleet |
| `uday.ghosh@northwind.test` | Uday Ghosh | EMPLOYEE | Fleet |
| `varun.sharma@northwind.test` | Varun Sharma | EMPLOYEE | Fleet |
| `anil.menon@northwind.test` | Anil Menon | EMPLOYEE | Accounts |
| `yash.iyer@northwind.test` | Yash Iyer | EMPLOYEE | Accounts |
| `zoya.reddy@northwind.test` | Zoya Reddy | EMPLOYEE | Accounts |
| `vidya.verma@northwind.test` | Vidya Verma | — | Fleet — **exited, cannot sign in** |

---

## Saffron Retail — `/saffron` · Rajasthan · 14 people

| Login | Name | Role | Team |
|---|---|---|---|
| `admin@saffron.test` | Bina Patel | ADMIN | Human Resources |
| `girish.shah@saffron.test` | Girish Shah | MANAGER | Stores |
| `hema.gupta@saffron.test` | Hema Gupta | LEAD | Stores |
| `parth.singh@saffron.test` | Parth Singh | LEAD | Merchandising |
| `imran.agarwal@saffron.test` | Imran Agarwal | EMPLOYEE | Stores |
| `jatin.joshi@saffron.test` | Jatin Joshi | EMPLOYEE | Stores |
| `komal.kulkarni@saffron.test` | Komal Kulkarni | EMPLOYEE | Stores |
| `lalit.desai@saffron.test` | Lalit Desai | EMPLOYEE | Stores |
| `mohit.bose@saffron.test` | Mohit Bose | EMPLOYEE | Stores |
| `neha.khan@saffron.test` | Neha Khan | EMPLOYEE | Stores |
| `rekha.pillai@saffron.test` | Rekha Pillai | EMPLOYEE | Merchandising |
| `sagar.goyal@saffron.test` | Sagar Goyal | EMPLOYEE | Merchandising |
| `tanvi.mehta@saffron.test` | Tanvi Mehta | EMPLOYEE | Merchandising |
| `umesh.saxena@saffron.test` | Umesh Saxena | — | Merchandising — **exited, cannot sign in** |

Rajasthan levies **no professional tax** — use this org to check that a
disabled statutory component behaves.

---

## Kaveri Health — `/kaveri` · Tamil Nadu · 18 people

| Login | Name | Role | Team |
|---|---|---|---|
| `admin@kaveri.test` | Vandana Rao | ADMIN | Human Resources |
| `waseem.chauhan@kaveri.test` | Waseem Chauhan | MANAGER | Clinical |
| `yamini.bhatt@kaveri.test` | Yamini Bhatt | LEAD | Clinical |
| `geeta.yadav@kaveri.test` | Geeta Yadav | LEAD | Patient Support |
| `ananya.iyer@kaveri.test` | Ananya Iyer | LEAD | Billing |
| `ajay.kapoor@kaveri.test` | Ajay Kapoor | EMPLOYEE | Clinical |
| `bharti.malhotra@kaveri.test` | Bharti Malhotra | EMPLOYEE | Clinical |
| `chetan.sinha@kaveri.test` | Chetan Sinha | EMPLOYEE | Clinical |
| `divya.das@kaveri.test` | Divya Das | EMPLOYEE | Clinical |
| `ekta.mishra@kaveri.test` | Ekta Mishra | EMPLOYEE | Clinical |
| `faisal.tiwari@kaveri.test` | Faisal Tiwari | EMPLOYEE | Clinical |
| `aarav.verma@kaveri.test` | Aarav Verma | EMPLOYEE | Patient Support |
| `hitesh.naidu@kaveri.test` | Hitesh Naidu | EMPLOYEE | Patient Support |
| `indu.ghosh@kaveri.test` | Indu Ghosh | EMPLOYEE | Patient Support |
| `arjun.reddy@kaveri.test` | Arjun Reddy | EMPLOYEE | Billing |
| `bhavna.menon@kaveri.test` | Bhavna Menon | EMPLOYEE | Billing |
| `chirag.patel@kaveri.test` | Chirag Patel | EMPLOYEE | Billing |
| `aditi.nair@kaveri.test` | Aditi Nair | — | Patient Support — **exited, cannot sign in** |

---

## What each role should see

| Page | Super admin | Admin | Manager | Lead | Employee |
|---|---|---|---|---|---|
| `/admin` platform console | ✅ | — | — | — | — |
| `/dashboard` | via admin mode | ✅ | ✅ | ✅ | ✅ |
| `/employees` | via admin mode | full, incl. PII | own subtree, editable | own subtree, read-only | directory only |
| `/payroll` | via admin mode | run, approve, pay | own payslips | own payslips | own payslips |
| `/leave` | via admin mode | all + approve | team + approve | team + approve | own only |
| `/requests` | via admin mode | ✅ | → `/dashboard` | → `/dashboard` | → `/dashboard` |
| `/settings` | via admin mode | ✅ | → `/dashboard` | → `/dashboard` | → `/dashboard` |
| `/activity` | `/admin/activity` | whole org | own actions | own actions | own actions |
| `/profile` | n/a — no employee record | ✅ | ✅ | ✅ | ✅ |

---

## Super admin: admin mode

Sign in as `superadmin@gmail.com`, then either:

- click the **org switcher** in the top-left and pick an organisation, or
- go to `/admin/orgs` and press **Admin mode** on a row.

You are then that org's admin — same nav, same pages, same data — with the top
bar turned amber and marked *Acting as admin*. Platform powers stay available.
Leave via the switcher's **Platform console** entry or the sidebar link.

Entering and leaving are both recorded in `/admin/activity` as critical.

---

## Things worth testing

- **Tenant isolation** — sign in as `admin@gmail.com` (18 people, Engineering /
  Sales / Finance / HR) then `admin@northwind.test` (20 people, Operations /
  Fleet / Accounts / HR). Neither may see the other's people, departments or
  payroll.
- **Change request approval** — as `employee@gmail.com` edit something on
  `/profile` that is not the photo; it becomes a request. Approve it as
  `admin@gmail.com` at `/requests`.
- **Leave approval** — apply as `employee@gmail.com`, approve as
  `lead@gmail.com`.
- **Payroll lifecycle** — as an admin, generate → approve → mark paid, then try
  the bank advice download before and after approval.
- **Statutory config** — `/settings` → Statutory. Try slabs that overlap or
  leave a gap; both are rejected. Compare Saffron (no PT) with Kaveri (six PT
  slabs).
- **Recycle bin** — delete an employee as an admin, then restore or permanently
  delete it as the super admin at `/admin/recycle-bin`. Purge asks you to type
  the record's full label.
- **PII masking** — a manager must never see Aadhaar, PAN or bank details; an
  admin sees them masked until revealed, and each reveal is logged.

---

⚠ **Never let email-as-password reach a real environment.** These accounts
exist only for local development.
