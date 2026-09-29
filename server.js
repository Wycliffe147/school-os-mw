require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const { initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const REPORTS_DIR = path.join(__dirname, 'reports');

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Register API Routes
app.use('/api', require('./routes/auth'));
// Public routes — registered FIRST so they are not blocked by protected routers below
app.use('/api', require('./routes/parentPortal'));
app.use('/api', require('./routes/discovery'));

// Protected routes (these have global router.use(authenticateToken) guards)
app.use('/api', require('./routes/saas'));
app.use('/api', require('./routes/students'));
app.use('/api', require('./routes/staff'));
app.use('/api', require('./routes/settings'));
app.use('/api', require('./routes/pdf'));
app.use('/api', require('./routes/whatsapp'));
// Phase 3
app.use('/api', require('./routes/payments'));
app.use('/api', require('./routes/timetable'));
app.use('/api', require('./routes/payroll'));

initDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    });
});
