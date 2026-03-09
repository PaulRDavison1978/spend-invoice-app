import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import XLSX from 'xlsx';
import prisma from '../lib/prisma.js';
import { decrypt } from '../services/cryptoService.js';
import authorize from '../middleware/authorize.js';

const router = Router();
const API_KEY_SETTING = 'anthropic_api_key';

async function resolveApiKey() {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: API_KEY_SETTING } });
    if (setting) return setting.encrypted ? decrypt(setting.value) : setting.value;
  } catch { /* fall through */ }
  return process.env.ANTHROPIC_API_KEY || null;
}

const SYSTEM_PROMPT = `You are a budget data mapping assistant. You will receive column headers and sample rows from an Excel spreadsheet. Your job is to map these columns to budget line item fields and return the extracted data.

Target fields (use these exact keys):
- type: "BAU", "New", or "XDT"
- businessUnit: business unit / department name
- serviceCategory: service category or licence category
- licence: licence name, software name, or service description (REQUIRED)
- project: project name
- costCentre: cost centre code
- comments: any comments or notes
- region: region code (e.g. UKI, NA, NEE, WE, Nordic, APAC)
- vendor: vendor / supplier name
- contractEndDate: contract end date as string (dd/mm/yyyy)
- contractValue: contract value as number (original currency)
- currency: 3-letter currency code (EUR, GBP, USD, etc.)
- eurAnnual: annual value in EUR as number
- monthlyBudget: object with keys Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec — each a number

Rules:
- Return ONLY a raw JSON object (no markdown fences, no explanation)
- The JSON must have: { "sheetUsed": "name of sheet", "mappings": { "targetField": "sourceColumn", ... }, "rows": [ { ...mapped row data... }, ... ] }
- Each row in "rows" must use the target field keys above
- For monthlyBudget, look for columns like "Jan-26", "Feb-26" or "Jan", "Feb" etc. and map them
- Strip leading vendor/supplier ID numbers (e.g. "00001113 ACME Corp" -> "ACME Corp")
- All numeric values should be numbers, not strings
- Round monetary values to 2 decimal places
- If EUR annual is not directly available but monthly values are, sum the 12 months
- If monthly values are not available but EUR annual is, divide by 12 evenly
- Skip empty rows (rows where licence/description is blank)
- Include ALL data rows, not just samples
- If there are multiple sheets, pick the one that looks most like a detailed line-item budget (most rows with licence/service data)`;

