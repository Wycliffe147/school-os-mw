let students = [];
let masterSubjects = [];
let subjectsList = [];
let subjectsMap = {};
let schoolSections = []; // School enrollment sections with fees

window.hasUnsavedChanges = false;

window.addEventListener('beforeunload', (e) => {
    if (window.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});

async function loadGlobals() {
    try {
        const res = await apiFetch('/api/settings');
        if (!res.ok) return;
        const settings = await res.json();
        masterSubjects = settings.masterSubjects || [];
        subjectsList = masterSubjects.filter(s => s.active).map(s => s.name).sort();
        subjectsMap = {};
        masterSubjects.forEach(s => subjectsMap[s.name] = s.abbr);

        // Load school sections
        schoolSections = (settings.sections && settings.sections.length > 0)
            ? settings.sections
            : [{ id: 'general', name: 'General', fee: 0, isDefault: true }];

        // Populate student section dropdown (only show if >1 section)
        const sectionGroup = document.getElementById('student-section-group');
        const sectionSelect = document.getElementById('student-section');
        if (sectionGroup && sectionSelect) {
            if (schoolSections.length > 1) {
                sectionSelect.innerHTML = schoolSections.map(sec =>
                    `<option value="${sec.id}" ${sec.isDefault ? 'selected' : ''}>${sec.name} (MK ${Number(sec.fee).toLocaleString()})</option>`
                ).join('');
                sectionGroup.style.display = '';
            } else {
                sectionGroup.style.display = 'none';
            }
        }

        // Populate fee ledger section filter (only show if >1 section)
        const feeSectionFilterContainer = document.getElementById('fee-section-filter-container');
        const feeSectionFilter = document.getElementById('fee-section-filter');
        if (feeSectionFilter) {
            feeSectionFilter.innerHTML = '<option value="ALL">All Sections</option>' +
                schoolSections.map(sec => `<option value="${sec.id}">${sec.name}</option>`).join('');
        }
        if (feeSectionFilterContainer) {
            feeSectionFilterContainer.style.display = schoolSections.length > 1 ? '' : 'none';
        }

        const sidebarSchoolName = document.getElementById('sidebar-school-name');
        if (sidebarSchoolName && settings.schoolName) {
            sidebarSchoolName.innerText = settings.schoolName;
        }
        if (document.getElementById('cat-weight')) {
            document.getElementById('cat-weight').value = settings.catWeight !== undefined ? settings.catWeight : 30;
        }
        if (document.getElementById('exam-weight')) {
            document.getElementById('exam-weight').value = settings.examWeight !== undefined ? settings.examWeight : 70;
        }
    } catch(e) {}
}

function getAbbreviation(sub) {
    return subjectsMap[sub] || sub.substring(0,3).toUpperCase();
}

function formatRole(role) {
    if (role === 'class_teacher') return 'Class Teacher';
    if (role === 'superadmin') return 'Super Admin';
    if (role === 'bursar') return 'Bursar';
    if (role === 'discipline_master') return 'Discipline Master';
    if (!role) return '';
    return role.charAt(0).toUpperCase() + role.slice(1);
}

const CLASS_LEVELS = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];

let authToken = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');

async function apiFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (authToken) options.headers['Authorization'] = `Bearer ${authToken}`;
    const response = await fetch(url, options);
    if (response.status === 401 || response.status === 403) {
        handleLogout();
        throw new Error("Unauthorized");
    }
    return response;
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    authToken = null;
    currentUser = null;
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
}

let currentClass = 'Form 1';

function renderActiveTab() {
    const activeTab = document.querySelector('.nav-links li.active');
    if (!activeTab) return;
    const tabId = activeTab.getAttribute('data-tab');
    if (tabId === 'students-tab') renderStudentsTab();
    if (tabId === 'fees-tab') renderFeesTab();
    if (tabId === 'attendance-tab') renderAttendanceTab();
    if (tabId === 'timetable-tab') renderTimetableTab();
    if (tabId === 'payroll-tab') renderPayrollTab();
    if (tabId === 'notices-tab') renderNoticesTab();
    if (tabId === 'applications-tab') renderApplicationsTab();
    if (tabId === 'staff-tab') renderStaffTab();
    if (tabId === 'marks-tab') renderMarksTab();
    if (tabId === 'rankings-tab') renderRankingsTab();
    if (tabId === 'explorer-tab') renderExplorerTab();
    if (tabId === 'analytics-tab') renderAnalyticsTab();
}

function setGlobalClass(val) {
    currentClass = val;
    const textEl = document.getElementById('global-class-text');
    if (textEl) textEl.textContent = val;
    const menu = document.getElementById('global-class-menu');
    if (menu) {
        menu.querySelectorAll('.dropdown-option').forEach(opt => {
            if (opt.getAttribute('data-val') === val) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
    }
}

function updateGlobalClassSelector(visibleClasses) {
    const menu = document.getElementById('global-class-menu');
    if (!menu) return;
    menu.querySelectorAll('.dropdown-option').forEach(opt => {
        const val = opt.getAttribute('data-val');
        opt.style.display = visibleClasses.includes(val) ? 'flex' : 'none';
    });
    if (!visibleClasses.includes(currentClass)) {
        setGlobalClass(visibleClasses[0]);
    } else {
        setGlobalClass(currentClass);
    }
}

(function setupGlobalClassDropdown() {
    const toggle = document.getElementById('global-class-toggle');
    const menu = document.getElementById('global-class-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
    });

    document.addEventListener('click', () => menu.classList.remove('open'));

    menu.querySelectorAll('.dropdown-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = opt.getAttribute('data-val');
            setGlobalClass(val);
            menu.classList.remove('open');
            renderActiveTab();
        });
    });
})();

async function checkLogin() {
    if (authToken && currentUser) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        document.getElementById('user-greeting').innerText = `Welcome, ${currentUser.name}`;
        if (document.getElementById('user-greeting-header')) {
            document.getElementById('user-greeting-header').innerText = `Welcome, ${currentUser.name}`;
        }
        document.getElementById('class-selector-container').style.display = 'flex';
        
        await loadGlobals();

        // Restrict the global class picker to a class teacher's own assigned class(es)
        // AND any other class they have subjects assigned in
        if (currentUser.role === 'class_teacher') {
            const homeroomClasses = (currentUser.classes && currentUser.classes.length) ? currentUser.classes : [];
            const subjectClasses = (currentUser.subjects || []).map(s => s.split(':')[0]);
            const myClasses = [...new Set([...homeroomClasses, ...subjectClasses])]
                .filter(c => CLASS_LEVELS.includes(c));
            const visibleClasses = myClasses.length ? myClasses : CLASS_LEVELS;
            updateGlobalClassSelector(visibleClasses);
        } else {
            updateGlobalClassSelector(CLASS_LEVELS);
        }

        if (currentUser.role === 'class_teacher') {
            document.querySelectorAll('.nav-links li').forEach(li => li.style.display = 'block');
            document.getElementById('nav-superadmin').style.display = 'none';
            document.getElementById('nav-analytics').style.display = 'none';
            document.querySelector('[data-tab="fees-tab"]').style.display = 'none';
            document.querySelector('[data-tab="payroll-tab"]').style.display = 'none';
            document.querySelector('[data-tab="staff-tab"]').style.display = 'none';
            document.querySelector('[data-tab="whatsapp-tab"]').style.display = 'none';
            document.querySelector('[data-tab="settings-tab"]').style.display = 'none';
            document.querySelector('[data-tab="applications-tab"]').style.display = 'none';
            document.querySelector('[data-tab="attendance-tab"]').style.display = 'none';

            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            document.querySelector('[data-tab="students-tab"]').classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById('students-tab').classList.add('active');
            renderStudentsTab();
        } else if (currentUser.role === 'bursar') {
            document.querySelectorAll('.nav-links li').forEach(li => li.style.display = 'none');
            document.querySelector('[data-tab="students-tab"]').style.display = 'block';
            document.querySelector('[data-tab="fees-tab"]').style.display = 'block';
            if (document.querySelector('[data-tab="explorer-tab"]')) document.querySelector('[data-tab="explorer-tab"]').style.display = 'block';

            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            document.querySelector('[data-tab="fees-tab"]').classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById('fees-tab').classList.add('active');
            renderFeesTab();
        } else if (currentUser.role === 'discipline_master') {
            document.querySelectorAll('.nav-links li').forEach(li => li.style.display = 'none');
            document.querySelector('[data-tab="students-tab"]').style.display = 'block';
            document.querySelector('[data-tab="attendance-tab"]').style.display = 'block';
            if (document.querySelector('[data-tab="explorer-tab"]')) document.querySelector('[data-tab="explorer-tab"]').style.display = 'block';

            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            document.querySelector('[data-tab="attendance-tab"]').classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById('attendance-tab').classList.add('active');
            renderAttendanceTab();
        } else if (currentUser.role === 'teacher') {
            document.querySelectorAll('.nav-links li').forEach(li => li.style.display = 'block');
            document.querySelector('[data-tab="students-tab"]').style.display = 'none';
            document.querySelector('[data-tab="fees-tab"]').style.display = 'none';
            document.querySelector('[data-tab="payroll-tab"]').style.display = 'none';
            document.querySelector('[data-tab="staff-tab"]').style.display = 'none';
            document.querySelector('[data-tab="applications-tab"]').style.display = 'none';
            document.querySelector('[data-tab="rankings-tab"]').style.display = 'none';
            document.querySelector('[data-tab="whatsapp-tab"]').style.display = 'none';
            document.querySelector('[data-tab="settings-tab"]').style.display = 'none';
            document.querySelector('[data-tab="superadmin-tab"]').style.display = 'none';
            document.querySelector('[data-tab="attendance-tab"]').style.display = 'none';
            document.getElementById('nav-analytics').style.display = 'none';

            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            document.querySelector('[data-tab="marks-tab"]').classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById('marks-tab').classList.add('active');
            renderMarksTab();
        } else if (currentUser.role === 'superadmin') {
            // Show all tabs including Super Admin and Analytics
            document.querySelectorAll('.nav-links li').forEach(li => li.style.display = 'block');
            document.getElementById('nav-superadmin').style.display = 'block';
            document.getElementById('nav-analytics').style.display = 'block';
            // Always land on Students tab
            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            document.querySelector('[data-tab="students-tab"]').classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById('students-tab').classList.add('active');
            renderStudentsTab();
        } else {
            // admin: show all except superadmin tab; show analytics
            document.querySelectorAll('.nav-links li').forEach(li => li.style.display = 'block');
            document.getElementById('nav-superadmin').style.display = 'none';
            document.getElementById('nav-analytics').style.display = 'block';
            // Always land on Students tab
            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            document.querySelector('[data-tab="students-tab"]').classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById('students-tab').classList.add('active');
            renderStudentsTab();
        }
    } else {
        handleLogout();
    }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;
    const schoolId = document.getElementById('login-school').value;
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: u, password: p, schoolId })
    });
    if (res.ok) {
        const data = await res.json();
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(currentUser));
        document.getElementById('login-error').style.display = 'none';
        checkLogin();
    } else {
        let msg = 'Invalid credentials. Please try again.';
        try { const d = await res.json(); if (d.error) msg = d.error + ' (HTTP ' + res.status + ')'; } catch(e) {}
        document.getElementById('login-error').innerText = msg;
        document.getElementById('login-error').style.display = 'block';
    }
});

// ── Two-step Login: School picker ─────────────────────────────────
let allSchools = []; // cached school list

function renderSchoolList(filter = '') {
    const list = document.getElementById('school-list');
    const q = filter.trim().toLowerCase();

    // Build display list: matching schools + Super Admin always at bottom
    const matched = allSchools.filter(s => !q || s.schoolName.toLowerCase().includes(q));

    list.innerHTML = '';

    if (matched.length === 0 && q) {
        list.innerHTML = '<p class="subtitle" style="text-align:center;padding:14px;">No schools found.</p>';
    }

    matched.forEach(s => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'school-pick-btn';
        btn.innerHTML = `
            <span class="school-pick-icon">🏫</span>
            <span class="school-pick-name">${s.schoolName}</span>
            <span class="school-pick-arrow">›</span>
        `;
        btn.addEventListener('click', () => selectSchool(s.schoolId, s.schoolName));
        list.appendChild(btn);
    });

    // Super Admin always visible (no search filter on it)
    if (!q || 'super admin'.includes(q)) {
        const saBtn = document.createElement('button');
        saBtn.type = 'button';
        saBtn.className = 'school-pick-btn school-pick-superadmin';
        saBtn.innerHTML = `
            <span class="school-pick-icon">🔑</span>
            <span class="school-pick-name">Super Admin</span>
            <span class="school-pick-arrow">›</span>
        `;
        saBtn.addEventListener('click', () => selectSchool('superadmin', '🔑 Super Admin'));
        list.appendChild(saBtn);
    }
}

function goBackToSchoolList() {
    document.getElementById('login-step-2').style.display = 'none';
    document.getElementById('login-step-1').style.display = 'block';
    document.getElementById('school-search').focus();
}

function selectSchool(schoolId, schoolName) {
    document.getElementById('login-school').value = schoolId;
    document.getElementById('login-school-label').textContent = schoolName;
    document.getElementById('login-step-1').style.display = 'none';
    document.getElementById('login-step-2').style.display = 'block';
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').style.display = 'none';
    setTimeout(() => document.getElementById('login-username').focus(), 50);
    // Push a history state so the phone's back gesture comes here first
    history.pushState({ loginStep: 2 }, '');
}

document.getElementById('login-back-btn').addEventListener('click', () => {
    history.back(); // triggers popstate which calls goBackToSchoolList
});

// Intercept phone/browser back gesture while on step 2
window.addEventListener('popstate', (e) => {
    const step2 = document.getElementById('login-step-2');
    if (step2 && step2.style.display !== 'none') {
        goBackToSchoolList();
    }
});

document.getElementById('school-search').addEventListener('input', (e) => {
    renderSchoolList(e.target.value);
});

async function loadSchoolOptions() {
    try {
        const res = await fetch('/api/public/schools');
        if (!res.ok) throw new Error('Failed');
        allSchools = await res.json();
    } catch (e) {
        allSchools = [];
        console.error('Could not load schools:', e);
    }
    renderSchoolList();
}
loadSchoolOptions();

document.getElementById('logout-btn').addEventListener('click', handleLogout);

// Handle Tabs Routing
document.querySelectorAll('.nav-links li').forEach(item => {
    item.addEventListener('click', () => {
        if (window.hasUnsavedChanges) {
            if (!confirm("You have unsaved changes. Are you sure you want to leave without saving?")) {
                return;
            }
            window.hasUnsavedChanges = false;
        }

        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        
        item.classList.add('active');
        const tabId = item.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        if (tabId === 'students-tab') renderStudentsTab();
        if (tabId === 'fees-tab') renderFeesTab();
        if (tabId === 'attendance-tab') renderAttendanceTab();
        if (tabId === 'timetable-tab') renderTimetableTab();
        if (tabId === 'payroll-tab') renderPayrollTab();
        if (tabId === 'staff-tab') renderStaffTab();
        if (tabId === 'marks-tab') renderMarksTab();
        if (tabId === 'rankings-tab') renderRankingsTab();
        if (tabId === 'explorer-tab') renderExplorerTab();
        if (tabId === 'whatsapp-tab') setupWhatsAppStatusPolling();
        if (tabId === 'notices-tab') renderNoticesTab();
        if (tabId === 'applications-tab') renderApplicationsTab();
        if (tabId === 'settings-tab') loadSettings();
        if (tabId === 'superadmin-tab') loadSuperAdmin();
        if (tabId === 'analytics-tab') renderAnalyticsTab();
    });
});

// Bulk Select All
const selectAllCheckbox = document.getElementById('selectAllReports');
if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.report-cb');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });
}

// Helper: Check missing marks for students
function checkMissingMarks(studentIds) {
    const results = [];
    (studentIds || []).forEach(id => {
        const student = students.find(s => s.id === id);
        if (!student) return;

        const activeSubjects = Object.keys(student.subjects || {}).filter(sub => student.subjects[sub] === true);
        const missing = activeSubjects.filter(sub => {
            const hasCat = student.catMarks && student.catMarks[sub] !== undefined && student.catMarks[sub] !== null && student.catMarks[sub] !== '';
            const hasExam = student.examMarks && student.examMarks[sub] !== undefined && student.examMarks[sub] !== null && student.examMarks[sub] !== '';
            const hasFinal = student.marks && student.marks[sub] !== undefined && student.marks[sub] !== null && student.marks[sub] !== '';
            return !hasCat && !hasExam && !hasFinal;
        });

        if (missing.length > 0) {
            results.push({
                id: student.id,
                name: student.name,
                classLevel: student.classLevel || 'Form 1',
                missingSubjects: missing
            });
        }
    });
    return results;
}

function promptMissingMarksWarning(missingList, actionName) {
    const studentLines = missingList.slice(0, 5).map(s => `• ${s.name} (${s.classLevel}): ${s.missingSubjects.join(', ')}`).join('\n');
    const extraCount = missingList.length > 5 ? `\n...and ${missingList.length - 5} other student(s)` : '';
    const confirmMsg = `⚠️ MISSING MARKS WARNING\n\nThe following ${missingList.length} student(s) have registered subjects without recorded marks:\n\n${studentLines}${extraCount}\n\nReport cards for these students will show 'Absent/No Score' for missing subjects.\n\nDo you want to proceed with ${actionName}?`;
    return confirm(confirmMsg);
}

// Download Selected
const btnDownloadSelected = document.getElementById('btn-download-selected');
if (btnDownloadSelected) {
    btnDownloadSelected.addEventListener('click', async () => {
        const selected = Array.from(document.querySelectorAll('.report-cb:checked')).map(cb => cb.value);
        if (selected.length === 0) {
            return alert("Please select at least one student.");
        }

        const missingList = checkMissingMarks(selected);
        if (missingList.length > 0) {
            if (!promptMissingMarksWarning(missingList, "downloading report cards as ZIP")) {
                return;
            }
        }
        
        btnDownloadSelected.innerText = 'Zipping... Please wait';
        
        try {
            const res = await apiFetch(`/api/generate-pdf-bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentIds: selected })
            });
            
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Report_Cards_${selected.length}.zip`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                btnDownloadSelected.innerText = '✅ Download Complete';
            } else {
                alert('Error generating bulk PDF ZIP.');
                btnDownloadSelected.innerText = '⬇️ Download Selected as ZIP';
            }
        } catch (e) {
            alert('Network error.');
        }
        
        setTimeout(() => {
            btnDownloadSelected.innerText = '⬇️ Download Selected as ZIP';
        }, 3000);
    });
}

