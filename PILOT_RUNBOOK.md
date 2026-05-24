# Internza — Phase 0 Pilot Runbook

Design-partner pilot: **2–3 colleges**, **8–10 students**, **5 reviewers**.  
Use this as a day-by-day checklist. Check boxes as you complete each step.

---

## 0. Before you onboard anyone

### 0.1 Production URLs (fill in)

| Item | Your value |
|------|------------|
| Frontend (Vercel) | `https://________________` |
| Backend API | `https://________________/api/v1` |
| Swagger (optional) | `https://________________/api/docs` |

### 0.2 Environment checklist (operator)

- [ ] **Supabase Postgres**: `DATABASE_URL` uses **transaction pooler** (port 6543, `pgbouncer=true`) on Render/Railway
- [ ] **Supabase Storage**: bucket + `SUPABASE_URL`, `SUPABASE_BUCKET`, `SUPABASE_SERVICE_ROLE_KEY` on backend
- [ ] **Frontend**: `NEXT_PUBLIC_API_URL` points to production API (`.../api/v1`)
- [ ] **CORS**: backend `FRONTEND_URL` matches Vercel URL exactly
- [ ] **JWT**: `JWT_SECRET` set (never commit)
- [ ] Migrations applied: `npm run prisma:migrate:prod` (or deploy hook)
- [ ] Super admin account exists and you can sign in

### 0.3 Email (choose one path)

| Path | When to use |
|------|-------------|
| **A — SMTP configured** | Invites and student passwords arrive by email |
| **B — No SMTP (common in pilot)** | Copy invite links from API logs + **Student login details** dialog after cohort launch |

- [ ] Path A or B selected and documented for your team

**Without SMTP:** backend logs warn with full invite URL, e.g.  
`Invite created but email not sent to … URL: {FRONTEND_URL}/invite/{collegeId}/{token}`

### 0.4 Published project templates

Students need **published** templates for self-paced enroll; cohorts need a **published** template at creation.

- [ ] At least **1 published** project template exists (Super Admin → Templates → Publish)
- [ ] Template has tasks in DB (seed or admin create flow)

### 0.5 Support contacts

| Role | Name | Contact |
|------|------|---------|
| Pilot lead (you) | | |
| College admin #1 | | |
| College admin #2 | | |

---

## 1. Super Admin — create colleges (repeat per college)

**UI:** `/super-admin/colleges`  
**API:** `POST /api/v1/super-admin/colleges` (multipart: name, domain, primaryAdminEmail, logo)

### Per college

- [ ] **College 1** — Name: ________________ Domain: ________________  
- [ ] **College 2** — Name: ________________ Domain: ________________  
- [ ] **College 3** (optional) — Name: ________________ Domain: ________________

For each college:

1. [ ] Click **Add College** — upload logo (PNG/JPG, &lt; 2MB), set primary admin email
2. [ ] Save — note **college ID** from URL or network response: `________________`
3. [ ] If SMTP off: find invite URL (logs or resend below) and send to primary admin securely

**Resend admin invite (if needed)**  
- UI: super-admin colleges flow / API  
- `POST /api/v1/super-admin/colleges/{collegeId}/invite-admin`  
- Body: `{ "email": "admin@college.edu" }`

**Invite link format**

```text
{FRONTEND_URL}/invite/{collegeId}/{64-char-token}
```

Expires in **7 days**. One-time use after accept.

---

## 2. College Admin — accept invite & set up

**Invite landing:** `/invite/{collegeId}/{token}`  
**Setup (new user):** `/invite/setup?collegeId=…&token=…&email=…`  
**Home after login:** `/admin/colleges/{collegeId}`

### Per college admin

- [ ] Admin #1 opened invite link → **Create account** or **Sign in** (if account exists)
- [ ] Lands on college overview — logo visible in header/banner area after cohort is active
- [ ] Uploaded/updated logo if needed: overview page → **College logo** (camera icon)  
  - API: `PATCH /api/v1/admin/colleges/{collegeId}/logo` (multipart `file`)

### Create cohort

**UI:** Overview → **New cohort**  
**API:** `POST /api/v1/admin/colleges/{collegeId}/cohorts`

- [ ] Cohort name: ________________
- [ ] Published template selected
- [ ] Start / end dates set
- [ ] Optional: invite reviewer emails in wizard (`inviteReviewerEmails`) — sends REVIEWER invites (same `/invite/...` pattern)
- [ ] Cohort ID noted: ________________

