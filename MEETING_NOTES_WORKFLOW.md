# Meeting Notes → Task Tracker Workflow

A reusable guide for converting raw meeting notes into a structured, trackable task list for any project.

---

## ⚡ Quick-Start Prompt

Copy and paste this when starting a new set of meeting notes:

```
Look at "<path/to/meeting-notes-file.md>". Make a copy of it and rename it using the format
<original-name>_tracker_YYYY-MM-DD.md. Convert all notes into the tracker immediately with
checkboxes and a status legend — grouping tasks by numbered feature area, with numbered tasks
within each section (e.g. 1.1, 1.2). Mark any unclear items as [?] directly in the tracker
with a note on what is ambiguous.

Do not begin any implementation yet. After building the tracker, present a summary of all [?]
items — grouped by section — and ask one focused question per item so I can clarify them.
Include a summary status table at the bottom.
```

> Replace `<path/to/meeting-notes-file.md>` with the actual file path.

---

## 📋 The Workflow — Step by Step

### Step 1 — Copy & Rename
- Make a copy of the original meeting notes file. **Never edit the original.**
- Name the copy using this convention:
  ```
  <original-filename>_tracker_YYYY-MM-DD.md
  ```
  Example: `ClientMeeting_tracker_2026-10-26.md`
- The date should reflect when the tracker was created, not the meeting date.

---

### Step 2 — Build the Tracker Copy
Convert all notes into the tracker immediately — **do not wait for clarifications first**.

- **Number each section and each task** within it (e.g. `1.`, `1.1`, `1.2`, `2.`, `2.1`)
  — this makes referencing specific items in conversation easy
- **Group tasks by feature area** using numbered section headers
- **Use bold for the task title** and italic for implementation detail/notes beneath it
- **Mark unclear items as `[?]`** directly in the tracker with a note explaining what is ambiguous
- **All clear items** get `[ ]` (ready to work on), completed items get `[x]`
- **Add inline callouts** for special instructions, e.g.:
  - `*(NOTE: skip — leave for last per instructions)*`
  - `*(needs testing!!!)*`
- **Mark the current focus section** with `← NEXT UP`
- **Add a Summary Status table** at the bottom (see template below)
- Include a **source file reference and last updated date** at the top

---

### Step 3 — Flag Clarifications to the User
After the tracker is written, present a **separate summary** of all `[?]` items:

- **Group by section number**, matching how they appear in the tracker
- **State specifically what is ambiguous** for each item
- **Ask one focused question per item** — don't bundle multiple questions together
- Make clear that `[?]` items are already in the tracker and **will not be worked on until resolved**

Update the `[?]` entries in the tracker as clarifications come in.

---

### Step 4 — Ongoing Use
As work progresses:
- Update checkbox statuses (`[ ]` → `[~]` → `[x]`)
- Move the `← NEXT UP` marker to the current active section
- Update the **Summary Status table** counts at the bottom after each session
- Before touching any `[?]` item, resolve its clarification first and update the file
- Log new tasks discovered during development under a `## 🆕 Additions` section at the bottom — do not silently add them to existing sections
- Update the `Last updated:` date in the header on every edit

---

## 📄 Tracker Template

```markdown
# <Project Name> — Sprint Task Tracker & Action Items

> Source: Derived from meeting notes (`<original-filename>.md`)
> Last updated: YYYY-MM-DD

---

## Status Key
[ ] Not started | [~] In progress | [x] Done | [?] Blocked/Needs clarification

---

## 1. <Feature Area Name>

- [x] **1.1 <Task Title>**
  *Implementation detail or acceptance criteria.*
- [ ] **1.2 <Task Title>**
  *What needs to be built.*
- [?] **1.3 <Unclear Task Title>**
  *Clarification needed: [specific question].*

---

## 2. <Feature Area Name> ← NEXT UP

- [ ] **2.1 <Task Title>** *(NOTE: skip — leave for last per instructions)*
  *Detail.*
- [ ] **2.2 <Task Title>** *(needs testing!!!)*
  *Detail.*

---

## Summary Status

| Section | Total | Done | Pending |
| :--- | :---: | :---: | :---: |
| 1. <Feature Area> | 3 | 2 | 1 |
| 2. <Feature Area> | 2 | 0 | 2 ← current |
| **Total** | **5** | **2** | **3** |
```

---

## ✅ Per-Session Checklist

Before starting any implementation session:

- [ ] Tracker file exists and is up to date
- [ ] `Last updated:` date is current
- [ ] `← NEXT UP` marker points to the active section
- [ ] No `[?]` items are being worked on without prior clarification
- [ ] Summary Status table reflects current counts
- [ ] New tasks discovered this session are logged under `## 🆕 Additions`

---

## 📁 File Naming Reference

| File | Purpose |
|------|---------|
| `<Meeting Name>.md` | Original raw notes — **read only, never edit** |
| `<Meeting Name>_tracker_YYYY-MM-DD.md` | Working copy with checkboxes and statuses |

---

> _This guide is project-agnostic. Use it for any project by substituting the placeholders._