// Send Selected via WhatsApp
const btnSendSelected = document.getElementById('btn-send-selected');
if (btnSendSelected) {
    btnSendSelected.addEventListener('click', async () => {
        const selected = Array.from(document.querySelectorAll('.report-cb:checked')).map(cb => cb.value);
        if (selected.length === 0) {
            return alert("Please select at least one student.");
        }

        const missingList = checkMissingMarks(selected);
        if (missingList.length > 0) {
            if (!promptMissingMarksWarning(missingList, "sending report cards via WhatsApp")) {
                return;
            }
        }

        const progressBox = document.getElementById('bulk-send-progress');
        const progressFill = document.getElementById('bulk-send-fill');
        const progressText = document.getElementById('bulk-send-text');

        progressBox.style.display = 'block';
        progressFill.style.width = '0%';
        btnSendSelected.disabled = true;

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < selected.length; i++) {
            const studentId = selected[i];
            const student = students.find(s => s.id === studentId);
            const name = student ? student.name : 'Unknown';
            
            progressText.innerText = `Sending report for ${name} (${i + 1}/${selected.length})...`;
            
            try {
                const res = await apiFetch('/api/whatsapp/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentId })
                });

                if (res.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                failCount++;
            }

            const percentage = Math.round(((i + 1) / selected.length) * 100);
            progressFill.style.width = `${percentage}%`;

            // Wait with a countdown before sending the next message
            if (i < selected.length - 1) {
                const selectedDelayVal = document.getElementById('bulk-send-delay')?.value || 'adaptive';
                let delayMs = 15000;
                let isResting = false;
                
                if (selectedDelayVal === 'adaptive') {
                    const adaptiveObj = getAdaptiveDelay(selected.length, i + 1);
                    delayMs = adaptiveObj.delay;
                    isResting = adaptiveObj.restingBreak;
                } else {
                    const baseDelay = parseInt(selectedDelayVal) || 15000;
                    // Add a small +- 2s random jitter to avoid robotic intervals
                    const jitter = (Math.random() * 4000) - 2000;
                    delayMs = Math.max(2000, baseDelay + jitter);
                }
                
                let secondsLeft = Math.round(delayMs / 1000);
                while (secondsLeft > 0) {
                    const breakMsg = isResting ? " (Resting break to avoid spam block)" : "";
                    progressText.innerText = `Sent report card for ${name} (${i + 1}/${selected.length}). Waiting ${secondsLeft}s before next...${breakMsg}`;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    secondsLeft--;
                }
            }
        }

        progressText.innerText = `Completed! Sent: ${successCount}, Failed: ${failCount}`;
        btnSendSelected.disabled = false;
        
        setTimeout(() => {
            progressBox.style.display = 'none';
        }, 5000);
    });
}


// Super Admin Logic
async function loadSuperAdmin() {
    try {
        const res = await apiFetch('/api/saas/schools');
        if (!res.ok) return;
        const schools = await res.json();

        const tbody = document.querySelector('#saas-schools-table tbody');
        tbody.innerHTML = '';
        schools.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.schoolId}</td>
                <td><strong>${s.schoolName}</strong></td>
                <td>${s.studentCount}</td>
                <td>${s.adminUsers.join(', ')}</td>
                <td style="display:flex; gap:6px;">
                    <button class="btn outline-btn edit-school-btn" data-id="${s.schoolId}" data-name="${s.schoolName}" data-admin="${s.adminUsers[0] || ''}" style="padding: 5px 10px; font-size: 0.8rem;">Edit</button>
                    <button class="btn danger-btn delete-school-btn" data-id="${s.schoolId}" style="padding: 5px 10px; font-size: 0.8rem;">Delete</button>
                </td>
            `;
            tr.querySelector('.edit-school-btn').addEventListener('click', () => {
                openEditSchoolModal(s.schoolId, s.schoolName, s.adminUsers[0] || '');
            });
            tr.querySelector('.delete-school-btn').addEventListener('click', async () => {
                const confirmed = confirm(`⚠️ DELETE "${s.schoolName}"?\n\nThis will permanently delete ALL students, teachers, and data for this school. This cannot be undone.`);
                if (!confirmed) return;
                try {
                    const delRes = await apiFetch(`/api/saas/schools/${s.schoolId}`, { method: 'DELETE' });
                    if (delRes.ok) {
                        alert(`School "${s.schoolName}" has been deleted.`);
                        loadSuperAdmin();
                    } else {
                        const err = await delRes.json();
                        alert('Error: ' + err.error);
                    }
                } catch (e) {
                    alert('Failed to delete school.');
                }
            });
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.log("Not a superadmin", e);
    }
}

// Edit School Modal logic
function openEditSchoolModal(schoolId, schoolName, currentAdmin) {
    document.getElementById('edit-school-id').value = schoolId;
    document.getElementById('edit-school-label').textContent = `School: ${schoolName}  |  Current admin: ${currentAdmin || 'N/A'}`;
    document.getElementById('edit-school-username').value = '';
    document.getElementById('edit-school-password').value = '';
    document.getElementById('edit-school-error').style.display = 'none';
    const modal = document.getElementById('edit-school-modal');
    modal.style.display = 'flex';
}

// ── Class Promotion Logic ──────────────────────────────────────────
document.getElementById('promote-classes-btn')?.addEventListener('click', () => {
    // Reset modal state
    document.getElementById('preserve-subjects-cb').checked = true;
    document.getElementById('promote-confirm-cb').checked = false;
    const confirmBtn = document.getElementById('promote-confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.4';
    confirmBtn.style.cursor = 'not-allowed';
    document.getElementById('promote-result').style.display = 'none';
    document.getElementById('promote-modal').style.display = 'flex';
});

document.getElementById('promote-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('promote-modal').style.display = 'none';
});

// Enable confirm button only when "I understand" checkbox is ticked
document.getElementById('promote-confirm-cb')?.addEventListener('change', (e) => {
    const confirmBtn = document.getElementById('promote-confirm-btn');
    confirmBtn.disabled = !e.target.checked;
    confirmBtn.style.opacity = e.target.checked ? '1' : '0.4';
    confirmBtn.style.cursor = e.target.checked ? 'pointer' : 'not-allowed';
});

document.getElementById('promote-confirm-btn')?.addEventListener('click', async () => {
    const preserveSubjects = document.getElementById('preserve-subjects-cb').checked;
    const confirmBtn = document.getElementById('promote-confirm-btn');
    const resultEl = document.getElementById('promote-result');

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Promoting...';

    try {
        const res = await apiFetch('/api/promote-classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preserveSubjects })
        });
        const data = await res.json();
        if (res.ok) {
            resultEl.style.color = '#059669';
            resultEl.textContent = `✅ Done! ${data.promoted} student(s) promoted, ${data.graduated} Form 4 student(s) graduated and removed.`;
            resultEl.style.display = 'block';
            // Reload student data in background
            await fetchStudents();
            setTimeout(() => {
                document.getElementById('promote-modal').style.display = 'none';
            }, 3500);
        } else {
            resultEl.style.color = '#dc2626';
            resultEl.textContent = '❌ Error: ' + (data.error || 'Promotion failed.');
            resultEl.style.display = 'block';
            confirmBtn.disabled = false;
            confirmBtn.textContent = '🎓 Confirm Promotion';
        }
    } catch (e) {
        resultEl.style.color = '#dc2626';
        resultEl.textContent = '❌ Network error. Please try again.';
        resultEl.style.display = 'block';
        confirmBtn.disabled = false;
        confirmBtn.textContent = '🎓 Confirm Promotion';
    }
});

// ── Edit School Modal logic ────────────────────────────────────────
document.getElementById('edit-school-cancel')?.addEventListener('click', () => {
    document.getElementById('edit-school-modal').style.display = 'none';
});

document.getElementById('edit-school-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const schoolId = document.getElementById('edit-school-id').value;
    const newUsername = document.getElementById('edit-school-username').value.trim();
    const newPassword = document.getElementById('edit-school-password').value;
    const errEl = document.getElementById('edit-school-error');

    if (!newUsername && !newPassword) {
        errEl.textContent = 'Please fill in at least the username or password.';
        errEl.style.display = 'block';
        return;
    }

    try {
        const res = await apiFetch(`/api/saas/schools/${schoolId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newUsername: newUsername || undefined, newPassword: newPassword || undefined })
        });
        const data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.error || 'Failed to update.';
            errEl.style.display = 'block';
            return;
        }
        document.getElementById('edit-school-modal').style.display = 'none';
        alert('School admin credentials updated successfully!');
        loadSuperAdmin();
    } catch (err) {
        errEl.textContent = 'Network error. Please try again.';
        errEl.style.display = 'block';
    }
});

document.getElementById('new-school-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const schoolName = document.getElementById('new-school-name').value;
    const adminUsername = document.getElementById('new-school-admin').value;
    const adminPassword = document.getElementById('new-school-pass').value;
    
    try {
        const res = await apiFetch('/api/saas/schools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schoolName, adminUsername, adminPassword })
        });
        
        const data = await res.json();
        if (data.error) return alert(data.error);
        
        alert('School created successfully! ID: ' + data.schoolId);
        document.getElementById('new-school-form').reset();
        loadSuperAdmin();
    } catch (e) {
        alert("Failed to create school.");
    }
});

// Superadmin - update own credentials
document.getElementById('superadmin-account-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = document.getElementById('sa-new-username').value.trim();
    const newPassword = document.getElementById('sa-new-password').value;
    const confirmPassword = document.getElementById('sa-confirm-password').value;
    const errEl = document.getElementById('sa-account-error');
    const okEl  = document.getElementById('sa-account-success');

    errEl.style.display = 'none';
    okEl.style.display  = 'none';

    if (!newUsername && !newPassword) {
        errEl.textContent = 'Please fill in at least the username or password.';
        errEl.style.display = 'block';
        return;
    }
    if (newPassword && newPassword !== confirmPassword) {
        errEl.textContent = 'Passwords do not match.';
        errEl.style.display = 'block';
        return;
    }

    try {
        const res = await apiFetch('/api/saas/me', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                newUsername: newUsername || undefined,
                newPassword: newPassword || undefined
            })
        });
        const data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.error || 'Update failed.';
            errEl.style.display = 'block';
        } else {
            okEl.textContent = '✅ Credentials updated! You will need to use the new credentials next time you log in.';
            okEl.style.display = 'block';
            document.getElementById('superadmin-account-form').reset();
        }
    } catch (err) {
        errEl.textContent = 'Network error. Please try again.';
        errEl.style.display = 'block';
    }
});

document.addEventListener("DOMContentLoaded", () => {
    checkLogin();
});

async function fetchStudents() {
    const res = await apiFetch('/api/students');
    students = await res.json();
}

// 1. Render Students Tab
async function renderStudentsTab() {
    await fetchStudents();

    const readOnly = currentUser.role === 'class_teacher';

    // Registration form and subject-config save are for admins only
    const addStudentCard = document.getElementById('add-student-form')?.closest('.card');
    if (addStudentCard) addStudentCard.style.display = readOnly ? 'none' : '';
    const saveSubjectsBtn = document.getElementById('save-subjects-btn');
    if (saveSubjectsBtn) saveSubjectsBtn.style.display = readOnly ? 'none' : '';


    // Render dynamic table headers
    const thead = document.getElementById('subjects-table-header');
    if (thead) {
        thead.innerHTML = `<th>Student</th><th>Gender</th><th>Phone</th><th>Bursary</th>` + 
            subjectsList.map(sub => `<th title="${sub}" style="font-size: 10px; writing-mode: vertical-rl; transform: rotate(180deg);">${getAbbreviation(sub)}</th>`).join('');
    }

    const tbody = document.querySelector('#subjects-table tbody');
    tbody.innerHTML = '';
    
    const classStudents = students.filter(s => (s.classLevel || 'Form 1') === currentClass);
    
    classStudents.forEach(student => {
        const tr = document.createElement('tr');
        if (readOnly) {
            tr.innerHTML = `
                <td>${student.name}</td>
                <td>${student.gender || 'Male'}</td>
                <td>${student.phone || ''}</td>
                <td>${student.bursaryName || ''}</td>
            ` +
                subjectsList.map(sub => `
                    <td style="text-align:center;">${student.subjects[sub] ? '✔' : ''}</td>
                `).join('');
        } else {
            tr.innerHTML = `
                <td><input type="text" data-student-id="${student.id}" data-field="name" value="${student.name}" style="width: 120px;"></td>
                <td>
                    <select data-student-id="${student.id}" data-field="gender" style="padding: 4px; border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color);">
                        <option value="Male" ${(student.gender === 'Male' || !student.gender) ? 'selected' : ''}>Male</option>
                        <option value="Female" ${student.gender === 'Female' ? 'selected' : ''}>Female</option>
                    </select>
                </td>
                <td><input type="text" data-student-id="${student.id}" data-field="phone" value="${student.phone || ''}" style="width: 100px;"></td>
                <td><input type="text" data-student-id="${student.id}" data-field="bursaryName" value="${student.bursaryName || ''}" placeholder="None" style="width: 100px;"></td>
            ` + 
                subjectsList.map(sub => `
                    <td>
                        <input type="checkbox" data-student-id="${student.id}" data-subject="${sub}" ${student.subjects[sub] ? 'checked' : ''}>
                    </td>
                `).join('');
        }
        tbody.appendChild(tr);
    });
}

// Save Subject Config Checkboxes
document.getElementById('save-subjects-btn').addEventListener('click', async () => {
    const updates = {};
    
    document.querySelectorAll('#subjects-table input[type="checkbox"]').forEach(box => {
        const studentId = box.getAttribute('data-student-id');
        const subject = box.getAttribute('data-subject');
        
        if (!updates[studentId]) updates[studentId] = { subjects: {} };
        updates[studentId].subjects[subject] = box.checked;
    });

    document.querySelectorAll('#subjects-table input[type="text"]').forEach(input => {
        const studentId = input.getAttribute('data-student-id');
        const field = input.getAttribute('data-field');
        if (!updates[studentId]) updates[studentId] = { subjects: {} };
        updates[studentId][field] = input.value;
    });

    document.querySelectorAll('#subjects-table select[data-field="gender"]').forEach(select => {
        const studentId = select.getAttribute('data-student-id');
        if (!updates[studentId]) updates[studentId] = { subjects: {} };
        updates[studentId].gender = select.value;
    });

    const res = await apiFetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
    });

    if (res.ok) {
        alert('Student data and subjects saved!');
        renderStudentsTab();
    } else {
        alert('Error saving data.');
    }
});

// Toggle bursary input
document.getElementById('student-on-bursary').addEventListener('change', (e) => {
    document.getElementById('student-bursary-group').style.display = e.target.checked ? 'block' : 'none';
});

// Add New Student Form
document.getElementById('add-student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('student-name').value;
    const gender = document.getElementById('student-gender')?.value || 'Male';
    const phone = document.getElementById('student-phone').value;
    const onBursary = document.getElementById('student-on-bursary').checked;
    const bursaryName = onBursary ? document.getElementById('student-bursary-name').value : '';
    
    // Get section - if only 1 section, the server will use the default
    const sectionEl = document.getElementById('student-section');
    const section = (sectionEl && schoolSections.length > 1) ? sectionEl.value : undefined;

    const res = await apiFetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, gender, phone, bursaryName, classLevel: currentClass, section, subjects: {} })
    });
    
    if (res.ok) {
        document.getElementById('student-name').value = '';
        document.getElementById('student-phone').value = '';
        document.getElementById('student-bursary-name').value = '';
        document.getElementById('student-on-bursary').checked = false;
        document.getElementById('student-bursary-group').style.display = 'none';
        alert('Student registered!');
        renderStudentsTab();
    }
});

// Search Student
document.getElementById('student-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#subjects-table tbody tr').forEach(tr => {
        const nameInput = tr.querySelector('input[data-field="name"]');
        if (nameInput && nameInput.value.toLowerCase().includes(term)) {
            tr.style.display = '';
        } else {
            tr.style.display = 'none';
        }
    });
});

// 1.5. Staff Tab
let users = [];

async function renderStaffTab() {
    const res = await apiFetch('/api/users');
    users = await res.json();

    const readOnly = currentUser.role === 'class_teacher';

    // Hide the create/edit form entirely for class teachers - view only
    const addStaffCard = document.getElementById('add-staff-form')?.closest('.card');
    if (addStaffCard) addStaffCard.style.display = readOnly ? 'none' : '';

    // Populate subject checkboxes
    const cbContainer = document.getElementById('staff-subjects-checkboxes');
    cbContainer.innerHTML = '';
    subjectsList.forEach(sub => {
        cbContainer.innerHTML += `
            <label><input type="checkbox" value="${sub}" class="staff-sub-cb"> ${sub}</label>
        `;
    });

    // Populate class checkboxes (for Class Teacher role)
    const classCbContainer = document.getElementById('staff-classes-checkboxes');
    if (classCbContainer) {
        classCbContainer.innerHTML = '';
        CLASS_LEVELS.forEach(cls => {
            classCbContainer.innerHTML += `
                <label style="margin-right: 15px;"><input type="checkbox" value="${cls}" class="staff-class-cb"> ${cls}</label>
            `;
        });
    }
    
    const tbody = document.querySelector('#staff-table tbody');
    tbody.innerHTML = '';
    
    users.forEach(u => {
        const tr = document.createElement('tr');
        const classSubs = (u.subjects || [])
            .filter(s => s.startsWith(currentClass + ':'))
            .map(s => s.split(':')[1])
            .sort();
            
        let subsDisplay = '<span style="color:#999; font-style:italic;">None</span>';
        if (u.role === 'admin') {
            subsDisplay = '<span style="background:#28a745; color:white; padding:3px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">ALL SUBJECTS</span>';
        } else if (classSubs.length > 0) {
            subsDisplay = '<div style="display:flex; flex-wrap:wrap; gap:4px;">' + 
                          classSubs.map(s => `<span style="background:#eef2f5; color:#333; padding:2px 6px; border-radius:4px; font-size:0.8rem; border:1px solid #dcdcdc;">${s}</span>`).join('') + 
                          '</div>';
        }
        
        tr.innerHTML = `
            <td>${u.name}</td>
            <td>${u.username}</td>
            <td>${readOnly ? '******' : (u.password || '******')}</td>
            <td>${subsDisplay}</td>
            <td><span>${formatRole(u.role)}</span></td>
            <td>
                ${readOnly ? '' : `
                <button class="btn outline-btn edit-staff-btn" data-id="${u.id}" style="padding: 5px;">Edit</button>
                <button class="btn danger-btn del-staff-btn" data-id="${u.id}" style="padding: 5px;">Delete</button>
                `}
            </td>
        `;

        if (!readOnly) {
            tr.querySelector('.edit-staff-btn').addEventListener('click', () => {
                document.getElementById('staff-id').value = u.id;
                document.getElementById('staff-name').value = u.name;
                document.getElementById('staff-username').value = u.username;
                document.getElementById('staff-password').placeholder = "(Leave blank to keep current)";
                document.getElementById('staff-role').value = u.role || 'teacher';

                document.querySelectorAll('.staff-sub-cb').forEach(cb => {
                    cb.checked = classSubs.includes(cb.value);
                });
                document.querySelectorAll('.staff-class-cb').forEach(cb => {
                    cb.checked = (u.classes || []).includes(cb.value);
                });
                document.getElementById('staff-role').dispatchEvent(new Event('change'));
                document.getElementById('cancel-staff-btn').style.display = 'inline-block';
            });

            tr.querySelector('.del-staff-btn').addEventListener('click', async () => {
                if(confirm('Delete this user?')) {
                    try {
                        await apiFetch(`/api/users/${u.id}`, { method: 'DELETE' });
                        renderStaffTab();
                    } catch(e) {
                        alert('Error deleting user or unauthorized.');
                    }
                }
            });
        }
        
        tbody.appendChild(tr);
    });
}

// Show the "Assigned Class(es)" checkboxes only when creating/editing a Class Teacher
document.getElementById('staff-role').addEventListener('change', (e) => {
    const classesGroup = document.getElementById('staff-classes-group');
    if (classesGroup) classesGroup.style.display = e.target.value === 'class_teacher' ? 'block' : 'none';
});

document.getElementById('add-staff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('staff-id').value;
    const name = document.getElementById('staff-name').value;
    const username = document.getElementById('staff-username').value;
    const password = document.getElementById('staff-password').value;
    const role = document.getElementById('staff-role').value;
    
    const existingUser = users.find(u => u.id === id);
    const existingSubjects = existingUser ? (existingUser.subjects || []) : [];
    const otherClassSubjects = existingSubjects.filter(s => !s.startsWith(currentClass + ':'));
    
    const currentClassSubjects = [];
    document.querySelectorAll('.staff-sub-cb:checked').forEach(cb => currentClassSubjects.push(`${currentClass}:${cb.value}`));
    
    const subjects = [...otherClassSubjects, ...currentClassSubjects];

    const classes = [];
    document.querySelectorAll('.staff-class-cb:checked').forEach(cb => classes.push(cb.value));
    
    if (!id && !password) {
        alert("Password is required for new accounts.");
        return;
    }
    
    try {
        const res = await apiFetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, username, password, role, subjects, classes })
        });
        
        if (res.ok) {
            document.getElementById('add-staff-form').reset();
            document.getElementById('staff-id').value = '';
            document.getElementById('cancel-staff-btn').style.display = 'none';
            renderStaffTab();
        } else {
            const err = await res.json();
            alert("Error: " + err.error);
        }
    } catch(e) {
        alert("Error saving user");
    }
});

