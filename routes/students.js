const express = require('express');
const router = express.Router();

const { readDb, writeDb } = require('../db');
const { rankStudents } = require('../services/pdfService');
const { authenticateToken, requireAdmin, requireBursarOrAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/students', (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    rankStudents(db);
    let ranked = db.students;
    const fullAccessRoles = ['admin', 'superadmin', 'headteacher', 'bursar', 'discipline_master'];
    if (fullAccessRoles.includes(req.user.role)) {
        // All students - no filter
    } else if (req.user.role === 'class_teacher') {
        const myClasses = req.user.classes || [];
        const teacherSubjects = req.user.subjects || [];
        ranked = ranked.filter(s => {
            const sClass = s.classLevel || 'Form 1';
            if (myClasses.includes(sClass)) return true;
            return teacherSubjects.some(sub => {
                if (sub.includes(':')) {
                    const [classLevel, subjectName] = sub.split(':');
                    return sClass === classLevel && s.subjects && s.subjects[subjectName] === true;
                }
                return s.subjects && s.subjects[sub] === true;
            });
        });
    } else {
        // teacher - filter by assigned subjects
        const teacherSubjects = req.user.subjects || [];
        ranked = ranked.filter(s =>
            teacherSubjects.some(sub => {
                if (sub.includes(':')) {
                    const [classLevel, subjectName] = sub.split(':');
                    return (s.classLevel || 'Form 1') === classLevel && s.subjects && s.subjects[subjectName] === true;
                }
                return s.subjects && s.subjects[sub] === true;
            })
        );
    }
    res.json(ranked);
});

router.post('/students', requireBursarOrAdmin, (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    
    if (req.body.updates) {
        Object.keys(req.body.updates).forEach(id => {
            const student = db.students.find(s => s.id === id);
            if (student) {
                if (req.body.updates[id].name !== undefined) student.name = req.body.updates[id].name;
                if (req.body.updates[id].gender !== undefined) student.gender = req.body.updates[id].gender;
                if (req.body.updates[id].phone !== undefined) student.phone = req.body.updates[id].phone;
                if (req.body.updates[id].bursaryName !== undefined) student.bursaryName = req.body.updates[id].bursaryName;
                if (req.body.updates[id].section !== undefined) student.section = req.body.updates[id].section;
                if (req.body.updates[id].feeLockOverride !== undefined) student.feeLockOverride = Boolean(req.body.updates[id].feeLockOverride);
                
                if (req.body.updates[id].subjects) {
                    if (!student.subjects) student.subjects = {};
                    Object.assign(student.subjects, req.body.updates[id].subjects);
                }
            }
        });
    } else {
        // Get default section from settings if not provided
        const defaultSection = (() => {
            const sections = db.settings.sections || [];
            return (sections.find(s => s.isDefault) || sections[0] || { id: 'general' }).id;
        })();

        db.students.push({
            id: Date.now().toString(),
            name: req.body.name,
            gender: req.body.gender || 'Male',
            phone: req.body.phone,
            bursaryName: req.body.bursaryName,
            classLevel: req.body.classLevel || 'Form 1',
            section: req.body.section || defaultSection,
            subjects: req.body.subjects || {},
            marks: {},
            paidAmount: 0,
            paymentHistory: [],
            termHistory: [],
            feeLockOverride: false
        });
    }
    writeDb();
    res.json({ success: true });
});

// Record a Fee Payment for a student
router.post('/students/:id/payments', requireBursarOrAdmin, (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const student = db.students.find(s => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const amount = Number(req.body.amount);
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "Invalid payment amount" });
    }

    if (!student.paymentHistory) student.paymentHistory = [];
    if (student.paidAmount === undefined) student.paidAmount = 0;

    const receiptNo = 'REC-' + Date.now().toString().slice(-6);
    const paymentRecord = {
        receiptNo,
        amount,
        method: req.body.method || 'Cash',
        date: new Date().toISOString(),
        note: req.body.note || 'Term Fee Payment',
        recordedBy: req.user.username
    };

    student.paymentHistory.push(paymentRecord);
    student.paidAmount += amount;

    writeDb();
    res.json({
        success: true,
        receipt: paymentRecord,
        paidAmount: student.paidAmount
    });
});

