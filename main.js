const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./db');
const { importFromExcel } = require('./db/import-excel');
const { buildReportData } = require('./db/reports');
const { buildExcelReport } = require('./export/excel-report');
const { buildPdfReport } = require('./export/pdf-report');
const { runStartupBackup, createBackupNow, backupsDir } = require('./db/backup');

let mainWindow;
let repo;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Havre de Paix - Gestion',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[renderer] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, description) => {
    console.error(`[renderer] did-fail-load: ${code} ${description}`);
  });
}

function registerIpcHandlers() {
  // Products
  ipcMain.handle('products:list', () => repo.products.list());
  ipcMain.handle('products:create', (_e, data) => repo.products.create(data));
  ipcMain.handle('products:update', (_e, id, data) => repo.products.update(id, data));
  ipcMain.handle('products:remove', (_e, id) => repo.products.remove(id));

  // Stock
  ipcMain.handle('stock:currentState', () => repo.stock.currentState());
  ipcMain.handle('stock:listMovements', (_e, filters) => repo.stock.listMovements(filters));
  ipcMain.handle('stock:addMovement', (_e, data) => repo.stock.addMovement(data));
  ipcMain.handle('stock:removeMovement', (_e, id) => repo.stock.removeMovement(id));

  // Expenses
  ipcMain.handle('expenses:list', (_e, filters) => repo.expenses.list(filters));
  ipcMain.handle('expenses:create', (_e, data) => repo.expenses.create(data));
  ipcMain.handle('expenses:update', (_e, id, data) => repo.expenses.update(id, data));
  ipcMain.handle('expenses:remove', (_e, id) => repo.expenses.remove(id));

  // Clients
  ipcMain.handle('clients:list', () => repo.clients.list());
  ipcMain.handle('clients:create', (_e, data) => repo.clients.create(data));
  ipcMain.handle('clients:update', (_e, id, data) => repo.clients.update(id, data));
  ipcMain.handle('clients:remove', (_e, id) => repo.clients.remove(id));

  // Debts
  ipcMain.handle('debts:list', (_e, filters) => repo.debts.list(filters));
  ipcMain.handle('debts:get', (_e, id) => repo.debts.get(id));
  ipcMain.handle('debts:create', (_e, data) => repo.debts.create(data));
  ipcMain.handle('debts:remove', (_e, id) => repo.debts.remove(id));
  ipcMain.handle('debts:addPayment', (_e, data) => repo.debts.addPayment(data));
  ipcMain.handle('debts:listPayments', (_e, debtId) => repo.debts.listPayments(debtId));

  // Dashboard
  ipcMain.handle('dashboard:summary', (_e, filters) => repo.dashboard.summary(filters));
  ipcMain.handle('dashboard:salesByDay', (_e, filters) => repo.dashboard.salesByDay(filters));

  // Import Excel (one-shot, idempotent-ish: only inserts products that don't already exist)
  ipcMain.handle('import:excel', async () => importFromExcel(repo));

  // Reports export
  ipcMain.handle('export:excel', async (_e, filters) => {
    const data = buildReportData(repo, filters || {});
    const buffer = await buildExcelReport(data);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter le rapport (Excel)',
      defaultPath: `Rapport Havre de Paix ${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    fs.writeFileSync(filePath, buffer);
    return { canceled: false, filePath };
  });

  ipcMain.handle('export:pdf', async (_e, filters) => {
    const data = buildReportData(repo, filters || {});
    const buffer = await buildPdfReport(data);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter le rapport (PDF)',
      defaultPath: `Rapport Havre de Paix ${new Date().toISOString().slice(0, 10)}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    fs.writeFileSync(filePath, buffer);
    return { canceled: false, filePath };
  });

  // Backups
  ipcMain.handle('backup:createNow', () => createBackupNow(dbPath));
  ipcMain.handle('backup:openFolder', () => shell.openPath(backupsDir(dbPath)));
}

let dbPath;

app.whenReady().then(() => {
  dbPath = path.join(app.getPath('userData'), 'havre-de-paix.sqlite');

  // Sauvegarde datée avant toute écriture de la session (une fois par jour, voir db/backup.js)
  runStartupBackup(dbPath);

  const initialized = initDatabase(dbPath);
  repo = initialized.repo;

  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