document.getElementById('cancel-staff-btn').addEventListener('click', () => {
    document.getElementById('add-staff-form').reset();
    document.getElementById('staff-id').value = '';
    document.getElementById('cancel-staff-btn').style.display = 'none';
});

// 2. Marks Grid Tab
let marksGridMode = 'quick'; // 'quick' | 'overview' - only used when acting as homeroom class_teacher

async function renderMarksTab(skipFetch) {
    if (!skipFetch) await fetchStudents();

    const isClassTeacher = currentUser.role === 'class_teacher';

    // Determine if they are the homeroom teacher for the CURRENTLY viewed class.
    // A class_teacher may be homeroom for Form 1 but also teach a subject in Form 2 —
    // in that case, when viewing Form 2 they behave like a normal subject teacher.
    const homeroomClasses = isClassTeacher
        ? (currentUser.classes && currentUser.classes.length ? currentUser.classes : [])
        : [];
    const isHomeroomForCurrent = homeroomClasses.includes(currentClass);

    // Subjects this user can edit marks for in the currently viewed class
    const editableSubjects = (currentUser.role === 'teacher' || isClassTeacher)
        ? (currentUser.subjects || []).filter(s => s.startsWith(currentClass + ':')).map(s => s.split(':')[1])
        : subjectsList;

    // Determine which columns to display:
    // - Admin/headteacher: all subjects
    // - Homeroom class_teacher in quick mode: only their subjects (filtered to enrolled students)
    // - Homeroom class_teacher in overview mode: all subjects
    // - Non-homeroom class_teacher (subject-only) OR plain teacher: only their subjects
    let allowedSubjects;
    if (!isClassTeacher && currentUser.role !== 'teacher') {
        // admin / headteacher / etc.
        allowedSubjects = subjectsList;
    } else if (isHomeroomForCurrent && marksGridMode === 'overview') {
        allowedSubjects = subjectsList;
    } else {
        // quick mode (homeroom), or non-homeroom class_teacher, or plain teacher
        allowedSubjects = editableSubjects.length > 0 ? editableSubjects : subjectsList;
    }

    // --- View Toggle: only show for homeroom class ---
    const completionBanner = document.getElementById('marks-completion-banner');
    if (isHomeroomForCurrent && editableSubjects.length > 0 && completionBanner) {
        const toggleHtml = `
            <div id="marks-grid-toggle" style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap; align-items:center;">
                <span style="font-size:0.82rem; color:var(--text-secondary); font-weight:600;">View:</span>
                <button id="btn-marks-quick" class="btn ${marksGridMode === 'quick' ? 'primary-btn' : 'outline-btn'}"
                    style="padding:5px 12px; font-size:0.82rem;">
                    📝 My Subjects (Quick Entry)
                </button>
                <button id="btn-marks-overview" class="btn ${marksGridMode === 'overview' ? 'primary-btn' : 'outline-btn'}"
                    style="padding:5px 12px; font-size:0.82rem;">
                    👁 All Subjects (Overview)
                </button>
            </div>
        `;
        // Inject toggle before the banner content
        const existingToggle = document.getElementById('marks-grid-toggle');
        if (!existingToggle) {
            completionBanner.insertAdjacentHTML('beforebegin', toggleHtml);
        } else {
            existingToggle.outerHTML = toggleHtml;
        }

        document.getElementById('btn-marks-quick').addEventListener('click', () => {
            if (marksGridMode !== 'quick') { marksGridMode = 'quick'; renderMarksTab(true); }
        });
        document.getElementById('btn-marks-overview').addEventListener('click', () => {
            if (marksGridMode !== 'overview') { marksGridMode = 'overview'; renderMarksTab(true); }
        });
    } else {
        // Remove toggle if present for other roles
        const existingToggle = document.getElementById('marks-grid-toggle');
        if (existingToggle) existingToggle.remove();
    }

    // Generate Headers
    const theadTr = document.getElementById('marks-table-header');
    theadTr.innerHTML = '<th>Student Name</th>';
    allowedSubjects.forEach(sub => {
        theadTr.innerHTML += `<th>${sub}</th>`;
    });
    theadTr.innerHTML += `<th>Actions</th>`;

    const tbody = document.querySelector('#marks-entry-table tbody');
    tbody.innerHTML = '';
    
    const classStudents = students.filter(s => (s.classLevel || 'Form 1') === currentClass);

    // In quick entry mode (homeroom class), only show students enrolled in at least one allowed subject.
    // For non-homeroom class (subject-only), always show all students (same as plain teacher).
    const displayStudents = (isHomeroomForCurrent && marksGridMode === 'quick')
        ? classStudents.filter(s => allowedSubjects.some(sub => s.subjects && s.subjects[sub]))
        : classStudents;
    
    let totalSlots = 0;
    let missingSlots = 0;

    displayStudents.forEach(student => {
        allowedSubjects.forEach(sub => {
            if (student.subjects && student.subjects[sub]) {
                totalSlots++;
                const mark = student.marks && student.marks[sub] !== undefined && student.marks[sub] !== null ? student.marks[sub] : '';
                if (mark === '') missingSlots++;
            }
        });
    });

    if (completionBanner) {
        if (totalSlots === 0) {
            completionBanner.innerHTML = '';
        } else if (missingSlots === 0) {
            completionBanner.innerHTML = `<div style="background:rgba(16,185,129,0.12); border:1px solid #10b981; color:#10b981; padding:10px 14px; border-radius:8px; font-weight:600; font-size:0.88rem;">✅ Mark Sheet 100% Complete for ${currentClass} (All subject marks entered)</div>`;
        } else {
            const pct = Math.round(((totalSlots - missingSlots) / totalSlots) * 100);
            completionBanner.innerHTML = `<div style="background:rgba(245,158,11,0.12); border:1px solid #f59e0b; color:#f59e0b; padding:10px 14px; border-radius:8px; font-weight:600; font-size:0.88rem;">⚠️ Mark Sheet Pending for ${currentClass}: ${pct}% Complete (${missingSlots} missing subject marks)</div>`;
        }
    }
    
    displayStudents.forEach(student => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', student.id);
        
        let cols = `<td><strong>${student.name}</strong></td>`;
        
        allowedSubjects.forEach(sub => {
            const isTaking = student.subjects && student.subjects[sub];
            const canEdit = currentUser.role === 'class_teacher' ? editableSubjects.includes(sub) : true;
            const mark = isTaking && student.marks && student.marks[sub] !== undefined && student.marks[sub] !== null ? student.marks[sub] : '';
            const isMissing = isTaking && canEdit && (mark === '');
            const inputStyle = `width: 60px; ${isMissing ? 'border:1px solid #f59e0b; background:rgba(245,158,11,0.08);' : ''}`;
            cols += `
                <td>
                    <input type="number" min="0" max="100" 
                           data-student-id="${student.id}" 
                           data-subject="${sub}" 
                           value="${mark}" 
                           ${(isTaking && canEdit) ? '' : 'disabled'}
                           style="${inputStyle}">
                </td>
            `;
        });

        const canEditRow = currentUser.role !== 'class_teacher' || editableSubjects.length > 0;
        cols += `
            <td>
                <button class="btn success-btn save-marks-row-btn" data-student-id="${student.id}" ${canEditRow ? '' : 'style="display:none;"'}>Save</button>
            </td>
        `;
        
        tr.innerHTML = cols;
        tbody.appendChild(tr);
    });

    // Track unsaved changes on marks input
    tbody.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            window.hasUnsavedChanges = true;
        });
    });

    // Add listeners to Save buttons
    tbody.querySelectorAll('.save-marks-row-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const studentId = btn.getAttribute('data-student-id');
            const rowInputs = tbody.querySelectorAll(`input[data-student-id="${studentId}"]`);
            const marks = {};
            rowInputs.forEach(input => {
                const subject = input.getAttribute('data-subject');
                if (!input.disabled) {
                    marks[subject] = input.value !== '' ? Number(input.value) : '';
                }
            });

            try {
                const res = await apiFetch('/api/marks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: studentId, marks })
                });

                if (res.ok) {
                    window.hasUnsavedChanges = false;
                    alert('Marks saved for this row!');
                } else {
                    const errorData = await res.json();
                    alert("Error: " + (errorData.error || "Failed to save marks."));
                }
            } catch(e) {
                alert("Error saving marks.");
            }
        });
    });
}


// 3. Render Rankings Tab
async function renderRankingsTab() {
    await fetchStudents();
    const tbody = document.querySelector('#rankings-table tbody');
    tbody.innerHTML = '';

    const canSend = currentUser.role !== 'class_teacher';
    const sendSelectedBtn = document.getElementById('btn-send-selected');
    if (sendSelectedBtn) sendSelectedBtn.style.display = canSend ? '' : 'none';

    const isJunior = currentClass === 'Form 1' || currentClass === 'Form 2';
    const scoreHeader = document.getElementById('rankings-score-header');
    if (scoreHeader) {
        scoreHeader.innerText = isJunior ? 'Overall Average (%)' : 'Best 6 MSCE Points';
    }

    const classStudents = students.filter(s => (s.classLevel || 'Form 1') === currentClass);

    classStudents.forEach(student => {
        const scoreDisplay = isJunior
            ? (student.average !== undefined && student.average !== null ? `${student.average}%` : '-')
            : (student.mscePoints !== undefined && student.mscePoints !== null ? `${student.mscePoints} pts` : '-');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="report-cb" value="${student.id}"></td>
            <td><strong>${student.rank || '-'}</strong></td>
            <td><strong>${student.name}</strong></td>
            <td>${student.subjectsCount || 0} Subjects</td>
            <td><span style="font-weight:700; color:${isJunior ? 'var(--accent-blue)' : '#8b5cf6'};">${scoreDisplay}</span></td>
            <td>
                <button class="btn primary-btn download-pdf-btn" data-student-id="${student.id}">Save PDF</button>
                <button class="btn outline-btn preview-pdf-btn" data-student-id="${student.id}" style="border: 1px solid var(--primary-color); color: var(--primary-color); background: transparent;">Preview</button>
                ${canSend ? `<button class="btn success-btn send-wa-btn" data-student-id="${student.id}">WhatsApp Report</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.download-pdf-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const studentId = btn.getAttribute('data-student-id');
            btn.innerText = 'Downloading...';
            
            // For single PDF, we can use the bulk API with an array of 1 or stick to window.open.
            // Since it's a browser, it's easiest to use fetch and blob for actual file download.
            try {
                const res = await apiFetch(`/api/generate-pdf-bulk`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentIds: [studentId] })
                });
                
                if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Report_Cards.zip`; // Even 1 file is zipped for consistency, or we could handle single.
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                    
                    btn.innerText = 'Saved!';
                    setTimeout(() => btn.innerText = 'Save PDF', 2000);
                } else {
                    alert('Error generating PDF.');
                    btn.innerText = 'Save PDF';
                }
            } catch (e) {
                alert('Network error.');
                btn.innerText = 'Save PDF';
            }
        });
    });

    tbody.querySelectorAll('.preview-pdf-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const studentId = btn.getAttribute('data-student-id');
            window.open(`/api/preview-pdf/${studentId}?token=${authToken}&t=${Date.now()}`, '_blank');
        });
    });

    tbody.querySelectorAll('.send-wa-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const studentId = btn.getAttribute('data-student-id');
            btn.innerText = 'Sending...';
            const res = await apiFetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId })
            });
            if (res.ok) {
                btn.innerText = 'Sent!';
                alert('Progress Report Card successfully sent to WhatsApp!');
            } else {
                const err = await res.json();
                alert(`WhatsApp Send failed: ${err.error}`);
                btn.innerText = 'WhatsApp Report';
            }
        });
    });
}

// 4. WhatsApp Status & Bulk Actions
let statusInterval = null;
function setupWhatsAppStatusPolling() {
    if (statusInterval) clearInterval(statusInterval);
    
    const checkStatus = async () => {
        const res = await apiFetch('/api/whatsapp/status');
        const data = await res.json();
        
        const statusSpan = document.getElementById('whatsapp-status');
        statusSpan.innerText = data.status;
        
        const logoutBtn = document.getElementById('whatsapp-logout-btn');
        
        if (data.status === "Connected") {
            statusSpan.className = "statusConnected";
            document.getElementById('qr-image').style.display = 'none';
            document.getElementById('qr-placeholder').style.display = 'block';
            document.getElementById('qr-placeholder').innerText = "✅ WhatsApp Connected!";
            logoutBtn.style.display = 'block';
        } else if (data.status === "Scan QR Code" && data.qr) {
            statusSpan.className = "statusPending";
            document.getElementById('qr-image').style.display = 'block';
            document.getElementById('qr-image').src = data.qr;
            document.getElementById('qr-placeholder').style.display = 'none';
            logoutBtn.style.display = 'block';
        } else {
            statusSpan.className = "statusDisconnected";
            document.getElementById('qr-image').style.display = 'none';
            document.getElementById('qr-placeholder').style.display = 'block';
            document.getElementById('qr-placeholder').innerText = "Waiting for WhatsApp connection setup...";
            logoutBtn.style.display = 'none';
        }
    };
    
    checkStatus();
    statusInterval = setInterval(checkStatus, 3000);
}

document.getElementById('whatsapp-logout-btn').addEventListener('click', async () => {
    const confirmed = confirm("Are you sure you want to disconnect and reset your WhatsApp connection?");
    if (!confirmed) return;
    const btn = document.getElementById('whatsapp-logout-btn');
    btn.innerText = "Disconnecting...";
    btn.disabled = true;
    try {
        const res = await apiFetch('/api/whatsapp/logout', { method: 'POST' });
        if (res.ok) {
            alert("WhatsApp connection successfully reset.");
        } else {
            alert("Error resetting connection.");
        }
    } catch(e) {
        alert("Failed to disconnect.");
    } finally {
        btn.innerText = "Disconnect / Reset Connection";
        btn.disabled = false;
    }
});

// Helper for adaptive WhatsApp send delays
function getAdaptiveDelay(totalCount, currentIndex) {
    let baseDelay = 15000; // default 15s
    let jitter = (Math.random() * 6000) - 3000; // default +-3s
    let restingBreak = false;
    
    if (totalCount <= 2) {
        baseDelay = 3000;
        jitter = (Math.random() * 2000) - 1000;
    } else if (totalCount <= 10) {
        baseDelay = 8000;
        jitter = (Math.random() * 4000) - 2000;
    } else if (totalCount <= 30) {
        baseDelay = 15000;
        jitter = (Math.random() * 6000) - 3000;
    } else {
        baseDelay = 25000;
        jitter = (Math.random() * 10000) - 5000;
    }
    
    let delay = Math.max(2000, baseDelay + jitter);
    
    // Add resting break every 10 messages for large runs
    if (totalCount > 30 && currentIndex > 0 && currentIndex % 10 === 0) {
        delay += 45000;
        restingBreak = true;
    }
    
    return { delay, restingBreak };
}

// Bulk Send Report Cards
document.getElementById('send-all-btn').addEventListener('click', async () => {
    await fetchStudents();
    if (students.length === 0) {
        alert('No registered students found.');
        return;
    }

    const progressBox = document.getElementById('bulk-progress-box');
    const progressFill = document.getElementById('bulk-progress-fill');
    const progressText = document.getElementById('bulk-progress-text');

    progressBox.style.display = 'block';
    progressFill.style.width = '0%';
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < students.length; i++) {
        const s = students[i];
        progressText.innerText = `Sending report for ${s.name} (${i + 1}/${students.length})...`;
        
        const res = await apiFetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: s.id })
        });

        if (res.ok) {
            successCount++;
        } else {
            failCount++;
        }

        const percentage = Math.round(((i + 1) / students.length) * 100);
        progressFill.style.width = `${percentage}%`;

        // Wait with a countdown before sending the next message
        if (i < students.length - 1) {
            const selectedDelayVal = document.getElementById('bulk-send-delay').value;
            let delayMs = 15000;
            let isResting = false;
            
            if (selectedDelayVal === 'adaptive') {
                const adaptiveObj = getAdaptiveDelay(students.length, i + 1);
                delayMs = adaptiveObj.delay;
                isResting = adaptiveObj.restingBreak;
            } else {
                const baseDelay = parseInt(selectedDelayVal) || 15000;
                // Add a small +- 2s random jitter to avoid robotic intervals
                const jitter = (Math.random() * 4000) - 2000;
                delayMs = Math.max(2000, baseDelay + jitter);
            }
            
            let secondsLeft = Math.round(delayMs / 1000);
            while (secondsLeft > 0) {
                const breakMsg = isResting ? " (Resting break to avoid spam block)" : "";
                progressText.innerText = `Sent report card for ${s.name} (${i + 1}/${students.length}). Waiting ${secondsLeft}s before next...${breakMsg}`;
                await new Promise(resolve => setTimeout(resolve, 1000));
                secondsLeft--;
            }
        }
    }

    progressText.innerText = `Completed bulk send! Success: ${successCount}, Failed: ${failCount}`;
});

