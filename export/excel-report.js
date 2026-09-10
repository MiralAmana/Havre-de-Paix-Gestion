const ExcelJS = require('exceljs');

function headerRow(sheet) {
  sheet.getRow(1).font = { bold: true };
}

async function buildExcelReport(data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Havre de Paix - Gestion';
  wb.created = new Date();

  const dashboardSheet = wb.addWorksheet('Tableau de bord');
  dashboardSheet.columns = [
    { header: 'Indicateur', key: 'k', width: 32 },
    { header: 'Valeur', key: 'v', width: 22 },
  ];
  dashboardSheet.addRows([
    { k: 'Période', v: `${data.filters.from || 'depuis le début'} au ${data.filters.to || "aujourd'hui"}` },
    { k: 'Valeur du stock', v: data.summary.stock_value },
    { k: "Chiffre d'affaires (période)", v: data.summary.revenue },
    { k: 'Dépenses (période)', v: data.summary.expenses_total },
    { k: 'Bénéfice net (période)', v: data.summary.net_profit },
    { k: 'Dettes clients en cours', v: data.summary.debts_outstanding },
    { k: 'Produits sous le seuil minimum', v: data.summary.below_min_products.length },
  ]);
  headerRow(dashboardSheet);

  const stockSheet = wb.addWorksheet('Stock');
  stockSheet.columns = [
    { header: 'Code', key: 'code', width: 10 },
    { header: 'Désignation', key: 'name', width: 28 },
    { header: 'Stock actuel', key: 'current_stock', width: 14 },
    { header: 'Stock min.', key: 'min_stock', width: 12 },
    { header: 'P.U. (CFA)', key: 'unit_price', width: 14 },
    { header: 'Valeur du stock (CFA)', key: 'stock_value', width: 18 },
    { header: 'Alerte', key: 'alert', width: 12 },
  ];
  data.stockState.forEach((s) =>
    stockSheet.addRow({
      code: s.code,
      name: s.name,
      current_stock: s.current_stock,
      min_stock: s.min_stock,
      unit_price: s.unit_price,
      stock_value: s.stock_value,
      alert: s.below_min ? 'Stock bas' : '',
    })
  );
  headerRow(stockSheet);

  const expensesSheet = wb.addWorksheet('Dépenses');
  expensesSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Désignation', key: 'label', width: 30 },
    { header: 'Article lié', key: 'product_name', width: 22 },
    { header: 'Montant (CFA)', key: 'amount', width: 16 },
  ];
  data.expenses.forEach((e) =>
    expensesSheet.addRow({ date: e.date, label: e.label, product_name: e.product_name || '', amount: e.amount })
  );
  headerRow(expensesSheet);

  const debtsSheet = wb.addWorksheet('Dettes clients');
  debtsSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Client', key: 'client_name', width: 22 },
    { header: 'Article', key: 'product_name', width: 22 },
    { header: 'Montant total (CFA)', key: 'total_amount', width: 18 },
    { header: 'Versé (CFA)', key: 'paid_amount', width: 14 },
    { header: 'Solde (CFA)', key: 'balance', width: 14 },
  ];
  data.debts.forEach((d) =>
    debtsSheet.addRow({
      date: d.date,
      client_name: d.client_name,
      product_name: d.product_name || '',
      total_amount: d.total_amount,
      paid_amount: d.paid_amount,
      balance: d.balance,
    })
  );
  headerRow(debtsSheet);

  return wb.xlsx.writeBuffer();
}

module.exports = { buildExcelReport };
