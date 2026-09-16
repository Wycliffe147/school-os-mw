const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');

const { readDb, getMongoDb } = require('../db');
const { generatePDF, rankStudents } = require('../services/pdfService');
const { authenticateToken, blockClassTeacher } = require('../middleware/auth');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

const waSocks = {};
const waQrImages = {};
const waStatuses = {};

async function useMongoDBAuthState(collection) {
    const writeData = async (data, id) => {
        await collection.replaceOne(
            { _id: id },
            { _id: id, data: JSON.parse(JSON.stringify(data, BufferJSON.replacer)) },
            { upsert: true }
        );
    };

    const readData = async (id) => {
        try {
            const doc = await collection.findOne({ _id: id });
            if (doc && doc.data) {
                return JSON.parse(JSON.stringify(doc.data), BufferJSON.reviver);
            }
        } catch (error) {
            console.error(error);
        }
        return null;
    };

    const removeData = async (id) => {
        await collection.deleteOne({ _id: id });
    };

    const creds = await readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? writeData(value, key) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => {
            return writeData(creds, 'creds');
        }
    };
}

async function clearWhatsAppAuth(schoolId) {
    const mongoDb = getMongoDb();
    if (mongoDb) {
        try {
            await mongoDb.collection(`whatsapp_auth_${schoolId}`).drop();
        } catch (_) {}
    } else {
        const dir = path.join(__dirname, '..', `auth_info_baileys_${schoolId}`);
        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch (_) {}
        }
    }
}

