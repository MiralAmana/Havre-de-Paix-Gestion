const fs = require('fs');
const path = require('path');

const RETENTION_DAYS = 30;
const FILENAME_PATTERN = /^havre-de-paix-(\d{4}-\d{2}-\d{2})(?:_\d{2}-\d{2}-\d{2})?\.sqlite$/;

function backupsDir(dbPath) {
  return path.join(path.dirname(dbPath), 'backups');
}

function pruneOldBackups(dir) {
  if (!fs.existsSync(dir)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(dir)) {
    const match = file.match(FILENAME_PATTERN);
    if (!match) continue;
    const fileDate = new Date(match[1]).getTime();
    if (fileDate < cutoff) {
      fs.unlinkSync(path.join(dir, file));
    }
  }
}

/**
 * Copies the database to a dated backup file, once per calendar day.
 * Safe to call on every app startup: does nothing if today's backup already exists,
 * and does nothing if the database file doesn't exist yet (first-ever launch).
 */
function runStartupBackup(dbPath) {
  if (!fs.existsSync(dbPath)) return null;

  const dir = backupsDir(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const dest = path.join(dir, `havre-de-paix-${today}.sqlite`);

  if (!fs.existsSync(dest)) {
    fs.copyFileSync(dbPath, dest);
  }

  pruneOldBackups(dir);
  return dest;
}

/** Forces a new timestamped backup regardless of whether one exists for today. */
function createBackupNow(dbPath) {
  if (!fs.existsSync(dbPath)) {
    throw new Error("Le fichier de base de données n'existe pas encore.");
  }

  const dir = backupsDir(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
  const dest = path.join(dir, `havre-de-paix-${stamp}.sqlite`);
  fs.copyFileSync(dbPath, dest);

  pruneOldBackups(dir);
  return dest;
}

module.exports = { runStartupBackup, createBackupNow, backupsDir };