// 5. Settings Tab
function addManebRow(examType, data = {}) {
    const tbody = document.getElementById('maneb-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.style.borderTop = '1px solid var(--border-color)';
    tr.innerHTML = `
        <td style="padding:6px 8px;">
            <select class="maneb-exam" style="background:var(--bg-secondary);color:white;border:1px solid var(--border-color);border-radius:4px;padding:4px;">
                <option value="JCE" ${(data.exam||examType)==='JCE'?'selected':''}>JCE</option>
                <option value="MSCE" ${(data.exam||examType)==='MSCE'?'selected':''}>MSCE</option>
            </select>
        </td>
        <td style="padding:6px 8px;"><input class="maneb-year" type="number" value="${data.year||new Date().getFullYear()}" min="2000" max="2099" style="width:70px;background:var(--bg-secondary);color:white;border:1px solid var(--border-color);border-radius:4px;padding:4px;"></td>
        <td style="padding:6px 8px;"><input class="maneb-sat" type="number" value="${data.sat||''}" min="0" placeholder="0" style="width:60px;background:var(--bg-secondary);color:white;border:1px solid var(--border-color);border-radius:4px;padding:4px;" oninput="updatePassRate(this)"></td>
        <td style="padding:6px 8px;"><input class="maneb-passed" type="number" value="${data.passed||''}" min="0" placeholder="0" style="width:60px;background:var(--bg-secondary);color:white;border:1px solid var(--border-color);border-radius:4px;padding:4px;" oninput="updatePassRate(this)"></td>
        <td style="padding:6px 8px;"><input class="maneb-failed" type="number" value="${data.failed||''}" min="0" placeholder="0" style="width:60px;background:var(--bg-secondary);color:white;border:1px solid var(--border-color);border-radius:4px;padding:4px;"></td>
        <td class="maneb-rate" style="padding:6px 8px; font-weight:700; color:var(--accent-green);">-</td>
        <td style="padding:6px 8px;"><button type="button" onclick="this.closest('tr').remove()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1rem;">✕</button></td>
    `;
    tbody.appendChild(tr);
    updatePassRate(tr.querySelector('.maneb-sat'));
    if (data.sat) updatePassRate(tr.querySelector('.maneb-sat'));
}

function updatePassRate(input) {
    const tr = input.closest('tr');
    if (!tr) return;
    const sat = Number(tr.querySelector('.maneb-sat').value) || 0;
    const passed = Number(tr.querySelector('.maneb-passed').value) || 0;
    tr.querySelector('.maneb-rate').textContent = sat > 0 ? `${Math.round(passed/sat*100)}%` : '-';
}

function loadManebRows(results) {
    const tbody = document.getElementById('maneb-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    results.forEach(r => addManebRow(r.exam, r));
}

async function deletePhoto(index) {
    if (!confirm('Remove this photo?')) return;
    const fd = new FormData();
    fd.append('deletePhotoIndex', index);
    const res = await apiFetch('/api/settings', { method: 'POST', body: fd });
    if (res.ok) await loadSettings();
}

async function loadSettings() {
    const res = await apiFetch('/api/settings');
    const settings = await res.json();
    
    document.getElementById('school-name').value = settings.schoolName || '';
    document.getElementById('school-subtitle').value = settings.subtitle || '';
    document.getElementById('theme-color').value = settings.themeColor || '#142e5c';

    // Logo preview - use Base64 (new) or URL (legacy)
    const logoWrap = document.getElementById('logo-preview-wrap');
    const logoImg  = document.getElementById('logo-preview-img');
    if (logoWrap && logoImg) {
        const logoSrc = settings.logoBase64 || (settings.logoPath ? settings.logoPath + '?t=' + Date.now() : null);
        if (logoSrc) {
            logoImg.src = logoSrc;
            logoWrap.style.display = 'block';
        } else {
            logoWrap.style.display = 'none';
        }
    }
    // Reset file input; add client-side size guard (500 KB)
    const logoInput = document.getElementById('school-logo');
    if (logoInput) {
        logoInput.value = '';
        logoInput.addEventListener('change', () => {
            const file = logoInput.files[0];
            if (file && file.size > 500 * 1024) {
                alert(`Logo is too large (${(file.size / 1024).toFixed(0)} KB). Maximum allowed size is 500 KB.`);
                logoInput.value = '';
                return;
            }
            if (logoWrap) logoWrap.style.display = 'none'; // hide old preview until saved
        }, { once: true });
    }

    const photosInput = document.getElementById('school-photos');
    if (photosInput) photosInput.value = '';

    const photosGrid = document.getElementById('photos-preview-grid');
    if (photosGrid) {
        const photos = settings.photos || [];
        photosGrid.innerHTML = photos.map((src, i) => `
            <div style="position:relative; width:100px; height:72px;">
                <img src="${src}" style="width:100px; height:72px; object-fit:cover; border-radius:6px; border:1px solid var(--border-color);">
                <button type="button" onclick="deletePhoto(${i})" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.7);border:none;color:white;border-radius:50%;width:18px;height:18px;font-size:0.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
            </div>
        `).join('');
    }

    loadManebRows(settings.manebResults || []);
    
    // Public Location & Profile
    if (document.getElementById('school-district')) {
        document.getElementById('school-district').value = settings.district || 'Blantyre';
        document.getElementById('school-address').value = settings.address || '';
        document.getElementById('school-motto').value = settings.motto || '';
        if (document.getElementById('admission-status')) document.getElementById('admission-status').value = settings.admissionStatus || 'Open';
        if (document.getElementById('admission-notes')) document.getElementById('admission-notes').value = settings.admissionNotes || '';
        document.getElementById('school-lat').value = settings.latitude !== undefined && settings.latitude !== null ? settings.latitude : '';
        document.getElementById('school-lng').value = settings.longitude !== undefined && settings.longitude !== null ? settings.longitude : '';

        const facs = settings.facilities || [];
        if (document.getElementById('fac-science')) document.getElementById('fac-science').checked = facs.includes('Science Lab');
        if (document.getElementById('fac-ict')) document.getElementById('fac-ict').checked = facs.includes('Computer Lab');
        if (document.getElementById('fac-boarding')) document.getElementById('fac-boarding').checked = facs.includes('Boarding');
        if (document.getElementById('fac-library')) document.getElementById('fac-library').checked = facs.includes('Library');
        if (document.getElementById('fac-sports')) document.getElementById('fac-sports').checked = facs.includes('Sports Ground');
    }

    if (document.getElementById('headteacher-remarks-pass')) {
        document.getElementById('headteacher-remarks-pass').value = settings.headteacherRemarksPass || '';
        document.getElementById('headteacher-remarks-fail').value = settings.headteacherRemarksFail || '';
        document.getElementById('next-term-fees').value = settings.nextTermFees || '';
        document.getElementById('next-term-date').value = settings.nextTermDate || '';
        
        if (document.getElementById('current-term')) {
            document.getElementById('current-term').value = settings.currentTerm || 'Term One';
            document.getElementById('header-contact-label').value = settings.headerContactLabel || 'School Phone';
            document.getElementById('header-contact-number').value = settings.headerContactNumber || '';
        }
    }
    
    document.getElementById('grading-tbody').innerHTML = '';
    if (settings.gradingSystem) {
        settings.gradingSystem.sort((a,b) => b.min - a.min).forEach(rule => addGradingRow(rule));
    }
    
    document.getElementById('grading-junior-tbody').innerHTML = '';
    if (settings.gradingSystemJunior) {
        settings.gradingSystemJunior.sort((a,b) => b.min - a.min).forEach(rule => addJuniorGradingRow(rule));
    }
    
    const mtbody = document.getElementById('master-subjects-tbody');
    if (mtbody) {
        mtbody.innerHTML = '';
        (settings.masterSubjects || []).forEach(sub => addMasterSubjectRow(sub));
    }

    const stbody = document.getElementById('sections-tbody');
    if (stbody) {
        stbody.innerHTML = '';
        const sections = (settings.sections && settings.sections.length > 0)
            ? settings.sections
            : [{ id: 'general', name: 'General', fee: settings.defaultTermFee || 0, isDefault: true }];
        sections.forEach(sec => addSectionRow(sec));
    }

    const year = settings.academicYear || '2025/2026';
    const term = settings.currentTerm || 'Term 1';
    
    if (document.getElementById('current-academic-badge')) {
        document.getElementById('current-academic-badge').textContent = `${term} (${year})`;
        document.getElementById('term-card-year').textContent = year;
        document.getElementById('term-card-term').textContent = term;
        
        let nextStep = '';
        if (term === 'Term 1' || term === 'Term One') nextStep = 'Close Term 1 & Advance to Term 2';
        else if (term === 'Term 2' || term === 'Term Two') nextStep = 'Close Term 2 & Advance to Term 3';
        else nextStep = 'Close Term 3, Advance to New Academic Year & Promote Classes';
        
        document.getElementById('term-card-next-step').textContent = nextStep;
    }
}

// GPS detection button in Settings
const btnDetectGps = document.getElementById('btn-detect-gps');
if (btnDetectGps) {
    btnDetectGps.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert('Geolocation not supported by this browser.');
            return;
        }
        btnDetectGps.innerText = 'Detecting...';
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                document.getElementById('school-lat').value = pos.coords.latitude.toFixed(6);
                document.getElementById('school-lng').value = pos.coords.longitude.toFixed(6);
                btnDetectGps.innerText = '✅ Location Detected!';
                const mapPinSvg = '<svg viewBox="0 0 32 32" width="14" height="14" style="vertical-align: -2px; display: inline-block;"><path fill="currentColor" d="M16 2C10.477 2 6 6.477 6 12c0 7.5 10 16 10 16s10-8.5 10-16c0-5.523-4.477-10-10-10zm0 13.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/><ellipse cx="16" cy="30" rx="6" ry="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
                setTimeout(() => { btnDetectGps.innerHTML = `${mapPinSvg} Detect School's Current GPS Location`; }, 3000);
            },
            () => {
                alert('Could not retrieve GPS coordinates. Check browser permissions.');
                const mapPinSvg = '<svg viewBox="0 0 32 32" width="14" height="14" style="vertical-align: -2px; display: inline-block;"><path fill="currentColor" d="M16 2C10.477 2 6 6.477 6 12c0 7.5 10 16 10 16s10-8.5 10-16c0-5.523-4.477-10-10-10zm0 13.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/><ellipse cx="16" cy="30" rx="6" ry="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
                btnDetectGps.innerHTML = `${mapPinSvg} Detect School's Current GPS Location`;
            }
        );
    });
}

function addSectionRow(section = { id: '', name: '', fee: 0, isDefault: false }) {
    const tbody = document.getElementById('sections-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    const secId = section.id || ('sec_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
    tr.setAttribute('data-id', secId);
    tr.innerHTML = `
        <td><input type="text" class="sec-name" value="${section.name || ''}" placeholder="e.g. Day School" required style="width: 150px;"></td>
        <td><input type="number" class="sec-fee" value="${section.fee !== undefined ? section.fee : ''}" placeholder="e.g. 30000" min="0" required style="width: 110px;"></td>
        <td><input type="radio" name="defaultSectionRadio" class="sec-default" ${section.isDefault ? 'checked' : ''} style="cursor:pointer;"></td>
        <td><button type="button" class="btn danger-btn remove-section-btn" style="padding:5px;">Remove</button></td>
    `;
    tr.querySelector('.remove-section-btn').addEventListener('click', () => {
        if (tbody.querySelectorAll('tr').length <= 1) {
            alert('A school must have at least one section.');
            return;
        }
        tr.remove();
        if (!tbody.querySelector('input.sec-default:checked')) {
            const firstRadio = tbody.querySelector('input.sec-default');
            if (firstRadio) firstRadio.checked = true;
        }
    });
    tbody.appendChild(tr);
}

const addSecBtn = document.getElementById('add-section-btn');
if (addSecBtn) addSecBtn.addEventListener('click', () => addSectionRow());

function addMasterSubjectRow(sub = {name: '', abbr: '', active: true}) {
    const tbody = document.getElementById('master-subjects-tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="checkbox" class="s-active" ${sub.active ? 'checked' : ''}></td>
        <td><input type="text" class="s-name" value="${sub.name}" required style="width: 150px;"></td>
        <td><input type="text" class="s-abbr" value="${sub.abbr}" required style="width: 80px;"></td>
        <td><button type="button" class="btn danger-btn remove-subject-btn" style="padding:5px;">Remove</button></td>
    `;
    tr.querySelector('.remove-subject-btn').addEventListener('click', () => tr.remove());
    tbody.appendChild(tr);
}

const addSubBtn = document.getElementById('add-subject-btn');
if (addSubBtn) addSubBtn.addEventListener('click', () => addMasterSubjectRow());

function addGradingRow(rule = {min: '', points: '', remark: ''}) {
    const tbody = document.getElementById('grading-tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="number" name="minMarks[]" value="${rule.min}" required style="width: 80px;"></td>
        <td><input type="number" name="points[]" value="${rule.points}" required style="width: 80px;"></td>
        <td><input type="text" name="remark[]" value="${rule.remark}" required style="width: 150px;"></td>
        <td><button type="button" class="btn danger-btn remove-grade-btn" style="padding:5px;">Remove</button></td>
    `;
    tr.querySelector('.remove-grade-btn').addEventListener('click', () => tr.remove());
    tbody.appendChild(tr);
}

function addJuniorGradingRow(rule = {min: '', gradeLetter: '', remark: ''}) {
    const tbody = document.getElementById('grading-junior-tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="number" name="jMinMarks[]" value="${rule.min}" required style="width: 80px;"></td>
        <td><input type="text" name="jGrade[]" value="${rule.gradeLetter}" required style="width: 80px;"></td>
        <td><input type="text" name="jRemark[]" value="${rule.remark}" required style="width: 150px;"></td>
        <td><button type="button" class="btn danger-btn remove-grade-btn" style="padding:5px;">Remove</button></td>
    `;
    tr.querySelector('.remove-grade-btn').addEventListener('click', () => tr.remove());
    tbody.appendChild(tr);
}

document.getElementById('add-grade-rule-btn').addEventListener('click', () => addGradingRow());
document.getElementById('add-junior-grade-rule-btn').addEventListener('click', () => addJuniorGradingRow());

document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const manebRows = [];
    document.querySelectorAll('#maneb-tbody tr').forEach(tr => {
        const sat = Number(tr.querySelector('.maneb-sat').value) || 0;
        const passed = Number(tr.querySelector('.maneb-passed').value) || 0;
        const failed = Number(tr.querySelector('.maneb-failed').value) || 0;
        manebRows.push({
            exam: tr.querySelector('.maneb-exam').value,
            year: tr.querySelector('.maneb-year').value,
            sat, passed, failed
        });
    });
    formData.append('manebResults', JSON.stringify(manebRows));

    const photosInput = document.getElementById('school-photos');
    if (photosInput && photosInput.files.length > 0) {
        Array.from(photosInput.files).forEach(f => formData.append('photos', f));
    }

    if (document.getElementById('admission-status')) formData.append('admissionStatus', document.getElementById('admission-status').value);
    if (document.getElementById('admission-notes')) formData.append('admissionNotes', document.getElementById('admission-notes').value);
    
    // Facilities checklist
    const facilities = [];
    if (document.getElementById('fac-science')?.checked) facilities.push('Science Lab');
    if (document.getElementById('fac-ict')?.checked) facilities.push('Computer Lab');
    if (document.getElementById('fac-boarding')?.checked) facilities.push('Boarding');
    if (document.getElementById('fac-library')?.checked) facilities.push('Library');
    if (document.getElementById('fac-sports')?.checked) facilities.push('Sports Ground');
    formData.append('facilities', JSON.stringify(facilities));

    // School Sections
    const sections = [];
    document.querySelectorAll('#sections-tbody tr').forEach(tr => {
        const id = tr.getAttribute('data-id') || ('sec_' + Date.now());
        const name = tr.querySelector('.sec-name').value.trim();
        const fee = Number(tr.querySelector('.sec-fee').value || 0);
        const isDefault = tr.querySelector('.sec-default').checked;
        if (name) {
            sections.push({ id, name, fee, isDefault });
        }
    });
    if (sections.length === 0) {
        sections.push({ id: 'general', name: 'General', fee: 0, isDefault: true });
    }
    if (!sections.some(s => s.isDefault)) sections[0].isDefault = true;
    formData.append('sections', JSON.stringify(sections));

    const rules = [];
    document.querySelectorAll('#grading-tbody tr').forEach(tr => {
        rules.push({
            min: Number(tr.querySelector('input[name="minMarks[]"]').value),
            points: Number(tr.querySelector('input[name="points[]"]').value),
            remark: tr.querySelector('input[name="remark[]"]').value
        });
    });
    formData.append('gradingSystem', JSON.stringify(rules));
    
    const jRules = [];
    document.querySelectorAll('#grading-junior-tbody tr').forEach(tr => {
        jRules.push({
            min: Number(tr.querySelector('input[name="jMinMarks[]"]').value),
            gradeLetter: tr.querySelector('input[name="jGrade[]"]').value,
            remark: tr.querySelector('input[name="jRemark[]"]').value
        });
    });
    formData.append('gradingSystemJunior', JSON.stringify(jRules));
    
    const mSubjects = [];
    document.querySelectorAll('#master-subjects-tbody tr').forEach(tr => {
        mSubjects.push({
            active: tr.querySelector('.s-active').checked,
            name: tr.querySelector('.s-name').value,
            abbr: tr.querySelector('.s-abbr').value
        });
    });
    formData.append('masterSubjects', JSON.stringify(mSubjects));
    
    try {
        const res = await apiFetch('/api/settings', {
            method: 'POST',
            body: formData // no Content-Type header so browser sets it automatically with boundary
        });
        
        if (res.ok) {
            alert('Settings saved successfully!');
            document.getElementById('school-logo').value = '';
            await loadGlobals();
            await loadSettings(); // refresh logo preview
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.error || 'Error saving settings.');
        }
    } catch(e) {
        alert('Error saving settings.');
    }
});

document.getElementById('preview-design-btn').addEventListener('click', () => {
    window.open(`/api/preview-pdf/dummy?token=${authToken}&t=${Date.now()}`, '_blank');
});

// ── 💰 Fee Ledger UI Implementation ────────────────────────────────
let feeLedgerSearchTerm = '';
let feeLedgerClassFilter = 'SELECTED';
let feeLedgerSectionFilter = 'ALL';
let feeLedgerStatusFilter = 'ALL';

function getStudentExpectedFee(student) {
    const sections = schoolSections && schoolSections.length > 0
        ? schoolSections
        : [{ id: 'general', name: 'General', fee: 0, isDefault: true }];
    const found = sections.find(s => s.id === student.section);
    const sec = found || (sections.find(s => s.isDefault) || sections[0]);
    const termFee = Number(sec.fee || 0);
    const arrears = Number(student.arrears || 0);
    return {
        fee: termFee,
        arrears: arrears,
        totalDue: termFee + arrears,
        name: sec.name,
        id: sec.id
    };
}

async function renderFeesTab() {
    try {
        const res = await apiFetch('/api/students');
        if (!res.ok) return;
        students = await res.json();
    } catch(e) {
        return;
    }

    // Update class filter dropdown option text
    const classFilterSelect = document.getElementById('fee-class-filter');
    if (classFilterSelect && classFilterSelect.options.length > 0) {
        classFilterSelect.options[0].text = `Current Class (${currentClass})`;
    }

    // Determine target students
    let targetStudents = students;
    if (feeLedgerClassFilter === 'SELECTED') {
        targetStudents = students.filter(s => (s.classLevel || 'Form 1') === currentClass);
    } else if (feeLedgerClassFilter !== 'ALL') {
        targetStudents = students.filter(s => (s.classLevel || 'Form 1') === feeLedgerClassFilter);
    }

    // Filter by section filter
    if (feeLedgerSectionFilter !== 'ALL') {
        targetStudents = targetStudents.filter(s => {
            const sec = getStudentExpectedFee(s);
            return sec.id === feeLedgerSectionFilter;
        });
    }

    // Filter by search term
    if (feeLedgerSearchTerm) {
        const term = feeLedgerSearchTerm.toLowerCase();
        targetStudents = targetStudents.filter(s => s.name && s.name.toLowerCase().includes(term));
    }

    // Filter by payment / lock status
    if (feeLedgerStatusFilter === 'HAS_BALANCE') {
        targetStudents = targetStudents.filter(s => {
            const td = getStudentExpectedFee(s).totalDue;
            const pa = Number(s.paidAmount || 0);
            return (td - pa) > 0;
        });
    } else if (feeLedgerStatusFilter === 'CLEARED') {
        targetStudents = targetStudents.filter(s => {
            const td = getStudentExpectedFee(s).totalDue;
            const pa = Number(s.paidAmount || 0);
            return (td - pa) <= 0;
        });
    } else if (feeLedgerStatusFilter === 'BURSARY') {
        targetStudents = targetStudents.filter(s => Boolean(s.bursaryName && s.bursaryName.trim()));
    } else if (feeLedgerStatusFilter === 'LOCKED') {
        targetStudents = targetStudents.filter(s => {
            const td = getStudentExpectedFee(s).totalDue;
            const pa = Number(s.paidAmount || 0);
            return (td - pa) > 0 && !s.feeLockOverride;
        });
    } else if (feeLedgerStatusFilter === 'OVERRIDDEN') {
        targetStudents = targetStudents.filter(s => Boolean(s.feeLockOverride));
    }

    const tbody = document.getElementById('fees-table-tbody');
    tbody.innerHTML = '';

    let totalExpected = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let clearedCount = 0;
    let balanceCount = 0;
    let bursaryCount = 0;

    if (targetStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 30px;">No students match the current fee filter criteria.</td></tr>`;
    }

    targetStudents.forEach(student => {
        const secObj = getStudentExpectedFee(student);
        const tf = secObj.fee;
        const arr = secObj.arrears;
        const totalDue = secObj.totalDue;
        const pa = Number(student.paidAmount || 0);
        const bal = totalDue - pa;
        const isBursary = Boolean(student.bursaryName && student.bursaryName.trim());

        totalExpected += totalDue;
        totalCollected += pa;
        totalOutstanding += Math.max(0, bal);
        if (bal <= 0) clearedCount++;
        else balanceCount++;
        if (isBursary) bursaryCount++;

        const tr = document.createElement('tr');

        // Fee lock badge
        let lockBadge = '';
        if (bal <= 0) {
            lockBadge = '<span class="badge" style="background: var(--accent-success); color: white;">🟢 Cleared</span>';
        } else if (student.feeLockOverride) {
            lockBadge = '<span class="badge" style="background: var(--accent-blue); color: white;">🔑 Admin Override (Unlocked)</span>';
        } else {
            lockBadge = '<span class="badge" style="background: var(--accent-danger); color: white;">🔒 Locked</span>';
        }

        const paymentCount = (student.paymentHistory || []).length;
        const bursaryTag = isBursary ? `<div style="margin-top: 3px;"><span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #c4b5fd; border: 1px solid #8b5cf6; font-size: 0.72rem; padding: 2px 6px;">🎓 ${student.bursaryName}</span></div>` : '';

        let sectionTdHtml = '';
        if (schoolSections.length > 1) {
            const opts = schoolSections.map(sec =>
                `<option value="${sec.id}" ${sec.id === secObj.id ? 'selected' : ''}>${sec.name} (MK ${Number(sec.fee).toLocaleString()})</option>`
            ).join('');
            sectionTdHtml = `<select class="student-section-select" data-id="${student.id}" data-current-sec="${secObj.id}" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: white; font-size: 0.85rem; cursor: pointer;">${opts}</select>`;
        } else {
            sectionTdHtml = `<span style="font-weight: 500; font-size: 0.85rem; color: var(--text-primary);">${secObj.name}</span>`;
        }

        tr.innerHTML = `
            <td>
                <strong>${student.name}</strong>
                ${bursaryTag}
            </td>
            <td>${student.classLevel || 'Form 1'}</td>
            <td>${sectionTdHtml}</td>
            <td style="font-weight: 600; color: var(--text-primary);">MK ${tf.toLocaleString()}</td>
            <td style="color: ${arr > 0 ? 'var(--accent-warning)' : 'var(--text-secondary)'}; font-weight: ${arr > 0 ? 'bold' : 'normal'};">MK ${arr.toLocaleString()}</td>
            <td style="font-weight: bold; color: var(--text-primary);">MK ${totalDue.toLocaleString()}</td>
            <td style="color: var(--accent-success); font-weight: 600;">MK ${pa.toLocaleString()}</td>
            <td style="color: ${bal > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}; font-weight: bold;">
                MK ${bal.toLocaleString()}
            </td>
            <td>${lockBadge}</td>
            <td>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <button class="btn btn-pay success-btn" style="padding: 4px 8px; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;" data-id="${student.id}" data-name="${student.name}">
                        💵 Record Pay ${paymentCount > 0 ? `(${paymentCount})` : ''}
                    </button>
                    <button class="btn btn-override outline-btn" style="padding: 4px 8px; font-size: 0.8rem;" data-id="${student.id}" data-override="${student.feeLockOverride ? 'false' : 'true'}">
                        ${student.feeLockOverride ? 'Lock' : 'Override Lock'}
                    </button>
                </div>
            </td>
        `;

        // Section change listener with warning dialog
        const secSelect = tr.querySelector('.student-section-select');
        if (secSelect) {
            secSelect.addEventListener('change', async (e) => {
                const sid = e.target.getAttribute('data-id');
                const oldSecId = e.target.getAttribute('data-current-sec');
                const newSecId = e.target.value;

                const oldSec = schoolSections.find(s => s.id === oldSecId) || { name: 'Previous Section', fee: 0 };
                const newSec = schoolSections.find(s => s.id === newSecId) || { name: 'New Section', fee: 0 };

                const confirmMsg = `⚠️ Change section for ${student.name}?\n\n` +
                    `From: ${oldSec.name} (MK ${Number(oldSec.fee).toLocaleString()})\n` +
                    `To: ${newSec.name} (MK ${Number(newSec.fee).toLocaleString()})\n\n` +
                    `Existing payments of MK ${pa.toLocaleString()} will now count toward the new fee balance of MK ${Math.max(0, Number(newSec.fee) - pa).toLocaleString()}.\n\n` +
                    `Proceed?`;

                if (!confirm(confirmMsg)) {
                    e.target.value = oldSecId;
                    return;
                }

                const updates = {};
                updates[sid] = { section: newSecId };
                await apiFetch('/api/students', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updates })
                });
                renderFeesTab();
            });
        }

        // Record payment click handler
        tr.querySelector('.btn-pay').addEventListener('click', () => {
            openPaymentModal(student.id, student.name);
        });

        // Override toggle click handler
        tr.querySelector('.btn-override').addEventListener('click', async (e) => {
            const sid = e.target.getAttribute('data-id');
            const overrideState = e.target.getAttribute('data-override') === 'true';
            await apiFetch(`/api/students/${sid}/fee-lock-override`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ override: overrideState })
            });
            renderFeesTab();
        });

        tbody.appendChild(tr);
    });

    // Update summary cards
    const ratePercent = totalExpected > 0 ? Math.min(100, Math.round((totalCollected / totalExpected) * 100)) : (targetStudents.length > 0 ? 100 : 0);
    document.getElementById('fee-summary-total').innerText = `MK ${totalExpected.toLocaleString()}`;
    document.getElementById('fee-summary-total-count').innerText = `${targetStudents.length} Students`;

    document.getElementById('fee-summary-collected').innerText = `MK ${totalCollected.toLocaleString()}`;
    document.getElementById('fee-summary-collected-count').innerText = `${clearedCount} Fully Cleared`;

    document.getElementById('fee-summary-outstanding').innerText = `MK ${totalOutstanding.toLocaleString()}`;
    document.getElementById('fee-summary-outstanding-count').innerText = `${balanceCount} With Balance`;

    document.getElementById('fee-summary-rate').innerText = `${ratePercent}%`;
    document.getElementById('fee-summary-bursary-count').innerText = `${bursaryCount} on Bursary`;
}