### Assign reviewers to cohort

- College admin is auto-assigned as reviewer on cohort create when possible
- [ ] Confirm **Review queue** works: college admin can open `/reviewer/dashboard`
- [ ] Optional: invite faculty — **Team** → invite reviewer  
  - UI: `/admin/colleges/{collegeId}/team`  
  - API: `POST /api/v1/admin/colleges/{collegeId}/team/reviewers/invite`

**Reviewer invite link** (same shape as admin):

```text
{FRONTEND_URL}/invite/{collegeId}/{token}
```

Type in DB: `REVIEWER`. On accept, user is linked to **all existing cohorts** for that college.

---

## 3. Launch cohort — enroll students (CSV)

**UI:** Cohorts table → **Upload & launch**  
**API:** `POST /api/v1/admin/colleges/{collegeId}/cohorts/{cohortId}/students/csv`  
**File:** multipart field `file`

### CSV format (required)

```csv
email,name,studentId
student1@college.edu,Ada Lovelace,S001
student2@college.edu,Bob Smith,S002
```

- [ ] CSV prepared (pilot: **3–4 students per college** → **8–10 total**)
- [ ] Upload completed — dialog shows **Student login details**
- [ ] **Copy all logins** (or rely on email if SMTP on)
- [ ] Login URL shared: `{FRONTEND_URL}/login`
- [ ] Cohort status → **ACTIVE** (automatic on successful import)

### New vs existing students

| Student type | What they receive |
|--------------|-------------------|
| **New email** | Account + **temporary password** in dialog |
| **Already on Internza** | No new password — use **existing password**; cohort plan added |

### Re-issue passwords (if needed)

- API: `POST /api/v1/admin/colleges/{collegeId}/cohorts/{cohortId}/students/issue-credentials`  
- [ ] Used only if students locked out — resets passwords for **all** cohort members

---

## 4. Student — login & complete one task loop

**Login:** `/login`  
**Student home:** `/dashboard`

### Per student (track in table)

| # | Email | College/cohort | Login OK | Saw cohort banner + logo | Submitted 1 task |
|---|-------|----------------|----------|---------------------------|------------------|
| 1 | | | [ ] | [ ] | [ ] |
| 2 | | | [ ] | [ ] | [ ] |
| 3 | | | [ ] | [ ] | [ ] |
| … | | | [ ] | [ ] | [ ] |

### Student checklist (send to each student)

1. [ ] Sign in at `{FRONTEND_URL}/login`
2. [ ] Confirm **college logo + cohort name** appear at top (when on cohort plan)
3. [ ] Open **Submissions** (`/submissions`) or **Milestones** (`/milestones`)
4. [ ] Select unlocked task
5. [ ] Upload **at least 5 screenshots** (images, max 5MB each)
6. [ ] Add PR link + reflection fields → **Submit**
7. [ ] (Optional) If also doing self-paced: use top **plan switcher** → **Self-paced** / **Start self-paced plan** (`/internship`)

**APIs touched**

- `GET /api/v1/students/dashboard?planId=` (optional plan switch)
- `POST /api/v1/students/tasks/{taskId}/screenshots` (multipart `files`)
- `POST /api/v1/students/tasks/submit` (JSON: taskId, prLink, description, screenshots[] min 5)

### Dual-plan test (optional, 1 student)

- [ ] Pick one student who already had a **self-paced** plan before cohort CSV
- [ ] Confirm switcher shows **cohort ↔ self-paced**
- [ ] Dashboard/milestones/submissions change when switching

---

## 5. Reviewer — review submissions (5 reviewers total)

**UI:** `/reviewer/dashboard` (also used by college admin as grader)  
**API:** `GET /api/v1/students/reviewer/dashboard`

### Per reviewer

| # | Email | Role | Invite accepted | Sees queue | Approved 1 | Rejected/changes 1 |
|---|-------|------|-----------------|------------|------------|---------------------|
| 1 | | college_admin | [ ] | [ ] | [ ] | [ ] |
| 2 | | reviewer | [ ] | [ ] | [ ] | [ ] |
| 3 | | reviewer | [ ] | [ ] | [ ] | [ ] |
| 4 | | | [ ] | [ ] | [ ] | [ ] |
| 5 | | | [ ] | [ ] | [ ] | [ ] |

