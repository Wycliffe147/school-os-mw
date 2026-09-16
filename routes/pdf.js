const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const { readDb } = require('../db');
const { generatePDF, rankStudents } = require('../services/pdfService');
const { authenticateToken } = require('../middleware/auth');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

router.use(authenticateToken);

router.post('/generate-pdf/:id', async (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    rankStudents(db);
    const ranked = db.students;
    const student = ranked.find(s => s.id === req.params.id);
    
    if (student) {
        const totalFees = student.totalFees || 0;
        const paidAmount = student.paidAmount || 0;
        const feeBalance = totalFees - paidAmount;
        if (feeBalance > 0 && !student.feeLockOverride) {
            return res.status(403).json({
                error: `Report card locked for ${student.name} due to outstanding fee balance of MK ${feeBalance.toLocaleString()}. Clear balance or enable admin override.`,
                isFeeLocked: true,
                feeBalance
            });
        }

        try {
            const pdfBytes = await generatePDF(student, db);
            const pdfPath = path.join(REPORTS_DIR, `${student.name.replace(/\s+/g, '_')}.pdf`);
            fs.writeFileSync(pdfPath, pdfBytes);
            res.json({ success: true, fileName: `${student.name.replace(/\s+/g, '_')}.pdf` });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(404).json({ error: "Student not found" });
    }
});

router.post('/generate-pdf-bulk', async (req, res) => {
    const { studentIds } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: "No student IDs provided" });
    }

    const db = readDb(req.user ? req.user.schoolId : 'default');
    rankStudents(db);
    
    try {
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        res.attachment('Report_Cards.zip');
        archive.pipe(res);

        for (const id of studentIds) {
            const student = db.students.find(s => s.id === id);
            if (student) {
                const totalFees = student.totalFees || 0;
                const paidAmount = student.paidAmount || 0;
                const feeBalance = totalFees - paidAmount;
                // If fee locked, skip including this student's report card in the ZIP batch
                if (feeBalance > 0 && !student.feeLockOverride) {
                    continue;
                }
                const pdfBytes = await generatePDF(student, db);
                const fileName = `${student.name.replace(/\s+/g, '_')}_Report.pdf`;
                archive.append(Buffer.from(pdfBytes), { name: fileName });
            }
        }

        await archive.finalize();
    } catch (e) {
        if (!res.headersSent) {
            res.status(500).json({ error: e.message });
        }
    }
});

router.get('/preview-pdf/dummy', async (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const dummyStudent = {
        name: "John Doe (Preview)",
        phone: "N/A",
        rank: 1,
        mscePoints: 6,
        totalMarks: 580,
        subjectsCount: 6,
        subjects: { "ENG": true, "MATH": true, "BIO": true, "CHEM": true, "PHY": true, "AGR": true },
        marks: { "ENG": 95, "MATH": 98, "BIO": 92, "CHEM": 99, "PHY": 96, "AGR": 100 }
    };
    
    try {
        const pdfBytes = await generatePDF(dummyStudent, db);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
        res.send(Buffer.from(pdfBytes));
    } catch (e) {
        res.status(500).send("Error generating preview: " + e.message);
    }
});

router.get('/preview-pdf/:id', async (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    rankStudents(db);
    const ranked = db.students;
    const student = ranked.find(s => s.id === req.params.id);
    
    if (student) {
        try {
            const pdfBytes = await generatePDF(student, db);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Content-Disposition', `inline; filename="${student.name.replace(/\s+/g, '_')}_preview.pdf"`);
            res.send(Buffer.from(pdfBytes));
        } catch (e) {
            res.status(500).send("Error generating preview: " + e.message);
        }
    } else {
        res.status(404).send("Student not found");
    }
});

module.exports = router;
