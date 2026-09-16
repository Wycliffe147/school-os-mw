const express = require('express');
const router = express.Router();
const { readDb, writeDb, getDbCache } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Distance calculation helper (Haversine formula in kilometers)
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10; // 1 decimal place
}

// Default Malawi District sample coordinates (for fallback if school hasn't set explicit lat/lng)
const DISTRICT_COORDS = {
    'Blantyre': { lat: -15.7861, lng: 35.0058 },
    'Lilongwe': { lat: -13.9626, lng: 33.7741 },
    'Mzuzu':    { lat: -11.4581, lng: 34.0151 },
    'Zomba':    { lat: -15.3833, lng: 35.3333 },
    'Kasungu':  { lat: -13.0333, lng: 33.4833 },
    'Mangochi': { lat: -14.4781, lng: 35.2645 },
    'Salima':   { lat: -13.7804, lng: 34.4587 }
};

// ── GET /api/public/explore ─────────────────────────────────────────────
// Public endpoint for school discovery network
router.get('/public/explore', (req, res) => {
    readDb('default');
    const dbCache = getDbCache();
    const { district, userLat, userLng, search, boarding, lab } = req.query;

    const uLat = userLat ? parseFloat(userLat) : null;
    const uLng = userLng ? parseFloat(userLng) : null;

    const schools = Object.keys(dbCache.schools)
        .filter(id => {
            if (id === 'default') {
                return (dbCache.users || []).some(u => u.schoolId === 'default' && u.role !== 'superadmin');
            }
            return true;
        })
        .map(id => {
            const schoolData = dbCache.schools[id];
            const settings = schoolData.settings || {};
            const students = schoolData.students || [];

            // District & GPS logic
            const sDistrict = settings.district || 'Blantyre';
            const defaultCoords = DISTRICT_COORDS[sDistrict] || DISTRICT_COORDS['Blantyre'];
            const lat = settings.latitude ? parseFloat(settings.latitude) : defaultCoords.lat;
            const lng = settings.longitude ? parseFloat(settings.longitude) : defaultCoords.lng;

            const distanceKm = (uLat && uLng) ? calculateDistance(uLat, uLng, lat, lng) : null;

            // Compute statistics
            const totalStudents = students.length;
            const totalStaff = (dbCache.users || []).filter(u => u.schoolId === id && u.role !== 'superadmin').length;
            const teacherRatio = totalStaff > 0 ? `1:${Math.round(totalStudents / totalStaff)}` : '1:25';

            // Automatic verified achievement badges
            const badges = [];
            if (totalStudents > 50) badges.push(' Verified Secondary Institution');
            if (settings.facilities && settings.facilities.includes('Science Lab')) badges.push('🔬 Science Lab Equipped');
            if (settings.facilities && settings.facilities.includes('Computer Lab')) badges.push('💻 ICT Center');
            if (settings.facilities && settings.facilities.includes('Boarding')) badges.push('🏠 Full Boarding Available');

            // Fee estimate
            const sampleStudent = students.find(s => s.totalFees > 0);
            const approxFees = sampleStudent ? sampleStudent.totalFees : (settings.defaultTermFee || 150000);

            return {
                schoolId: id,
                schoolName: settings.schoolName || 'Malawi Academy',
                motto: settings.motto || 'Excellence in Education',
                district: sDistrict,
                address: settings.address || `${sDistrict}, Malawi`,
                phone: settings.phone || '+265 888 000 000',
                email: settings.email || `info@${id}.ac.mw`,
                latitude: lat,
                longitude: lng,
                distanceKm,
                totalStudents,
                teacherRatio,
                approxFees,
                facilities: settings.facilities || ['Classrooms', 'Sports Ground'],
                subjects: settings.subjects || ['Mathematics', 'English', 'Biology', 'Physical Science', 'Chichewa', 'Geography', 'History'],
                badges,
                rating: settings.rating || 4.8,
                reviewsCount: (schoolData.reviews || []).length
            };
        });

    // Apply filtering
    let filtered = schools;

    if (district && district !== 'All') {
        filtered = filtered.filter(s => s.district.toLowerCase() === district.toLowerCase());
    }

    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(s => s.schoolName.toLowerCase().includes(q) || s.district.toLowerCase().includes(q) || s.motto.toLowerCase().includes(q));
    }

    if (boarding === 'true') {
        filtered = filtered.filter(s => s.facilities.includes('Boarding'));
    }

    if (lab === 'true') {
        filtered = filtered.filter(s => s.facilities.includes('Science Lab') || s.facilities.includes('Computer Lab'));
    }

    // Sort by distance if GPS is provided, else by rating
    if (uLat && uLng) {
        filtered.sort((a, b) => (a.distanceKm || 9999) - (b.distanceKm || 9999));
    } else {
        filtered.sort((a, b) => b.rating - a.rating);
    }

    res.json({ count: filtered.length, schools: filtered });
});

