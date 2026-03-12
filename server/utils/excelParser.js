import ExcelJS from 'exceljs';

function resolveRawValue(cell) {
  const val = cell.value;
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    if ('result' in val) return val.result;
    if (val.richText) return val.richText.map(r => r.text).join('');
    if (val instanceof Date) return val;
  }
  return val;
}

/**
 * Read an Excel buffer into an ExcelJS Workbook.
 */
export async function readWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

/**
 * Get ordered sheet names from a workbook.
 */
export function getSheetNames(wb) {
  return wb.worksheets.map(ws => ws.name);
}

/**
 * Convert a worksheet to an array of arrays.
 * Equivalent to XLSX.utils.sheet_to_json(ws, { header: 1, raw: true/false }).
 *
 * @param {ExcelJS.Worksheet} ws
 * @param {{ raw?: boolean }} options
 */
export function sheetToArrays(ws, { raw = true } = {}) {
  const rows = [];
  const colCount = ws.columnCount;
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const arr = [];
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      if (raw) {
        arr.push(resolveRawValue(cell));
      } else {
        arr.push(cell.text || null);
      }
    }
    rows.push(arr);
  }
  return rows;
}
