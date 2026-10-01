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

        // ── 10. Mark completion data audit ───────────────────────────────────
        let totalActiveSubjectSlots = 0;
        let filledSubjectSlots = 0;

        students.forEach(s => {
            const subs = Object.keys(s.subjects || {}).filter(k => s.subjects[k]);
            subs.forEach(sub => {
                totalActiveSubjectSlots++;
                const m = computeMark(s, sub, catW, examW);
                if (m !== null && m !== undefined) filledSubjectSlots++;
            });
        });

        const missingMarksCount = totalActiveSubjectSlots - filledSubjectSlots;
        const markCompletionRate = totalActiveSubjectSlots > 0 ? Math.round((filledSubjectSlots / totalActiveSubjectSlots) * 100) : 100;

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
            studentCount: students.length,
            markCompletionRate,
            missingMarksCount
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Analytics computation failed' });
    }
});

// ─── Helper: Convert percentage mark to MANEB Points (1 to 9) ─────────────────
function getManebPoint(mark) {
    if (mark === null || mark === undefined || isNaN(mark)) return { point: null, label: 'No Mark', code: '-' };
    const m = Number(mark);
    if (m >= 80) return { point: 1, label: 'Distinction', code: '1' };
    if (m >= 75) return { point: 2, label: 'Distinction', code: '2' };
    if (m >= 70) return { point: 3, label: 'Credit', code: '3' };
    if (m >= 65) return { point: 4, label: 'Credit', code: '4' };
    if (m >= 60) return { point: 5, label: 'Credit', code: '5' };
    if (m >= 50) return { point: 6, label: 'Credit', code: '6' };
    if (m >= 45) return { point: 7, label: 'Pass', code: '7' };
    if (m >= 40) return { point: 8, label: 'Pass', code: '8' };
    return { point: 9, label: 'Fail', code: '9' };
}

// ─── GET /api/analytics/student/:id ──────────────────────────────────────────
router.get('/analytics/student/:id', (req, res) => {
    try {
        const db = readDb(req.user.schoolId);
        const students = db.students || [];
        const settings = db.settings || {};
        const catW = Number(settings.catWeight ?? 30);
        const examW = Number(settings.examWeight ?? 70);

        const student = students.find(s => s.id === req.params.id);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        const classLevel = student.classLevel || 'Form 1';
        const classStudents = students.filter(s => (s.classLevel || 'Form 1') === classLevel);

        // 1. Calculate class rank/position
        const rankedClass = classStudents.map(s => {
            const subs = Object.keys(s.subjects || {}).filter(k => s.subjects[k]);
            const marks = subs.map(sub => computeMark(s, sub, catW, examW)).filter(m => m !== null);
            const avg = marks.length ? marks.reduce((a, b) => a + b, 0) / marks.length : 0;
            return { id: s.id, avg };
        }).sort((a, b) => b.avg - a.avg);

        const rankIndex = rankedClass.findIndex(s => s.id === student.id);
        const position = rankIndex !== -1 ? rankIndex + 1 : null;
        const totalClassStudents = classStudents.length;

        // 2. Individual Subject Performance & MANEB Points
        const activeSubjects = Object.keys(student.subjects || {}).filter(k => student.subjects[k]);
        let totalMarkSum = 0;
        let markCount = 0;

        const subjectDetails = activeSubjects.map(sub => {
            const cat = student.catMarks && student.catMarks[sub] != null ? Number(student.catMarks[sub]) : null;
            const exam = student.examMarks && student.examMarks[sub] != null ? Number(student.examMarks[sub]) : null;
            const mark = computeMark(student, sub, catW, examW);
            const maneb = getManebPoint(mark);

            if (mark !== null) {
                totalMarkSum += mark;
                markCount++;
            }

            return {
                subject: sub,
                catMark: cat,
                examMark: exam,
                finalMark: mark,
                manebPoint: maneb.point,
                manebLabel: maneb.label,
                manebCode: maneb.code
            };
        }).sort((a, b) => (b.finalMark || 0) - (a.finalMark || 0));

        const studentAvg = markCount > 0 ? Math.round((totalMarkSum / markCount) * 10) / 10 : null;

        // 3. Best 6 MSCE Points Calculation (MANEB Rules)
        const englishEntry = subjectDetails.find(s => s.subject.toLowerCase().includes('english'));
        const englishPoint = englishEntry && englishEntry.manebPoint !== null ? englishEntry.manebPoint : 9;
        
        const otherSubjects = subjectDetails
            .filter(s => !s.subject.toLowerCase().includes('english') && s.manebPoint !== null)
            .map(s => s.manebPoint)
            .sort((a, b) => a - b); // Lowest points first (1 is best)

        const top5Others = otherSubjects.slice(0, 5);
        let best6Points = null;
        let msceQualified = false;

        if (subjectDetails.length >= 6) {
            const totalPointsList = [englishPoint, ...top5Others];
            best6Points = totalPointsList.reduce((a, b) => a + b, 0);
            
            // MANEB MSCE pass criteria: Pass English (Point <= 8) and pass at least 5 other subjects
            const passedSubjectsCount = subjectDetails.filter(s => s.manebPoint !== null && s.manebPoint <= 8).length;
            msceQualified = (englishPoint <= 8) && (passedSubjectsCount >= 6);
        }

        // 4. Attendance Summary
        const attendance = db.attendance || [];
        let totalDays = 0;
        let presentDays = 0;
        let absentDays = 0;
        let excusedDays = 0;

        attendance.forEach(day => {
            if (day.records && day.records[student.id]) {
                totalDays++;
                const st = day.records[student.id];
                if (st === 'present') presentDays++;
                else if (st === 'absent') absentDays++;
                else if (st === 'excused') excusedDays++;
            }
        });

        const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null;

        // 5. Fee Health
        const sections = settings.sections || [];
        const secObj = sections.find(s => s.id === student.section) || sections.find(s => s.isDefault) || { fee: 0 };
        const totalFees = student.totalFees !== undefined ? Number(student.totalFees) : Number(secObj.fee || 0);
        const paidAmount = Number(student.paidAmount || 0);
        const balance = totalFees - paidAmount;

        // 6. Term History Trend
        const termHistory = (student.termHistory || []).map(snap => {
            const termLabel = snap.term || snap.label || 'Term';
            const termMarks = Object.values(snap.marks || {}).filter(m => m !== null && !isNaN(Number(m))).map(Number);
            const tAvg = termMarks.length ? Math.round((termMarks.reduce((a, b) => a + b, 0) / termMarks.length) * 10) / 10 : null;
            return {
                term: termLabel,
                avg: tAvg
            };
        });

        res.json({
            id: student.id,
            name: student.name,
            gender: student.gender || 'Not specified',
            phone: student.phone || '-',
            parentName: student.parentName || '-',
            parentPhone: student.parentPhone || '-',
            classLevel,
            sectionName: secObj.name || 'General',
            bursaryName: student.bursaryName || null,
            position,
            totalClassStudents,
            studentAvg,
            subjectDetails,
            best6Points,
            msceQualified,
            attendance: {
                totalDays,
                presentDays,
                absentDays,
                excusedDays,
                rate: attendanceRate
            },
            fees: {
                totalFees,
                paidAmount,
                balance,
                lockOverride: Boolean(student.feeLockOverride),
                paymentHistory: student.paymentHistory || []
            },
            termHistory
        });
    } catch (err) {
        console.error('Student Analytics error:', err);
        res.status(500).json({ error: 'Failed to compute student analytics' });
    }
});

module.exports = router;

