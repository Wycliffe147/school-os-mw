const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const { readDb, writeDb } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { generatePDF } = require('../services/pdfService');

// Normalise phone: strip non-digits, return last 9 digits for suffix matching
function normPhone(p) {
    if (!p) return '';
    const digits = String(p).replace(/\D/g, '');
    return digits.slice(-9);
}

// ── POST /api/parent-portal/login ──────────────────────────────────────
// Body: { phone, schoolId }
router.post('/parent-portal/login', (req, res) => {
    const { phone, schoolId } = req.body;
    if (!phone || !schoolId) return res.status(400).json({ error: 'phone and schoolId are required' });

    const db = readDb(schoolId);
    const phoneSuffix = normPhone(phone);

    // Find ALL students whose parent phone matches (a parent may have multiple children)
    const students = (db.students || []).filter(s => {
        const sp = normPhone(s.parentPhone || s.phone);
        return sp && (sp.endsWith(phoneSuffix) || phoneSuffix.endsWith(sp));
    });

    if (!students.length) {
        return res.status(401).json({ error: 'No student found for this phone number in this school. Please contact your school office.' });
    }

    // JWT carries all matched student IDs so parent can switch between children
    const token = jwt.sign(
        { parentPhone: phone, studentIds: students.map(s => String(s.id)), schoolId },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    const schoolSettings = db.settings || {};
    res.json({
        token,
        // Return minimal info for all children so the frontend can show a picker
        students: students.map(s => ({
            id: String(s.id),
            name: s.name,
            classLevel: s.classLevel,
            gender: s.gender
        })),
        school: {
            name: schoolSettings.schoolName || schoolId,
            term: schoolSettings.currentTerm || '',
            year: schoolSettings.academicYear || new Date().getFullYear()
        }
    });
});

// ── Middleware: verify parent JWT ──────────────────────────────────────
function authenticateParent(req, res, next) {
    const auth = req.headers.authorization;
    let token = null;
    if (auth && auth.startsWith('Bearer ')) {
        token = auth.slice(7);
    } else if (req.query.token) {
        token = req.query.token;
    }
    if (!token) return res.status(401).json({ error: 'Unauthorised' });
    try {
        req.parentUser = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
}

function sanitiseStudent(s, expectedFee) {
    // Never expose internal DB fields; only expose what parents should see
    return {
        id: String(s.id),
        name: s.name,
        classLevel: s.classLevel,
        gender: s.gender,
        parentName: s.parentName,
        expectedFee: expectedFee || 0,
        paidAmount: s.paidAmount || 0,
        paymentHistory: (s.paymentHistory || []).map(p => ({
            date: p.date,
            amount: p.amount,
            method: p.method,
            receiptNo: p.receiptNo
        })),
        termHistory: (s.termHistory || []).map(t => ({
            termName: t.termName,
            sectionName: t.sectionName,
            expectedFee: t.expectedFee,
            paidAmount: t.paidAmount,
            balance: t.balance,
            paymentHistory: (t.paymentHistory || []).map(p => ({
                date: p.date,
                amount: p.amount,
                method: p.method,
                receiptNo: p.receiptNo
            })),
            archivedAt: t.archivedAt
        })),
        academicHistory: (s.academicHistory || []).map(a => ({
            termName: a.termName,
            classLevel: a.classLevel,
            totalScore: a.totalScore,
            average: a.average,
            subjectCount: a.subjectCount,
            position: a.position,
            outOf: a.outOf,
            subjectScores: a.subjectScores || {},
            archivedAt: a.archivedAt
        })),
        marks: s.marks || {},
        catMarks: s.catMarks || {},
        examMarks: s.examMarks || {},
        feeLockOverride: s.feeLockOverride || false
    };
}

// ── GET /api/parent-portal/me?studentId=xxx ───────────────────────────
// studentId param selects which child to view (defaults to first in list)
router.get('/parent-portal/me', authenticateParent, (req, res) => {
    const { studentIds, studentId: singleId, schoolId } = req.parentUser;
    const ids = (studentIds || (singleId ? [singleId] : [])).map(String);
    const requestedId = String(req.query.studentId || ids[0] || '');

    // Security: parent can only view children linked to their token
    if (!ids.includes(requestedId)) return res.status(403).json({ error: 'Forbidden' });

    const db = readDb(schoolId);
    const student = (db.students || []).find(s => String(s.id) === requestedId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Resolve section-based expected fee (mirrors admin fee ledger logic)
    const sections = db.settings.sections || [];
    const defaultSection = sections.find(s => s.isDefault) || sections[0] || { fee: 0 };
    const studentSection = sections.find(s => s.id === student.section) || defaultSection;
    const expectedFee = Number(studentSection.fee) || 0;

    const settings = db.settings || {};
    res.json({
        student: sanitiseStudent(student, expectedFee),
        // Include all siblings so the portal can show a switcher
        siblings: ids.map(id => {
            const sib = (db.students || []).find(s => String(s.id) === String(id));
            return sib ? { id: String(sib.id), name: sib.name, classLevel: sib.classLevel } : null;
        }).filter(Boolean),
        school: {
            name: settings.schoolName || schoolId,
            term: settings.currentTerm || '',
            year: settings.academicYear || new Date().getFullYear()
        }
    });
});

// ── GET /api/parent-portal/attendance/:studentId ───────────────────────
router.get('/parent-portal/attendance/:studentId', authenticateParent, (req, res) => {
    const { studentIds, studentId: singleId, schoolId } = req.parentUser;
    const ids = (studentIds || (singleId ? [singleId] : [])).map(String);
    const targetId = String(req.params.studentId || '');

    // Security: parent can only see their own children's data
    if (!ids.includes(targetId)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const db = readDb(schoolId);
    const student = (db.students || []).find(s => String(s.id) === targetId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const allAttendance = db.attendance || [];
    const classLevel = student.classLevel;

    const records = [];
    let present = 0, absent = 0, late = 0, excused = 0;

    allAttendance.forEach(dayRecord => {
        if (dayRecord.classLevel !== classLevel) return;
        const entry = (dayRecord.students || []).find(s => s.studentId === tokenStudentId);
        if (entry) {
            records.push({ date: dayRecord.date, status: entry.status });
            if (entry.status === 'present')  present++;
            else if (entry.status === 'absent')   absent++;
            else if (entry.status === 'late')     late++;
            else if (entry.status === 'excused')  excused++;
        }
    });

    records.sort((a, b) => a.date.localeCompare(b.date));

    res.json({
        total: present + absent + late + excused,
        present,
        absent,
        late,
        excused,
        records
    });
});

// ── GET /api/parent-portal/notices ────────────────────────────────────
router.get('/parent-portal/notices', authenticateParent, (req, res) => {
    const { schoolId } = req.parentUser;
    const db = readDb(schoolId);
    const notices = (db.notices || []).sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
    res.json(notices);
});

// ── POST /api/parent-portal/notices (Admin only — separate auth) ───────
// Admin can post notices that all parents of a school can see.
// Uses regular JWT from admin session.
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.post('/parent-portal/notices', authenticateToken, requireAdmin, (req, res) => {
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title and body are required' });

    const db = readDb(req.user.schoolId);
    if (!db.notices) db.notices = [];

    const notice = {
        id: `notice_${Date.now()}`,
        title,
        body,
        postedAt: new Date().toISOString(),
        postedBy: req.user.username
    };

    db.notices.push(notice);
    writeDb();
    res.json({ success: true, notice });
});

// ── DELETE /api/parent-portal/notices/:id (Admin only) ─────────────────
router.delete('/parent-portal/notices/:id', authenticateToken, requireAdmin, (req, res) => {
    const db = readDb(req.user.schoolId);
    if (!db.notices) return res.status(404).json({ error: 'Not found' });
    db.notices = db.notices.filter(n => n.id !== req.params.id);
    writeDb();
    res.json({ success: true });
});

// ── GET /api/parent-portal/pdf ──────────────────────────────────────────
// Query: studentId, termIndex (optional), download (optional 'true')
router.get('/parent-portal/pdf', authenticateParent, async (req, res) => {
    const { studentIds, studentId: singleId, schoolId } = req.parentUser;
    const ids = (studentIds || (singleId ? [singleId] : [])).map(String);
    const targetId = String(req.query.studentId || ids[0] || '');
    const hasTermIndex = req.query.termIndex !== undefined && req.query.termIndex !== null && req.query.termIndex !== '';
    const termIndex = hasTermIndex ? parseInt(req.query.termIndex, 10) : null;
    const download = req.query.download === 'true';

    if (!ids.includes(targetId)) return res.status(403).json({ error: 'Forbidden' });

    const db = readDb(schoolId);
    const student = (db.students || []).find(s => String(s.id) === targetId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    let pdfStudent = student;
    let pdfDb = JSON.parse(JSON.stringify(db));

    if (hasTermIndex && !isNaN(termIndex) && student.academicHistory && student.academicHistory[termIndex]) {
        const arc = student.academicHistory[termIndex];
        if (arc.termName) pdfDb.settings.currentTerm = arc.termName;

        const subjectsObj = {};
        Object.keys(arc.subjectScores || {}).forEach(sub => {
            subjectsObj[sub] = true;
        });

        pdfStudent = {
            id: student.id,
            name: student.name,
            gender: student.gender,
            classLevel: arc.classLevel || student.classLevel,
            rank: arc.position || 1,
            juniorTotalScore: arc.totalScore || 0,
            mscePoints: arc.totalScore || 0,
            subjects: subjectsObj,
            marks: arc.subjectScores || {},
            catMarks: {},
            examMarks: {}
        };
    } else {
        // Current term check: fee lock gate
        const sections = db.settings.sections || [];
        const defaultSection = sections.find(s => s.isDefault) || sections[0] || { fee: 0 };
        const studentSection = sections.find(s => s.id === student.section) || defaultSection;
        const expectedFee = Number(studentSection.fee) || 0;
        const paidAmount = Number(student.paidAmount) || 0;
        const feeBalance = expectedFee - paidAmount;

        if (feeBalance > 0 && !student.feeLockOverride) {
            return res.status(403).send("Report card locked due to outstanding fee balance.");
        }
    }

    try {
        const pdfBytes = await generatePDF(pdfStudent, pdfDb);
        const fileName = `${pdfStudent.name.replace(/\s+/g, '_')}_Report.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        if (download) {
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        } else {
            res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        }
        res.send(Buffer.from(pdfBytes));
    } catch (e) {
        console.error("Parent portal PDF error:", e);
        res.status(500).send("Error generating PDF report: " + e.message);
    }
});

module.exports = router;
