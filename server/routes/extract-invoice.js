import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../lib/prisma.js';
import { decrypt } from '../services/cryptoService.js';

const router = Router();

const API_KEY_SETTING = 'anthropic_api_key';

const SYSTEM_PROMPT = `You are an invoice data extraction assistant. Extract data from the provided invoice and return ONLY a raw JSON object (no markdown fences, no explanation) matching this exact structure:

{
  "supplier": {
    "company": "string - supplier/vendor company name",
    "address": "string - full supplier address",
    "vat_number": "string - supplier VAT/tax registration number",
    "website": "string - supplier website URL",
    "phone": "string - supplier phone number",
    "email": "string - supplier email address"
  },
  "customer": {
    "company": "string - customer/bill-to company name",
    "attention": "string - attention line or contact person",
    "address": "string - full customer address",
    "vat_number": "string - customer VAT/tax registration number"
  },
  "invoice": {
    "title": "string - brief description or title of the invoice",
    "invoice_number": "string - invoice number/reference",
    "invoice_date": "string - YYYY-MM-DD format",
    "due_date": "string - YYYY-MM-DD format",
    "payment_terms": "string - e.g. '30 days from invoice date'",
    "currency": "string - 3-letter currency code e.g. GBP, USD, EUR"
  },
  "line_items": [
    {
      "category": "string - category or grouping of the line item",
      "description": "string - line item description",
      "quantity": "number",
      "unit_rate": "number - price per unit, NO currency symbols",
      "amount": "number - total for this line, NO currency symbols"
    }
  ],
  "totals": {
    "subtotal": "number - sum before tax, NO currency symbols",
    "vat_rate": "number - VAT/tax rate as decimal e.g. 0.20 for 20%",
    "vat_amount": "number - total tax amount, NO currency symbols",
    "total": "number - grand total including tax, NO currency symbols"
  },
  "bank_details": {
    "bank": "string - bank name",
    "account_number": "string - bank account number",
    "sort_code": "string - sort code if applicable",
    "iban": "string - IBAN if applicable",
    "swift_bic": "string - SWIFT/BIC code if applicable"
  }
}

Rules:
- Strip all currency symbols from numeric amounts
- All amounts should be numbers (not strings) with up to 2 decimal places
- If tax/VAT is included in the total, try to separate it; if not determinable set vat_amount to 0 and vat_rate to 0
- If a field cannot be determined, use empty string for text fields, 0 for numbers, [] for line_items
- For dates, use YYYY-MM-DD format. If only a month/year is given, use the 1st of that month
- Return ONLY the JSON object, nothing else`;

async function resolveApiKey() {
  // Try DB first
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: API_KEY_SETTING } });
    if (setting) {
      return setting.encrypted ? decrypt(setting.value) : setting.value;
    }
  } catch {
    // DB or decryption failed — fall through to env var
  }

  // Fallback to environment variable
  return process.env.ANTHROPIC_API_KEY || null;
}

router.post('/api/extract-invoice', async (req, res) => {
  try {
    const { file, mediaType } = req.body;

    if (!file || !mediaType) {
      return res.status(400).json({ error: 'Missing required fields: file, mediaType', type: 'invalid_request_error' });
    }

    const resolvedKey = await resolveApiKey();
    if (!resolvedKey) {
      return res.status(422).json({
        error: 'No Anthropic API key configured. An administrator must set the API key in Settings > API.',
        type: 'configuration_error',
      });
    }

    const isPdf = mediaType === 'application/pdf';
    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: file } };

    const client = new Anthropic({ apiKey: resolvedKey });

    const apiResult = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: 'Extract all invoice data from this document and return as JSON.' }
        ]
      }]
    });

    const textContent = apiResult.content?.find(b => b.type === 'text')?.text || '';

    // Strip markdown fences if present
    let jsonStr = textContent.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      return res.status(502).json({ error: 'Failed to parse Claude response as JSON', type: 'parse_error' });
    }

    res.json({ success: true, data });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ error: `Authentication error: ${err.message}`, type: 'authentication_error' });
    }
    if (err.status === 429) {
      return res.status(429).json({ error: `Rate limit exceeded: ${err.message}`, type: 'rate_limit_error' });
    }
    if (err.name === 'AbortError' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'Request timed out', type: 'timeout_error' });
    }
    res.status(500).json({ error: err.message, type: 'server_error' });
  }
});

export default router;
