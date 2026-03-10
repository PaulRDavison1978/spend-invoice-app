import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { logAudit } from '../services/auditService.js';
import { findMatches } from '../services/matchingService.js';
import { checkSpendThreshold } from '../services/thresholdService.js';

const router = Router();

// GET /api/invoices
router.get('/api/invoices', async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        lineItems: true,
        monthlyCosts: { orderBy: { yearMonth: 'asc' } },
        spendApproval: { select: { id: true, ref: true, title: true } },
      },
      orderBy: { id: 'asc' },
    });
    res.json(invoices);
  } catch (err) { next(err); }
});

// POST /api/invoices
router.post('/api/invoices', async (req, res, next) => {
  try {
    const {
      invoiceNumber, vendor, date, dueDate, amount, taxAmount,
      department, businessUnit, description, submittedBy, fileName, fileUrl,
      supplierJson, customerJson, currency, lineItems,
    } = req.body;

    // Check for duplicate invoice (same invoiceNumber + vendor)
    if (invoiceNumber) {
      const existing = await prisma.invoice.findFirst({
        where: { invoiceNumber, vendor: { equals: vendor, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) {
        return res.status(409).json({ error: `Duplicate invoice: ${invoiceNumber} from ${vendor} already exists`, duplicate: true });
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        vendor,
        date,
        dueDate,
        amount: parseFloat(amount) || 0,
        taxAmount: parseFloat(taxAmount) || 0,
        department,
        businessUnit: businessUnit || null,
        description,
        submittedBy: submittedBy || req.user?.name || 'Unknown',
        fileName,
        fileUrl,
        supplierJson: supplierJson || undefined,
        customerJson: customerJson || undefined,
        currency,
        lineItems: lineItems?.length ? {
          create: lineItems.map(li => ({
            category: li.category || null,
            description: li.description || null,
            quantity: li.quantity || 0,
            unitRate: li.unitRate || li.rate || 0,
            amount: li.amount || 0,
          })),
        } : undefined,
      },
      include: { lineItems: true },
    });

    const performedBy = req.user?.name || submittedBy || 'System';
    await logAudit({ action: 'INVOICE_UPLOADED', details: `Invoice ${invoiceNumber} uploaded from ${vendor}`, performedBy, userId: req.user?.id });

    res.status(201).json(invoice);
  } catch (err) { next(err); }
});

// GET /api/invoices/:id
router.get('/api/invoices/:id', async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        lineItems: true,
        monthlyCosts: { orderBy: { yearMonth: 'asc' } },
        spendApproval: { select: { id: true, ref: true, title: true } },
      },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) { next(err); }
});

// DELETE /api/invoices/:id
router.delete('/api/invoices/:id', async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    await prisma.invoice.delete({ where: { id: invoice.id } });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'INVOICE_DELETED', details: `Invoice ${invoice.invoiceNumber} deleted`, performedBy, userId: req.user?.id });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// PATCH /api/invoices/:id/link
router.patch('/api/invoices/:id/link', async (req, res, next) => {
  try {
    const { spendApprovalId } = req.body;
    if (!spendApprovalId) return res.status(400).json({ error: 'spendApprovalId is required' });

    const invoice = await prisma.invoice.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const spend = await prisma.spendApproval.findUnique({ where: { id: spendApprovalId } });
    if (!spend) return res.status(404).json({ error: 'Spend approval not found' });

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { spendApprovalId: spend.id },
      include: { spendApproval: { select: { id: true, ref: true, title: true } } },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'INVOICE_MATCHED', details: `Invoice ${invoice.invoiceNumber} matched to spend approval "${spend.title}"`, performedBy, userId: req.user?.id });

    const thresholdAlert = await checkSpendThreshold(spend.id, performedBy, req.user?.id);

    res.json({ ...updated, thresholdAlert });
  } catch (err) { next(err); }
});

// PATCH /api/invoices/:id/unlink
router.patch('/api/invoices/:id/unlink', async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const oldSpendApprovalId = invoice.spendApprovalId;

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { spendApprovalId: null },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'INVOICE_UNLINKED', details: `Invoice ${invoice.invoiceNumber} unlinked from spend approval`, performedBy, userId: req.user?.id });

    // Re-check threshold on the old spend approval to clear/downgrade alerts
    let thresholdAlert = null;
    if (oldSpendApprovalId) {
      thresholdAlert = await checkSpendThreshold(oldSpendApprovalId, performedBy, req.user?.id);
    }

    res.json({ ...updated, thresholdAlert });
  } catch (err) { next(err); }
});

