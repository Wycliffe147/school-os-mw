const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { readDb, getDbCache } = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

// In-memory Rate Limiter for Login
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10;

function loginRateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (entry) {
        if (now - entry.firstAttempt < RATE_LIMIT_WINDOW_MS) {
            if (entry.count >= RATE_LIMIT_MAX) {
                return res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
            }
            entry.count++;
        } else {
            loginAttempts.set(ip, { count: 1, firstAttempt: now });
        }
    } else {
        loginAttempts.set(ip, { count: 1, firstAttempt: now });
    }
    next();
}

router.post('/login', loginRateLimiter, (req, res) => {
    readDb('default');
    const dbCache = getDbCache();
    const username = (req.body.username || '').trim();
    const password = (req.body.password || '');
    const schoolId = (req.body.schoolId || '').trim();

    if (schoolId === 'superadmin') {
        const user = dbCache.users.find(u => u.username === username && u.role === 'superadmin');
        if (!user) return res.status(401).json({ error: "User not found (superadmin)" });
        if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: "Wrong password (superadmin)" });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, subjects: user.subjects || [], classes: user.classes || [], name: user.name, schoolId: user.schoolId || 'default' }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ token, user: { id: user.id, username: user.username, role: user.role, subjects: user.subjects || [], classes: user.classes || [], name: user.name } });
    }

    const user = dbCache.users.find(u =>
        u.username.trim() === username &&
        (u.schoolId === schoolId || (!u.schoolId && schoolId === 'default'))
    );
    if (!user) return res.status(401).json({ error: `User not found in school: ${schoolId}` });
    if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: "Wrong password" });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, subjects: user.subjects || [], classes: user.classes || [], name: user.name, schoolId: user.schoolId || 'default' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, subjects: user.subjects || [], classes: user.classes || [], name: user.name } });
});

router.get('/public/schools', (req, res) => {
    readDb('default');
    const dbCache = getDbCache();
    const list = Object.keys(dbCache.schools)
        .filter(id => {
            if (id === 'default') {
                return (dbCache.users || []).some(u => u.schoolId === 'default' && u.role !== 'superadmin');
            }
            return true;
        })
        .map(id => ({
            schoolId: id,
            schoolName: dbCache.schools[id].settings.schoolName || 'Unnamed School'
        }));
    res.json(list);
});

router.get('/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