// Fee Search & Filter Listeners
document.getElementById('fee-student-search')?.addEventListener('input', (e) => {
    feeLedgerSearchTerm = e.target.value.trim();
    renderFeesTab();
});

document.getElementById('fee-class-filter')?.addEventListener('change', (e) => {
    feeLedgerClassFilter = e.target.value;
    renderFeesTab();
});

document.getElementById('fee-status-filter')?.addEventListener('change', (e) => {
    feeLedgerStatusFilter = e.target.value;
    renderFeesTab();
});

// Export Fee Ledger CSV
document.getElementById('btn-export-fees')?.addEventListener('click', () => {
    if (!students || students.length === 0) return alert('No student data to export.');
    
    let target = students;
    if (feeLedgerClassFilter === 'SELECTED') target = students.filter(s => (s.classLevel || 'Form 1') === currentClass);
    else if (feeLedgerClassFilter !== 'ALL') target = students.filter(s => (s.classLevel || 'Form 1') === feeLedgerClassFilter);
    if (feeLedgerSectionFilter !== 'ALL') target = target.filter(s => getStudentExpectedFee(s).id === feeLedgerSectionFilter);
    
    let csv = 'Student ID,Full Name,Class Level,Section,Bursary,Expected Fee (MK),Paid Amount (MK),Balance (MK),Fee Lock Override\n';
    target.forEach(s => {
        const secObj = getStudentExpectedFee(s);
        const tf = secObj.fee;
        const pa = Number(s.paidAmount || 0);
        const bal = tf - pa;
        const bursary = (s.bursaryName || '').replace(/,/g, ' ');
        const name = (s.name || '').replace(/,/g, ' ');
        csv += `"${s.id}","${name}","${s.classLevel || 'Form 1'}","${secObj.name}","${bursary}",${tf},${pa},${bal},${s.feeLockOverride ? 'YES' : 'NO'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Fee_Ledger_${(feeLedgerClassFilter === 'SELECTED' ? currentClass : feeLedgerClassFilter).replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Print Fee Ledger Sheet
document.getElementById('btn-print-fees')?.addEventListener('click', () => {
    window.print();
});

// Payment Modal Logic
function openPaymentModal(studentId, studentName) {
    const s = students.find(x => x.id === studentId);
    if (!s) return;

    document.getElementById('payment-student-id').value = studentId;
    document.getElementById('payment-student-name').innerText = `${studentName} (${s.classLevel || 'Form 1'})`;
    
    const secObj = getStudentExpectedFee(s);
    const tf = secObj.fee;
    const pa = Number(s.paidAmount || 0);
    const bal = tf - pa;

    document.getElementById('pay-modal-term-fee').innerText = `MK ${tf.toLocaleString()} (${secObj.name})`;
    document.getElementById('pay-modal-paid').innerText = `MK ${pa.toLocaleString()}`;
    document.getElementById('pay-modal-balance').innerText = `MK ${bal.toLocaleString()}`;

    document.getElementById('payment-amount').value = '';
    document.getElementById('payment-method').value = 'Cash';
    document.getElementById('payment-note').value = '';
    document.getElementById('payment-error').style.display = 'none';

    // Quick pay full balance button
    const payFullBtn = document.getElementById('btn-pay-full-balance');
    if (payFullBtn) {
        payFullBtn.onclick = () => {
            document.getElementById('payment-amount').value = Math.max(0, bal);
        };
    }

    renderPaymentHistoryList(s);
    document.getElementById('payment-modal').style.display = 'flex';
}

function renderPaymentHistoryList(student) {
    const hist = document.getElementById('payment-history-list');
    hist.innerHTML = '';

    if (student && student.paymentHistory && student.paymentHistory.length > 0) {
        student.paymentHistory.slice().reverse().forEach(p => {
            const div = document.createElement('div');
            div.style.cssText = 'padding: 10px; margin-bottom: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); display: flex; justify-content: space-between; align-items: center; gap: 10px;';
            
            const methodBadge = `<span class="badge" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); font-size: 0.75rem; padding: 2px 6px;">${p.method || 'Cash'}</span>`;
            
            div.innerHTML = `
                <div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
                        <strong style="color: var(--accent-success); font-size: 0.95rem;">MK ${Number(p.amount).toLocaleString()}</strong>
                        ${methodBadge}
                        <span style="font-size: 0.78rem; color: var(--text-secondary);">${p.receiptNo}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        ${new Date(p.date).toLocaleDateString()} ${p.note ? `· ${p.note}` : ''} <span style="opacity: 0.7;">(by ${p.recordedBy || 'Admin'})</span>
                    </div>
                </div>
                <div style="display: flex; gap: 6px; flex-shrink: 0;">
                    <button class="btn outline-btn btn-print-rec" style="padding: 4px 8px; font-size: 0.75rem;">🖨️ Receipt</button>
                    <button class="btn danger-btn btn-void-pay" style="padding: 4px 8px; font-size: 0.75rem;">🗑️</button>
                </div>
            `;

            // Print Receipt handler
            div.querySelector('.btn-print-rec').addEventListener('click', () => {
                openReceiptModal(student, p);
            });

            // Void payment handler
            div.querySelector('.btn-void-pay').addEventListener('click', async () => {
                if (!confirm(`⚠️ Are you sure you want to VOID and DELETE payment ${p.receiptNo} of MK ${Number(p.amount).toLocaleString()}?`)) return;
                
                try {
                    const delRes = await apiFetch(`/api/students/${student.id}/payments/${p.receiptNo}`, {
                        method: 'DELETE'
                    });
                    if (delRes.ok) {
                        const updatedData = await delRes.json();
                        // Update local student object
                        student.paidAmount = updatedData.paidAmount;
                        student.paymentHistory = student.paymentHistory.filter(x => x.receiptNo !== p.receiptNo);
                        
                        // Update modal numbers
                        const secObj = getStudentExpectedFee(student);
                        const newBal = secObj.fee - student.paidAmount;
                        document.getElementById('pay-modal-paid').innerText = `MK ${student.paidAmount.toLocaleString()}`;
                        document.getElementById('pay-modal-balance').innerText = `MK ${newBal.toLocaleString()}`;
                        
                        renderPaymentHistoryList(student);
                        renderFeesTab();
                    } else {
                        const err = await delRes.json();
                        alert(err.error || 'Failed to void payment.');
                    }
                } catch(e) {
                    alert('Network error voiding payment.');
                }
            });

            hist.appendChild(div);
        });
    } else {
        hist.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 10px;">No previous payment records.</p>';
    }
}

document.getElementById('payment-close-x')?.addEventListener('click', () => {
    document.getElementById('payment-modal').style.display = 'none';
});

document.getElementById('payment-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('payment-modal').style.display = 'none';
});

document.getElementById('payment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('payment-student-id').value;
    const amount = Number(document.getElementById('payment-amount').value);
    const method = document.getElementById('payment-method').value;
    const note = document.getElementById('payment-note').value;

    const res = await apiFetch(`/api/students/${studentId}/payments`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ amount, method, note })
    });

    if (res.ok) {
        const data = await res.json();
        document.getElementById('payment-modal').style.display = 'none';
        await renderFeesTab();
        
        // Find updated student and offer to show receipt
        const s = students.find(x => x.id === studentId);
        if (s && data.receipt && confirm('✅ Payment recorded successfully! Would you like to view/print the official receipt now?')) {
            openReceiptModal(s, data.receipt);
        }
    } else {
        const err = await res.json();
        document.getElementById('payment-error').innerText = err.error || 'Failed to record payment.';
        document.getElementById('payment-error').style.display = 'block';
    }
});

// Printable Receipt Modal Logic
function openReceiptModal(student, payment) {
    const schoolNameEl = document.getElementById('sidebar-school-name');
    const schoolName = (schoolNameEl && schoolNameEl.innerText) ? schoolNameEl.innerText : 'EXCEL ACADEMY';
    
    document.getElementById('receipt-school-name').innerText = schoolName.toUpperCase();
    document.getElementById('receipt-no').innerText = payment.receiptNo;
    document.getElementById('receipt-date').innerText = new Date(payment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    document.getElementById('receipt-student-name').innerText = student.name;
    document.getElementById('receipt-student-class').innerText = student.classLevel || 'Form 1';
    document.getElementById('receipt-method').innerText = payment.method || 'Cash';
    document.getElementById('receipt-note').innerText = payment.note || 'Term Tuition Fee Payment';
    document.getElementById('receipt-amount').innerText = `MK ${Number(payment.amount).toLocaleString()}`;
    
    const secObj = getStudentExpectedFee(student);
    const tf = secObj.fee;
    const pa = Number(student.paidAmount || 0);
    const bal = tf - pa;
    document.getElementById('receipt-total-fee').innerText = `MK ${tf.toLocaleString()} (${secObj.name})`;
    document.getElementById('receipt-balance').innerText = `MK ${bal.toLocaleString()}`;
    document.getElementById('receipt-recorded-by').innerText = payment.recordedBy || 'Admin';

    document.getElementById('receipt-modal').style.display = 'flex';
}

document.getElementById('btn-close-receipt-modal')?.addEventListener('click', () => {
    document.getElementById('receipt-modal').style.display = 'none';
});

document.getElementById('btn-print-receipt-action')?.addEventListener('click', () => {
    const receiptContent = document.getElementById('printable-receipt-area').innerHTML;
    const printWindow = window.open('', '', 'width=650,height=750');
    printWindow.document.write(`
        <html>
        <head>
            <title>Fee Payment Receipt</title>
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 25px; color: #1e293b; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <div style="max-width: 480px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 25px; border-radius: 8px;">
                ${receiptContent}
            </div>
            <script>
                window.onload = function() { window.print(); window.close(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
});

// Academic Calendar & Term Advancement Action
async function handleAdvanceTermAction() {
    const termBadge = document.getElementById('current-academic-badge')?.textContent || 'Current Term';
    const nextStepText = document.getElementById('term-card-next-step')?.textContent || 'Advance Term';

    const confirmMsg = `⚠️ ADVANCE ACADEMIC CALENDAR & ARCHIVE TERM\n\nTarget Action: ${nextStepText}\nActive Term: ${termBadge}\n\nThis will execute the following automated steps:\n1. Archive report cards, marks, and ranks into Academic History.\n2. Archive fee ledgers and carry over all unpaid fee balances as opening ARREARS for the new term.\n3. Reset current term marks and paid amounts for all students.\n4. (If closing Term 3): Automatically promote Form 1→2, Form 2→3, Form 3→4, and Form 4→Graduated.\n\nAre you sure you want to proceed?`;

    if (!confirm(confirmMsg)) return;

    try {
        const res = await apiFetch('/api/settings/advance-term', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (res.ok) {
            alert(`✅ ${data.message}`);
            await loadSettings();
            await renderFeesTab();
        } else {
            alert('Error advancing term: ' + (data.error || 'Unknown error'));
        }
    } catch(e) {
        alert('Network error advancing term.');
    }
}

document.getElementById('btn-advance-term-action')?.addEventListener('click', handleAdvanceTermAction);

document.getElementById('btn-start-new-term')?.addEventListener('click', () => {
    if (currentUser && currentUser.role === 'admin') {
        const settingsTab = document.querySelector('[data-tab="settings-tab"]');
        if (settingsTab) settingsTab.click();
        const card = document.getElementById('term-management-card');
        if (card) card.scrollIntoView({ behavior: 'smooth' });
    } else {
        alert('ℹ️ Term Advancement & Class Promotions are managed by the Headteacher/Admin in Global Settings.');
    }
});

// ── 📅 Daily Attendance UI Implementation ─────────────────────────────
let currentAttendanceDate = new Date().toISOString().split('T')[0];

async function renderAttendanceTab() {
    const dateInput = document.getElementById('attendance-date');
    if (!dateInput.value) {
        dateInput.value = currentAttendanceDate;
    } else {
        currentAttendanceDate = dateInput.value;
    }

    try {
        const res = await apiFetch('/api/students');
        if (!res.ok) return;
        students = await res.json();
    } catch(e) {
        return;
    }

    let existingRegister = { records: {} };
    try {
        const attRes = await apiFetch(`/api/attendance?date=${currentAttendanceDate}&classLevel=${encodeURIComponent(currentClass)}`);
        if (attRes.ok) existingRegister = await attRes.json();
    } catch(e) {}

    const classStudents = students.filter(s => (s.classLevel || 'Form 1') === currentClass);
    const tbody = document.getElementById('attendance-table-tbody');
    tbody.innerHTML = '';

    for (const student of classStudents) {
        const currentStatus = (existingRegister.records && existingRegister.records[student.id]) || '';

        // Fetch student summary attendance
        let summaryText = '0 / 0 Days';
        try {
            const sumRes = await apiFetch(`/api/students/${student.id}/attendance-summary`);
            if (sumRes.ok) {
                const sum = await sumRes.json();
                summaryText = `${sum.present} Present / ${sum.totalDays} Total Days`;
            }
        } catch(e) {}

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${student.name}</strong></td>
            <td>${student.classLevel || 'Form 1'}</td>
            <td>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;" class="att-status-group" data-id="${student.id}">
                    <label style="cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 4px; color: var(--accent-success);">
                        <input type="radio" name="att-${student.id}" value="present" ${currentStatus === 'present' ? 'checked' : ''}> 🟢 Present
                    </label>
                    <label style="cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 4px; color: var(--accent-danger);">
                        <input type="radio" name="att-${student.id}" value="absent" ${currentStatus === 'absent' ? 'checked' : ''}> 🔴 Absent
                    </label>
                    <label style="cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 4px; color: #f59e0b;">
                        <input type="radio" name="att-${student.id}" value="late" ${currentStatus === 'late' ? 'checked' : ''}> 🟡 Late
                    </label>
                    <label style="cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 4px; color: var(--accent-blue);">
                        <input type="radio" name="att-${student.id}" value="excused" ${currentStatus === 'excused' ? 'checked' : ''}> 🔵 Excused
                    </label>
                </div>
            </td>
            <td style="color: var(--text-secondary); font-size: 0.9rem;">${summaryText}</td>
        `;
        tbody.appendChild(tr);
    }
}

document.getElementById('btn-load-attendance').addEventListener('click', () => {
    currentAttendanceDate = document.getElementById('attendance-date').value;
    renderAttendanceTab();
});

document.getElementById('btn-mark-all-present').addEventListener('click', () => {
    document.querySelectorAll('#attendance-table-tbody input[value="present"]').forEach(r => r.checked = true);
});

document.getElementById('btn-save-attendance').addEventListener('click', async () => {
    const date = document.getElementById('attendance-date').value;
    const records = {};

    document.querySelectorAll('#attendance-table-tbody .att-status-group').forEach(group => {
        const sid = group.getAttribute('data-id');
        const selected = group.querySelector('input:checked');
        if (selected) {
            records[sid] = selected.value;
        }
    });

    const res = await apiFetch('/api/attendance', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ date, classLevel: currentClass, records })
    });

    const msg = document.getElementById('attendance-status-msg');
    if (res.ok) {
        msg.innerText = `✅ Attendance register for ${currentClass} on ${date} saved successfully!`;
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 4000);
        renderAttendanceTab();
    } else {
        alert('Failed to save attendance register.');
    }
});

