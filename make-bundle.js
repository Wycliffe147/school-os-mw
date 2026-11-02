#!/usr/bin/env node
/**
 * make-bundle.js — SchoolOS MW Claude.ai Context Bundle Generator
 *
 * Produces a single text file (schoolos-bundle.txt) containing the entire
 * codebase in a structured format suitable for uploading to a Claude.ai Project
 * as project knowledge. Run with:
 *
 *   node make-bundle.js
 *
 * Output: schoolos-bundle.txt  (in the project root)
 */

const fs   = require('fs');
const path = require('path');
const root = __dirname;

// ── Split into two bundles to stay within Claude.ai's ~500 KB file limit ────
//   Bundle A (backend)  → schoolos-bundle-backend.txt   (~130 KB)
//   Bundle B (frontend) → schoolos-bundle-frontend.txt  (~560 KB, still big)
//   Bundle C (frontend-slim) skips explore/school-profile for a tighter cut

const BUNDLE_BACKEND = [
  // Server & DB
  'server.js',
  'package.json',
  'db.js',
  'middleware/auth.js',

  // All routes
  'routes/auth.js',
  'routes/students.js',
  'routes/payments.js',
  'routes/settings.js',
  'routes/payroll.js',
  'routes/staff.js',
  'routes/parentPortal.js',
  'routes/timetable.js',
  'routes/analytics.js',
  'routes/discovery.js',
  'routes/whatsapp.js',
  'routes/pdf.js',
  'routes/saas.js',

  // Services
  'services/pdfService.js',

  // Docs
  'ROADMAP.md',
  'CONCEPT_NOTE.md',
  '1SchoolOS_review_working_copy.md',
];

const BUNDLE_FRONTEND = [
  // CSS first
  'public/index.css',

  // Main admin app
  'public/index.html',
  'public/app.js',

  // Parent portal
  'public/parent-portal.html',

  // Public pages
  'public/explore.html',
  'public/school-profile.html',
];

// We'll generate both. Change FILES below to target one bundle at a time,
// or run the script which auto-generates both.
const FILES = [...BUNDLE_BACKEND, ...BUNDLE_FRONTEND];

// ── Files to skip entirely (too large / generated / binary) ─────────────────
const SKIP = new Set([
  'db.json',           // live data — keep private
  'package-lock.json',
]);

// ── Build both bundles ───────────────────────────────────────────────────────
function buildBundle(label, fileList, outFileName) {
  const SEP  = '='.repeat(80);

  let out = '';
  let totalBytes = 0;
  let includedCount = 0;
  let skippedCount  = 0;

  // Header
  out += `${SEP}\n`;
  out += `  SCHOOLOS MW — ${label.toUpperCase()} BUNDLE\n`;
  out += `  Generated: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Blantyre' })} CAT\n`;
  out += `  Purpose  : Claude.ai Project Knowledge File\n`;
  out += `  Repo     : https://github.com/Wycliffe147/school-os-mw\n`;
  out += `${SEP}\n\n`;

  // Table of contents
  out += `TABLE OF CONTENTS\n`;
  out += '-'.repeat(40) + '\n';
  fileList.forEach((rel, i) => {
    const fullPath = path.join(root, rel);
    const exists   = fs.existsSync(fullPath);
    out += `  ${String(i + 1).padStart(2, ' ')}. ${rel}${exists ? '' : '  [NOT FOUND — SKIPPED]'}\n`;
  });
  out += '\n' + SEP + '\n\n';

  // File contents
  for (const rel of fileList) {
    if (SKIP.has(path.basename(rel))) { skippedCount++; continue; }

    const fullPath = path.join(root, rel);
    if (!fs.existsSync(fullPath)) { skippedCount++; continue; }

    const stat    = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines   = content.split('\n').length;

    out += `${SEP}\n`;
    out += `FILE: ${rel}\n`;
    out += `SIZE: ${(stat.size / 1024).toFixed(1)} KB  |  LINES: ${lines}\n`;
    out += `${SEP}\n`;
    out += content;
    if (!content.endsWith('\n')) out += '\n';
    out += `\n`;

    totalBytes += stat.size;
    includedCount++;
  }

  // Footer
  out += `${SEP}\n`;
  out += `END OF ${label.toUpperCase()} BUNDLE\n`;
  out += `Files included : ${includedCount}\n`;
  out += `Files skipped  : ${skippedCount}\n`;
  out += `Total source   : ${(totalBytes / 1024).toFixed(1)} KB\n`;
  const bundleKB = (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1);
  out += `Bundle size    : ${bundleKB} KB\n`;
  out += `${SEP}\n`;

  const outFile = path.join(root, outFileName);
  fs.writeFileSync(outFile, out, 'utf8');

  return { label, includedCount, skippedCount, totalKB: (totalBytes / 1024).toFixed(1), bundleKB, outFile, outFileName };
}

// ── Run generators ─────────────────────────────────────────────────────────
console.log('🚀 Generating SchoolOS bundles for Claude.ai...\n');

const resAll      = buildBundle('Full Codebase', FILES, 'schoolos-bundle.txt');
const resBackend  = buildBundle('Backend & Docs', BUNDLE_BACKEND, 'schoolos-bundle-backend.txt');
const resFrontend = buildBundle('Frontend', BUNDLE_FRONTEND, 'schoolos-bundle-frontend.txt');

[resAll, resBackend, resFrontend].forEach(r => {
  console.log(`✅  ${r.outFileName.padEnd(28)} | ${r.bundleKB.padStart(6)} KB | ${r.includedCount} files (${r.label})`);
});

console.log('\n💡 Recommendation for Claude.ai Project:');
console.log('   - For general/backend work: Upload schoolos-bundle-backend.txt (~140 KB)');
console.log('   - For frontend UI/UX work : Upload schoolos-bundle-frontend.txt (~600 KB)');
console.log('   - For full global context : Upload schoolos-bundle.txt (~740 KB)\n');
