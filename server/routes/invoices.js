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
      department, description, submittedBy, fileName, fileUrl,
      supplierJson, customerJson, currency, lineItems,
    } = req.body;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        vendor,
        date,
        dueDate,
        amount: parseFloat(amount) || 0,
        taxAmount: parseFloat(taxAmount) || 0,
        department,
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
