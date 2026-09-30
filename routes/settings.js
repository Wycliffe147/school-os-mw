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

module.exports = router;
