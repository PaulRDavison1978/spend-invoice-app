import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import extractInvoiceRouter from './routes/extract-invoice.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(extractInvoiceRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