async function connectToWhatsApp(schoolId = 'default') {
    if (waSocks[schoolId]) {
        try { waSocks[schoolId].end(undefined); } catch(_) {}
        delete waSocks[schoolId];
    }

    let state, saveCreds;
    const mongoDb = getMongoDb();
    if (mongoDb) {
        const collection = mongoDb.collection(`whatsapp_auth_${schoolId}`);
        ({ state, saveCreds } = await useMongoDBAuthState(collection));
    } else {
        const authDir = path.join(__dirname, '..', `auth_info_baileys_${schoolId}`);
        ({ state, saveCreds } = await useMultiFileAuthState(authDir));
    }

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 25000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        retryRequestOptions: {
            delayMs: 250,
            maxRetries: 5
        },
        logger: pino({ level: 'silent' })
    });

    waSocks[schoolId] = sock;
    waStatuses[schoolId] = 'Connecting...';
    waQrImages[schoolId] = null;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        console.log(`[WhatsApp:${schoolId}] CONNECTION UPDATE:`, JSON.stringify({ connection, hasQr: !!qr }));

        if (qr) {
            waStatuses[schoolId] = 'Scan QR Code';
            try {
                waQrImages[schoolId] = await QRCode.toDataURL(qr);
            } catch (e) {
                console.error(`[WhatsApp:${schoolId}] Failed to generate QR:`, e);
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;
            waStatuses[schoolId] = 'Disconnected';
            waQrImages[schoolId] = null;
            delete waSocks[schoolId];
            if (shouldReconnect) {
                console.log(`[WhatsApp:${schoolId}] Disconnected (status ${statusCode}). Auto-reconnecting in 3s...`);
                setTimeout(() => {
                    connectToWhatsApp(schoolId).catch(err => console.error(`[WhatsApp:${schoolId}] Reconnect failed:`, err));
                }, 3000);
            } else {
                console.log(`[WhatsApp:${schoolId}] Explicitly logged out. Clearing credentials.`);
                await clearWhatsAppAuth(schoolId);
            }
        } else if (connection === 'open') {
            waStatuses[schoolId] = 'Connected';
            waQrImages[schoolId] = null;
            console.log(`✅ [WhatsApp:${schoolId}] Connected successfully!`);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // 🤖 WhatsApp Parent Self-Service Bot Listener
    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (m.type !== 'notify') return;
            for (const msg of m.messages) {
                if (!msg.message || msg.key.fromMe) continue;

                const remoteJid = msg.key.remoteJid;
                if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net') && !remoteJid.endsWith('@c.us')) continue;

                const rawSenderNum = remoteJid.replace(/\D/g, '');
                const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
                if (!text) continue;

                const command = text.toUpperCase();
                const db = readDb(schoolId);
                const schoolName = db.settings.schoolName || 'School';

                // Find student by matching parent phone number
                const student = db.students.find(s => {
                    if (!s.phone) return false;
                    const cleanStudentPhone = s.phone.replace(/\D/g, '');
                    return rawSenderNum.endsWith(cleanStudentPhone) || cleanStudentPhone.endsWith(rawSenderNum);
                });

                if (!student) {
                    // Unknown number message
                    await sock.sendMessage(remoteJid, {
                        text: `Hello! 👋 Welcome to *${schoolName}* Automated Parent Service.\n\nYour phone number (${rawSenderNum}) is not currently registered to a student in our database. Please contact the school office to register your phone number.`
                    });
                    continue;
                }

                rankStudents(db);

                if (command.includes('FEE') || command.includes('BAL') || command === '1') {
                    // 1. Fee Balance Statement
                    const tf = student.totalFees || 0;
                    const pa = student.paidAmount || 0;
                    const bal = tf - pa;
                    const feeStatus = bal <= 0 ? '🟢 Cleared' : `🔴 Outstanding MK ${bal.toLocaleString()}`;

                    let reply = `💵 *Fee Balance Statement for ${student.name}*\n\n`;
                    reply += `• Class: ${student.classLevel || 'Form 1'}\n`;
                    reply += `• Term Fee: MK ${tf.toLocaleString()}\n`;
                    reply += `• Total Paid: MK ${pa.toLocaleString()}\n`;
                    reply += `• Status: ${feeStatus}\n\n`;
                    
                    if (bal > 0) {
                        reply += `Please send payment to the school bursar or mobile money account.\n\n`;
                    }
                    reply += `Reply *REPORT* for report card or *ATTEND* for attendance record.`;

                    await sock.sendMessage(remoteJid, { text: reply });

                } else if (command.includes('REPORT') || command.includes('CARD') || command.includes('RESULT') || command === '2') {
                    // 2. Report Card PDF Dispatch
                    const tf = student.totalFees || 0;
                    const pa = student.paidAmount || 0;
                    const bal = tf - pa;

                    if (bal > 0 && !student.feeLockOverride) {
                        await sock.sendMessage(remoteJid, {
                            text: `🔒 *Report Card Locked*\n\nDear Parent/Guardian,\nThe report card for *${student.name}* is currently locked due to an outstanding fee balance of *MK ${bal.toLocaleString()}*.\n\nPlease clear the balance or contact the administration.`
                        });
                    } else {
                        await sock.sendMessage(remoteJid, { text: `📄 Generating report card for *${student.name}*... Please wait.` });

                        const pdfBytes = await generatePDF(student, db);
                        const fileName = `${student.name.replace(/\s+/g, '_')}_Report.pdf`;
                        const pdfPath = path.join(REPORTS_DIR, fileName);
                        fs.writeFileSync(pdfPath, pdfBytes);

                        await sock.sendMessage(remoteJid, {
                            document: fs.readFileSync(pdfPath),
                            fileName: fileName,
                            mimetype: 'application/pdf',
                            caption: `Here is the official progress report card for ${student.name}.`
                        });
                    }

                } else if (command.includes('ATTEND') || command === '3') {
                    // 3. Attendance Summary
                    let present = 0, totalDays = 0;
                    if (db.attendance && Array.isArray(db.attendance)) {
                        db.attendance.forEach(entry => {
                            if (entry.records && entry.records[student.id]) {
                                totalDays++;
                                if (entry.records[student.id] === 'present' || entry.records[student.id] === 'late') {
                                    present++;
                                }
                            }
                        });
                    }

                    let reply = `📅 *Attendance Summary for ${student.name}*\n\n`;
                    reply += `• Class: ${student.classLevel || 'Form 1'}\n`;
                    reply += `• Days Present: ${present}\n`;
                    reply += `• Total Days Recorded: ${totalDays}\n\n`;
                    reply += `Reply *REPORT* for report card or *FEES* for fee balance.`;

                    await sock.sendMessage(remoteJid, { text: reply });

                } else {
                    // Default Menu / Help
                    let reply = `🤖 *${schoolName} Parent Self-Service Bot*\n\n`;
                    reply += `Hello! Welcome. You are connected for student *${student.name}* (${student.classLevel || 'Form 1'}).\n\n`;
                    reply += `Reply with any keyword below:\n\n`;
                    reply += `1️⃣ *FEES* — View fee balance & receipt history\n`;
                    reply += `2️⃣ *REPORT* — Download PDF report card\n`;
                    reply += `3️⃣ *ATTEND* — View attendance summary\n`;
                    reply += `4️⃣ *MENU* — Display this menu`;

                    await sock.sendMessage(remoteJid, { text: reply });
                }
            }
        } catch (botErr) {
            console.error(`[WhatsApp:${schoolId} Bot Error]:`, botErr);
        }
    });
}