document.getElementById('btn-send-absent-whatsapp').addEventListener('click', async () => {
    const date = document.getElementById('attendance-date').value;
    const res = await apiFetch('/api/whatsapp/send-absent-alerts', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ date, classLevel: currentClass })
    });

    if (res.ok) {
        const data = await res.json();
        alert(`📲 Sent ${data.count} absence alert(s) to parents on WhatsApp!`);
    } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to send WhatsApp alerts.'}`);
    }
});

// ── 🗓️ PHASE 3.2 - Timetable UI ─────────────────────────────────────
const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIMETABLE_PERIODS = [
    { period: 1, name: '07:30-08:15' },
    { period: 2, name: '08:15-09:00' },
    { period: 3, name: '09:00-09:45' },
    { period: 4, name: '10:15-11:00' },
    { period: 5, name: '11:00-11:45' },
    { period: 6, name: '12:30-13:15' },
    { period: 7, name: '13:15-14:00' }
];

async function renderTimetableTab() {
    document.getElementById('timetable-class-label').innerText = currentClass;
    const grid = document.getElementById('timetable-grid');
    grid.innerHTML = '<p style="color: var(--text-secondary);">Loading timetable...</p>';

    let scheduleData = [];
    let staffList = [];
    try {
        const ttRes = await apiFetch(`/api/timetable?classLevel=${encodeURIComponent(currentClass)}`);
        if (ttRes.ok) { const d = await ttRes.json(); scheduleData = d.schedule || []; }

        const canSeeStaff = currentUser && (
            currentUser.role === 'admin' ||
            currentUser.role === 'superadmin' ||
            currentUser.role === 'headteacher'
        );
        if (canSeeStaff) {
            const stRes = await apiFetch('/api/users');
            if (stRes.ok) staffList = await stRes.json();
        }
    } catch(e) { grid.innerHTML = '<p>Error loading timetable.</p>'; return; }

    const scheduleMap = {};
    scheduleData.forEach(slot => {
        scheduleMap[`${slot.day}-${slot.period}`] = slot;
    });

    let html = `<table style="width:100%; border-collapse:collapse; min-width:600px;">
        <thead><tr>
            <th style="padding:10px; text-align:left; background:var(--bg-secondary); border:1px solid var(--border-color);">Period</th>
            ${TIMETABLE_DAYS.map(d => `<th style="padding:10px; text-align:center; background:var(--accent-blue); color:white; border:1px solid var(--border-color);">${d}</th>`).join('')}
        </tr></thead>
        <tbody>`;

    const canEditTimetable = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');

    TIMETABLE_PERIODS.forEach(p => {
        html += `<tr>`;
        html += `<td style="padding:10px; font-size:0.8rem; color:var(--text-secondary); border:1px solid var(--border-color); white-space:nowrap;"><strong>P${p.period}</strong><br>${p.name}</td>`;
        TIMETABLE_DAYS.forEach(day => {
            const key = `${day}-${p.period}`;
            const slot = scheduleMap[key];
            const teacher = slot && slot.teacherId ? staffList.find(u => u.id === slot.teacherId) : null;
            html += `<td style="padding:6px; border:1px solid var(--border-color); min-width:110px; vertical-align:top;">
                <div style="font-size:0.85rem; font-weight:bold; color:${slot ? 'var(--accent-blue)' : 'var(--text-secondary)'}">
                    ${slot ? slot.subject : '<em style="opacity:0.4">Free</em>'}
                </div>
                ${teacher ? `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px;">${teacher.name}</div>` : ''}
                ${canEditTimetable ? `
                <div style="display:flex; gap:4px; margin-top:5px; flex-wrap:wrap;">
                    <button class="btn outline-btn btn-tt-edit" style="padding:2px 6px; font-size:0.72rem;" data-day="${day}" data-period="${p.period}" data-slot='${JSON.stringify(slot || {})}'>✏️</button>
                    ${slot ? `<button class="btn outline-btn btn-tt-clear" style="padding:2px 6px; font-size:0.72rem; color:var(--accent-danger);" data-day="${day}" data-period="${p.period}">✕</button>` : ''}
                </div>` : ''}
            </td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    grid.innerHTML = html;

    grid.querySelectorAll('.btn-tt-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const day = btn.getAttribute('data-day');
            const period = btn.getAttribute('data-period');
            const slot = JSON.parse(btn.getAttribute('data-slot') || '{}');
            openTimetableSlotModal(day, period, slot, staffList);
        });
    });

    grid.querySelectorAll('.btn-tt-clear').forEach(btn => {
        btn.addEventListener('click', async () => {
            const day = btn.getAttribute('data-day');
            const period = btn.getAttribute('data-period');
            await apiFetch(`/api/timetable?classLevel=${encodeURIComponent(currentClass)}&day=${day}&period=${period}`, { method: 'DELETE' });
            renderTimetableTab();
        });
    });
}

document.getElementById('btn-reload-timetable').addEventListener('click', renderTimetableTab);

function openTimetableSlotModal(day, period, existing, staffList) {
    const subject = prompt(`Subject for ${day} Period ${period} (${currentClass}):`, existing.subject || '');
    if (subject === null) return;

    const teacherOptions = staffList.map(s => `${s.id}: ${s.name}`).join('\n');
    const teacherChoice = prompt(`Teacher ID (optional - leave blank for none).\nAvailable:\n${teacherOptions}`, existing.teacherId || '');
    const teacherId = teacherChoice && teacherChoice.trim() ? teacherChoice.trim().split(':')[0].trim() : null;

    apiFetch('/api/timetable', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            classLevel: currentClass,
            day,
            period: Number(period),
            subject,
            teacherId
        })
    }).then(res => {
        if (res.ok) {
            renderTimetableTab();
        } else {
            res.json().then(d => alert(`Error: ${d.error}`));
        }
    });
}

// ── 💼 PHASE 3.3 - Payroll & HR UI ───────────────────────────────────
async function renderPayrollTab() {
    const tbody = document.getElementById('payroll-table-tbody');
    tbody.innerHTML = '';
    let staffList = [];
    try {
        const res = await apiFetch('/api/payroll/staff');
        if (!res.ok) return;
        staffList = await res.json();
    } catch(e) { return; }

    staffList.forEach(s => {
        const allowances = s.allowances || {};
        const totalAllow = (Number(allowances.housing || 0) + Number(allowances.transport || 0) + Number(allowances.health || 0));
        const gross = Number(s.basicSalary || 0) + totalAllow;

        // Simplified net: deduct 15% PAYE + 5% pension from basic for preview
        const paye = Math.round(Math.max(0, Number(s.basicSalary || 0) - 100000) * 0.15);
        const pension = Math.round(Number(s.basicSalary || 0) * 0.05);
        const net = gross - paye - pension;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${s.name}</strong></td>
            <td>${formatRole(s.role)}</td>
            <td>${s.employmentType || 'Full-Time'}</td>
            <td>
                <input type="number" class="payroll-basic-input" value="${s.basicSalary || 0}" min="0" data-id="${s.id}" style="width:110px; padding:5px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-primary); color:white;">
            </td>
            <td>MK ${gross.toLocaleString()}</td>
            <td style="font-weight:bold; color:var(--accent-success);">MK ${net.toLocaleString()}</td>
            <td>${s.leaveBalance !== undefined ? s.leaveBalance + ' day(s)' : '14 day(s)'}</td>
            <td>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn primary-btn btn-gen-payslip" style="padding:3px 8px; font-size:0.78rem;" data-id="${s.id}" data-name="${s.name}">🧾 Payslip</button>
                    <button class="btn outline-btn btn-record-leave" style="padding:3px 8px; font-size:0.78rem;" data-id="${s.id}" data-name="${s.name}">🌴 Leave</button>
                    <button class="btn outline-btn btn-staff-history" style="padding:3px 8px; font-size:0.78rem;" data-id="${s.id}">📜 History</button>
                </div>
            </td>`;

        tr.querySelector('.payroll-basic-input').addEventListener('change', async (e) => {
            await apiFetch(`/api/payroll/staff/${s.id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ basicSalary: Number(e.target.value) })
            });
            renderPayrollTab();
        });

        tr.querySelector('.btn-gen-payslip').addEventListener('click', async (e) => {
            const sid = e.target.getAttribute('data-id');
            const sname = e.target.getAttribute('data-name');
            const month = prompt(`Generate payslip for ${sname}.\nEnter month (e.g. September):`, new Date().toLocaleString('default', { month: 'long' }));
            if (!month) return;
            const res = await apiFetch(`/api/payroll/payslip/${sid}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ month, year: new Date().getFullYear() })
            });
            if (res.ok) {
                const data = await res.json();
                const p = data.payslip;
                openPrintablePayslipModal(s, p);
            }
        });

        tr.querySelector('.btn-record-leave').addEventListener('click', async (e) => {
            const sid = e.target.getAttribute('data-id');
            const sname = e.target.getAttribute('data-name');
            const type = prompt(`Leave type for ${sname}:\n1. Annual Leave\n2. Sick Leave\n3. Compassionate\nEnter type:`, 'Annual Leave');
            if (!type) return;
            const startDate = prompt('Start date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
            if (!startDate) return;
            const endDate = prompt('End date (YYYY-MM-DD):', startDate);
            if (!endDate) return;
            const reason = prompt('Reason (optional):') || '';
            const res = await apiFetch(`/api/payroll/leave/${sid}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ startDate, endDate, reason, type })
            });
            if (res.ok) {
                const data = await res.json();
                alert(`✅ Leave recorded. Remaining balance: ${data.leaveBalance} day(s).`);
                renderPayrollTab();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        });

        tr.querySelector('.btn-staff-history').addEventListener('click', () => {
            openStaffHistoryModal(s);
        });

        tbody.appendChild(tr);
    });
}

// Staff HR History Modal Logic
function openStaffHistoryModal(staff) {
    document.getElementById('staff-history-title').innerText = `📜 HR History: ${staff.name}`;
    document.getElementById('staff-history-subtitle').innerText = `${formatRole(staff.role)} · ${staff.employmentType || 'Full-Time'} · ${staff.leaveBalance !== undefined ? staff.leaveBalance : 14} Day(s) Remaining Leave`;

    // Render Payslips
    const payslipsList = document.getElementById('staff-payslips-list');
    payslipsList.innerHTML = '';
    const payslips = staff.paymentHistory || [];

    if (payslips.length > 0) {
        payslips.slice().reverse().forEach(p => {
            const div = document.createElement('div');
            div.style.cssText = 'padding: 10px 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); display: flex; justify-content: space-between; align-items: center; gap: 10px;';
            const totalDeductions = Number(p.paye || 0) + Number(p.pension || 0);
            div.innerHTML = `
                <div>
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">
                        ${p.month} ${p.year} <span style="font-size: 0.78rem; font-weight: normal; color: var(--text-secondary);">(${p.slipId})</span>
                    </div>
                    <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
                        Gross: MK ${Number(p.grossPay || 0).toLocaleString()} · Tax/Deductions: MK ${totalDeductions.toLocaleString()} · <strong style="color: var(--accent-success);">Net: MK ${Number(p.netPay || 0).toLocaleString()}</strong>
                    </div>
                </div>
                <button class="btn primary-btn btn-print-this-payslip" style="padding: 4px 10px; font-size: 0.78rem; background: #0284c7;">🖨️ View / Print</button>
            `;
            div.querySelector('.btn-print-this-payslip').addEventListener('click', () => {
                openPrintablePayslipModal(staff, p);
            });
            payslipsList.appendChild(div);
        });
    } else {
        payslipsList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.88rem; padding: 10px 0;">No monthly payslips issued yet for this staff member.</p>';
    }

    // Render Leave Logs
    const leaveList = document.getElementById('staff-leave-list');
    leaveList.innerHTML = '';
    const leaves = staff.leaveHistory || [];

    if (leaves.length > 0) {
        leaves.slice().reverse().forEach(l => {
            const div = document.createElement('div');
            div.style.cssText = 'padding: 10px 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); font-size: 0.85rem;';
            const typeColor = l.type === 'Sick' ? 'var(--accent-danger)' : (l.type === 'Compassionate' ? '#f59e0b' : 'var(--accent-blue)');
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span class="badge" style="background: ${typeColor}; color: white; font-size: 0.75rem;">${l.type || 'Annual Leave'} (${l.days} day${l.days > 1 ? 's' : ''})</span>
                    <span style="color: var(--text-secondary); font-size: 0.78rem;">${new Date(l.startDate).toLocaleDateString()} to ${new Date(l.endDate).toLocaleDateString()}</span>
                </div>
                ${l.reason ? `<div style="color: var(--text-primary); margin-top: 4px;">Reason: ${l.reason}</div>` : ''}
                <div style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 4px;">Recorded by: ${l.recordedBy || 'Admin'}</div>
            `;
            leaveList.appendChild(div);
        });
    } else {
        leaveList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.88rem; padding: 10px 0;">No leave logs recorded.</p>';
    }

    document.getElementById('staff-history-modal').style.display = 'flex';
}

function openPrintablePayslipModal(staff, payslip) {
    const schoolNameEl = document.getElementById('sidebar-school-name');
    const schoolName = (schoolNameEl && schoolNameEl.innerText) ? schoolNameEl.innerText : 'EXCEL ACADEMY';
    
    document.getElementById('payslip-school-name').innerText = schoolName.toUpperCase();
    document.getElementById('ps-staff-name').innerText = staff.name;
    document.getElementById('ps-staff-role').innerText = formatRole(staff.role);
    document.getElementById('ps-staff-id').innerText = staff.nationalId || staff.username || 'N/A';

    document.getElementById('ps-period').innerText = `${payslip.month} ${payslip.year}`;
    document.getElementById('ps-slip-id').innerText = payslip.slipId;
    document.getElementById('ps-date').innerText = payslip.generatedAt ? new Date(payslip.generatedAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

    const basic = Number(payslip.basicSalary || 0);
    const allow = payslip.allowances || {};
    const housing = Number(allow.housing || 0);
    const transport = Number(allow.transport || 0);
    const health = Number(allow.health || 0);
    const gross = Number(payslip.grossPay || (basic + housing + transport + health));
    const paye = Number(payslip.paye || 0);
    const pension = Number(payslip.pension || 0);
    const totalDeductions = paye + pension;
    const net = Number(payslip.netPay || (gross - totalDeductions));

    document.getElementById('ps-basic').innerText = `MK ${basic.toLocaleString()}`;
    document.getElementById('ps-allow-housing').innerText = `MK ${housing.toLocaleString()}`;
    document.getElementById('ps-allow-transport').innerText = `MK ${transport.toLocaleString()}`;
    document.getElementById('ps-allow-health').innerText = `MK ${health.toLocaleString()}`;
    document.getElementById('ps-gross').innerText = `MK ${gross.toLocaleString()}`;

    document.getElementById('ps-paye').innerText = `MK ${paye.toLocaleString()}`;
    document.getElementById('ps-pension').innerText = `MK ${pension.toLocaleString()}`;
    document.getElementById('ps-total-deductions').innerText = `MK ${totalDeductions.toLocaleString()}`;
    document.getElementById('ps-net').innerText = `MK ${net.toLocaleString()}`;
    document.getElementById('ps-generated-by').innerText = payslip.generatedBy || 'Admin';

    document.getElementById('printable-payslip-modal').style.display = 'flex';
}

document.getElementById('staff-history-close-x')?.addEventListener('click', () => {
    document.getElementById('staff-history-modal').style.display = 'none';
});
document.getElementById('staff-history-close-btn')?.addEventListener('click', () => {
    document.getElementById('staff-history-modal').style.display = 'none';
});
document.getElementById('btn-close-payslip-modal')?.addEventListener('click', () => {
    document.getElementById('printable-payslip-modal').style.display = 'none';
});

document.getElementById('btn-print-payslip-action')?.addEventListener('click', () => {
    const content = document.getElementById('printable-payslip-area').innerHTML;
    const printWindow = window.open('', '', 'width=700,height=800');
    printWindow.document.write(`
        <html>
        <head>
            <title>Staff Payslip</title>
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 25px; color: #1e293b; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <div style="max-width: 580px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 25px; border-radius: 8px;">
                ${content}
            </div>
            <script>
                window.onload = function() { window.print(); window.close(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
});


// ── 📢 PHASE 3.4 - Notices Tab (Admin side) ──────────────────────────
async function renderNoticesTab() {
    const listEl = document.getElementById('notices-admin-list');
    const countEl = document.getElementById('notices-count');
    listEl.innerHTML = '<p style="color:var(--text-secondary);">Loading...</p>';

    const canPostNotices = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.role === 'headteacher' || currentUser.role === 'class_teacher');
    const formCard = document.getElementById('notices-form')?.closest('.card');
    if (formCard) formCard.style.display = canPostNotices ? 'block' : 'none';

    try {
        const res = await apiFetch('/api/parent-portal/notices');
        if (!res.ok) return;
        const notices = await res.json();
        countEl.textContent = `(${notices.length})`;
        if (!notices.length) {
            listEl.innerHTML = '<p style="color:var(--text-secondary);">No notices posted yet.</p>';
            return;
        }
        listEl.innerHTML = notices.map(n => `
            <div style="border-left:3px solid var(--accent-blue); padding:10px 14px; margin-bottom:10px; background:var(--bg-secondary); border-radius:0 8px 8px 0;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                    <div>
                        <div style="font-weight:700; margin-bottom:4px;">${n.title}</div>
                        <div style="font-size:0.78rem; color:var(--text-secondary); margin-bottom:6px;">${new Date(n.postedAt).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})} · by ${n.postedBy || 'Admin'}</div>
                        <div style="font-size:0.88rem; color:var(--text-secondary);">${n.body}</div>
                    </div>
                    ${canPostNotices ? `<button class="btn outline-btn btn-del-notice" data-id="${n.id}" style="padding:3px 8px; font-size:0.75rem; color:var(--accent-danger); border-color:var(--accent-danger); flex-shrink:0;">✕</button>` : ''}
                </div>
            </div>`).join('');

        listEl.querySelectorAll('.btn-del-notice').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this notice?')) return;
                await apiFetch(`/api/parent-portal/notices/${btn.getAttribute('data-id')}`, { method: 'DELETE' });
                renderNoticesTab();
            });
        });
    } catch(e) {
        listEl.innerHTML = '<p style="color:var(--accent-danger);">Failed to load notices.</p>';
    }
}

document.getElementById('notices-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('notice-title').value.trim();
    const body  = document.getElementById('notice-body').value.trim();
    const res = await apiFetch('/api/parent-portal/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body })
    });
    if (res.ok) {
        document.getElementById('notice-title').value = '';
        document.getElementById('notice-body').value = '';
        renderNoticesTab();
    } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
    }
});