// POST /api/budgets/ai-map — AI-powered Excel field mapping
router.post(
  '/api/budgets/ai-map',
  authorize('budget.manage_all', 'budget.manage_own'),
  async (req, res, next) => {
    try {
      const { file, fileName } = req.body;
      if (!file) return res.status(400).json({ error: 'Missing file data' });

      const resolvedKey = await resolveApiKey();
      if (!resolvedKey) {
        return res.status(422).json({
          error: 'No Anthropic API key configured. An administrator must set the API key in Settings > API.',
          type: 'configuration_error',
        });
      }

      // Parse Excel
      const buffer = Buffer.from(file, 'base64');
      const wb = XLSX.read(buffer, { type: 'buffer' });

      // Build sheet summaries for Claude
      const sheetSummaries = [];
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
        const fmtData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        if (rawData.length < 2) continue;

        // Find the header row (first row with multiple non-empty cells)
        let headerIdx = 0;
        for (let i = 0; i < Math.min(5, rawData.length); i++) {
          const nonEmpty = (rawData[i] || []).filter(c => c != null && c !== '').length;
          if (nonEmpty >= 3) { headerIdx = i; break; }
        }

        const headers = (fmtData[headerIdx] || []).map(h => (h || '').toString());
        const dataRowCount = rawData.length - headerIdx - 1;

        // Send sample rows (first 5 formatted for readability, plus row count)
        const sampleRows = [];
        for (let i = headerIdx + 1; i < Math.min(headerIdx + 6, fmtData.length); i++) {
          sampleRows.push((fmtData[i] || []).map(c => (c || '').toString()));
        }

        sheetSummaries.push({ name, headers, sampleRows, dataRowCount });
      }

      if (sheetSummaries.length === 0) {
        return res.status(400).json({ error: 'No valid sheets found in the Excel file' });
      }

      // Now find the best sheet (most data rows) and send ALL its data to Claude
      const bestSheet = sheetSummaries.reduce((a, b) => a.dataRowCount > b.dataRowCount ? a : b);
      const ws = wb.Sheets[bestSheet.name];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
      const fmtData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

      // Find header row index again
      let headerIdx = 0;
      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const nonEmpty = (rawData[i] || []).filter(c => c != null && c !== '').length;
        if (nonEmpty >= 3) { headerIdx = i; break; }
      }

      const headers = (fmtData[headerIdx] || []).map(h => (h || '').toString());

      // Collect all data rows (formatted for dates, raw for numbers combined)
      const allRows = [];
      for (let i = headerIdx + 1; i < rawData.length; i++) {
        const raw = rawData[i] || [];
        const fmt = fmtData[i] || [];
        // Use formatted for string-like columns, raw for numeric
        const row = headers.map((_, ci) => {
          const rv = raw[ci];
          const fv = fmt[ci];
          if (rv == null || rv === '') return '';
          if (typeof rv === 'number') return rv;
          return (fv || rv || '').toString();
        });
        allRows.push(row);
      }

      // Limit rows sent to Claude (max 200 to stay within token limits)
      const maxRows = Math.min(allRows.length, 200);
      const rowsToSend = allRows.slice(0, maxRows);

      const userMessage = `File: "${fileName || 'budget.xlsx'}"

Available sheets: ${sheetSummaries.map(s => `"${s.name}" (${s.dataRowCount} data rows)`).join(', ')}

I recommend using sheet "${bestSheet.name}" which has ${bestSheet.dataRowCount} data rows.

Headers (row ${headerIdx + 1}):
${JSON.stringify(headers)}

Data rows (${rowsToSend.length} of ${allRows.length} total):
${JSON.stringify(rowsToSend)}

Map these columns to budget line item fields and return ALL ${rowsToSend.length} rows as mapped data.`;

      const client = new Anthropic({ apiKey: resolvedKey });
      const apiResult = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const textContent = apiResult.content?.find(b => b.type === 'text')?.text || '';

      let jsonStr = textContent.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        return res.status(502).json({ error: 'Failed to parse AI response', type: 'parse_error', raw: textContent.substring(0, 500) });
      }

      // Normalize rows
      const rows = (parsed.rows || []).map(row => ({
        type: row.type || 'BAU',
        businessUnit: row.businessUnit || null,
        serviceCategory: row.serviceCategory || null,
        licence: row.licence || '',
        project: row.project || null,
        costCentre: row.costCentre || null,
        comments: row.comments || null,
        region: row.region || null,
        vendor: row.vendor || null,
        contractEndDate: row.contractEndDate || null,
        contractValue: row.contractValue ? Math.round(row.contractValue * 100) / 100 : null,
        currency: row.currency || 'EUR',
        eurAnnual: row.eurAnnual ? Math.round(row.eurAnnual * 100) / 100 : null,
        monthlyBudget: row.monthlyBudget || null,
      })).filter(r => r.licence);

      res.json({
        success: true,
        sheetUsed: parsed.sheetUsed || bestSheet.name,
        mappings: parsed.mappings || {},
        rows,
        totalInFile: allRows.length,
        totalMapped: rows.length,
      });
    } catch (err) {
      if (err.status === 401) return res.status(401).json({ error: 'API authentication error', type: 'authentication_error' });
      if (err.status === 429) return res.status(429).json({ error: 'Rate limit exceeded', type: 'rate_limit_error' });
      next(err);
    }
  }
);

export default router;
