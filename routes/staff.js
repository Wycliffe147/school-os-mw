const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const { readDb, writeDb, getDbCache } = require('../db');
const { authenticateToken, requireAdmin, requireStaffViewer } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/users', requireStaffViewer, (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    let visibleUsers = db.users.filter(u => u.role !== 'superadmin');

    if (req.user.role === 'class_teacher') {
        const myClasses = req.user.classes || [];
        visibleUsers = visibleUsers.filter(u => {
            if (u.role === 'admin') return true;
            if (u.role === 'class_teacher') return (u.classes || []).some(c => myClasses.includes(c));
            return (u.subjects || []).some(s => myClasses.some(c => s.startsWith(c + ':')));
        });
    }

    const safeUsers = visibleUsers.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        subjects: u.subjects,
        classes: u.classes,
        password: req.user.role === 'class_teacher' ? undefined : u.password
    }));
    res.json(safeUsers);
});

router.post('/users', requireAdmin, (req, res) => {
    readDb(req.user ? req.user.schoolId : 'default');
    const dbCache = getDbCache();
    const { id, username, name, password, role, subjects, classes } = req.body;
    
    if (id) {
        const idx = dbCache.users.findIndex(u => u.id === id);
        if (idx !== -1) {
            dbCache.users[idx].username = username;
            dbCache.users[idx].name = name;
            dbCache.users[idx].subjects = subjects || [];
            dbCache.users[idx].classes = classes || [];
            if (role) dbCache.users[idx].role = role;
            if (password) {
                dbCache.users[idx].passwordHash = bcrypt.hashSync(password, 8);
                dbCache.users[idx].password = password;
            }
        }
    } else {
        const schoolUsers = dbCache.users.filter(u => u.schoolId === (req.user ? req.user.schoolId : 'default'));
        if (schoolUsers.find(u => u.username === username)) {
            return res.status(400).json({ error: "Username already exists" });
        }
        dbCache.users.push({
            schoolId: req.user ? req.user.schoolId : 'default',
            id: 'teacher_' + Date.now(),
            username,
            name,
            passwordHash: bcrypt.hashSync(password, 8),
            password: password,
            role: role || 'teacher',
            subjects: subjects || [],
            classes: classes || []
        });
    }
    writeDb();
    res.json({ success: true });
});

router.delete('/users/:id', requireAdmin, (req, res) => {
    readDb(req.user ? req.user.schoolId : 'default');
    const dbCache = getDbCache();
    if (req.params.id === 'admin_1' || req.params.id === req.user.id) {
        return res.status(400).json({ error: "Cannot delete master admin or yourself." });
    }
    dbCache.users = dbCache.users.filter(u => u.id !== req.params.id);
    writeDb();
    res.json({ success: true });
});

module.exports = router;