router.use(authenticateToken);

router.get('/whatsapp/status', (req, res) => {
    const schoolId = req.user ? req.user.schoolId : 'default';
    if (!waSocks[schoolId] && waStatuses[schoolId] !== 'Connecting') {
        waStatuses[schoolId] = 'Connecting';
        connectToWhatsApp(schoolId);
    }
    res.json({
        status: waStatuses[schoolId] || 'Disconnected',
        qr: waQrImages[schoolId] || null
    });
});

router.post('/whatsapp/logout', async (req, res) => {
    const schoolId = req.user ? req.user.schoolId : 'default';
    waStatuses[schoolId] = 'Disconnected';
    waQrImages[schoolId] = null;
    if (waSocks[schoolId]) {
        try {
            await waSocks[schoolId].logout();
        } catch (e) {
            try { waSocks[schoolId].end(undefined); } catch (_) {}
        }
        delete waSocks[schoolId];
    }
    await clearWhatsAppAuth(schoolId);
    res.json({ success: true });
});

router.post('/whatsapp/send', blockClassTeacher, async (req, res) => {
    const schoolId = req.user ? req.user.schoolId : 'default';
    const sock = waSocks[schoolId];
    const { studentId } = req.body;
    const db = readDb(req.user ? req.user.schoolId : 'default');
    rankStudents(db);
    const ranked = db.students;
    const student = ranked.find(s => s.id === studentId);

    if (!student) {
        return res.status(404).json({ error: "Student not found" });
    }

    if (waStatuses[schoolId] !== 'Connected') {
        return res.status(400).json({ error: "WhatsApp is not connected. Scan the QR code first." });
    }

    if (!student.phone) {
        return res.status(400).json({ error: "No phone number saved for this student." });
    }

    // Fee Lock Gate Check
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
        const fileName = `${student.name.replace(/\s+/g, '_')}.pdf`;
        const pdfPath = path.join(REPORTS_DIR, fileName);
        fs.writeFileSync(pdfPath, pdfBytes);

        let cleanNumber = student.phone.replace(/\D/g, '');
        if (cleanNumber.length === 9) {
            cleanNumber = "265" + cleanNumber;
        }
        const jid = `${cleanNumber}@c.us`;

        await sock.sendMessage(jid, {
            document: fs.readFileSync(pdfPath),
            fileName: fileName,
            mimetype: 'application/pdf',
            caption: `Here is the progress report card for ${student.name}.`
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Send Automated WhatsApp Absence Alerts for students marked absent on a specific date
router.post('/whatsapp/send-absent-alerts', async (req, res) => {
    const schoolId = req.user ? req.user.schoolId : 'default';
    const sock = waSocks[schoolId];
    const { date, classLevel } = req.body;

    if (waStatuses[schoolId] !== 'Connected') {
        return res.status(400).json({ error: "WhatsApp is not connected. Scan QR code first." });
    }

    const db = readDb(schoolId);
    if (!db.attendance) db.attendance = [];

    const record = db.attendance.find(a => a.date === date && a.classLevel === classLevel);
    if (!record || !record.records) {
        return res.status(400).json({ error: `No attendance register found for ${classLevel} on ${date}` });
    }

    const absentStudentIds = Object.keys(record.records).filter(id => record.records[id] === 'absent');
    if (absentStudentIds.length === 0) {
        return res.json({ success: true, count: 0, message: "No absent students for this date." });
    }

    const schoolName = db.settings.schoolName || 'School';
    let sentCount = 0;
    const errors = [];

    for (const sid of absentStudentIds) {
        const student = db.students.find(s => s.id === sid);
        if (student && student.phone) {
            let cleanNumber = student.phone.replace(/\D/g, '');
            if (cleanNumber.length === 9) cleanNumber = "265" + cleanNumber;
            const jid = `${cleanNumber}@c.us`;

            try {
                const message = `⚠️ *Absence Notice from ${schoolName}*\n\nDear Parent/Guardian,\nYour child *${student.name}* (${classLevel}) was marked *ABSENT* today (${date}).\n\nIf you were unaware of this absence, please contact the school administration immediately.`;
                await sock.sendMessage(jid, { text: message });
                sentCount++;
            } catch (err) {
                errors.push({ student: student.name, error: err.message });
            }
        }
    }

    res.json({ success: true, count: sentCount, totalAbsent: absentStudentIds.length, errors });
});

module.exports = router;
