const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

const DB_FILE = path.join(__dirname, 'db.json');

let dbCache = null;
let mongoClient = null;
let mongoDb = null;

async function initDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.log("⚠️ No MONGODB_URI environment variable found. Falling back to local db.json file only.");
        if (fs.existsSync(DB_FILE)) {
            dbCache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        } else {
            dbCache = { students: [], users: [], subjects: [], settings: {} };
        }
        fixUsers();
        return;
    }
    
    try {
        mongoClient = new MongoClient(uri);
        await mongoClient.connect();
        mongoDb = mongoClient.db('report_generator');
        console.log("✅ Connected to MongoDB Cloud");
        
        const stateCollection = mongoDb.collection('app_state');
        const state = await stateCollection.findOne({ _id: 'main' });
        
        if (state && state.data) {
            dbCache = state.data;
        } else {
            console.log("No data found in MongoDB. Initializing fresh DB.");
            if (fs.existsSync(DB_FILE)) {
                dbCache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            } else {
                dbCache = { students: [], users: [], subjects: [], settings: {} };
            }
            await stateCollection.insertOne({ _id: 'main', data: dbCache });
        }
        fixUsers();
    } catch (err) {
        console.error("❌ Failed to connect to MongoDB, falling back to local file:", err);
        if (fs.existsSync(DB_FILE)) {
            dbCache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        } else {
            dbCache = { students: [], users: [], subjects: [], settings: {} };
        }
        fixUsers();
    }
}

function fixUsers() {
    const allUsers = dbCache.users || [];
    allUsers.forEach(u => {
        if (!u.passwordHash && u.password) {
            console.log(`[fixUsers] Backfilling passwordHash for user: ${u.username}`);
            u.passwordHash = bcrypt.hashSync(u.password, 8);
        }
    });
    const broken = allUsers.filter(u => !u.passwordHash);
    if (broken.length) {
        console.warn(`[fixUsers] ${broken.length} user(s) have no passwordHash and no plaintext password — they cannot log in:`, broken.map(u => u.username));
    }
}

if (!fs.existsSync(DB_FILE)) {
    const initialDb = {
        students: [],
        subjects: [
            "Additional Mathematics", "Agriculture", "Biology", "Bible Knowledge", 
            "Business Studies", "Computer Studies", "Chemistry", "Chichewa", 
            "Clothing & Textiles", "Creative Arts", "Geography", "French", 
            "English", "History", "Home Economics", "Life Skills", 
            "Mathematics", "Metal Work", "Physics", "Religious & Moral Education", 
            "Social Studies", "Technical Drawing", "Woodwork"
        ],
        settings: {
            schoolName: "EXCEL ACADEMY",
            subtitle: "Official Student Progress Report Card",
            themeColor: "#142e5c",
            logoPath: null
        }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
}

function readDb(schoolId = 'default') {
    if (!dbCache.schools) {
        dbCache.schools = {
            'default': {
                students: dbCache.students || [],
                settings: dbCache.settings || {},
                subjects: dbCache.subjects || []
            }
        };
        dbCache.users = dbCache.users || [];
        dbCache.users.forEach(u => { 
            if(!u.schoolId) u.schoolId = 'default'; 
            if(u.id === 'admin_1') u.role = 'superadmin';
            if (!u.passwordHash && u.password) {
                u.passwordHash = bcrypt.hashSync(u.password, 8);
            }
        });
        delete dbCache.students;
        delete dbCache.settings;
        delete dbCache.subjects;
    }
    
    if (!dbCache.schools[schoolId]) {
        dbCache.schools[schoolId] = {
            students: [],
            settings: JSON.parse(JSON.stringify(dbCache.schools['default'].settings)),
            subjects: [...dbCache.schools['default'].subjects]
        };
    }
    
    const schoolData = dbCache.schools[schoolId];
    
    if (schoolData.settings.headteacherRemarksPass === undefined) schoolData.settings.headteacherRemarksPass = "Promoted to next class. Well done!";
    if (schoolData.settings.headteacherRemarksFail === undefined) schoolData.settings.headteacherRemarksFail = "Failed. Work harder next term.";
    if (schoolData.settings.nextTermFees === undefined) schoolData.settings.nextTermFees = "MK 50,000";
    if (schoolData.settings.nextTermDate === undefined) schoolData.settings.nextTermDate = "10 September 2026";
    if (schoolData.settings.currentTerm === undefined) schoolData.settings.currentTerm = "Term One";
    if (!schoolData.settings.gradingSystem) {
        schoolData.settings.gradingSystem = dbCache.schools['default'].settings.gradingSystem || [];
    }
    if (!schoolData.settings.gradingSystemJunior) {
        schoolData.settings.gradingSystemJunior = dbCache.schools['default'].settings.gradingSystemJunior || [];
    }
    if (!schoolData.settings.masterSubjects) {
        schoolData.settings.masterSubjects = dbCache.schools['default'].settings.masterSubjects || [];
    }
    schoolData.subjects = schoolData.settings.masterSubjects.filter(s => s.active).map(s => s.name);
    
    schoolData.users = dbCache.users.filter(u => u.schoolId === schoolId && u.role !== 'superadmin');
    schoolData.allUsers = dbCache.users;
    
    return schoolData;
}

function writeDb(db) {
    if (typeof db === 'undefined' || db === null) {
        db = dbCache;
    }
    dbCache = db;
    if (mongoDb) {
        mongoDb.collection('app_state').updateOne(
            { _id: 'main' },
            { $set: { data: db } },
            { upsert: true }
        ).catch(err => console.error("MongoDB Save Error:", err));
    }
    fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), (err) => {
        if (err) console.error("Local backup failed:", err);
    });
}

function getDbCache() {
    return dbCache;
}

function getMongoDb() {
    return mongoDb;
}

module.exports = {
    initDB,
    readDb,
    writeDb,
    getDbCache,
    getMongoDb
};
