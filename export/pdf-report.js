const { BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

function loadLogoSvg() {
  try {
    const svg = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'assets', 'logo.svg'), 'utf8');
    return svg.replace('<svg ', '<svg height="78" ');
  } catch (err) {
    return '';
  }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function formatCFA(amount) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(amount) || 0) + ' CFA';
}

function kpi(label, value) {
  return `<div class="kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`;
}

function table(headers, rows) {
  if (!rows.length) return '<p class="empty">Aucune donnée.</p>';
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function buildReportHtml(data) {
  const period = `${data.filters.from || 'depuis le début'} au ${data.filters.to || "aujourd'hui"}`;

  const stockRows = data.stockState.map((s) => [
    s.code,
    s.name,
    s.current_stock,
    s.min_stock,
    formatCFA(s.unit_price),
    formatCFA(s.stock_value),
    s.below_min ? 'Stock bas' : '',
  ]);

  const expenseRows = data.expenses.map((e) => [e.date, e.label, e.product_name || '', formatCFA(e.amount)]);

  const debtRows = data.debts.map((d) => [
    d.date,
    d.client_name,
    d.product_name || '',
    formatCFA(d.total_amount),
    formatCFA(d.paid_amount),
    formatCFA(d.balance),
  ]);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1c1510; padding: 24px; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #6a5a4a; margin-bottom: 16px; }
  h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 2px solid #8b4a24; padding-bottom: 4px; }
  .kpis { display: flex; flex-wrap: wrap; gap: 10px; }
  .kpi { border: 1px solid #e7dccb; border-radius: 6px; padding: 8px 12px; min-width: 150px; background: #faf6ef; }
  .kpi .label { font-size: 10px; color: #6a5a4a; text-transform: uppercase; }
  .kpi .value { font-size: 15px; font-weight: bold; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #e7dccb; padding: 5px 8px; text-align: left; font-size: 11px; }
  th { background: #f3eadc; }
  .empty { color: #6a5a4a; font-style: italic; }
  .header { display: flex; align-items: center; gap: 18px; margin-bottom: 14px; }
  .header h1 { margin: 0; }
</style>
</head>
<body>
  <div class="header">
    ${loadLogoSvg()}
    <div>
      <h1>Havre de Paix — Rapport de gestion</h1>
      <div class="meta">Période : ${esc(period)} — généré le ${esc(new Date().toLocaleString('fr-FR'))}</div>
    </div>
  </div>

  <div class="kpis">
    ${kpi('Valeur du stock', formatCFA(data.summary.stock_value))}
    ${kpi("Chiffre d'affaires", formatCFA(data.summary.revenue))}
    ${kpi('Dépenses', formatCFA(data.summary.expenses_total))}
    ${kpi('Bénéfice net', formatCFA(data.summary.net_profit))}
    ${kpi('Dettes clients en cours', formatCFA(data.summary.debts_outstanding))}
  </div>

  <h2>État du stock</h2>
  ${table(['Code', 'Désignation', 'Stock', 'Stock min.', 'P.U.', 'Valeur', 'Alerte'], stockRows)}

  <h2>Dépenses (période)</h2>
  ${table(['Date', 'Désignation', 'Article lié', 'Montant'], expenseRows)}

  <h2>Dettes clients en cours</h2>
  ${table(['Date', 'Client', 'Article', 'Montant total', 'Versé', 'Solde'], debtRows)}
</body>
</html>`;
}

async function buildPdfReport(data) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true },
  });

  try {
    const html = buildReportHtml(data);
    await win.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(html));
    const buffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    });
    return buffer;
  } finally {
    win.destroy();
  }
}

module.exports = { buildPdfReport, buildReportHtml };
