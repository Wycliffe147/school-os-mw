# 🎓 Project Roadmap — School Management System & Educational Marketplace

> **Project:** `report-generator-web`
> **Current State:** Phase 1 (Live) — Multi-Tenant Student Report Card Generator & WhatsApp Delivery Engine
> **Ultimate Vision:** A nationwide two-sided educational platform connecting schools (B2B) and parents (B2C) across Malawi and Sub-Saharan Africa.

---

## 🌐 The Big Picture

This project will evolve in two parallel directions:

- **B2B (School Operations):** A full School Management System (SMS) that schools subscribe to for managing students, marks, fees, attendance, and parent communication.
- **B2C (Parent Discovery):** A public-facing school finder and comparison network where parents can locate schools near them by GPS, compare MSCE performance, view verified fee structures, and apply for admissions — far beyond what Google Maps can offer.

The more schools use the B2B system, the richer and more trusted the public B2C directory becomes. This creates a self-reinforcing growth flywheel.

---

## 📌 Phase 1 — Current Baseline: Report Card Engine ✅ LIVE

> *Goal: Stable, secure, production-ready multi-tenant report card generation.*

### Features (Done)
- [x] Multi-tenant SaaS architecture (SuperAdmin provisions isolated school tenants)
- [x] Role-based access control: SuperAdmin, Admin, Class Teacher, Subject Teacher
- [x] Student registry with subject enrollment
- [x] Dual national grading: MSCE (Senior, Form 3 & 4) + JCE (Junior, Form 1 & 2)
- [x] Marks grid with per-teacher, per-subject access restrictions
- [x] Student ranking engine (class-level, MSCE points & JCE total score)
- [x] Dynamic PDF report card generator (logo, theme color, bar chart, headteacher remarks)
- [x] Bulk PDF download as ZIP
- [x] WhatsApp delivery engine (Baileys) with per-school sessions
- [x] Anti-spam delay controls for bulk WhatsApp sending
- [x] End-of-year class promotion workflow
- [x] Dual storage: MongoDB Cloud + local `db.json` offline fallback (for Termux/low-connectivity)

### Hardening To-Dos
- [x] Refactor `server.js` into modular routes (`/routes/auth.js`, `/routes/students.js`, `/routes/saas.js`, `/routes/whatsapp.js`, `/routes/staff.js`, `/routes/settings.js`, `/routes/pdf.js`)
- [x] Extract PDF logic into `/services/pdfService.js`
- [x] Enforce `process.env.JWT_SECRET` configuration with environment fallback
- [x] Remove diagnostic/debug endpoints (`/api/debug/users`, `/api/debug/reset-password`)
- [x] Add rate limiting on `/api/login` to prevent brute-force attacks
- [ ] Refactor monolithic `dbCache` to per-collection atomic MongoDB operations for better multi-school scaling

---

## 📌 Phase 2 — Immediate High-Value Operations & WhatsApp Bot (B2B)

> *Goal: Double system value. Solve fee collection and real-time parent communication.*

### 2.1 Fee Ledger & Financial Gate
- [x] Create student fee ledger schema (Termly Tuition, Boarding, PTA levies, Bursary credits)
- [x] Fee payment recording interface for Bursars/Admins with instant digital receipts
- [x] **WhatsApp Fee Lock Gate:** Automatically block PDF report card delivery if student has an outstanding fee balance (with admin toggle to override)
- [ ] Automated WhatsApp fee reminder messages to parents

### 2.2 Daily Attendance Module
- [x] Teacher attendance register interface (Present, Absent, Late, Excused) — optimized for fast mobile entry
- [x] Automated WhatsApp absence alert sent to parent when child is marked absent
- [x] Attendance statistics (Days Present / Days Total) embedded on the PDF report card

### 2.3 Multi-Assessment System (CAT + Final Exams)
- [x] Support entering multiple assessment types: Weekly Tests, CATs, Mid-Term, End-of-Term
- [x] Configurable grade weighting formula (e.g. 30% Continuous Assessment + 70% Final Exam)
- [x] Historical academic records: store multi-year grade history per student (Form 1 through Form 4 full transcript)

### 2.4 Enhanced Role-Based Access Control (RBAC)
- [x] **Bursar Role:** Access restricted to Fee Management and Financial Reports only
- [x] **Discipline Master Role:** Access to attendance logs and disciplinary incident records

