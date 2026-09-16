const express = require('express');
const router = express.Router();

const { readDb, writeDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [
    { period: 1, name: 'Period 1 (07:30 - 08:15)' },
    { period: 2, name: 'Period 2 (08:15 - 09:00)' },
    { period: 3, name: 'Period 3 (09:00 - 09:45)' },
    { period: 4, name: 'Period 4 (10:15 - 11:00)' },
    { period: 5, name: 'Period 5 (11:00 - 11:45)' },
    { period: 6, name: 'Period 6 (12:30 - 13:15)' },
    { period: 7, name: 'Period 7 (13:15 - 14:00)' }
];

// Get Timetable for a specific class or overall
router.get('/timetable', (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const { classLevel } = req.query;
    if (!db.timetable) db.timetable = [];

    if (classLevel) {
        const schedule = db.timetable.filter(t => t.classLevel === classLevel);
        return res.json({ classLevel, schedule, days: DAYS, periods: PERIODS });
    }

    res.json({ timetable: db.timetable, days: DAYS, periods: PERIODS });
});

// Save Timetable Period Assignment
router.post('/timetable', requireAdmin, (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const { classLevel, day, period, subject, teacherId, room } = req.body;

    if (!classLevel || !day || !period || !subject) {
        return res.status(400).json({ error: "Missing required fields (classLevel, day, period, subject)" });
    }

    if (!db.timetable) db.timetable = [];

    // Check teacher collision (teacher assigned to another class during the same period and day)
    if (teacherId) {
        const collision = db.timetable.find(t =>
            t.day === day &&
            Number(t.period) === Number(period) &&
            t.teacherId === teacherId &&
            t.classLevel !== classLevel
        );

        if (collision) {
            const teacher = (db.users || []).find(u => u.id === teacherId);
            const teacherName = teacher ? teacher.name : 'Teacher';
            return res.status(409).json({
                error: `Schedule collision! ${teacherName} is already assigned to ${collision.classLevel} during ${day} Period ${period}.`
            });
        }
    }

    // Update or insert slot
    const existingIdx = db.timetable.findIndex(t => t.classLevel === classLevel && t.day === day && Number(t.period) === Number(period));
    const slotEntry = {
        classLevel,
        day,
        period: Number(period),
        subject,
        teacherId: teacherId || null,
        room: room || 'Main Classroom',
        updatedBy: req.user.username
    };

    if (existingIdx !== -1) {
        db.timetable[existingIdx] = slotEntry;
    } else {
        db.timetable.push(slotEntry);
    }

    writeDb();
    res.json({ success: true, slot: slotEntry });
});

// Delete Timetable Period Assignment
router.delete('/timetable', requireAdmin, (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const { classLevel, day, period } = req.query;

    if (!db.timetable) db.timetable = [];

    db.timetable = db.timetable.filter(t => !(t.classLevel === classLevel && t.day === day && Number(t.period) === Number(period)));
    writeDb();
    res.json({ success: true });
});

// Get Individual Teacher Schedule
router.get('/timetable/teacher/:teacherId', (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const teacherId = req.params.teacherId;
    if (!db.timetable) db.timetable = [];

    const schedule = db.timetable.filter(t => t.teacherId === teacherId);
    res.json({ teacherId, schedule, days: DAYS, periods: PERIODS });
});

module.exports = router;
