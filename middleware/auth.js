const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-excel-academy-key-change-me';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token && req.query.token) token = req.query.token;
    if (!token) return res.status(401).json({ error: "Access denied" });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') return res.status(403).json({ error: "Admin access required" });
    next();
}

function requireStaffViewer(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.role !== 'class_teacher') {
        return res.status(403).json({ error: "Access required" });
    }
    next();
}

function blockClassTeacher(req, res, next) {
    if (req.user.role === 'class_teacher') return res.status(403).json({ error: "Class teachers cannot send report cards." });
    next();
}

function requireBursarOrAdmin(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.role !== 'bursar') {
        return res.status(403).json({ error: "Bursar or Admin access required" });
    }
    next();
}

function requireDisciplineOrAdmin(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.role !== 'discipline_master') {
        return res.status(403).json({ error: "Discipline Master or Admin access required" });
    }
    next();
}

function requireSuperAdmin(req, res, next) {
    if (req.user && req.user.role === 'superadmin') {
        next();
    } else {
        res.status(403).json({ error: "Superadmin access required" });
    }
}

module.exports = {
    JWT_SECRET,
    authenticateToken,
    requireAdmin,
    requireStaffViewer,
    blockClassTeacher,
    requireBursarOrAdmin,
    requireDisciplineOrAdmin,
    requireSuperAdmin
};