### 2.5 WhatsApp Parent Self-Service Bot
- [x] Parent sends `"FEES"` → receives current fee balance and payment details automatically
- [x] Parent sends `"REPORT"` → receives their child's latest PDF report card automatically (subject to Fee Lock Gate)
- [x] Parent sends `"ATTEND"` → receives their child's current attendance summary

---

## 📌 Phase 3 — Enterprise SMS & Financial Automation (B2B)

> *Goal: Become an indispensable, full School Management System schools cannot operate without.*

### 3.1 Mobile Money Integration (Malawi)
- [x] Integrate Airtel Money API for automated payment verification and reconciliation
- [x] Integrate TNM Mpamba API for automated payment verification and reconciliation
- [x] Auto-update student fee ledger when payment reference is confirmed by mobile money gateway

### 3.2 Timetable & Class Scheduler
- [x] Automated master timetable generator (teachers, subjects, classrooms, time slots)
- [x] Exam schedule and invigilation roster planner
- [x] Teacher workload balancing (prevent over-scheduling)

### 3.3 Staff Payroll & HR Module
- [x] Full staff profile directory (qualifications, national ID, employment type, contact info, emergency contacts)
- [x] Teacher attendance and leave day tracking
- [x] Monthly payslip generator: Basic Pay, allowances, PAYE tax deductions, pension contributions, net pay

### 3.4 Web Parent Self-Service Portal
- [x] Dedicated parent login portal (separate from teacher/admin dashboard)
- [x] Parents log in using registered phone number + school code
- [x] Child fee balance and full payment history view
- [x] Child attendance summary (present/absent/late) with last 30-day records
- [x] Child subject marks and grades panel
- [x] School notices / announcements board (admin posts, parents read)
- [x] Session persistence with sessionStorage (stay logged in after refresh)

---

## 📌 Phase 4 — The Grand Vision: Public School Discovery & Comparison Network 🌐 (B2C)

> *Goal: Become the definitive educational network connecting parents and schools across Malawi. Think Google Maps for schools — but with real, verified, live data schools cannot fake.*

### 4.1 Geolocation & "Schools Near Me" Finder
- [x] Public-facing discovery portal (`public/explore.html`)
- [x] HTML5 Geolocation API / GPS-based school search ("Find schools near me") with Haversine km calculations
- [x] District / City search filters (Blantyre, Lilongwe, Zomba, Mzuzu, Kasungu, etc.)
- [x] Interactive school list view sorted by GPS distance or rating

### 4.2 Rich Verified School Profiles
- [x] Public school profile data auto-populated from tenant's live system data
- [x] Subject offerings, facilities checklist (Science Labs, Computer Lab, Boarding)
- [x] Estimated termly fees and contact details

### 4.3 Academic Performance & School Comparison Engine
- [x] **Side-by-side school comparer:** Select up to 3 schools and compare fees, facilities, badges, and teacher ratios
- [x] **Verified Achievement Badges:** Automatically calculated from live school records

### 4.4 Online Admission & Parent Engagement Engine
- [x] **"Apply for Admission" button** on public school cards
- [x] School admin receives applications in their dashboard (`📥 Applications` tab) to accept/reject
- [x] Parent reviews and ratings module

---

## 📝 Future Backlog — Deferred (Far Future)

> These features are noted for consideration far down the line after the core SMS and public marketplace have solid adoption.

- **Textbook & Asset Inventory Ledger:** Track textbook distribution (serial numbers/barcodes), end-of-term return audits, and automatic lost-book fines posted to the student fee ledger.
- **Government / Ministry of Education Integration:** Automated submission of school performance reports directly to Malawi's MoE data portals.
- **Student Online Exam / Quiz Engine:** In-browser computer-based testing (CBT) for schools with computer labs.

---

## 💰 Commercial Targets (Malawi Kwacha — MWK)

| Milestone | Active Schools | Monthly Revenue | Annual Revenue (ARR) |
| :--- | :--- | :--- | :--- |
| Phase 1 Launch | 20 schools | MK 1,225,000 | **MK 14.7 Million** |
| Regional Growth | 100 schools | MK 7,875,000 | **MK 94.5 Million** |
| National Scale | 500 schools | MK 43,750,000 | **MK 525 Million** |

---

*Last Updated: September 2026*
