const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000; // the shop may leave the app open all day
const MAX_LOG_BYTES = 100 * 1024;

function logFile() {
  return path.join(app.getPath('userData'), 'updates.log');
}

// Network errors carry a multi-line stack; the first line is enough for the log.
function reason(err) {
  return String((err && err.message) || err).split('\n')[0];
}

function log(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  console.log(`[updater] ${message}`);
  try {
    const file = logFile();
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_LOG_BYTES) fs.unlinkSync(file);
    fs.appendFileSync(file, line);
  } catch (_) {
    // A log that cannot be written must never break the app.
  }
}

/**
 * Checks GitHub Releases for a newer version at startup and every few hours.
 * Silent when offline or when nothing is published; only speaks up once an update is downloaded.
 * Skipped in development (npm start) — there is no installed build to replace.
 */
function setupAutoUpdate(getWindow) {
  if (!app.isPackaged) return;

  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => log('Recherche de mise à jour…'));
  autoUpdater.on('update-not-available', () => log(`À jour (version ${app.getVersion()}).`));
  autoUpdater.on('update-available', (info) => log(`Nouvelle version ${info.version} trouvée, téléchargement…`));
  autoUpdater.on('error', (err) => log(`Erreur : ${reason(err)}`));

  autoUpdater.on('update-downloaded', async (info) => {
    log(`Version ${info.version} téléchargée.`);
    const win = getWindow();
    const { response } = await dialog.showMessageBox(win && !win.isDestroyed() ? win : undefined, {
      type: 'info',
      title: 'Mise à jour disponible',
      message: `La nouvelle version ${info.version} est prête.`,
      detail:
        'Vos données sont conservées. Redémarrer maintenant pour l\'installer, ' +
        'ou plus tard : elle s\'installera à la prochaine fermeture de l\'application.',
      buttons: ['Redémarrer maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  const check = () => autoUpdater.checkForUpdates().catch((err) => log(`Vérification impossible : ${reason(err)}`));
  check();
  setInterval(check, CHECK_EVERY_MS);
}

module.exports = { setupAutoUpdate };