// ── 📥 PHASE 4.4 - Applications Tab (Admin side) ──────────────────────
async function renderApplicationsTab() {
    const tbody = document.getElementById('applications-table-tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-secondary);">Loading applications...</td></tr>';

    try {
        const res = await apiFetch('/api/admin/applications');
        if (!res.ok) return;
        const apps = await res.json();
        if (!apps.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-secondary);">No applications received yet. Parents can apply via the <a href="/explore.html" target="_blank" style="color:var(--accent-blue);">Public Discovery Page</a>.</td></tr>';
            return;
        }

        tbody.innerHTML = apps.map(a => {
            const statusColor = a.status === 'Approved' ? 'var(--accent-success)' : a.status === 'Rejected' ? 'var(--accent-danger)' : 'var(--accent-amber)';
            return `
            <tr>
                <td><strong>${a.studentName}</strong></td>
                <td>${a.classApplied}</td>
                <td>${a.parentName || '-'}</td>
                <td>${a.parentPhone}</td>
                <td>${new Date(a.appliedAt).toLocaleDateString()}</td>
                <td><span style="color:${statusColor}; font-weight:bold;">${a.status}</span></td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn primary-btn btn-app-approve" data-id="${a.id}" style="padding:3px 8px; font-size:0.75rem;">Accept</button>
                        <button class="btn outline-btn btn-app-reject" data-id="${a.id}" style="padding:3px 8px; font-size:0.75rem; color:var(--accent-danger); border-color:var(--accent-danger);">Reject</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.btn-app-approve').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                await apiFetch(`/api/admin/applications/${id}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ status: 'Approved', note: 'Accepted for admission' })
                });
                renderApplicationsTab();
            });
        });

        tbody.querySelectorAll('.btn-app-reject').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                await apiFetch(`/api/admin/applications/${id}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ status: 'Rejected', note: 'Not accepted' })
                });
                renderApplicationsTab();
            });
        });

    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:var(--accent-danger);">Failed to load applications.</td></tr>';
    }
}

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS DASHBOARD
// ═══════════════════════════════════════════════════════════════════

// ─── Colour helpers ─────────────────────────────────────────────────────────
function anGradeColour(val) {
    if (val === null || val === undefined) return 'rgba(255,255,255,0.06)';
    if (val >= 80) return '#10b981'; // green
    if (val >= 65) return '#3b82f6'; // blue
    if (val >= 50) return '#f59e0b'; // amber
    return '#ef4444'; // red
}
function anGradeTextColour(val) {
    if (val === null || val === undefined) return 'var(--text-secondary)';
    if (val >= 80) return '#fff';
    if (val >= 65) return '#fff';
    if (val >= 50) return '#fff';
    return '#fff';
}

// ─── Horizontal bar chart (pure CSS/HTML) ───────────────────────────────────
function anRenderBarChart(containerId, items, { colorFn, maxVal, unit = '' }) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const max = maxVal || Math.max(...items.map(d => d.value || 0), 1);
    el.innerHTML = items.map(d => {
        const pct = d.value !== null && d.value !== undefined ? Math.round((d.value / max) * 100) : 0;
        const color = colorFn ? colorFn(d.value) : '#3b82f6';
        const display = d.value !== null && d.value !== undefined ? `${d.value}${unit}` : '-';
        return `
        <div class="an-bar-track">
            <span class="an-bar-label" title="${d.label}">${d.label.length > 10 ? d.label.substring(0, 9) + '...' : d.label}</span>
            <div class="an-bar-bg">
                <div class="an-bar-fill" style="width:${pct}%; background:${color};">
                    ${pct > 18 ? display : ''}
                </div>
            </div>
            <span class="an-bar-val" style="color:${color};">${pct <= 18 ? display : ''}</span>
        </div>`;
    }).join('');
}

// ─── Sparkline SVG line chart ────────────────────────────────────────────────
function anRenderSparkline(containerId, points, { color = '#3b82f6', fillColor, labelKey = 'label', valueKey = 'value', unit = '' } = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!points.length) {
        el.innerHTML = '<p style="color:var(--text-secondary); padding-top:60px; text-align:center; font-size:0.85rem;">No data yet</p>';
        return;
    }
    const W = el.offsetWidth || 400;
    const H = 180;
    const PAD = { top: 12, right: 10, bottom: 36, left: 44 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;
    const vals = points.map(p => p[valueKey]);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const range = maxV - minV || 1;

    const xScale = i => PAD.left + (i / (points.length - 1 || 1)) * chartW;
    const yScale = v => PAD.top + chartH - ((v - minV) / range) * chartH;

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(p[valueKey]).toFixed(1)}`).join(' ');
    const areaD = pathD + ` L${xScale(points.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;

    // Y-axis ticks
    const yTicks = [minV, Math.round((minV + maxV) / 2), maxV];
    const yTicksHtml = yTicks.map(v =>
        `<text x="${PAD.left - 6}" y="${yScale(v) + 4}" text-anchor="end" font-size="10" fill="var(--text-secondary)">${Math.round(v)}${unit}</text>`
    ).join('');

    // X-axis labels (show at most 6 evenly spaced)
    const step = Math.ceil(points.length / 6);
    const xLabels = points
        .filter((_, i) => i % step === 0 || i === points.length - 1)
        .map((p, _, arr) => {
            const origIdx = points.indexOf(p);
            const x = xScale(origIdx);
            const lbl = (p[labelKey] || '').toString().substring(0, 8);
            return `<text x="${x}" y="${H - 6}" text-anchor="middle" font-size="9" fill="var(--text-secondary)">${lbl}</text>`;
        }).join('');

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="spark-svg">
        <defs>
            <linearGradient id="sparkGrad-${containerId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${fillColor || color}" stop-opacity="0.25"/>
                <stop offset="100%" stop-color="${fillColor || color}" stop-opacity="0.02"/>
            </linearGradient>
        </defs>
        <!-- Grid lines -->
        ${yTicks.map(v => `<line x1="${PAD.left}" y1="${yScale(v)}" x2="${PAD.left + chartW}" y2="${yScale(v)}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`).join('')}
        <!-- Area fill -->
        <path d="${areaD}" fill="url(#sparkGrad-${containerId})"/>
        <!-- Line -->
        <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <!-- Dots -->
        ${points.length <= 30 ? points.map((p, i) =>
            `<circle cx="${xScale(i)}" cy="${yScale(p[valueKey])}" r="3" fill="${color}" stroke="var(--bg-secondary)" stroke-width="1.5"/>`
        ).join('') : ''}
        <!-- Y ticks -->
        ${yTicksHtml}
        <!-- X labels -->
        ${xLabels}
    </svg>`;
}

// ─── Heatmap table ───────────────────────────────────────────────────────────
function anRenderHeatmap(containerId, data, classLevels) {
    const el = document.getElementById(containerId);
    if (!el) return;
    // Collect all subjects
    const subjectSet = new Set();
    classLevels.forEach(cls => (data[cls] || []).forEach(s => subjectSet.add(s.subject)));
    const subjects = [...subjectSet].sort();
    if (!subjects.length) { el.innerHTML = '<p style="color:var(--text-secondary); padding:20px;">No mark data available.</p>'; return; }

    const thead = `<thead><tr>
        <th style="position:sticky;left:0;background:#0f172a;z-index:2;min-width:130px;">Subject</th>
        ${classLevels.map(c => `<th style="text-align:center;">${c}</th>`).join('')}
    </tr></thead>`;

    const tbody = subjects.map(sub => {
        const cells = classLevels.map(cls => {
            const entry = (data[cls] || []).find(s => s.subject === sub);
            const val = entry ? entry.avg : null;
            const bg = anGradeColour(val);
            const txt = val !== null ? `${val}%` : '-';
            return `<td class="hm-cell" style="background:${bg}; color:${anGradeTextColour(val)};">${txt}</td>`;
        }).join('');
        return `<tr><td style="position:sticky;left:0;background:var(--bg-secondary);font-size:0.82rem;white-space:nowrap;">${sub}</td>${cells}</tr>`;
    }).join('');

    el.innerHTML = `<table style="border-collapse:collapse;width:100%;">${thead}<tbody>${tbody}</tbody></table>`;
}

// ─── Student rank table ──────────────────────────────────────────────────────
function anRenderRankTable(containerId, students, rankColor) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!students.length) { el.innerHTML = '<p style="color:var(--text-secondary); padding:16px;">No data.</p>'; return; }
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;">
        <thead><tr>
            <th style="background:#0f172a;width:30px;">#</th>
            <th style="background:#0f172a;">Name</th>
            <th style="background:#0f172a;">Class</th>
            <th style="background:#0f172a;text-align:center;">Avg %</th>
        </tr></thead>
        <tbody>${students.map((s, i) => `<tr>
            <td style="font-weight:700; color:${rankColor};">${i + 1}</td>
            <td><button type="button" class="btn-student-analytics" data-id="${s.id}" style="background:none;border:none;color:var(--accent-blue);font-weight:600;cursor:pointer;padding:0;text-align:left;font-family:inherit;font-size:0.88rem;text-decoration:underline;">${s.name}</button></td>
            <td style="color:var(--text-secondary);">${s.classLevel}</td>
            <td style="text-align:center; font-weight:700; color:${anGradeColour(s.avg)};">${s.avg}%</td>
        </tr>`).join('')}</tbody>
    </table>`;

    el.querySelectorAll('.btn-student-analytics').forEach(btn => {
        btn.addEventListener('click', () => {
            const sid = btn.getAttribute('data-id');
            openStudentAnalyticsModal(sid);
        });
    });
}

// ─── Individual Student Analytics Modal Logic ─────────────────────────────────
async function openStudentAnalyticsModal(studentId) {
    const modal = document.getElementById('modal-student-analytics');
    const content = document.getElementById('modal-student-analytics-content');
    if (!modal || !content) return;

    modal.style.display = 'flex';
    content.innerHTML = '<div style="text-align:center; padding:50px;"><p style="color:var(--text-secondary); font-size:1.1rem;">Loading student analytics...</p></div>';

    try {
        const res = await apiFetch(`/api/analytics/student/${studentId}`);
        if (!res.ok) throw new Error('Failed to fetch student analytics');
        const st = await res.json();
        renderStudentAnalyticsModalContent(st);
    } catch (e) {
        content.innerHTML = '<div style="text-align:center; padding:40px;"><p style="color:var(--accent-danger);">Failed to load student analytics data.</p></div>';
    }
}

