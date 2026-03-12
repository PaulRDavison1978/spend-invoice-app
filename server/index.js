import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import extractInvoiceRouter from './routes/extract-invoice.js';
import { publicRouter as authPublicRouter, protectedRouter as authProtectedRouter } from './routes/auth.js';
import invoicesRouter from './routes/invoices.js';
import spendApprovalsRouter from './routes/spend-approvals.js';
import usersRouter from './routes/users.js';
import rolesRouter from './routes/roles.js';
import lookupsRouter from './routes/lookups.js';
import auditLogsRouter from './routes/audit-logs.js';
import emailTemplatesRouter from './routes/email-templates.js';
import spendAlertsRouter from './routes/spend-alerts.js';
import settingsRouter from './routes/settings.js';
import budgetLinesRouter from './routes/budget-lines.js';
import budgetsRouter from './routes/budgets.js';
import budgetImportRouter from './routes/budget-import.js';
import auth from './middleware/auth.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "https://login.microsoftonline.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
    },
  },
}));

// Prevent caching of API responses containing sensitive data
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// Catch JSON parse errors before auth to avoid leaking technology details
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// Public routes (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rate-limit auth endpoints more strictly
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

// Rate-limit extract-invoice endpoints more strictly
const extractLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/extract-invoice', extractLimiter);

// Auth callback + dev endpoints are public (used during login flow)
app.use(authPublicRouter);

// All remaining routes require authentication
app.use(auth);

// Auth /me and /logout require authentication
app.use(authProtectedRouter);

app.use(extractInvoiceRouter);
app.use(invoicesRouter);
app.use(spendApprovalsRouter);
app.use(usersRouter);
app.use(rolesRouter);
app.use(lookupsRouter);
app.use(auditLogsRouter);
app.use(emailTemplatesRouter);
app.use(spendAlertsRouter);
app.use(settingsRouter);
app.use(budgetLinesRouter);
app.use(budgetsRouter);
app.use(budgetImportRouter);

// Centralized error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
