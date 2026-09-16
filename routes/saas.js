const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const { readDb, writeDb, getDbCache } = require('../db');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireSuperAdmin);

router.get('/saas/schools', (req, res) => {
    readDb('default');
    const dbCache = getDbCache();
    const stats = Object.keys(dbCache.schools)
        .filter(schoolId => schoolId !== 'default')
        .map(schoolId => {
            const s = dbCache.schools[schoolId];
            const admins = dbCache.users.filter(u => u.schoolId === schoolId && (u.role === 'admin' || u.role === 'superadmin'));
            return {
                schoolId,
                schoolName: s.settings.schoolName || "Unnamed School",
                studentCount: s.students.length,
                adminUsers: admins.map(a => a.username)
            };
        });
    res.json(stats);
});

router.post('/saas/schools', (req, res) => {
    readDb('default');
    const dbCache = getDbCache();
    try {
        const { schoolName, adminUsername, adminPassword } = req.body;
        if (!schoolName || !adminUsername || !adminPassword) return res.status(400).json({error: "Missing fields"});
        if (dbCache.users.find(u => u.username === adminUsername)) return res.status(400).json({error: "Username taken"});
        
        const schoolId = 'school_' + Date.now();
        
        const defaultSettings = dbCache.schools['default']?.settings || {};
        dbCache.schools[schoolId] = {
            students: [],
            settings: JSON.parse(JSON.stringify(defaultSettings)),
            subjects: [...(dbCache.schools['default']?.subjects || [])]
        };
        dbCache.schools[schoolId].settings.schoolName = schoolName;
        
        dbCache.users.push({
            id: 'admin_' + Date.now(),
            username: adminUsername,
            name: 'School Admin',
            passwordHash: bcrypt.hashSync(adminPassword, 8),
            role: 'admin',
            schoolId: schoolId,
            subjects: []
        });
        
        writeDb();
        res.json({ success: true, schoolId });
    } catch (e) {
        console.error('Error creating school:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/saas/schools/:schoolId', (req, res) => {
    readDb('default');
    const dbCache = getDbCache();
    const { schoolId } = req.params;
    if (schoolId === 'default') return res.status(400).json({ error: "Cannot delete the default school" });
    if (!dbCache.schools[schoolId]) return res.status(404).json({ error: "School not found" });
    
    delete dbCache.schools[schoolId];
    dbCache.users = dbCache.users.filter(u => u.schoolId !== schoolId);
    writeDb();
    res.json({ success: true });
});

router.put('/saas/schools/:schoolId', (req, res) => {
    readDb('default');
    const dbCache = getDbCache();
    const { schoolId } = req.params;
    if (!dbCache.schools[schoolId]) return res.status(404).json({ error: "School not found" });
    const { newUsername, newPassword } = req.body;
    if (!newUsername && !newPassword) return res.status(400).json({ error: "Provide at least a new username or password" });

    const adminUser = dbCache.users.find(u => u.schoolId === schoolId && u.role === 'admin');
    if (!adminUser) return res.status(404).json({ error: "No admin user found for this school" });

    if (newUsername && newUsername !== adminUser.username) {
        const taken = dbCache.users.find(u => u.username === newUsername && u.id !== adminUser.id);
        if (taken) return res.status(400).json({ error: "Username already taken by another user" });
        adminUser.username = newUsername;
    }
    if (newPassword) {
        adminUser.passwordHash = bcrypt.hashSync(newPassword, 8);
        adminUser.password = newPassword;
    }
    writeDb();
    res.json({ success: true });
});

router.put('/saas/me', (req, res) => {
    readDb('default');
    const dbCache = getDbCache();
    const { newUsername, newPassword } = req.body;
    if (!newUsername && !newPassword) {
        return res.status(400).json({ error: 'Provide at least a new username or password.' });
    }

    const me = dbCache.users.find(u => u.id === req.user.id);
    if (!me) return res.status(404).json({ error: 'Superadmin account not found.' });

    if (newUsername && newUsername !== me.username) {
        const taken = dbCache.users.find(u => u.username === newUsername && u.id !== me.id);
        if (taken) return res.status(400).json({ error: 'Username already taken.' });
        me.username = newUsername;
    }
    if (newPassword) {
        me.passwordHash = bcrypt.hashSync(newPassword, 8);
        me.password = newPassword;
    }

    writeDb();
    res.json({ success: true });
});

module.exports = router;
