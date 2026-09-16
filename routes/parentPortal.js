const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const { readDb, writeDb } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

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

    // Find a student whose parent phone matches
    const student = (db.students || []).find(s => {
        const sp = normPhone(s.parentPhone);
        return sp && sp.endsWith(phoneSuffix);
    });

    if (!student) {
        return res.status(401).json({ error: 'No student found for this phone number in this school. Please contact your school office.' });
    }

    const token = jwt.sign(
        { parentPhone: phone, studentId: student.id, schoolId },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    const schoolSettings = db.settings || {};
    res.json({
        token,
        student: sanitiseStudent(student),
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
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorised' });
    const token = auth.slice(7);
    try {
        req.parentUser = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
}

function sanitiseStudent(s) {
    // Never expose internal DB fields; only expose what parents should see
    return {
        id: s.id,
        name: s.name,
        classLevel: s.classLevel,
        gender: s.gender,
        parentName: s.parentName,
        totalFees: s.totalFees || 0,
        paidAmount: s.paidAmount || 0,
        paymentHistory: (s.paymentHistory || []).map(p => ({
            date: p.date,
            amount: p.amount,
            method: p.method,
            receiptNo: p.receiptNo
        })),
        marks: s.marks || {},
        catMarks: s.catMarks || {},
        examMarks: s.examMarks || {},
        feeLockOverride: s.feeLockOverride || false
    };
}

// ── GET /api/parent-portal/me ──────────────────────────────────────────
router.get('/parent-portal/me', authenticateParent, (req, res) => {
    const { studentId, schoolId } = req.parentUser;
    const db = readDb(schoolId);
    const student = (db.students || []).find(s => s.id === studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const settings = db.settings || {};
    res.json({
        student: sanitiseStudent(student),
        school: {
            name: settings.schoolName || schoolId,
            term: settings.currentTerm || '',
            year: settings.academicYear || new Date().getFullYear()
        }
    });
});

// ── GET /api/parent-portal/attendance/:studentId ───────────────────────
router.get('/parent-portal/attendance/:studentId', authenticateParent, (req, res) => {
    const { studentId: tokenStudentId, schoolId } = req.parentUser;

    // Security: parent can only see their own child's data
    if (req.params.studentId !== tokenStudentId) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const db = readDb(schoolId);
    const student = (db.students || []).find(s => s.id === tokenStudentId);
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

module.exports = router;
