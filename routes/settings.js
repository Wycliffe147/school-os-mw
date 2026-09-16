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
    res.json(readDb(req.user ? req.user.schoolId : 'default').settings);
});

router.post('/settings', requireAdmin, upload.single('logo'), (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    if (req.body.schoolName) db.settings.schoolName = req.body.schoolName;
    if (req.body.subtitle) db.settings.subtitle = req.body.subtitle;
    if (req.body.themeColor) db.settings.themeColor = req.body.themeColor;
    if (req.body.headteacherRemarksPass !== undefined) db.settings.headteacherRemarksPass = req.body.headteacherRemarksPass;
    if (req.body.headteacherRemarksFail !== undefined) db.settings.headteacherRemarksFail = req.body.headteacherRemarksFail;
    if (req.body.nextTermFees !== undefined) db.settings.nextTermFees = req.body.nextTermFees;
    if (req.body.nextTermDate !== undefined) db.settings.nextTermDate = req.body.nextTermDate;
    if (req.body.currentTerm !== undefined) db.settings.currentTerm = req.body.currentTerm;
    if (req.body.headerContactLabel !== undefined) db.settings.headerContactLabel = req.body.headerContactLabel;
    if (req.body.headerContactNumber !== undefined) db.settings.headerContactNumber = req.body.headerContactNumber;
    if (req.body.catWeight !== undefined) db.settings.catWeight = Number(req.body.catWeight);
    if (req.body.examWeight !== undefined) db.settings.examWeight = Number(req.body.examWeight);
    
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

module.exports = router;
