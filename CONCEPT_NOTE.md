# 🇲🇼 EXECUTIVE CONCEPT NOTE & PROJECT PROPOSAL

**PROJECT TITLE:** SchoolOS Malawi & EduSearch Network  
**SUBTITLE:** Integrated Digital School Management System (B2B) & Public School Discovery Network (B2C) for Malawian Secondary Education  
**NATIONAL ALIGNMENT:** *Malawi 2063 (MW2063) — Enabler 5: Human Capital Development & Digitalisation*  
**LIVE PROTOTYPE:** [https://school-os-mw.onrender.com](https://school-os-mw.onrender.com)  

---

## 1. Executive Summary

Malawian secondary education is undergoing a vital transformation toward digital public infrastructure. However, the majority of secondary schools—particularly Community Day Secondary Schools (CDSS) and conventional public schools—continue to rely on manual, paper-based processes for student record-keeping, grading, fee tracking, and parent communication.

**SchoolOS Malawi** is a comprehensive, cloud-native School Management System (SMS) and Public Discovery Network specifically engineered for Malawian secondary schools. It operates seamlessly across low-bandwidth mobile devices, tablets, and desktop browsers, requiring zero hardware installation.

By digitizing school operations, automating Malawi Senior MSCE (1–9 Points) and Junior JCE grading, integrating mobile money fee reconciliation, and providing a public school discovery portal, **SchoolOS Malawi** bridges the digital divide between schools, parents, and government education divisions.

---

## 2. The Problem Statement

1. **Inefficient Paper-Based Grading & PDF Generation:** Teachers spend up to 40 hours per term manually calculating grades, computing class ranks, and handwriting report cards.
2. **Fee Collection & Revenue Leakage:** Schools suffer significant financial defaults due to un-tracked fee ledgers and lack of automated payment verification.
3. **Communication Gap with Parents:** Parents in rural and urban areas are often unaware of student absences or fee balances until the end of term.
4. **Lack of Transparent Public School Data:** Prospective parents have no centralized platform to search for verified secondary schools, compare facilities, or apply for admission online.

---

## 3. System Architecture & Core Modules

The platform is split into two interconnected engines:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SchoolOS Malawi Architecture                    │
├───────────────────────────────────┬────────────────────────────────────┤
│   B2B: School Administration (SMS)│  B2C: Public & Parent Engagement   │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Senior MSCE & Junior JCE Grading│ • GPS "Schools Near Me" Finder     │
│ • Fee Ledger & Mobile Money Gate  │ • Side-by-Side School Comparer     │
│ • Daily Attendance & Alert Engine │ • Parent Self-Service Web Portal   │
│ • Staff Payroll, PAYE & Pension   │ • Online Admission Applications    │
│ • Master Timetable Scheduler      │ • School Announcement Board        │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Key Functional Capabilities:

- **Automated MSCE & JCE Grading Engine:** Computes subject grades (Points 1–9 for Senior Forms 3–4; Grades A–F for Junior Forms 1–2) with customizable CAT & Exam weightings, automatically ranks students, and generates official PDF report cards in bulk ZIP archives.
- **Fintech & Fee Lock Gate:** Integrates Mobile Money reference verification (Airtel Money & TNM Mpamba). The system enforces an automated *Fee Lock Gate* that safely restricts report card access for unpaid balances unless granted administrative override.
- **Staff Payroll & HR Suite:** Automates monthly staff salary computations, including Malawian PAYE tax bands, 5% MIPF pension deductions, leave day balances, and digital payslip generation.
- **Parent Self-Service Portal (`parent-portal.html`):** Parents log in using their registered phone number and school code to view real-time fee balances, last 30-day attendance records, marks, and school notices.
- **Public Discovery & Comparison Network (`explore.html`):** A public portal featuring HTML5 GPS geolocation (Haversine formula distance calculation), district filters (Blantyre, Lilongwe, Zomba, Mzuzu, etc.), verified facility badges, and a 3-school side-by-side comparison tool.

---

## 4. Proposed Phase 1 Pilot Implementation

To demonstrate system efficacy, we propose a **Free 1-Term Pilot Project** across 3 secondary schools in a selected Education Division:

| School Type | Pilot Objective | Target Metrics |
| :--- | :--- | :--- |
| **1 × CDSS (Community Day)** | Digitise marks entry & fee ledger tracking | 90% reduction in report card compilation time |
| **1 × Conventional Public School** | Daily attendance tracking & parent alert pilot | 50% decrease in unexcused student absenteeism |
| **1 × Private Secondary School** | Full Mobile Money integration & Parent Portal | 100% automated fee reconciliation rate |

---

## 5. Request for Partnership & Support

To scale **SchoolOS Malawi** into a national digital public good, we are seeking:

1. **Ministry of Education Authorization:** Official clearance to conduct the 3-school pilot project and present findings to the Directorate of Secondary Education.
2. **Innovation Hub Incubation (mHub / MUST / UNICEF Lab):** Technical mentorship, grant-writing support, and strategic connection to international EdTech funding bodies.
3. **Corporate / Telecom Partnerships:** Bulk SMS gateway integration with Airtel Malawi & TNM for feature-phone parent alerts.

---

## 6. Project Contact Information

- **Innovator / Lead Developer:** [Your Name / Organization]
- **Email / Phone:** [Your Email & Phone Number]
- **Live Interactive System Link:** [https://school-os-mw.onrender.com](https://school-os-mw.onrender.com)
- **Public Discovery Portal Link:** [https://school-os-mw.onrender.com/explore.html](https://school-os-mw.onrender.com/explore.html)
