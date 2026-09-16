const express = require('express');
const router = express.Router();

const { readDb, writeDb } = require('../db');
const { authenticateToken, requireBursarOrAdmin } = require('../middleware/auth');

// Mobile Money Gateway Webhook / Verification Endpoint (Airtel Money & TNM Mpamba)
router.post('/payments/mobile-money/callback', (req, res) => {
    const { schoolId, phone, amount, transactionRef, provider, studentId } = req.body;

    if (!phone || !amount || !transactionRef) {
        return res.status(400).json({ error: "Missing required fields (phone, amount, transactionRef)" });
    }

    const db = readDb(schoolId || 'default');
    
    // Find student by provided studentId or phone number
    let student = null;
    if (studentId) {
        student = db.students.find(s => s.id === studentId);
    }
    if (!student) {
        const cleanPhone = phone.replace(/\D/g, '');
        student = db.students.find(s => s.phone && (s.phone.replace(/\D/g, '').endsWith(cleanPhone) || cleanPhone.endsWith(s.phone.replace(/\D/g, ''))));
    }

    if (!student) {
        return res.status(404).json({ error: "No student matching phone or studentId found" });
    }

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
        return res.status(400).json({ error: "Invalid payment amount" });
    }

    if (!student.paymentHistory) student.paymentHistory = [];
    if (student.paidAmount === undefined) student.paidAmount = 0;

    const receiptNo = `${provider ? provider.toUpperCase() : 'MM'}-${transactionRef.slice(-6)}`;
    
    // Check for duplicate transaction
    if (student.paymentHistory.some(p => p.receiptNo === receiptNo || p.transactionRef === transactionRef)) {
        return res.status(409).json({ error: "Transaction reference already processed" });
    }

    const paymentRecord = {
        receiptNo,
        transactionRef,
        provider: provider || 'Mobile Money',
        amount: payAmount,
        date: new Date().toISOString(),
        note: `${provider || 'Mobile Money'} Auto-Payment (Ref: ${transactionRef})`,
        recordedBy: 'Mobile Money Gateway'
    };

    student.paymentHistory.push(paymentRecord);
    student.paidAmount += payAmount;

    writeDb();

    res.json({
        success: true,
        receipt: paymentRecord,
        studentName: student.name,
        paidAmount: student.paidAmount,
        totalFees: student.totalFees || 0,
        feeBalance: (student.totalFees || 0) - student.paidAmount
    });
});

// Admin manual mobile money transaction verification
router.post('/payments/verify-mobile-money', authenticateToken, requireBursarOrAdmin, (req, res) => {
    const { studentId, amount, transactionRef, provider } = req.body;
    const db = readDb(req.user ? req.user.schoolId : 'default');

    const student = db.students.find(s => s.id === studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
        return res.status(400).json({ error: "Invalid payment amount" });
    }

    if (!student.paymentHistory) student.paymentHistory = [];
    if (student.paidAmount === undefined) student.paidAmount = 0;

    const receiptNo = `${provider ? provider.toUpperCase() : 'MM'}-${transactionRef.slice(-6)}`;
    const paymentRecord = {
        receiptNo,
        transactionRef,
        provider: provider || 'Airtel/TNM',
        amount: payAmount,
        date: new Date().toISOString(),
        note: `${provider || 'Mobile Money'} Verified (Ref: ${transactionRef})`,
        recordedBy: req.user.username
    };

    student.paymentHistory.push(paymentRecord);
    student.paidAmount += payAmount;

    writeDb();

    res.json({
        success: true,
        receipt: paymentRecord,
        paidAmount: student.paidAmount,
        totalFees: student.totalFees || 0,
        feeBalance: (student.totalFees || 0) - student.paidAmount
    });
});

module.exports = router;
