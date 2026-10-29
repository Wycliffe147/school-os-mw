# 1SchoolOS — Sprint Task Tracker & Action Items

> Source: Derived from meeting notes (`1SchoolOS review.md`)
> Last updated: 2026-10-29

---

## Status Key
`[ ]` Not started &nbsp;|&nbsp; `[~]` In progress &nbsp;|&nbsp; `[x]` Done &nbsp;|&nbsp; `[?]` Blocked / Needs clarification

---

## 1. Student & Guardian

- [x] **1.1 Country Code Dropdown on Phone Number Field**
  *Dropdown with 🇲🇼 Malawi (+265, default) and 🇿🇦 South Africa (+27). Auto-formats number as user types (XXX XXX XXX for MW, XX XXX XXXX for ZA). Shows ✅/❌ validity indicator based on digit count.*

- [x] **1.2 Display Guardian Name Alongside Phone Number**
  *Added `guardianName` field to registration form, DB schema, and student table. Displayed as its own column in both read-only and edit modes.*

- [x] **1.3 Support Multiple Contact Numbers per Guardian / Student**
  *Dynamic phone entry UI with "+ Add another number" button. Each entry has its own country code dropdown + formatted input. Stored as `phones[]` array; primary phone kept in `phone` for backward compatibility.*

- [x] **1.4 New Students Appear at the Bottom of the List**
  *Changed student table sort from alphabetical (`a.name.localeCompare`) to insertion order (`Number(a.id) - Number(b.id)`), since IDs are timestamps.*

- [x] **1.5 Add Enrollment Date Field**
  *Auto-recorded as today's date (ISO format) on student registration. Saved to `enrollmentDate` in DB. Displayed as a read-only column in the student table.*

---

## 2. Finance / Fee Ledger ← NEXT UP

- [ ] **2.1 Rename "Total Expected" → "Projection / Total Expected" on Fee Ledger**
  *Update the label on the fee ledger only — refers to fee payment projection totals.*

---

## 3. Labels & Terminology

- [ ] **3.1 Rename "Class Teacher" → "Form Teacher" Throughout the System**
  *Global find-and-replace of the label across all views, forms, and reports.*

---

## 4. Attendance

- [ ] **4.1 Add Filters to Attendance View**
  *Add filter controls — at minimum by date, class, and attendance status.*

- [?] **4.2 Teacher Attendance / Punctuality Tracking**
  *Clarification pending: Should this be a separate module or an extension of existing student attendance? And who is responsible for recording it — the manager or admin?*

---

## 5. Time & Logs

- [ ] **5.1 Time Book for Teachers**
  *Log of teacher sessions and hours — tracks when teachers are present and teaching.*

- [ ] **5.2 Audit Log for Admin**
  *Track all changes made by any account including the bursar. Admin should be able to see a full history of edits.*

- [ ] **5.3 Allow Bursar to Edit / Redo Entries**
  *Give the bursar the ability to correct or undo previously submitted entries.*

---

## 6. Timetable *(Noted — clarify later)*

- [?] **6.1 Manager Dashboard to View Master Timetable Template** *(NOTE: on hold — clarification pending)*
  *Clarification pending: Should the manager be view-only or also able to create/edit timetable templates? Is "manager" a defined role in the system?*

---

## 7. Analytics *(Noted — clarify later)*

- [?] **7.1 Compare Analytics Between Classes (e.g. Form 1A vs 1B)** *(NOTE: on hold — clarification pending)*
  *Clarification pending: Which metrics should be compared (attendance, grades, fees, or all)? Should it be a side-by-side view or overlapping chart?*

---

## Summary Status

| Section | Total | Done | Pending |
| :--- | :---: | :---: | :---: |
| 1. Student & Guardian | 5 | 5 | 0 ✅ |
| 2. Finance / Fee Ledger | 1 | 0 | 1 ← current |
| 3. Labels & Terminology | 1 | 0 | 1 |
| 4. Attendance | 2 | 0 | 2 |
| 5. Time & Logs | 3 | 0 | 3 |
| 6. Timetable | 1 | 0 | 1 ⛔ blocked |
| 7. Analytics | 1 | 0 | 1 ⛔ blocked |
| **Total** | **14** | **5** | **9** |
