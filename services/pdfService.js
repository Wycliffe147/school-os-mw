const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

function getGrade(scoreStr, db, classLevel) {
    const isJunior = classLevel === 'Form 1' || classLevel === 'Form 2';
    
    if (scoreStr === '' || scoreStr === null || scoreStr === undefined) {
        return isJunior ? { gradeLetter: '-', remark: 'No Grade', points: '-' } : { points: 9, remark: 'No Grade', gradeLetter: '-' };
    }
    
    const score = Number(scoreStr);
    
    if (isJunior) {
        const rules = [...(db.settings.gradingSystemJunior || [])].sort((a, b) => b.min - a.min);
        for (const rule of rules) {
            if (score >= rule.min) return { gradeLetter: rule.gradeLetter, remark: rule.remark, points: '-' };
        }
        return { gradeLetter: 'F', remark: "Fail", points: '-' };
    } else {
        const rules = [...(db.settings.gradingSystem || [])].sort((a, b) => b.min - a.min);
        for (const rule of rules) {
            if (score >= rule.min) return { points: rule.points, remark: rule.remark, gradeLetter: '-' };
        }
        return { points: 9, remark: "Fail", gradeLetter: '-' };
    }
}

function rankStudents(db) {
    const forms = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];
    
    forms.forEach(form => {
        const classStudents = db.students.filter(s => (s.classLevel || 'Form 1') === form);
        
        classStudents.forEach(student => {
            student.mscePoints = 0;
            student.subjectsCount = 0;
            let pointsList = [];
            
            db.subjects.forEach(sub => {
                if (student.subjects && student.subjects[sub]) {
                    student.subjectsCount++;
                    const score = student.marks && student.marks[sub];
                    if (score !== null && score !== undefined && score !== '') {
                        const gradeInfo = getGrade(score, db, student.classLevel || 'Form 1');
                        if (!['Form 1', 'Form 2'].includes(student.classLevel || 'Form 1')) {
                            if (gradeInfo.points !== '-') {
                                pointsList.push(Number(gradeInfo.points));
                            }
                        } else {
                            pointsList.push(100 - Number(score));
                        }
                    }
                }
            });
            
            pointsList.sort((a, b) => a - b);
            const best6 = pointsList.slice(0, 6);
            student.mscePoints = best6.reduce((acc, val) => acc + val, 0);
            
            if (['Form 1', 'Form 2'].includes(student.classLevel || 'Form 1')) {
                student.juniorTotalScore = pointsList.reduce((acc, val) => acc + (100 - val), 0); 
            }
        });
        
        classStudents.sort((a, b) => {
            const isJunior = ['Form 1', 'Form 2'].includes(a.classLevel || 'Form 1');
            if (isJunior) {
                return (b.juniorTotalScore || 0) - (a.juniorTotalScore || 0);
            } else {
                return a.mscePoints - b.mscePoints;
            }
        });
        
        classStudents.forEach((student, index) => {
            student.rank = index + 1;
        });
    });
}

