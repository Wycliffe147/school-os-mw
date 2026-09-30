const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const { readDb, writeDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const upload = multer({ dest: UPLOADS_DIR });

router.use(authenticateToken);

router.get('/settings', (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    // Ensure sections always returned; default: one general section
    if (!db.settings.sections || db.settings.sections.length === 0) {
        db.settings.sections = [{ id: 'general', name: 'General', fee: 0, isDefault: true }];
    }
    res.json(db.settings);
});

router.post('/settings', requireAdmin, upload.single('logo'), (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    if (req.body.schoolName) db.settings.schoolName = req.body.schoolName;
    if (req.body.subtitle) db.settings.subtitle = req.body.subtitle;
    if (req.body.themeColor) db.settings.themeColor = req.body.themeColor;
    if (req.body.district !== undefined) db.settings.district = req.body.district;
    if (req.body.address !== undefined) db.settings.address = req.body.address;
    if (req.body.motto !== undefined) db.settings.motto = req.body.motto;
    if (req.body.latitude !== undefined) db.settings.latitude = req.body.latitude ? Number(req.body.latitude) : null;
    if (req.body.longitude !== undefined) db.settings.longitude = req.body.longitude ? Number(req.body.longitude) : null;
    if (req.body.defaultTermFee !== undefined) db.settings.defaultTermFee = Number(req.body.defaultTermFee);
    if (req.body.facilities !== undefined) {
        try {
            db.settings.facilities = Array.isArray(req.body.facilities) ? req.body.facilities : JSON.parse(req.body.facilities);
        } catch (_) {
            db.settings.facilities = String(req.body.facilities).split(',').map(s => s.trim()).filter(Boolean);
        }
    }
    if (req.body.headteacherRemarksPass !== undefined) db.settings.headteacherRemarksPass = req.body.headteacherRemarksPass;
    if (req.body.headteacherRemarksFail !== undefined) db.settings.headteacherRemarksFail = req.body.headteacherRemarksFail;
    if (req.body.nextTermFees !== undefined) db.settings.nextTermFees = req.body.nextTermFees;
    if (req.body.nextTermDate !== undefined) db.settings.nextTermDate = req.body.nextTermDate;
    if (req.body.currentTerm !== undefined) db.settings.currentTerm = req.body.currentTerm;
    if (req.body.headerContactLabel !== undefined) db.settings.headerContactLabel = req.body.headerContactLabel;
    if (req.body.headerContactNumber !== undefined) db.settings.headerContactNumber = req.body.headerContactNumber;
    if (req.body.catWeight !== undefined) db.settings.catWeight = Number(req.body.catWeight);
    if (req.body.examWeight !== undefined) db.settings.examWeight = Number(req.body.examWeight);

    // School Sections (fee structure)
    if (req.body.sections !== undefined) {
        try {
            const parsedSections = JSON.parse(req.body.sections);
            if (Array.isArray(parsedSections) && parsedSections.length > 0) {
                db.settings.sections = parsedSections;
                // Ensure exactly one is default
                const hasDefault = parsedSections.some(s => s.isDefault);
                if (!hasDefault) db.settings.sections[0].isDefault = true;

                // Migrate: assign default section to any student who has none
                const defaultSection = db.settings.sections.find(s => s.isDefault) || db.settings.sections[0];
                (db.students || []).forEach(student => {
                    if (!student.section) student.section = defaultSection.id;
                });
            }
        } catch (e) {
            console.error('Error parsing sections:', e);
        }
    }
    
    if (req.body.masterSubjects) {
        try {
            const parsed = JSON.parse(req.body.masterSubjects);
            db.settings.masterSubjects = parsed;
            db.subjects = parsed.filter(s => s.active).map(s => s.name);
        } catch (e) {
            console.error("Error parsing masterSubjects", e);
        }
    }
    
    if (req.body.gradingSystem) {
        try {
            db.settings.gradingSystem = JSON.parse(req.body.gradingSystem);
        } catch (e) {
            console.error("Error parsing gradingSystem", e);
        }
    }
    
    if (req.body.gradingSystemJunior) {
        try {
            db.settings.gradingSystemJunior = JSON.parse(req.body.gradingSystemJunior);
        } catch (e) {
            console.error("Error parsing gradingSystemJunior", e);
        }
    }
    
    if (req.file) {
        db.settings.logoPath = req.file.path;
    }
    
    writeDb();
    res.json({ success: true, settings: db.settings });
});

// ── POST /api/settings/advance-term ──────────────────────────────────
// Admin/Headteacher triggers term advancement & end-of-year promotions
router.post('/settings/advance-term', requireAdmin, (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');

    if (!db.settings.academicYear) db.settings.academicYear = '2025/2026';
    if (!db.settings.currentTerm)  db.settings.currentTerm  = 'Term 1';

    const oldTerm = db.settings.currentTerm;
    const oldYear = db.settings.academicYear;

    const sections = db.settings.sections || [];
    const getSection = (sectionId) => sections.find(s => s.id === sectionId);
    const defaultSection = sections.find(s => s.isDefault) || sections[0] || { id: 'general', name: 'General', fee: 0 };

    // ── Rank students & compute scores for archiving ────────────────────
    const subjectsList = db.subjects || [];
    const catWeight  = db.settings.catWeight  !== undefined ? Number(db.settings.catWeight)  : 30;
    const examWeight = db.settings.examWeight !== undefined ? Number(db.settings.examWeight) : 70;

    const classBuckets = {};
    (db.students || []).forEach(student => {
        const cl = student.classLevel || 'Form 1';
        if (!classBuckets[cl]) classBuckets[cl] = [];
        classBuckets[cl].push(student);
    });

    const scoreMap = new Map();
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
                    return;
                }
                subjectScores[sub] = composite;
                runningTotal += composite;
                subjectCount++;
            });
            const average = subjectCount > 0 ? Math.round((runningTotal / subjectCount) * 10) / 10 : 0;
            scoreMap.set(String(student.id), { total: runningTotal, subjectScores, average, subjectCount });
        });

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

    // ── Archive & Reset each student ──────────────────────────────────
    let studentCount = 0;
    (db.students || []).forEach(student => {
        const section = getSection(student.section) || defaultSection;
        const expectedFee = Number(section.fee) || 0;
        const arrears = Number(student.arrears || 0);
        const totalDue = expectedFee + arrears;
        const paidAmount = Number(student.paidAmount || 0);
        const balance = Math.max(0, totalDue - paidAmount);
        const academicSnap = scoreMap.get(String(student.id)) || { total: 0, average: 0, subjectScores: {}, subjectCount: 0 };

        // Pass calculation
        let passedSubjectsCount = 0;
        let englishPassed = false;
        Object.entries(academicSnap.subjectScores || {}).forEach(([sub, score]) => {
            if (Number(score) >= 40) {
                passedSubjectsCount++;
                if (sub === 'ENG' || sub === 'English') englishPassed = true;
            }
        });
        const hasPassed = englishPassed && passedSubjectsCount >= 6;

        // Archive Fee History
        if (!student.termHistory) student.termHistory = [];
        student.termHistory.push({
            termName: `${oldTerm} (${oldYear})`,
            academicYear: oldYear,
            section: section.id,
            sectionName: section.name,
            expectedFee,
            arrears,
            paidAmount,
            balance,
            paymentHistory: [...(student.paymentHistory || [])],
            archivedAt: new Date().toISOString()
        });

        // Archive Academic History
        if (!student.academicHistory) student.academicHistory = [];
        student.academicHistory.push({
            termName: `${oldTerm} (${oldYear})`,
            academicYear: oldYear,
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

        // Reset for Next Term: Carried over balance becomes opening arrears!
        student.arrears = balance;
        student.paidAmount = 0;
        student.paymentHistory = [];
        student.feeLockOverride = false;
        student.marks = {};
        student.catMarks = {};
        student.examMarks = {};
        studentCount++;
    });

    // ── Advance Term & Academic Year State ─────────────────────────────
    let isYearEnd = false;
    if (oldTerm === 'Term 1') {
        db.settings.currentTerm = 'Term 2';
    } else if (oldTerm === 'Term 2') {
        db.settings.currentTerm = 'Term 3';
    } else {
        // End of Term 3 -> Advance Academic Year & Promote Classes
        isYearEnd = true;
        db.settings.currentTerm = 'Term 1';
        
        // Parse "2025/2026" -> "2026/2027"
        const years = oldYear.split('/');
        if (years.length === 2 && !isNaN(years[0]) && !isNaN(years[1])) {
            db.settings.academicYear = `${Number(years[0]) + 1}/${Number(years[1]) + 1}`;
        } else {
            const yr = new Date().getFullYear();
            db.settings.academicYear = `${yr}/${yr + 1}`;
        }

        // Auto-promote classes
        (db.students || []).forEach(student => {
            const cl = student.classLevel || 'Form 1';
            if (cl === 'Form 1') student.classLevel = 'Form 2';
            else if (cl === 'Form 2') student.classLevel = 'Form 3';
            else if (cl === 'Form 3') student.classLevel = 'Form 4';
            else if (cl === 'Form 4') student.classLevel = 'Graduated';
        });
    }

    writeDb();

    res.json({
        success: true,
        message: isYearEnd 
            ? `Successfully closed ${oldTerm} (${oldYear}) & completed End-of-Year Class Promotions! New Academic Year: ${db.settings.academicYear} (Term 1).`
            : `Successfully closed ${oldTerm} (${oldYear})! Advanced to ${db.settings.currentTerm} (${db.settings.academicYear}).`,
        currentTerm: db.settings.currentTerm,
        academicYear: db.settings.academicYear,
        studentCount,
        isYearEnd
    });
});

module.exports = router;
