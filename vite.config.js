import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function anthropicProxyPlugin() {
  return {
    name: 'anthropic-proxy',
    configureServer(server) {
      server.middlewares.use('/api/extract-invoice', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { file, mediaType, apiKey } = JSON.parse(body);
            if (!file || !mediaType || !apiKey) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing required fields: file, mediaType, apiKey' }));
              return;
            }

            const isPdf = mediaType === 'application/pdf';
            const contentBlock = isPdf
              ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file } }
              : { type: 'image', source: { type: 'base64', media_type: mediaType, data: file } };

            const systemPrompt = `You are an invoice data extraction assistant. Extract data from the provided invoice and return ONLY a raw JSON object (no markdown fences, no explanation) matching this exact structure:

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

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60000);

            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 2048,
                system: systemPrompt,
                messages: [{
                  role: 'user',
                  content: [
                    contentBlock,
                    { type: 'text', text: 'Extract all invoice data from this document and return as JSON.' }
                  ]
                }]
              }),
              signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
              const errBody = await response.text();
              const status = response.status;
              let type = 'api_error';
              if (status === 401) type = 'authentication_error';
              else if (status === 429) type = 'rate_limit_error';
              else if (status === 400) type = 'invalid_request_error';
              res.writeHead(status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Anthropic API error (${status}): ${errBody}`, type }));
              return;
            }

            const apiResult = await response.json();
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
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to parse Claude response as JSON', type: 'parse_error' }));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data }));
          } catch (err) {
            if (err.name === 'AbortError') {
              res.writeHead(504, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Request timed out (60s)', type: 'timeout_error' }));
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message, type: 'server_error' }));
            }
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  }
})