// Void / Delete a Fee Payment record
router.delete('/students/:id/payments/:receiptNo', requireBursarOrAdmin, (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const student = db.students.find(s => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });

    if (!student.paymentHistory) student.paymentHistory = [];
    const prevCount = student.paymentHistory.length;
    student.paymentHistory = student.paymentHistory.filter(p => p.receiptNo !== req.params.receiptNo);

    if (student.paymentHistory.length === prevCount) {
        return res.status(404).json({ error: "Payment record not found" });
    }

    student.paidAmount = student.paymentHistory.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    writeDb();
    res.json({
        success: true,
        paidAmount: student.paidAmount
    });
});

// Override fee lock for a student
router.post('/students/:id/fee-lock-override', requireBursarOrAdmin, (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const student = db.students.find(s => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    student.feeLockOverride = Boolean(req.body.override);
    writeDb();
    res.json({ success: true });
});

// Start New Term - archive current term data, reset payment state for all students
router.post('/fee-ledger/start-new-term', requireBursarOrAdmin, (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const { termName } = req.body;
    if (!termName || !termName.trim()) {
        return res.status(400).json({ error: 'termName is required (e.g. "Term 2 2026")' });
    }

    const sections = db.settings.sections || [];
    const getSection = (sectionId) => sections.find(s => s.id === sectionId);
    const defaultSection = sections.find(s => s.isDefault) || sections[0] || { id: 'general', name: 'General', fee: 0 };

    // ── Compute class ranks before archiving ───────────────────────────
    // Group students by class and compute total score + rank per class
    const subjectsList = db.subjects || [];
    const catWeight  = db.settings.catWeight  !== undefined ? Number(db.settings.catWeight)  : 30;
    const examWeight = db.settings.examWeight !== undefined ? Number(db.settings.examWeight) : 70;

    const classBuckets = {};
    (db.students || []).forEach(student => {
        const cl = student.classLevel || 'Form 1';
        if (!classBuckets[cl]) classBuckets[cl] = [];
        classBuckets[cl].push(student);
    });

    // Per-student: compute composite total & per-subject scores
    const scoreMap = new Map(); // studentId -> { total, subjectScores, average }
    Object.values(classBuckets).forEach(group => {
        group.forEach(student => {
            const subjectScores = {};
            let runningTotal = 0;
            let subjectCount = 0;
            subjectsList.forEach(sub => {
                if (!student.subjects || !student.subjects[sub]) return;
                const cat  = Number(student.catMarks  && student.catMarks[sub]  != null ? student.catMarks[sub]  : '');
                const exam = Number(student.examMarks && student.examMarks[sub] != null ? student.examMarks[sub] : '');
                const raw  = Number(student.marks     && student.marks[sub]     != null ? student.marks[sub]     : '');
                let composite;
                if (!isNaN(cat) && !isNaN(exam)) {
                    composite = Math.round((cat * catWeight / 100) + (exam * examWeight / 100));
                } else if (!isNaN(raw)) {
                    composite = raw;
                } else {
                    return; // no score for this subject
                }
                subjectScores[sub] = composite;
                runningTotal += composite;
                subjectCount++;
            });
            const average = subjectCount > 0 ? Math.round((runningTotal / subjectCount) * 10) / 10 : 0;
            scoreMap.set(String(student.id), { total: runningTotal, subjectScores, average, subjectCount });
        });

        // Rank within class by total score descending
        const sorted = [...group].sort((a, b) => {
            const aTotal = (scoreMap.get(String(a.id)) || {}).total || 0;
            const bTotal = (scoreMap.get(String(b.id)) || {}).total || 0;
            return bTotal - aTotal;
        });
        sorted.forEach((student, idx) => {
            const entry = scoreMap.get(String(student.id));
            if (entry) entry.position = idx + 1;
        });
    });

    // ── Archive fee + academic snapshot per student ────────────────────
    let studentCount = 0;
    (db.students || []).forEach(student => {
        const section = getSection(student.section) || defaultSection;
        const expectedFee = section.fee || 0;
        const paidAmount = student.paidAmount || 0;
        const academicSnap = scoreMap.get(String(student.id)) || { total: 0, average: 0, subjectScores: {}, subjectCount: 0 };

        // Fee archive
        if (!student.termHistory) student.termHistory = [];
        student.termHistory.push({
            termName: termName.trim(),
            section: section.id,
            sectionName: section.name,
            expectedFee,
            paidAmount,
            balance: Math.max(0, expectedFee - paidAmount),
            paymentHistory: [...(student.paymentHistory || [])],
            archivedAt: new Date().toISOString()
        });

        // Academic archive
        let passedSubjectsCount = 0;
        let englishPassed = false;
        Object.entries(academicSnap.subjectScores || {}).forEach(([sub, score]) => {
            if (Number(score) >= 40) {
                passedSubjectsCount++;
                if (sub === 'ENG' || sub === 'English') englishPassed = true;
            }
        });
        const hasPassed = englishPassed && passedSubjectsCount >= 6;

        if (!student.academicHistory) student.academicHistory = [];
        student.academicHistory.push({
            termName: termName.trim(),
            classLevel: student.classLevel || '',
            totalScore: academicSnap.total,
            average: academicSnap.average,
            subjectCount: academicSnap.subjectCount,
            position: academicSnap.position || null,
            outOf: (classBuckets[student.classLevel || 'Form 1'] || []).length,
            passed: hasPassed,
            subjectScores: { ...academicSnap.subjectScores },
            archivedAt: new Date().toISOString()
        });

        // Reset for new term
        student.paidAmount = 0;
        student.paymentHistory = [];
        student.feeLockOverride = false;
        studentCount++;
    });

    writeDb();
    res.json({ success: true, studentCount, termName: termName.trim() });
});



// Save Daily Attendance Register
router.post('/attendance', (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const { date, classLevel, records } = req.body; // records: { studentId: 'present'|'absent'|'late'|'excused' }
    
    if (!date || !classLevel || !records) {
        return res.status(400).json({ error: "Missing required fields (date, classLevel, records)" });
    }

    if (!db.attendance) db.attendance = [];
    
    const existingIdx = db.attendance.findIndex(a => a.date === date && a.classLevel === classLevel);
    const entry = {
        date,
        classLevel,
        records,
        recordedBy: req.user.username,
        updatedAt: new Date().toISOString()
    };

    if (existingIdx !== -1) {
        db.attendance[existingIdx] = entry;
    } else {
        db.attendance.push(entry);
    }

    writeDb();
    res.json({ success: true });
});

// Get Attendance Register for a specific date and class
router.get('/attendance', (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const { date, classLevel } = req.query;
    if (!db.attendance) db.attendance = [];
    
    const record = db.attendance.find(a => a.date === date && a.classLevel === classLevel);
    res.json(record || { date, classLevel, records: {} });
});

// Get Attendance Summary for a student across all recorded days
router.get('/students/:id/attendance-summary', (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const studentId = req.params.id;
    if (!db.attendance) db.attendance = [];

    let present = 0, absent = 0, late = 0, excused = 0;
    db.attendance.forEach(entry => {
        if (entry.records && entry.records[studentId]) {
            const status = entry.records[studentId];
            if (status === 'present') present++;
            else if (status === 'absent') absent++;
            else if (status === 'late') late++;
            else if (status === 'excused') excused++;
        }
    });

    const totalDays = present + absent + late + excused;
    res.json({ present, absent, late, excused, totalDays });
});


router.delete('/students/:id', requireAdmin, (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    db.students = db.students.filter(s => s.id !== req.params.id);
    writeDb();
    res.json({ success: true });
});

router.post('/promote-classes', requireAdmin, (req, res) => {
    const schoolId = req.user ? req.user.schoolId : 'default';
    const db = readDb(schoolId);
    const { preserveSubjects } = req.body;

    const nextClass = { 'Form 1': 'Form 2', 'Form 2': 'Form 3', 'Form 3': 'Form 4' };

    let graduated = 0;
    let promoted = 0;

    const form4 = db.students.filter(s => (s.classLevel || 'Form 1') === 'Form 4');
    graduated = form4.length;
    db.students = db.students.filter(s => (s.classLevel || 'Form 1') !== 'Form 4');

    ['Form 3', 'Form 2', 'Form 1'].forEach(currentClass => {
        db.students.forEach(s => {
            if ((s.classLevel || 'Form 1') === currentClass) {
                s.classLevel = nextClass[currentClass];
                s.marks = {};
                if (!preserveSubjects) {
                    s.subjects = {};
                }
                promoted++;
            }
        });
    });

    writeDb();
    res.json({ success: true, promoted, graduated });
});

router.post('/marks', (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const { id, marks } = req.body;
    
    const fullAccessRoles = ['admin', 'superadmin', 'headteacher', 'bursar', 'discipline_master'];
    if (!fullAccessRoles.includes(req.user.role)) {
        // teachers and class_teachers are restricted to their assigned subjects
        const student = db.students.find(s => s.id === id);
        if (!student) {
            return res.status(404).json({ error: "Student not found" });
        }
        const studentClass = student.classLevel || 'Form 1';
        const teacherSubjects = req.user.subjects || [];
        for (let sub of Object.keys(marks)) {
            if (marks[sub] !== undefined && marks[sub] !== '') {
                const expectedKey = `${studentClass}:${sub}`;
                if (!teacherSubjects.includes(expectedKey) && !teacherSubjects.includes(sub)) {
                    return res.status(403).json({ error: "Unauthorized to edit subject: " + sub });
                }
            }
        }
    }
    
    const idx = db.students.findIndex(s => s.id === id);
    if (idx !== -1) {
        const catW = db.settings.catWeight !== undefined ? db.settings.catWeight : 30;
        const examW = db.settings.examWeight !== undefined ? db.settings.examWeight : 70;

        if (!db.students[idx].marks) db.students[idx].marks = {};
        if (!db.students[idx].catMarks) db.students[idx].catMarks = {};
        if (!db.students[idx].examMarks) db.students[idx].examMarks = {};

        db.subjects.forEach(sub => {
            if (db.students[idx].subjects && db.students[idx].subjects[sub]) {
                const inputVal = marks[sub];
                if (typeof inputVal === 'object' && inputVal !== null) {
                    const catVal = inputVal.cat !== undefined && inputVal.cat !== '' && inputVal.cat !== null ? Number(inputVal.cat) : null;
                    const examVal = inputVal.exam !== undefined && inputVal.exam !== '' && inputVal.exam !== null ? Number(inputVal.exam) : null;
                    
                    db.students[idx].catMarks[sub] = catVal;
                    db.students[idx].examMarks[sub] = examVal;

                    if (catVal !== null && examVal !== null) {
                        db.students[idx].marks[sub] = Math.round((catVal * (catW / 100)) + (examVal * (examW / 100)));
                    } else if (examVal !== null) {
                        db.students[idx].marks[sub] = examVal;
                    } else if (catVal !== null) {
                        db.students[idx].marks[sub] = catVal;
                    } else {
                        db.students[idx].marks[sub] = null;
                    }
                } else if (inputVal !== undefined && inputVal !== '') {
                    const numVal = inputVal !== null ? Number(inputVal) : null;
                    db.students[idx].marks[sub] = numVal;
                    db.students[idx].examMarks[sub] = numVal;
                }
            }
        });
        writeDb();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Student not found" });
    }
});

module.exports = router;
