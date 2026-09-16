const express = require('express');
const router = express.Router();

const { readDb, writeDb } = require('../db');
const { rankStudents } = require('../services/pdfService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/students', (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    rankStudents(db);
    let ranked = db.students;
    if (req.user.role === 'class_teacher') {
        const myClasses = req.user.classes || [];
        ranked = ranked.filter(s => myClasses.includes(s.classLevel || 'Form 1'));
    } else if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
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

router.post('/students', requireAdmin, (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    
    if (req.body.updates) {
        Object.keys(req.body.updates).forEach(id => {
            const student = db.students.find(s => s.id === id);
            if (student) {
                if (req.body.updates[id].name !== undefined) student.name = req.body.updates[id].name;
                if (req.body.updates[id].phone !== undefined) student.phone = req.body.updates[id].phone;
                if (req.body.updates[id].bursaryName !== undefined) student.bursaryName = req.body.updates[id].bursaryName;
                if (req.body.updates[id].totalFees !== undefined) student.totalFees = Number(req.body.updates[id].totalFees);
                if (req.body.updates[id].feeLockOverride !== undefined) student.feeLockOverride = Boolean(req.body.updates[id].feeLockOverride);
                
                if (req.body.updates[id].subjects) {
                    if (!student.subjects) student.subjects = {};
                    Object.assign(student.subjects, req.body.updates[id].subjects);
                }
            }
        });
    } else {
        db.students.push({
            id: Date.now().toString(),
            name: req.body.name,
            phone: req.body.phone,
            bursaryName: req.body.bursaryName,
            classLevel: req.body.classLevel || 'Form 1',
            subjects: req.body.subjects || {},
            marks: {},
            totalFees: req.body.totalFees ? Number(req.body.totalFees) : 0,
            paidAmount: 0,
            paymentHistory: [],
            feeLockOverride: false
        });
    }
    writeDb();
    res.json({ success: true });
});

// Record a Fee Payment for a student
router.post('/students/:id/payments', requireAdmin, (req, res) => {
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
        paidAmount: student.paidAmount,
        totalFees: student.totalFees || 0,
        balance: (student.totalFees || 0) - student.paidAmount
    });
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

// Toggle Fee Lock Override for a student
router.post('/students/:id/fee-lock-override', requireAdmin, (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const student = db.students.find(s => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });

    student.feeLockOverride = Boolean(req.body.override);
    writeDb();
    res.json({ success: true, feeLockOverride: student.feeLockOverride });
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
    
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
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
