import ExcelJS from 'exceljs';

function resolveCellValue(cell) {
  const val = cell.value;
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    if ('result' in val) return val.result;
    if (val.richText) return val.richText.map(r => r.text).join('');
    if (val instanceof Date) return cell.text;
  }
  return val;
}

/**
 * Parse an ArrayBuffer into a workbook wrapper with sheet access.
 * Drop-in replacement for the xlsx library's read + sheet_to_json pattern.
 */
export async function parseWorkbook(arrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  const sheetNames = wb.worksheets.map(ws => ws.name);

  return {
    sheetNames,
    /**
     * Convert a named sheet to an array of row objects (keyed by header).
     * Equivalent to XLSX.utils.sheet_to_json(sheet, { defval }).
     */
    getJsonRows(sheetName, { defval } = {}) {
      const ws = wb.getWorksheet(sheetName);
      if (!ws || ws.rowCount === 0) return [];

      const colCount = ws.columnCount;
      const headerRow = ws.getRow(1);
      const headers = [];
      for (let c = 1; c <= colCount; c++) {
        const cell = headerRow.getCell(c);
        const val = cell.text || (cell.value != null ? String(cell.value) : '');
        headers.push(val || `Column${c}`);
      }

      const rows = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const obj = {};
        let hasData = false;
        for (let c = 0; c < headers.length; c++) {
          const cell = row.getCell(c + 1);
          const val = resolveCellValue(cell);
          if (val === null || val === undefined) {
            obj[headers[c]] = defval !== undefined ? defval : val;
          } else {
            obj[headers[c]] = val;
            hasData = true;
          }
        }
        if (hasData || defval !== undefined) rows.push(obj);
      }

      return rows;
    },
  };
}
