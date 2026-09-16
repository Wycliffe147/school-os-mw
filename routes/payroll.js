const express = require('express');
const router = express.Router();

const { readDb, writeDb } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

// Get all staff profiles for the school
router.get('/payroll/staff', (req, res) => {
    const db = readDb(req.user ? req.user.schoolId : 'default');
    const staff = (db.users || [])
        .filter(u => u.schoolId === req.user.schoolId && u.role !== 'superadmin')
        .map(u => ({
            id: u.id,
            name: u.name,
            username: u.username,
            role: u.role,
            nationalId: u.nationalId || '',
            qualification: u.qualification || '',
            employmentType: u.employmentType || 'Full-Time',
            basicSalary: u.basicSalary || 0,
            allowances: u.allowances || { housing: 0, transport: 0, health: 0 },
            paymentHistory: u.paymentHistory || [],
            leaveBalance: u.leaveBalance !== undefined ? u.leaveBalance : 14,
            leaveHistory: u.leaveHistory || []
        }));
    res.json(staff);
});

// Update Staff HR Profile (salary, allowances, national ID, qualifications, employment type)
router.put('/payroll/staff/:id', (req, res) => {
    const dbCache = require('../db').getDbCache();
    const staffUser = dbCache.users.find(u => u.id === req.params.id);
    if (!staffUser) return res.status(404).json({ error: "Staff member not found" });

    const { basicSalary, allowances, nationalId, qualification, employmentType } = req.body;

    if (basicSalary !== undefined) staffUser.basicSalary = Number(basicSalary);
    if (allowances) staffUser.allowances = allowances;
    if (nationalId !== undefined) staffUser.nationalId = nationalId;
    if (qualification !== undefined) staffUser.qualification = qualification;
    if (employmentType !== undefined) staffUser.employmentType = employmentType;

    writeDb();
    res.json({ success: true });
});

// Generate and Record a Monthly Payslip
router.post('/payroll/payslip/:id', (req, res) => {
    const dbCache = require('../db').getDbCache();
    const staffUser = dbCache.users.find(u => u.id === req.params.id);
    if (!staffUser) return res.status(404).json({ error: "Staff member not found" });

    const basic = Number(staffUser.basicSalary || 0);
    const allowances = staffUser.allowances || { housing: 0, transport: 0, health: 0 };
    const totalAllowances = (Number(allowances.housing || 0) + Number(allowances.transport || 0) + Number(allowances.health || 0));
    const grossPay = basic + totalAllowances;

    // Malawi PAYE Tax calculation (simplified 2024 bands)
    let paye = 0;
    if (grossPay > 1_500_000) {
        paye = (grossPay - 1_500_000) * 0.40 + (1_000_000 * 0.35) + (500_000 * 0.30) + (500_000 * 0.15);
    } else if (grossPay > 500_000) {
        paye = (grossPay - 500_000) * 0.35 + (500_000 * 0.30) + (500_000 * 0.15);
    } else if (grossPay > 0) {
        // First MK 0-100,000 exempt, MK 100,001-500,000 at 15%
        const taxable = Math.max(0, grossPay - 100_000);
        const at30pct = Math.max(0, Math.min(taxable, 400_000));
        paye = at30pct * 0.15;
    }
    paye = Math.round(paye);

    // Pension (MIPF): 5% employee contribution
    const pension = Math.round(basic * 0.05);

    const netPay = grossPay - paye - pension;

    const { month, year } = req.body;

    if (!staffUser.paymentHistory) staffUser.paymentHistory = [];

    const slipId = `SLIP-${Date.now().toString().slice(-6)}`;
    const payslip = {
        slipId,
        month: month || new Date().toLocaleString('default', { month: 'long' }),
        year: year || new Date().getFullYear(),
        basicSalary: basic,
        allowances,
        totalAllowances,
        grossPay,
        paye,
        pension,
        netPay,
        generatedAt: new Date().toISOString(),
        generatedBy: req.user.username
    };

    staffUser.paymentHistory.push(payslip);
    writeDb();

    res.json({ success: true, payslip });
});

// Record Leave for a Staff Member
router.post('/payroll/leave/:id', (req, res) => {
    const dbCache = require('../db').getDbCache();
    const staffUser = dbCache.users.find(u => u.id === req.params.id);
    if (!staffUser) return res.status(404).json({ error: "Staff member not found" });

    const { startDate, endDate, reason, type } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ error: "Start and end date required" });

    const days = Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

    if (!staffUser.leaveHistory) staffUser.leaveHistory = [];
    if (staffUser.leaveBalance === undefined) staffUser.leaveBalance = 14;

    if (type !== 'Sick' && staffUser.leaveBalance < days) {
        return res.status(400).json({ error: `Insufficient leave balance. Available: ${staffUser.leaveBalance} day(s).` });
    }

    if (type !== 'Sick') {
        staffUser.leaveBalance -= days;
    }

    staffUser.leaveHistory.push({
        startDate,
        endDate,
        days,
        reason: reason || '',
        type: type || 'Annual Leave',
        recordedBy: req.user.username,
        createdAt: new Date().toISOString()
    });

    writeDb();
    res.json({ success: true, leaveBalance: staffUser.leaveBalance });
});

module.exports = router;
