const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const EXCEL_PATH = path.join(
  __dirname,
  '..',
  '..',
  'gestion',
  'Nouveau Tableau Finance Officiel Havre de Paix.xlsx'
);

const CODE_PATTERN = /^[A-Za-z]\d{3,}$/;

function normalizeName(name) {
  return (name || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/s$/, ''); // "Gazelles" -> "Gazelle" style plural tolerance
}

function cellText(cell) {
  const v = cell.value;
  if (v && typeof v === 'object') {
    if (v instanceof Date) return v;
    if (v.richText) return v.richText.map((rt) => rt.text).join('');
    // Formula cell: use the cached result if present. Some cells in this workbook
    // have no cached result at all (Excel never recalculated them) — treat those
    // as blank rather than leaking the raw {formula, error, ...} object into the data.
    if ('result' in v) {
      const result = v.result;
      if (result && typeof result === 'object' && 'error' in result) return null; // e.g. #DIV/0!
      return result;
    }
    return null;
  }
  return v;
}

// Converts a worksheet into a 0-indexed array-of-arrays (row 1 -> index 0, column A -> index 0).
function sheetToArray(sheet) {
  const rows = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const maxCol = Math.max(sheet.columnCount || 0, row.cellCount || 0);
    const arr = [];
    for (let c = 1; c <= maxCol; c++) {
      arr[c - 1] = cellText(row.getCell(c));
    }
    rows.push(arr);
  }
  return rows;
}

// Scans a sheet (array-of-arrays) for the LAST header row matching `headerMatch(row)`,
// then reads contiguous data rows below it while `isDataRow(row)` holds.
function readLastBlock(rows, headerMatch, isDataRow) {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (headerMatch(rows[i] || [])) headerIdx = i;
  }
  if (headerIdx === -1) return [];

  const data = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (!isDataRow(row)) break;
    data.push(row);
  }
  return data;
}

function readProductList(workbook) {
  const sheet = workbook.getWorksheet('Liste des produits');
  if (!sheet) return [];
  const rows = sheetToArray(sheet);

  const dataRows = readLastBlock(
    rows,
    (row) => row[1] === 'Référence',
    (row) => typeof row[1] === 'string' && CODE_PATTERN.test(row[1])
  );

  return dataRows.map((row) => ({
    code: row[1],
    name: row[2],
    units_per_case: Number(row[3]) || 1,
    unit_price: Number(row[4]) || 0,
    unit_profit: Number(row[5]) || 0,
  }));
}

function readLatestStockBlock(workbook) {
  const sheet = workbook.getWorksheet('Suivi du Stock');
  if (!sheet) return [];
  const rows = sheetToArray(sheet);

  const dataRows = readLastBlock(
    rows,
    (row) => row[0] === 'Code \nArticle',
    (row) => typeof row[0] === 'string' && CODE_PATTERN.test(row[0])
  );

  return dataRows
    .filter((row) => row[1]) // skip rows with no Désignation (e.g. the empty A012 row)
    .map((row) => ({
      code: row[0],
      name: row[1],
      min_stock: Number(row[2]) || 0,
      stock_final: Number(row[8]) || 0,
      unit_price: Number(row[9]) || 0,
    }));
}

/**
 * Imports the existing Excel workbook into the SQLite database:
 *  - Uses "Liste des produits" as the canonical product master (price, units/case, profit).
 *  - Adds any extra product found in the most recent "Suivi du Stock" block that isn't
 *    already covered by name (case/plural-insensitive match) — these are products the
 *    original spreadsheet never added to "Liste des produits", so they're created with
 *    the data actually available (name, price, min stock) and flagged as incomplete.
 *  - Seeds one opening-balance stock movement per product from that latest block's
 *    "Stock Final", dated today, so the app starts from the last known real state.
 * Safe to re-run: skips products whose code already exists.
 */
async function importFromExcel(repo) {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Fichier Excel introuvable : ${EXCEL_PATH}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);

  const masterProducts = readProductList(workbook);
  const stockBlock = readLatestStockBlock(workbook);

  const report = {
    productsCreated: [],
    productsSkippedExisting: [],
    productsIncomplete: [],
    openingStockEntriesCreated: [],
  };

  const existingByCode = new Map(repo.products.list().map((p) => [p.code, p]));
  const masterByNormName = new Map(masterProducts.map((p) => [normalizeName(p.name), p]));
  const newlyCreatedCodes = new Set();

  function ensureProduct({ code, name, unit_price, min_stock }) {
    if (existingByCode.has(code)) {
      report.productsSkippedExisting.push(code);
      return existingByCode.get(code);
    }

    const master = masterByNormName.get(normalizeName(name));
    const created = repo.products.create({
      code,
      name,
      unit_price: master ? master.unit_price : unit_price,
      units_per_case: master ? master.units_per_case : 1,
      unit_profit: master ? master.unit_profit : 0,
      min_stock: min_stock || 0,
    });

    existingByCode.set(code, created);
    newlyCreatedCodes.add(code);
    report.productsCreated.push(code);
    if (!master) report.productsIncomplete.push(name);
    return created;
  }

  // 1) Canonical products from "Liste des produits"
  for (const p of masterProducts) {
    ensureProduct({ code: p.code, name: p.name, unit_price: p.unit_price, min_stock: 0 });
  }

  // 2) Any additional product only found in the latest stock block, seeded with an
  //    opening stock movement from its "Stock Final".
  const today = new Date().toISOString().slice(0, 10);
  for (const s of stockBlock) {
    const product = ensureProduct({
      code: s.code,
      name: s.name,
      unit_price: s.unit_price,
      min_stock: s.min_stock,
    });

    if (newlyCreatedCodes.has(s.code) && s.stock_final > 0) {
      repo.stock.addMovement({
        product_id: product.id,
        date: today,
        type: 'entree',
        quantity: s.stock_final,
        note: 'Import initial depuis Excel (stock connu au moment de la migration)',
      });
      report.openingStockEntriesCreated.push(product.code);
    }
  }

  return report;
}

module.exports = { importFromExcel, EXCEL_PATH };