async function generatePDF(student, db) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 } : { r: 0.08, g: 0.18, b: 0.36 };
    };
    const theme = hexToRgb(db.settings.themeColor);

    page.drawRectangle({
        x: 0,
        y: height - 100,
        width: width,
        height: 100,
        color: rgb(theme.r, theme.g, theme.b),
    });

    if (db.settings.logoPath && fs.existsSync(db.settings.logoPath)) {
        try {
            const logoBytes = fs.readFileSync(db.settings.logoPath);
            let logoImage;
            
            const isPng = logoBytes[0] === 0x89 && logoBytes[1] === 0x50 && logoBytes[2] === 0x4E && logoBytes[3] === 0x47;
            
            if (isPng) {
                logoImage = await pdfDoc.embedPng(logoBytes);
            } else {
                logoImage = await pdfDoc.embedJpg(logoBytes);
            }
            
            const targetHeight = 60;
            const scaleFactor = targetHeight / logoImage.height;
            page.drawImage(logoImage, {
                x: width - 40 - (logoImage.width * scaleFactor),
                y: height - 80,
                width: logoImage.width * scaleFactor,
                height: targetHeight,
            });
        } catch (e) {
            console.error("Failed to embed logo:", e);
        }
    }

    page.drawText(db.settings.schoolName, {
        x: 40,
        y: height - 50,
        size: 24,
        font: fontBold,
        color: rgb(1, 1, 1),
    });

    page.drawText(db.settings.subtitle, {
        x: 40,
        y: height - 75,
        size: 12,
        font: fontRegular,
        color: rgb(0.8, 0.85, 0.95),
    });

    const isJunior = ['Form 1', 'Form 2'].includes(student.classLevel || 'Form 1');
    const classTotal = db.students.filter(s => (s.classLevel || 'Form 1') === (student.classLevel || 'Form 1')).length;

    page.drawText(`${db.settings.headerContactLabel || 'Contact'}: ${db.settings.headerContactNumber || ''}`, { x: 40, y: height - 120, size: 10, font: fontRegular });
    page.drawText(`Student Name: ${student.name}`, { x: 40, y: height - 140, size: 12, font: fontBold });
    page.drawText(`Class: ${student.classLevel || 'Form 1'}`, { x: 40, y: height - 160, size: 10, font: fontBold });
    page.drawText(`Term: ${db.settings.currentTerm}`, { x: 40, y: height - 180, size: 10, font: fontBold });
    
    const totalText = isJunior ? `Total Score: ${student.juniorTotalScore}` : `Total Points: ${student.mscePoints} (Best 6 Subjects)`;
    page.drawText(`Position: ${student.rank} of ${classTotal}`, { x: 380, y: height - 140, size: 12, font: fontBold });
    page.drawText(totalText, { x: 380, y: height - 160, size: 10, font: fontRegular });

    const columns = [
        { title: 'Subject', x: 40 },
        { title: 'Score (%)', x: 170 },
        { title: isJunior ? 'Grade' : 'Points', x: 250 },
        { title: 'Remark', x: 330 },
        { title: 'Teacher', x: 440 }
    ];
    const tableTop = height - 220;
    page.drawLine({ start: { x: 40, y: tableTop }, end: { x: 550, y: tableTop }, thickness: 1.5, color: rgb(0.1, 0.1, 0.1) });
    
    columns.forEach(col => {
        page.drawText(col.title, { x: col.x, y: tableTop - 20, size: 10, font: fontBold });
    });
    
    page.drawLine({ start: { x: 40, y: tableTop - 30 }, end: { x: 550, y: tableTop - 30 }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });

    let currentY = tableTop - 50;
    const graphData = [];
    
    db.subjects.forEach(sub => {
        if (student.subjects && student.subjects[sub]) {
            const score = student.marks ? student.marks[sub] : null;
            const hasScore = score !== null && score !== undefined && score !== '';
            
            if (hasScore) {
                graphData.push({ subject: sub, score: Number(score) });
            }
            
            const gradeInfo = hasScore ? getGrade(score, db, student.classLevel || 'Form 1') : { points: '-', remark: 'Absent/No Score', gradeLetter: '-' };

            const teacherSubKey = `${student.classLevel || 'Form 1'}:${sub}`;
            const teachersForSub = (db.users || [])
                .filter(u => u.role === 'teacher' && (u.subjects || []).includes(teacherSubKey))
                .map(u => u.name).join(', ');
            const teacherName = teachersForSub || '-';

            page.drawText(sub, { x: columns[0].x, y: currentY, size: 10, font: fontRegular });
            page.drawText(hasScore ? `${score}%` : '-', { x: columns[1].x, y: currentY, size: 10, font: fontRegular });
            page.drawText(isJunior ? gradeInfo.gradeLetter : String(gradeInfo.points), { x: columns[2].x, y: currentY, size: 10, font: fontRegular });
            page.drawText(gradeInfo.remark, { x: columns[3].x, y: currentY, size: 10, font: fontRegular });
            page.drawText(teacherName, { x: columns[4].x, y: currentY, size: 9, font: fontRegular });

            page.drawLine({ start: { x: 40, y: currentY - 8 }, end: { x: 550, y: currentY - 8 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
            currentY -= 25;
        }
    });

    let passedSubjectsCount = 0;
    let englishPassed = false;
    db.subjects.forEach(sub => {
        if (student.subjects && student.subjects[sub]) {
            const score = student.marks ? student.marks[sub] : null;
            if (score !== null && score !== undefined && score !== '') {
                const gradeInfo = getGrade(score, db, student.classLevel || 'Form 1');
                if (gradeInfo.points !== '-' && Number(gradeInfo.points) < 9) {
                    passedSubjectsCount++;
                    if (sub === 'ENG' || sub === 'English') englishPassed = true;
                }
            }
        }
    });
    
    const hasPassed = englishPassed && passedSubjectsCount >= 6;
    const finalRemarks = hasPassed ? db.settings.headteacherRemarksPass : db.settings.headteacherRemarksFail;

    if (graphData.length > 0) {
        currentY -= 30;
        const chartHeight = 80;
        const chartWidth = 450;
        const chartY = currentY - chartHeight;
        
        page.drawLine({ start: { x: 50, y: chartY }, end: { x: 520, y: chartY }, thickness: 1, color: rgb(0,0,0) });
        page.drawLine({ start: { x: 50, y: chartY }, end: { x: 50, y: chartY + chartHeight }, thickness: 1, color: rgb(0,0,0) });
        
        page.drawText('100', { x: 30, y: chartY + chartHeight - 3, size: 8, font: fontRegular });
        page.drawText('50', { x: 35, y: chartY + (chartHeight/2) - 3, size: 8, font: fontRegular });
        page.drawText('0', { x: 40, y: chartY - 3, size: 8, font: fontRegular });

        page.drawLine({ start: { x: 50, y: chartY + (chartHeight/2) }, end: { x: 520, y: chartY + (chartHeight/2) }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
        page.drawLine({ start: { x: 50, y: chartY + chartHeight }, end: { x: 520, y: chartY + chartHeight }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });

        const spacing = chartWidth / graphData.length;
        const barWidth = Math.min(30, spacing - 10);

        graphData.forEach((data, index) => {
            const barHeight = (data.score / 100) * chartHeight;
            const x = 50 + (index * spacing) + (spacing / 2) - (barWidth / 2);
            
            page.drawRectangle({
                x: x,
                y: chartY + 1,
                width: barWidth,
                height: barHeight,
                color: rgb(0.1, 0.3, 0.6)
            });
            
            const shortSub = data.subject.substring(0, 5).toUpperCase();
            page.drawText(shortSub, { x: x + (barWidth/2) - (shortSub.length * 2.5), y: chartY - 12, size: 8, font: fontRegular });
            page.drawText(String(data.score), { x: x + (barWidth/2) - 5, y: chartY + barHeight + 3, size: 8, font: fontRegular });
        });

        currentY = chartY - 30;
    }

    // Calculate Student Attendance Summary
    let attPresent = 0, attTotal = 0;
    if (db.attendance && Array.isArray(db.attendance)) {
        db.attendance.forEach(entry => {
            if (entry.records && entry.records[student.id]) {
                attTotal++;
                if (entry.records[student.id] === 'present' || entry.records[student.id] === 'late') {
                    attPresent++;
                }
            }
        });
    }

    currentY -= 10;
    page.drawText(`Headteacher's Remarks: ${finalRemarks}`, { x: 40, y: currentY, size: 10, font: fontRegular });
    if (attTotal > 0) {
        currentY -= 15;
        page.drawText(`Attendance Record: ${attPresent} Days Present / ${attTotal} Total Days Recorded`, { x: 40, y: currentY, size: 10, font: fontRegular });
    }
    if (student.bursaryName && student.bursaryName.trim() !== '') {
        currentY -= 15;
        page.drawText(`Bursary Name: ${student.bursaryName}`, { x: 40, y: currentY, size: 10, font: fontRegular });
    }
    currentY -= 15;
    page.drawText(`Next Term Fees: ${db.settings.nextTermFees}`, { x: 40, y: currentY, size: 10, font: fontRegular });
    currentY -= 15;
    page.drawText(`Next Term Opens On: ${db.settings.nextTermDate}`, { x: 40, y: currentY, size: 10, font: fontRegular });

    currentY -= 20;
    page.drawText(`Generated on: ${new Date().toLocaleDateString()}`, { x: 380, y: currentY, size: 9, font: fontRegular });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

module.exports = {
    getGrade,
    rankStudents,
    generatePDF
};