### Reviewer actions

- [ ] Open pending submission → view screenshots / PR link
- [ ] **Approve:** `POST /api/v1/students/tasks/approve` — body `{ taskId, feedback? }`
- [ ] **Reject / changes:** `POST /api/v1/students/tasks/reject` — body `{ taskId, feedback }`
- [ ] Confirm next task unlocks for student after approval (cohort sequential tasks)

---

## 6. End-of-pilot validation (all colleges)

### Functional

- [ ] 2–3 colleges created with logos
- [ ] 8–10 students enrolled and at least **1 submission each** (or documented blocker)
- [ ] 5 reviewers performed at least **1 review each**
- [ ] Certificate ZIP tested once (optional):  
  `GET /api/v1/admin/colleges/{collegeId}/cohorts/{cohortId}/certificates`  
  (heavy — small cohort only)

### Metrics to capture (for IH / investors / tie-ups)

| Metric | Value |
|--------|-------|
| Median time: cohort launch → first student login | |
| Median time: submit → first review | |
| % students completing ≥1 approved task | |
| Admin hours saved vs previous process (interview) | |
| Would college pay for next cohort? (Y/N + quote) | |

### Known pilot limitations (do not promise beyond this)

- Email may be manual without SMTP
- No billing / payments in product
- Rate limiting not strict until Throttler guard enabled
- Large CSV / large certificate batches — run in off-hours
- Scale target: **&lt; 20 concurrent users**, not 1000

---

## 7. Incident playbook (quick fixes)

| Issue | Likely cause | Fix |
|-------|--------------|-----|
| Invite link invalid | Expired (7d) or used | Resend invite API |
| Student can’t login | Wrong password / new account | `issue-credentials` or copy from launch dialog |
| No screenshots uploading | File &gt; 5MB or wrong type | JPG/PNG/WEBP only |
| Submit fails “5 screenshots” | &lt; 5 paths uploaded | Upload all 5 before submit |
| Reviewer empty queue | Not assigned to cohort / wrong college | Re-create cohort reviewers or accept invite |
| Logo broken | Storage env / URL | Check Supabase bucket public read + `resolveStorageUrl` |
| CORS error | `FRONTEND_URL` mismatch | Align backend env with Vercel URL |

---

## 8. API quick reference

| Action | Method | Path |
|--------|--------|------|
| Sign in | POST | `/auth/signin` |
| Current user | GET | `/auth/me` |
| Create college | POST | `/super-admin/colleges` |
| Resend admin invite | POST | `/super-admin/colleges/:id/invite-admin` |
| College dashboard | GET | `/admin/colleges/:collegeId` |
| Update college logo | PATCH | `/admin/colleges/:collegeId/logo` |
| Create cohort | POST | `/admin/colleges/:collegeId/cohorts` |
| Import students CSV | POST | `/admin/colleges/:collegeId/cohorts/:cohortId/students/csv` |
| Invite reviewer | POST | `/admin/colleges/:collegeId/team/reviewers/invite` |
| Student dashboard | GET | `/students/dashboard?planId=` |
| Upload screenshots | POST | `/students/tasks/:taskId/screenshots` |
| Submit task | POST | `/students/tasks/submit` |
| Reviewer queue | GET | `/students/reviewer/dashboard` |
| Approve task | POST | `/students/tasks/approve` |
| Reject task | POST | `/students/tasks/reject` |
| Validate invite | GET | `/invite/:collegeId/:token` |
| Accept invite (setup) | POST | `/invite/setup` |

---

## 9. After pilot — what to post (Indie Hackers / Product Hunt)

Only after Section 6 metrics exist:

- [ ] IH post: problem, **2–3 colleges**, screenshots, metrics table, ask for 5 more design partners
- [ ] PH launch (optional): **waitlist / book demo**, not open global student signup
- [ ] Deck slide: pilot outcomes + roadmap (email queue, dashboard perf)

---

## 10. Sign-off

| Milestone | Date | Signed |
|-----------|------|--------|
| Infra ready (Section 0) | | |
| Colleges live (Section 1–2) | | |
| Students launched (Section 3–4) | | |
| Reviews complete (Section 5) | | |
| Metrics captured (Section 6) | | |

**Pilot status:** ☐ Not started · ☐ In progress · ☐ Complete