function renderStudentAnalyticsModalContent(st) {
    const content = document.getElementById('modal-student-analytics-content');
    if (!content) return;

    const isForm3Or4 = st.classLevel === 'Form 3' || st.classLevel === 'Form 4';

    function pointBadge(p, label) {
        if (p === null) return `<span style="color:var(--text-secondary);">-</span>`;
        let color = '#ef4444';
        if (p <= 2) color = '#10b981';
        else if (p <= 6) color = '#3b82f6';
        else if (p <= 8) color = '#f59e0b';

        return `<span style="background:${color}; color:#fff; font-weight:700; padding:3px 9px; border-radius:4px; font-size:0.78rem; display:inline-block;">Pt ${p} (${label})</span>`;
    }

    const msceBadge = st.msceQualified
        ? `<span style="background:#10b981; color:#fff; padding:4px 10px; border-radius:20px; font-size:0.78rem; font-weight:700;">✅ MSCE Qualified</span>`
        : `<span style="background:#ef4444; color:#fff; padding:4px 10px; border-radius:20px; font-size:0.78rem; font-weight:700;">⚠️ MSCE At-Risk</span>`;

    const html = `
    <!-- Header -->
    <div style="border-bottom:1px solid var(--border-color); padding-bottom:16px; margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
            <div>
                <h2 style="margin:0 0 6px 0; font-size:1.35rem; color:var(--text-primary);">${st.name}</h2>
                <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; font-size:0.85rem; color:var(--text-secondary);">
                    <span>🏫 <strong>${st.classLevel}</strong> (${st.sectionName})</span>
                    <span>👤 ${st.gender}</span>
                    <span>📞 Parent: ${st.parentName} (${st.parentPhone})</span>
                    ${st.bursaryName ? `<span style="background:rgba(245,158,11,0.15); color:#f59e0b; padding:2px 8px; border-radius:4px; font-weight:600;">🎁 ${st.bursaryName}</span>` : ''}
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:1.2rem; font-weight:800; color:var(--accent-blue);">
                    Position ${st.position || '-'} <span style="font-size:0.85rem; font-weight:400; color:var(--text-secondary);">of ${st.totalClassStudents}</span>
                </div>
                ${isForm3Or4 ? `<div style="margin-top:6px;">${msceBadge}</div>` : ''}
            </div>
        </div>
    </div>

    <!-- Key Metrics Grid -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:20px;">
        <div style="background:rgba(255,255,255,0.03); border-left:4px solid #3b82f6; border-radius:8px; padding:12px;">
            <p style="font-size:0.72rem; color:var(--text-secondary); margin:0 0 4px; text-transform:uppercase;">Overall Average</p>
            <h3 style="margin:0; font-size:1.3rem; color:${anGradeColour(st.studentAvg)};">${st.studentAvg !== null ? `${st.studentAvg}%` : '-'}</h3>
        </div>
        ${isForm3Or4 ? `
        <div style="background:rgba(255,255,255,0.03); border-left:4px solid #8b5cf6; border-radius:8px; padding:12px;">
            <p style="font-size:0.72rem; color:var(--text-secondary); margin:0 0 4px; text-transform:uppercase;">MSCE Best 6 Points</p>
            <h3 style="margin:0; font-size:1.3rem; color:#8b5cf6;">${st.best6Points !== null ? `${st.best6Points} Points` : '-'}</h3>
            <span style="font-size:0.7rem; color:var(--text-secondary);">Lower is better (MANEB)</span>
        </div>` : `
        <div style="background:rgba(255,255,255,0.03); border-left:4px solid #8b5cf6; border-radius:8px; padding:12px;">
            <p style="font-size:0.72rem; color:var(--text-secondary); margin:0 0 4px; text-transform:uppercase;">Class Position</p>
            <h3 style="margin:0; font-size:1.3rem; color:#8b5cf6;">Top ${st.position ? Math.round((st.position / st.totalClassStudents) * 100) : '-'}%</h3>
            <span style="font-size:0.7rem; color:var(--text-secondary);">Rank ${st.position || '-'} of ${st.totalClassStudents}</span>
        </div>`}
        <div style="background:rgba(255,255,255,0.03); border-left:4px solid #10b981; border-radius:8px; padding:12px;">
            <p style="font-size:0.72rem; color:var(--text-secondary); margin:0 0 4px; text-transform:uppercase;">Attendance Rate</p>
            <h3 style="margin:0; font-size:1.3rem; color:#10b981;">${st.attendance.rate !== null ? `${st.attendance.rate}%` : 'No data'}</h3>
            <span style="font-size:0.7rem; color:var(--text-secondary);">${st.attendance.presentDays} present / ${st.attendance.totalDays} days</span>
        </div>
        <div style="background:rgba(255,255,255,0.03); border-left:4px solid ${st.fees.balance > 0 ? '#ef4444' : '#10b981'}; border-radius:8px; padding:12px;">
            <p style="font-size:0.72rem; color:var(--text-secondary); margin:0 0 4px; text-transform:uppercase;">Fee Balance</p>
            <h3 style="margin:0; font-size:1.3rem; color:${st.fees.balance > 0 ? '#ef4444' : '#10b981'};">MK ${Number(st.fees.balance).toLocaleString()}</h3>
            <span style="font-size:0.7rem; color:var(--text-secondary);">${st.fees.balance <= 0 ? 'Cleared' : 'Outstanding'}</span>
        </div>
    </div>

    <!-- MANEB Subject Matrix -->
    <div style="margin-bottom:20px;">
        <h4 style="margin:0 0 10px 0; font-size:0.95rem; display:flex; justify-content:space-between; align-items:center;">
            <span>🇲🇼 MANEB Subject Performance & Grade Points (1-9 Scale)</span>
            <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:400;">1=Distinction (80%+) | 9=Fail (<40%)</span>
        </h4>
        <div class="table-container" style="max-height:240px; overflow-y:auto;">
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr>
                        <th style="background:#0f172a;">Subject</th>
                        <th style="background:#0f172a; text-align:center;">CAT (30%)</th>
                        <th style="background:#0f172a; text-align:center;">Exam (70%)</th>
                        <th style="background:#0f172a; text-align:center;">Final %</th>
                        <th style="background:#0f172a; text-align:center;">MANEB Grade Point</th>
                    </tr>
                </thead>
                <tbody>
                    ${st.subjectDetails.map(sub => `
                    <tr>
                        <td><strong>${sub.subject}</strong></td>
                        <td style="text-align:center;">${sub.catMark !== null ? sub.catMark : '-'}</td>
                        <td style="text-align:center;">${sub.examMark !== null ? sub.examMark : '-'}</td>
                        <td style="text-align:center; font-weight:700; color:${anGradeColour(sub.finalMark)};">${sub.finalMark !== null ? `${sub.finalMark}%` : '-'}</td>
                        <td style="text-align:center;">${pointBadge(sub.manebPoint, sub.manebLabel)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <!-- Term History & Fee Payments Grid -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px; padding:14px;">
            <h4 style="margin:0 0 10px 0; font-size:0.9rem;">📈 Term-over-Term Progression</h4>
            ${st.termHistory.length ? `
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${st.termHistory.map(t => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); padding:8px 12px; border-radius:6px;">
                    <span style="font-size:0.82rem; font-weight:600;">${t.term}</span>
                    <span style="font-size:0.9rem; font-weight:700; color:${anGradeColour(t.avg)};">${t.avg !== null ? `${t.avg}%` : '-'}</span>
                </div>`).join('')}
            </div>` : '<p style="color:var(--text-secondary); font-size:0.8rem; margin:0;">No prior term history recorded.</p>'}
        </div>

        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px; padding:14px;">
            <h4 style="margin:0 0 10px 0; font-size:0.9rem;">💳 Fee Installment Log</h4>
            ${st.fees.paymentHistory.length ? `
            <div style="max-height:140px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                ${st.fees.paymentHistory.map(p => `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; background:rgba(255,255,255,0.04); padding:6px 10px; border-radius:4px;">
                    <div>
                        <span style="font-weight:600; color:var(--text-primary);">MK ${Number(p.amount).toLocaleString()}</span>
                        <span style="color:var(--text-secondary); font-size:0.75rem;"> (${p.method || 'Cash'})</span>
                    </div>
                    <span style="color:var(--text-secondary); font-size:0.72rem;">${new Date(p.date).toLocaleDateString()}</span>
                </div>`).join('')}
            </div>` : '<p style="color:var(--text-secondary); font-size:0.8rem; margin:0;">No payments recorded yet.</p>'}
        </div>
    </div>`;

    content.innerHTML = html;
}

(function setupStudentAnalyticsSearch() {
    const input = document.getElementById('analytics-student-search');
    const results = document.getElementById('analytics-student-results');
    if (!input || !results) return;

    input.addEventListener('input', async () => {
        const query = input.value.trim().toLowerCase();
        if (!query) {
            results.style.display = 'none';
            return;
        }

        try {
            if (!students || !students.length) {
                const res = await apiFetch('/api/students');
                if (res.ok) students = await res.json();
            }

            const matches = (students || []).filter(s => s.name.toLowerCase().includes(query)).slice(0, 8);
            if (!matches.length) {
                results.innerHTML = '<p style="padding:10px; color:var(--text-secondary); font-size:0.8rem; margin:0;">No matching students</p>';
            } else {
                results.innerHTML = matches.map(s => `
                <div class="dropdown-option" data-id="${s.id}" style="font-size:0.85rem; padding:8px 12px; cursor:pointer;">
                    <span><strong>${s.name}</strong> (${s.classLevel || 'Form 1'})</span>
                </div>`).join('');

                results.querySelectorAll('.dropdown-option').forEach(opt => {
                    opt.addEventListener('click', () => {
                        const sid = opt.getAttribute('data-id');
                        input.value = '';
                        results.style.display = 'none';
                        openStudentAnalyticsModal(sid);
                    });
                });
            }
            results.style.display = 'block';
        } catch(e) {}
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !results.contains(e.target)) {
            results.style.display = 'none';
        }
    });
})();


// ─── KPI card ────────────────────────────────────────────────────────────────
function anKpiCard(icon, label, value, sub, accentColor) {
    return `<div class="card" style="flex:1; min-width:160px; padding:16px; border-left:4px solid ${accentColor};">
        <p style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">${icon} ${label}</p>
        <h2 style="font-size:1.4rem; color:${accentColor}; margin:0 0 2px;">${value}</h2>
        <span style="font-size:0.75rem; color:var(--text-secondary);">${sub}</span>
    </div>`;
}

// ─── Main render function ────────────────────────────────────────────────────
let analyticsData = null;
let analyticsClassFilter = 'ALL';

async function renderAnalyticsTab() {
    const loading = document.getElementById('analytics-loading');
    const errEl   = document.getElementById('analytics-error');
    if (loading) loading.style.display = 'block';
    if (errEl)   errEl.style.display   = 'none';

    try {
        const res = await apiFetch('/api/analytics/summary');
        if (!res.ok) throw new Error('Failed');
        analyticsData = await res.json();
        renderAnalyticsDashboard(analyticsData);
    } catch (e) {
        if (errEl) errEl.style.display = 'block';
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function renderAnalyticsDashboard(d) {
    if (!d) return;
    const classLevels = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];
    const filterCls   = analyticsClassFilter;

    // Filter helper - class-specific or school-wide
    const filteredClassStats = filterCls === 'ALL'
        ? d.classStats
        : d.classStats.filter(c => c.class === filterCls);

    // ── KPI Row ───────────────────────────────────────────────────────────────
    const kpiRow = document.getElementById('analytics-kpi-row');
    if (kpiRow) {
        const totalStudents = filterCls === 'ALL'
            ? d.studentCount
            : (d.enrolmentByClass[filterCls] || 0);
        const avgMark = filteredClassStats.length
            ? (filteredClassStats.reduce((s, c) => s + (c.avg || 0), 0) / filteredClassStats.filter(c => c.avg !== null).length).toFixed(1)
            : '-';
        const avgPassRate = filteredClassStats.filter(c => c.passRate !== null).length
            ? Math.round(filteredClassStats.reduce((s, c) => s + (c.passRate || 0), 0) / filteredClassStats.filter(c => c.passRate !== null).length)
            : '-';
        const collRate = d.feeStats.collectionRate;
        const attRates = filterCls === 'ALL'
            ? Object.values(d.attendanceByClass).filter(v => v !== null)
            : [d.attendanceByClass[filterCls]].filter(v => v !== null);
        const avgAtt = attRates.length ? Math.round(attRates.reduce((a, b) => a + b, 0) / attRates.length) : '-';

        const markComp = d.markCompletionRate !== undefined ? d.markCompletionRate : 100;
        const missingCnt = d.missingMarksCount !== undefined ? d.missingMarksCount : 0;
        const compColor = markComp === 100 ? '#10b981' : '#f59e0b';

        kpiRow.innerHTML =
            anKpiCard('🎓', 'Total Students', totalStudents, filterCls === 'ALL' ? 'All classes' : filterCls, '#3b82f6') +
            anKpiCard('📈', 'School Average', avgMark !== '-' ? `${avgMark}%` : '-', 'Overall mark avg', '#8b5cf6') +
            anKpiCard('✅', 'Pass Rate', avgPassRate !== '-' ? `${avgPassRate}%` : '-', `Pass mark: ${d.passMark}%`, '#10b981') +
            anKpiCard('📝', 'Mark Completion', `${markComp}%`, missingCnt > 0 ? `${missingCnt} marks pending` : 'All marks entered', compColor) +
            anKpiCard('💰', 'Fee Collection', `${collRate}%`, `MK ${Number(d.feeStats.totalPaid).toLocaleString()} collected`, '#f59e0b') +
            anKpiCard('📅', 'Attendance Rate', avgAtt !== '-' ? `${avgAtt}%` : 'No data', 'Last recorded', '#06b6d4');
    }

    // ── Class avg bar chart ───────────────────────────────────────────────────
    const classItems = filteredClassStats.map(c => ({ label: c.class, value: c.avg }));
    anRenderBarChart('chart-class-avg', classItems, {
        colorFn: anGradeColour,
        maxVal: 100,
        unit: '%'
    });

    // ── Subject pass rate bar chart ───────────────────────────────────────────
    let subStats = d.subjectStats;
    if (filterCls !== 'ALL') {
        const byClass = (d.subjectByClass[filterCls] || []);
        subStats = byClass.map(s => ({
            subject: s.subject,
            avg: s.avg,
            passRate: s.avg >= d.passMark ? 100 : 0 // fallback if individual pass data unavailable
        }));
        // Prefer full passRate from d.subjectStats if available
        subStats = byClass.map(s => {
            const full = d.subjectStats.find(ss => ss.subject === s.subject);
            return { subject: s.subject, passRate: full ? full.passRate : null, avg: s.avg };
        });
    }
    const subjItems = subStats.map(s => ({ label: s.subject, value: s.passRate })).sort((a, b) => (b.value || 0) - (a.value || 0));
    const subjectContainer = document.getElementById('chart-subject-passrate');
    if (subjectContainer) {
        subjectContainer.style.height = `${Math.max(220, subjItems.length * 38)}px`;
    }
    anRenderBarChart('chart-subject-passrate', subjItems, {
        colorFn: v => v >= 75 ? '#10b981' : v >= 50 ? '#3b82f6' : '#ef4444',
        maxVal: 100,
        unit: '%'
    });

    // ── Fee collection panel ──────────────────────────────────────────────────
    const feeDonut = document.getElementById('chart-fee-donut');
    if (feeDonut) {
        const fs = d.feeStats;
        const pct = fs.collectionRate;
        const barColor = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
        feeDonut.innerHTML = `
        <div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="font-size:0.82rem; color:var(--text-secondary);">Collected</span>
                <span style="font-weight:700; color:${barColor};">${pct}%</span>
            </div>
            <div style="background:rgba(255,255,255,0.06); border-radius:8px; height:16px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:${barColor}; border-radius:8px; transition:width 0.6s;"></div>
            </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:6px;">
            ${[
                ['Expected', `MK ${Number(fs.totalFees).toLocaleString()}`, '#3b82f6'],
                ['Collected', `MK ${Number(fs.totalPaid).toLocaleString()}`, '#10b981'],
                ['Outstanding', `MK ${Number(fs.outstanding).toLocaleString()}`, '#ef4444'],
                ['Fully Paid', `${fs.fullyPaid} / ${fs.totalStudents}`, '#8b5cf6'],
                ['On Bursary', fs.bursaryCount, '#f59e0b'],
                ['', '', '']
            ].filter(r => r[0]).map(([lbl, val, col]) => `
                <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:10px;">
                    <p style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:3px;">${lbl}</p>
                    <p style="font-size:0.88rem; font-weight:700; color:${col};">${val}</p>
                </div>`).join('')}
        </div>
        ${Object.keys(fs.methodCounts).length ? `
        <div>
            <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:8px;">Payment Methods</p>
            ${Object.entries(fs.methodCounts).map(([m, v]) => `
            <div class="an-bar-track" style="margin-bottom:7px;">
                <span class="an-bar-label">${m}</span>
                <div class="an-bar-bg">
                    <div class="an-bar-fill" style="width:${Math.round((v / fs.totalPaid) * 100)}%; background:#6366f1;"></div>
                </div>
                <span class="an-bar-val" style="color:#818cf8;">MK ${Number(v).toLocaleString()}</span>
            </div>`).join('')}
        </div>` : ''}`;
    }

    // ── Monthly fee sparkline ─────────────────────────────────────────────────
    anRenderSparkline('chart-monthly-fees', d.monthlyFees, {
        color: '#f59e0b',
        fillColor: '#f59e0b',
        labelKey: 'month',
        valueKey: 'amount',
        unit: ''
    });

    // ── Attendance by class bar chart ─────────────────────────────────────────
    const attItems = (filterCls === 'ALL' ? classLevels : [filterCls]).map(cls => ({
        label: cls,
        value: d.attendanceByClass[cls]
    }));
    anRenderBarChart('chart-attendance-class', attItems, {
        colorFn: v => v === null ? 'rgba(255,255,255,0.1)' : v >= 85 ? '#10b981' : v >= 70 ? '#f59e0b' : '#ef4444',
        maxVal: 100,
        unit: '%'
    });

    // ── Daily attendance sparkline ────────────────────────────────────────────
    anRenderSparkline('chart-daily-att', d.dailyAttTrend, {
        color: '#06b6d4',
        fillColor: '#06b6d4',
        labelKey: 'date',
        valueKey: 'rate',
        unit: '%'
    });

    // ── Subject heatmap ───────────────────────────────────────────────────────
    const heatmapClasses = filterCls === 'ALL' ? classLevels : [filterCls];
    anRenderHeatmap('analytics-heatmap', d.subjectByClass, heatmapClasses);

    // ── Top 10 & Bottom 10 ────────────────────────────────────────────────────
    const top10 = filterCls === 'ALL'
        ? d.top10
        : d.top10.filter(s => s.classLevel === filterCls);
    const bottom10 = filterCls === 'ALL'
        ? d.bottom10
        : d.bottom10.filter(s => s.classLevel === filterCls);
    anRenderRankTable('analytics-top10', top10, '#10b981');
    anRenderRankTable('analytics-bottom10', bottom10, '#ef4444');
}

// ── Custom dropdown logic for analytics class filter ─────────────────────────
(function setupAnalyticsDropdown() {
    const toggle = document.getElementById('analytics-class-toggle');
    const menu   = document.getElementById('analytics-class-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
    });

    document.addEventListener('click', () => menu.classList.remove('open'));

    menu.querySelectorAll('.dropdown-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.querySelectorAll('.dropdown-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            const val = opt.getAttribute('data-val');
            document.getElementById('analytics-class-val').value = val;
            document.getElementById('analytics-class-text').textContent = opt.textContent.trim();
            analyticsClassFilter = val;
            menu.classList.remove('open');
            if (analyticsData) renderAnalyticsDashboard(analyticsData);
        });
    });
})();

document.getElementById('btn-refresh-analytics')?.addEventListener('click', () => {
    analyticsData = null;
    renderAnalyticsTab();
});

// ── 3.5. Lists & Reports (Explorer Tab) ──────────────────────────────────
async function renderExplorerTab() {
    await fetchStudents();

    // Populate target subject select dropdown if empty or needs updating
    const subjSelect = document.getElementById('exp-subject-select');
    if (subjSelect) {
        const curVal = subjSelect.value;
        if (subjSelect.options.length === 0 && subjectsList && subjectsList.length > 0) {
            subjSelect.innerHTML = subjectsList.map(s => `<option value="${s}">${s}</option>`).join('');
            if (curVal && subjectsList.includes(curVal)) subjSelect.value = curVal;
        }
    }

    applyAndRenderExplorer();
}

function applyAndRenderExplorer() {
    if (!students || !students.length) return;

    const classFilter = document.getElementById('exp-class-filter')?.value || 'CURRENT';
    const sortField = document.getElementById('exp-sort-field')?.value || 'name_asc';
    const targetSubject = document.getElementById('exp-subject-select')?.value || (subjectsList[0] || 'Mathematics');
    const scoreCutoff = document.getElementById('exp-score-cutoff')?.value || 'ALL';
    const genderFilter = document.getElementById('exp-gender-filter')?.value || 'ALL';
    const feeFilter = document.getElementById('exp-fee-filter')?.value || 'ALL';
    const subjectEnrolled = document.getElementById('exp-subject-enrolled')?.value || 'ALL';
    const searchTerm = (document.getElementById('exp-search-input')?.value || '').toLowerCase().trim();

    // 1. Filter students
    let filtered = students.filter(s => {
        // Class Level filter
        if (classFilter === 'CURRENT') {
            if ((s.classLevel || 'Form 1') !== currentClass) return false;
        } else if (classFilter !== 'ALL') {
            if (s.classLevel !== classFilter) return false;
        }

        // Gender filter
        if (genderFilter !== 'ALL') {
            const g = (s.gender || 'Male').toLowerCase();
            if (g !== genderFilter.toLowerCase()) return false;
        }

        // Fee / Bursary status filter
        if (feeFilter === 'PAID') {
            if (s.bursaryName || (s.paidAmount || 0) < (s.totalFees || 0)) return false;
        } else if (feeFilter === 'OWING') {
            if (s.bursaryName || (s.paidAmount || 0) >= (s.totalFees || 0)) return false;
        } else if (feeFilter === 'BURSARY') {
            if (!s.bursaryName) return false;
        }

        // Subject Enrollment filter
        const isTaking = s.subjects && s.subjects[targetSubject] === true;
        if (subjectEnrolled === 'TAKING' && !isTaking) return false;
        if (subjectEnrolled === 'NOT_TAKING' && isTaking) return false;

        // Subject Mark Cutoff filter
        const mark = (s.marks && s.marks[targetSubject] !== undefined && s.marks[targetSubject] !== null && s.marks[targetSubject] !== '')
            ? Number(s.marks[targetSubject])
            : null;
        if (scoreCutoff === 'FAIL') {
            if (mark === null || mark >= 40) return false;
        } else if (scoreCutoff === 'PASS') {
            if (mark === null || mark < 40 || mark >= 80) return false;
        } else if (scoreCutoff === 'DISTINCTION') {
            if (mark === null || mark < 80) return false;
        }

        // Instant text search
        if (searchTerm) {
            const nameMatch = (s.name || '').toLowerCase().includes(searchTerm);
            const phoneMatch = (s.phone || '').toLowerCase().includes(searchTerm);
            const parentMatch = (s.parentPhone || '').toLowerCase().includes(searchTerm);
            if (!nameMatch && !phoneMatch && !parentMatch) return false;
        }

        return true;
    });

    // 2. Sort students
    filtered.sort((a, b) => {
        if (sortField === 'name_asc') {
            return (a.name || '').localeCompare(b.name || '');
        } else if (sortField === 'name_desc') {
            return (b.name || '').localeCompare(a.name || '');
        } else if (sortField === 'rank_asc') {
            return (a.rank || 999) - (b.rank || 999);
        } else if (sortField === 'rank_desc') {
            return (b.rank || 999) - (a.rank || 999);
        } else if (sortField === 'subject_high') {
            const mA = (a.marks && a.marks[targetSubject] !== undefined && a.marks[targetSubject] !== null) ? Number(a.marks[targetSubject]) : -1;
            const mB = (b.marks && b.marks[targetSubject] !== undefined && b.marks[targetSubject] !== null) ? Number(b.marks[targetSubject]) : -1;
            return mB - mA;
        } else if (sortField === 'subject_low') {
            const mA = (a.marks && a.marks[targetSubject] !== undefined && a.marks[targetSubject] !== null) ? Number(a.marks[targetSubject]) : 999;
            const mB = (b.marks && b.marks[targetSubject] !== undefined && b.marks[targetSubject] !== null) ? Number(b.marks[targetSubject]) : 999;
            return mA - mB;
        }
        return 0;
    });

    // 3. Render table & badge
    const badge = document.getElementById('explorer-counter-badge');
    if (badge) badge.textContent = `${filtered.length} Student${filtered.length === 1 ? '' : 's'}`;

    const thScore = document.getElementById('explorer-th-score');
    if (thScore) thScore.textContent = `${targetSubject} Score ↕`;

    const tbody = document.querySelector('#explorer-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-secondary);">No students match the active filter criteria.</td></tr>`;
        return;
    }

    filtered.forEach(student => {
        const isJunior = (student.classLevel === 'Form 1' || student.classLevel === 'Form 2');
        const scoreDisplay = isJunior
            ? (student.average !== undefined && student.average !== null ? `${student.average}%` : '-')
            : (student.mscePoints !== undefined && student.mscePoints !== null ? `${student.mscePoints} pts` : '-');

        const mark = (student.marks && student.marks[targetSubject] !== undefined && student.marks[targetSubject] !== null && student.marks[targetSubject] !== '')
            ? Number(student.marks[targetSubject])
            : null;
        
        let markBadge = '-';
        if (mark !== null) {
            const color = mark >= 80 ? '#10b981' : mark >= 40 ? '#3b82f6' : '#ef4444';
            markBadge = `<span style="font-weight:600; color:${color};">${mark}%</span>`;
        }

        const subjectsCount = student.subjects ? Object.keys(student.subjects).filter(k => student.subjects[k]).length : 0;
        const isTargetEnrolled = student.subjects && student.subjects[targetSubject] === true;

        let feeBadge = '';
        if (student.bursaryName) {
            feeBadge = `<span style="background:rgba(139,92,246,0.15); border:1px solid #8b5cf6; color:#8b5cf6; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">Bursary (${student.bursaryName})</span>`;
        } else if ((student.paidAmount || 0) >= (student.totalFees || 0)) {
            feeBadge = `<span style="background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#10b981; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">Fully Paid</span>`;
        } else {
            const balance = (student.totalFees || 0) - (student.paidAmount || 0);
            feeBadge = `<span style="background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#ef4444; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">Owes MWK ${balance.toLocaleString()}</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>#${student.rank || '-'}</strong></td>
            <td><strong>${student.name}</strong></td>
            <td>${student.gender || 'Male'}</td>
            <td>${student.classLevel || 'Form 1'}</td>
            <td>${subjectsCount} Subjects ${isTargetEnrolled ? `(<span style="color:#10b981;">✓ Enrolled</span>)` : ''}</td>
            <td>${markBadge}</td>
            <td><strong>${scoreDisplay}</strong></td>
            <td>${feeBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Bind Explorer Control Listeners
['exp-class-filter', 'exp-sort-field', 'exp-subject-select', 'exp-score-cutoff', 'exp-gender-filter', 'exp-fee-filter', 'exp-subject-enrolled'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyAndRenderExplorer);
});
document.getElementById('exp-search-input')?.addEventListener('input', applyAndRenderExplorer);

// Clickable Table Headers Sort
document.querySelectorAll('#explorer-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const sortType = th.getAttribute('data-sort');
        const sortSelect = document.getElementById('exp-sort-field');
        if (!sortSelect) return;
        if (sortType === 'name') {
            sortSelect.value = sortSelect.value === 'name_asc' ? 'name_desc' : 'name_asc';
        } else if (sortType === 'rank') {
            sortSelect.value = sortSelect.value === 'rank_asc' ? 'rank_desc' : 'rank_asc';
        } else if (sortType === 'subject_score') {
            sortSelect.value = sortSelect.value === 'subject_high' ? 'subject_low' : 'subject_high';
        }
        applyAndRenderExplorer();
    });
});

// CSV Export for Explorer Tab
document.getElementById('btn-export-explorer-csv')?.addEventListener('click', () => {
    const targetSubject = document.getElementById('exp-subject-select')?.value || 'Mathematics';
    const rows = [
        ['Rank', 'Student Name', 'Gender', 'Class Level', 'Target Subject', 'Subject Mark (%)', 'Overall Average/Points', 'Fee Status', 'Phone']
    ];

    document.querySelectorAll('#explorer-table tbody tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 8) {
            const rank = tds[0].textContent.replace('#', '').trim();
            const name = tds[1].textContent.trim();
            const gender = tds[2].textContent.trim();
            const cls = tds[3].textContent.trim();
            const mark = tds[5].textContent.trim();
            const overall = tds[6].textContent.trim();
            const feeStatus = tds[7].textContent.trim();
            const studentObj = students.find(s => s.name === name);
            const phone = studentObj ? (studentObj.phone || '') : '';
            rows.push([rank, name, gender, cls, targetSubject, mark, overall, feeStatus, phone]);
        }
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Custom_Student_List_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// PDF & Print View for Explorer Tab
document.getElementById('btn-export-explorer-pdf')?.addEventListener('click', () => window.print());
document.getElementById('btn-print-explorer')?.addEventListener('click', () => window.print());

// Initial load
checkLogin();