// GET /api/invoices/:id/monthly-costs
router.get('/api/invoices/:id/monthly-costs', async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const rows = await prisma.invoiceMonthlyCost.findMany({
      where: { invoiceId },
      orderBy: { yearMonth: 'asc' },
    });
    res.json(rows);
  } catch (err) { next(err); }
});

// PUT /api/invoices/:id/monthly-costs — replace all monthly cost rows for an invoice
router.put('/api/invoices/:id/monthly-costs', async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const { months } = req.body; // [{ month: "Jan", yearMonth: "2026-01", amount: 500 }, ...]
    if (!Array.isArray(months)) return res.status(400).json({ error: 'months array is required' });

    // Delete existing and recreate in a transaction
    const rows = await prisma.$transaction(async (tx) => {
      await tx.invoiceMonthlyCost.deleteMany({ where: { invoiceId } });
      if (months.length === 0) return [];
      const created = [];
      for (const m of months) {
        const row = await tx.invoiceMonthlyCost.create({
          data: { invoiceId, month: m.month, yearMonth: m.yearMonth, amount: parseFloat(m.amount) || 0 },
        });
        created.push(row);
      }
      return created;
    });

    const performedBy = req.user?.name || 'System';
    const allocDesc = rows.length === 0 ? 'cleared (invoice date)' : rows.length === 1 ? `booked to ${rows[0].month}` : `spread across ${rows.length} months`;
    await logAudit({ action: 'INVOICE_COST_ALLOCATION', details: `Invoice ${invoice.invoiceNumber} cost allocation ${allocDesc}`, performedBy, userId: req.user?.id });

    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/invoices/bulk-import — bulk create invoices from spreadsheet data
router.post('/api/invoices/bulk-import', async (req, res, next) => {
  try {
    const items = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array of invoices' });
    }

    // Check for duplicates against existing invoices (by invoiceNumber + vendor)
    const incomingNumbers = items.map(i => i.invoiceNumber).filter(Boolean);
    const existing = incomingNumbers.length > 0
      ? await prisma.invoice.findMany({ where: { invoiceNumber: { in: incomingNumbers } }, select: { invoiceNumber: true, vendor: true } })
      : [];
    const existingSet = new Set(existing.map(e => `${e.invoiceNumber}|||${(e.vendor || '').toLowerCase()}`));

    const created = [];
    const skipped = [];
    for (const item of items) {
      const key = `${item.invoiceNumber}|||${(item.vendor || '').toLowerCase()}`;
      if (item.invoiceNumber && existingSet.has(key)) {
        skipped.push({ invoiceNumber: item.invoiceNumber, vendor: item.vendor, reason: 'Duplicate' });
        continue;
      }
      // Also track within the batch to prevent intra-batch duplicates
      if (item.invoiceNumber) existingSet.add(key);

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: item.invoiceNumber || `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          vendor: item.vendor || 'Unknown',
          date: item.date || new Date().toISOString().split('T')[0],
          dueDate: item.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amount: parseFloat(item.amount) || 0,
          taxAmount: parseFloat(item.taxAmount) || 0,
          department: item.department || null,
          businessUnit: item.businessUnit || null,
          description: item.description || null,
          submittedBy: item.submittedBy || req.user?.name || 'Bulk Import',
          currency: item.currency || null,
        },
        include: { lineItems: true },
      });
      created.push(invoice);
    }

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'INVOICES_BULK_IMPORTED', details: `${created.length} invoice(s) bulk imported, ${skipped.length} duplicate(s) skipped`, performedBy, userId: req.user?.id });

    res.status(201).json({ created, skipped });
  } catch (err) { next(err); }
});

// POST /api/invoices/match
router.post('/api/invoices/match', async (req, res, next) => {
  try {
    const hasAssignAll = req.userPermissions?.includes('invoices.assign_all');
    const results = await findMatches({
      restrictToUser: !hasAssignAll,
      userName: req.user?.name,
    });
    res.json(results);
  } catch (err) { next(err); }
});

export default router;
