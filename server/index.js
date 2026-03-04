import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import extractInvoiceRouter from './routes/extract-invoice.js';
import authRouter from './routes/auth.js';
import invoicesRouter from './routes/invoices.js';
import spendApprovalsRouter from './routes/spend-approvals.js';
import usersRouter from './routes/users.js';
import rolesRouter from './routes/roles.js';
import lookupsRouter from './routes/lookups.js';
import auditLogsRouter from './routes/audit-logs.js';
import emailTemplatesRouter from './routes/email-templates.js';
import spendAlertsRouter from './routes/spend-alerts.js';
import auth from './middleware/auth.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Public routes (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Extract invoice uses its own API key auth
app.use(extractInvoiceRouter);

// Auth callback is public (used during login flow)
app.use(authRouter);

// All remaining routes require authentication
app.use(auth);

app.use(invoicesRouter);
app.use(spendApprovalsRouter);
app.use(usersRouter);
app.use(rolesRouter);
app.use(lookupsRouter);
app.use(auditLogsRouter);
app.use(emailTemplatesRouter);
app.use(spendAlertsRouter);

// Centralized error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
