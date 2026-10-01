const express = require('express');
const router = express.Router();
const { readDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Analytics is read-only - allow admin, superadmin, and headteacher
router.use((req, res, next) => {
    const allowed = ['admin', 'superadmin', 'headteacher'];
    if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    next();
});

// ─── Helper: compute weighted total mark for a student in a subject ───────────
function computeMark(student, sub, catW, examW) {
    const raw = student.marks && student.marks[sub] != null ? Number(student.marks[sub]) : null;
    if (raw !== null && !isNaN(raw)) return raw;
    const cat  = student.catMarks  && student.catMarks[sub]  != null ? Number(student.catMarks[sub])  : null;
    const exam = student.examMarks && student.examMarks[sub] != null ? Number(student.examMarks[sub]) : null;
    if (cat !== null && exam !== null) return Math.round((cat * (catW / 100)) + (exam * (examW / 100)));
    if (exam !== null) return exam;
    if (cat !== null) return cat;
    return null;
}

// ─── Helper: get pass mark from grading system ───────────────────────────────
function getPassMark(settings) {
    const gs = settings.gradingSystem || [];
    // Find the lowest boundary that is considered pass (not fail/D)
    // Convention: grades with letter A,B,C,D or P,F. Fail is bottom.
    // We look for the grade whose remark includes 'fail' (case-insensitive) and take its min+1
    for (const g of gs) {
        if (g.label && /fail/i.test(g.label)) return (Number(g.min) || 0) + 1;
        if (g.letter && /^[Ff]$/.test(g.letter.trim())) return (Number(g.min) || 0) + 1;
    }
    // Fallback: 50
    return 50;
}

// ─── GET /api/analytics/summary ──────────────────────────────────────────────
router.get('/analytics/summary', (req, res) => {
    try {
        const db      = readDb(req.user.schoolId);
        const students = db.students || [];
        const settings = db.settings || {};
        const catW  = Number(settings.catWeight  ?? 30);
        const examW = Number(settings.examWeight ?? 70);
        const passMark = getPassMark(settings);
        const classLevels = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];
        const attendance  = db.attendance || [];

        // ── 1. Enrolment by class ────────────────────────────────────────────
        const enrolmentByClass = {};
        classLevels.forEach(c => {
            enrolmentByClass[c] = students.filter(s => (s.classLevel || 'Form 1') === c).length;
        });

        // Gender breakdown
        const genderCounts = { Male: 0, Female: 0, Unknown: 0 };
        students.forEach(s => {
            const g = (s.gender || '').toLowerCase();
            if (g === 'male' || g === 'm') genderCounts.Male++;
            else if (g === 'female' || g === 'f') genderCounts.Female++;
            else genderCounts.Unknown++;
        });

        // ── 2. Average marks per subject (school-wide) ───────────────────────
        const subjectTotals = {};
        const subjectCounts = {};
        const subjectPassCount = {};
        students.forEach(s => {
            const subs = Object.keys(s.subjects || {}).filter(k => s.subjects[k]);
            subs.forEach(sub => {
                const m = computeMark(s, sub, catW, examW);
                if (m !== null) {
                    subjectTotals[sub] = (subjectTotals[sub] || 0) + m;
                    subjectCounts[sub] = (subjectCounts[sub] || 0) + 1;
                    if (m >= passMark) subjectPassCount[sub] = (subjectPassCount[sub] || 0) + 1;
                }
            });
        });
        const subjectStats = Object.keys(subjectTotals).map(sub => ({
            subject: sub,
            avg: Math.round((subjectTotals[sub] / subjectCounts[sub]) * 10) / 10,
            count: subjectCounts[sub],
            passCount: subjectPassCount[sub] || 0,
            passRate: Math.round(((subjectPassCount[sub] || 0) / subjectCounts[sub]) * 100)
        })).sort((a, b) => b.avg - a.avg);

        // ── 3. Average marks per class ───────────────────────────────────────
        const classStats = classLevels.map(cls => {
            const cs = students.filter(s => (s.classLevel || 'Form 1') === cls);
            if (!cs.length) return { class: cls, avg: null, passRate: null, count: 0 };
            const avgs = cs.map(s => {
                const subs = Object.keys(s.subjects || {}).filter(k => s.subjects[k]);
                const marks = subs.map(sub => computeMark(s, sub, catW, examW)).filter(m => m !== null);
                return marks.length ? marks.reduce((a, b) => a + b, 0) / marks.length : null;
            }).filter(a => a !== null);
            if (!avgs.length) return { class: cls, avg: null, passRate: null, count: cs.length };
            const avg = Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10;
            const passing = cs.filter(s => {
                const subs = Object.keys(s.subjects || {}).filter(k => s.subjects[k]);
                const marks = subs.map(sub => computeMark(s, sub, catW, examW)).filter(m => m !== null);
                if (!marks.length) return false;
                const studentAvg = marks.reduce((a, b) => a + b, 0) / marks.length;
                return studentAvg >= passMark;
            }).length;
            return {
                class: cls,
                avg,
                passRate: cs.length ? Math.round((passing / cs.length) * 100) : null,
                count: cs.length
            };
        });

        // ── 4. Top 10 students (school-wide average) ─────────────────────────
        const studentAverages = students.map(s => {
            const subs = Object.keys(s.subjects || {}).filter(k => s.subjects[k]);
            const marks = subs.map(sub => computeMark(s, sub, catW, examW)).filter(m => m !== null);
            const avg = marks.length ? Math.round((marks.reduce((a, b) => a + b, 0) / marks.length) * 10) / 10 : null;
            return { id: s.id, name: s.name, classLevel: s.classLevel || 'Form 1', avg };
        }).filter(s => s.avg !== null).sort((a, b) => b.avg - a.avg);
        const top10 = studentAverages.slice(0, 10);

        // ── 5. Bottom 10 at-risk students ────────────────────────────────────
        const bottom10 = [...studentAverages].sort((a, b) => a.avg - b.avg).slice(0, 10);

        // ── 6. Fee collection stats ──────────────────────────────────────────
        let totalFees = 0, totalPaid = 0, fullyPaid = 0, bursaryCount = 0;
        // Payment method breakdown
        const methodCounts = {};
        students.forEach(s => {
            const sections = settings.sections || [];
            const section = sections.find(sec => sec.id === s.section) || sections.find(sec => sec.isDefault) || { fee: 0 };
            const fee = s.totalFees !== undefined ? Number(s.totalFees) : Number(section.fee || 0);
            const paid = Number(s.paidAmount || 0);
            totalFees += fee;
            totalPaid += paid;
            if (fee > 0 && paid >= fee) fullyPaid++;
            if (s.bursaryName) bursaryCount++;
            (s.paymentHistory || []).forEach(p => {
                const m = p.method || 'Cash';
                methodCounts[m] = (methodCounts[m] || 0) + Number(p.amount || 0);
            });
        });

        // Monthly fee collection - build from paymentHistory
        const monthlyFees = {};
        students.forEach(s => {
            (s.paymentHistory || []).forEach(p => {
                if (!p.date) return;
                const d = new Date(p.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                monthlyFees[key] = (monthlyFees[key] || 0) + Number(p.amount || 0);
            });
        });
        const monthlyFeesSorted = Object.entries(monthlyFees)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, amount]) => ({ month, amount }));

        // ── 7. Attendance stats ──────────────────────────────────────────────
        // Overall attendance rate by class
        const attendanceByClass = {};
        classLevels.forEach(cls => {
            const classRecords = attendance.filter(a => a.classLevel === cls);
            let totalStudentDays = 0, presentDays = 0;
            classRecords.forEach(day => {
                Object.values(day.records || {}).forEach(status => {
                    totalStudentDays++;
                    if (status === 'present') presentDays++;
                });
            });
            attendanceByClass[cls] = totalStudentDays > 0
                ? Math.round((presentDays / totalStudentDays) * 100)
                : null;
        });

        // Daily attendance trend (last 30 recorded days, all classes combined)
        const dailyAtt = {};
        attendance.forEach(day => {
            const records = Object.values(day.records || {});
            if (!records.length) return;
            if (!dailyAtt[day.date]) dailyAtt[day.date] = { present: 0, total: 0 };
            records.forEach(status => {
                dailyAtt[day.date].total++;
                if (status === 'present') dailyAtt[day.date].present++;
            });
        });
        const dailyAttSorted = Object.entries(dailyAtt)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-30)
            .map(([date, { present, total }]) => ({
                date,
                rate: total > 0 ? Math.round((present / total) * 100) : 0,
                present,
                total
            }));

        // ── 8. Term history performance trend ───────────────────────────────
        // Group termHistory snapshots by term label across all students
        const termTotals = {};
        const termCounts = {};
        students.forEach(s => {
            (s.termHistory || []).forEach(snap => {
                const label = snap.term || snap.label || 'Unknown';
                const marks = Object.values(snap.marks || {}).filter(m => m !== null && !isNaN(Number(m))).map(Number);
                if (!marks.length) return;
                const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
                termTotals[label] = (termTotals[label] || 0) + avg;
                termCounts[label] = (termCounts[label] || 0) + 1;
            });
        });
        const termTrend = Object.keys(termTotals).map(term => ({
            term,
            avg: Math.round((termTotals[term] / termCounts[term]) * 10) / 10
        }));

        // ── 9. Subject performance per class (heatmap data) ──────────────────
        const subjectByClass = {};
        classLevels.forEach(cls => {
            const cs = students.filter(s => (s.classLevel || 'Form 1') === cls);
            const totals = {}, counts = {};
            cs.forEach(s => {
                const subs = Object.keys(s.subjects || {}).filter(k => s.subjects[k]);
                subs.forEach(sub => {
                    const m = computeMark(s, sub, catW, examW);
                    if (m !== null) {
                        totals[sub] = (totals[sub] || 0) + m;
                        counts[sub] = (counts[sub] || 0) + 1;
                    }
                });
            });
            subjectByClass[cls] = Object.keys(totals).map(sub => ({
                subject: sub,
                avg: Math.round((totals[sub] / counts[sub]) * 10) / 10
            }));
        });

        res.json({
            enrolmentByClass,
            genderCounts,
            subjectStats,
            classStats,
            top10,
            bottom10,
            feeStats: {
                totalFees,
                totalPaid,
                outstanding: totalFees - totalPaid,
                collectionRate: totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0,
                fullyPaid,
                bursaryCount,
                totalStudents: students.length,
                methodCounts
            },
            monthlyFees: monthlyFeesSorted,
            attendanceByClass,
            dailyAttTrend: dailyAttSorted,
            termTrend,
            subjectByClass,
            passMark,
            studentCount: students.length
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Analytics computation failed' });
    }
});

module.exports = router;