// ── GET /api/public/explore/:schoolId ──────────────────────────────────
router.get('/public/explore/:schoolId', (req, res) => {
    readDb('default');
    const dbCache = getDbCache();
    const { schoolId } = req.params;
    const schoolData = dbCache.schools[schoolId];
    if (!schoolData) return res.status(404).json({ error: 'School not found' });

    const settings = schoolData.settings || {};
    const students = schoolData.students || [];

    const reviews = schoolData.reviews || [
        { name: 'Chifundo Banda (Parent)', rating: 5, date: '2026-02-14', comment: 'Excellent academic standards and disciplined teachers.' },
        { name: 'Mary Phiri (Alumni)', rating: 5, date: '2025-11-20', comment: 'Prepared me well for my MSCE exams.' }
    ];

    res.json({
        schoolId,
        schoolName: settings.schoolName || 'Malawi Academy',
        motto: settings.motto || 'Excellence in Education',
        district: settings.district || 'Blantyre',
        address: settings.address || 'Malawi',
        phone: settings.phone || '+265 888 000 000',
        email: settings.email || `info@${schoolId}.ac.mw`,
        facilities: settings.facilities || ['Science Lab', 'Computer Lab', 'Library', 'Sports Ground'],
        subjects: settings.subjects || ['Mathematics', 'English', 'Biology', 'Physical Science', 'Chichewa', 'Geography', 'History', 'Agriculture'],
        gradingSystem: settings.gradingSystem || 'Senior MSCE (1-9 Points)',
        reviews
    });
});

// ── POST /api/public/apply ──────────────────────────────────────────────
// Parent submits admission application
router.post('/public/apply', (req, res) => {
    const { schoolId, studentName, parentName, parentPhone, classApplied, previousSchool } = req.body;
    if (!schoolId || !studentName || !parentPhone) {
        return res.status(400).json({ error: 'School ID, student name, and parent phone are required' });
    }

    const dbCache = getDbCache();
    const schoolData = dbCache.schools[schoolId];
    if (!schoolData) return res.status(404).json({ error: 'School not found' });

    if (!schoolData.applications) schoolData.applications = [];

    const app = {
        id: `APP_${Date.now()}`,
        studentName,
        parentName: parentName || '',
        parentPhone,
        classApplied: classApplied || 'Form 1',
        previousSchool: previousSchool || '',
        status: 'Pending',
        appliedAt: new Date().toISOString()
    };

    schoolData.applications.push(app);
    writeDb();

    res.json({ success: true, applicationId: app.id, message: `Application submitted successfully to ${schoolData.settings.schoolName || schoolId}!` });
});

// ── GET /api/admin/applications (School Admin) ─────────────────────────
router.get('/admin/applications', authenticateToken, requireAdmin, (req, res) => {
    const dbCache = getDbCache();
    const schoolData = dbCache.schools[req.user.schoolId] || {};
    res.json(schoolData.applications || []);
});

// ── PUT /api/admin/applications/:id (Approve/Reject) ───────────────────
router.put('/admin/applications/:id', authenticateToken, requireAdmin, (req, res) => {
    const dbCache = getDbCache();
    const schoolData = dbCache.schools[req.user.schoolId];
    if (!schoolData || !schoolData.applications) return res.status(404).json({ error: 'Application not found' });

    const app = schoolData.applications.find(a => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    const { status, note } = req.body;
    if (status) app.status = status;
    if (note) app.adminNote = note;

    writeDb();
    res.json({ success: true, application: app });
});

module.exports = router;
