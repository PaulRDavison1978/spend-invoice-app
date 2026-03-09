import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// GET /api/budget-lines
router.get('/api/budget-lines', async (req, res, next) => {
  try {
    const lines = await prisma.budgetLineItem.findMany({
      include: {
        spendApproval: { select: { id: true, ref: true, title: true, amount: true, currency: true, status: true } },
      },
      orderBy: { id: 'asc' },
    });
    res.json(lines);
  } catch (err) { next(err); }
});

// POST /api/budget-lines  (single or bulk)
router.post('/api/budget-lines', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const created = await prisma.budgetLineItem.createMany({
      data: items.map(item => ({
        type: item.type || 'BAU',
        businessUnit: item.businessUnit || null,
        serviceCategory: item.serviceCategory || null,
        licence: item.licence,
        project: item.project || null,
        costCentre: item.costCentre || null,
        comments: item.comments || null,
        region: item.region || null,
        vendor: item.vendor || null,
        contractEndDate: item.contractEndDate || null,
        contractValue: item.contractValue ? parseFloat(item.contractValue) : null,
        currency: item.currency || null,
        eurAnnual: item.eurAnnual ? parseFloat(item.eurAnnual) : null,
        monthlyBudget: item.monthlyBudget || null,
        spendApprovalId: item.spendApprovalId || null,
      })),
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'BUDGET_LINES_IMPORTED', details: `${created.count} budget line item(s) imported`, performedBy, userId: req.user?.id });

    res.status(201).json({ count: created.count });
  } catch (err) { next(err); }
});

// PATCH /api/budget-lines/:id/link  — link to spend approval
router.patch('/api/budget-lines/:id/link', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { spendApprovalId } = req.body;
    if (!spendApprovalId) return res.status(400).json({ error: 'spendApprovalId is required' });

    const line = await prisma.budgetLineItem.update({
      where: { id },
      data: { spendApprovalId },
      include: { spendApproval: { select: { id: true, ref: true, title: true } } },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'BUDGET_LINE_LINKED', details: `Budget line "${line.licence}" linked to ${line.spendApproval?.ref}`, performedBy, userId: req.user?.id });

    res.json(line);
  } catch (err) { next(err); }
});

// PATCH /api/budget-lines/:id/unlink  — remove from spend approval
router.patch('/api/budget-lines/:id/unlink', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const line = await prisma.budgetLineItem.update({
      where: { id },
      data: { spendApprovalId: null },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'BUDGET_LINE_UNLINKED', details: `Budget line "${line.licence}" unlinked`, performedBy, userId: req.user?.id });

    res.json(line);
  } catch (err) { next(err); }
});

// POST /api/budget-lines/bulk-link  — link multiple lines to a spend approval
router.post('/api/budget-lines/bulk-link', async (req, res, next) => {
  try {
    const { ids, spendApprovalId } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !spendApprovalId) {
      return res.status(400).json({ error: 'ids array and spendApprovalId are required' });
    }

    await prisma.budgetLineItem.updateMany({
      where: { id: { in: ids } },
      data: { spendApprovalId },
    });

    const performedBy = req.user?.name || 'System';
    const sp = await prisma.spendApproval.findUnique({ where: { id: spendApprovalId }, select: { ref: true } });
    await logAudit({ action: 'BUDGET_LINES_BULK_LINKED', details: `${ids.length} budget line(s) linked to ${sp?.ref}`, performedBy, userId: req.user?.id });

    res.json({ success: true, count: ids.length });
  } catch (err) { next(err); }
});

// DELETE /api/budget-lines/:id
router.delete('/api/budget-lines/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.budgetLineItem.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/budget-report  — Budget vs Spend Approval vs Actuals
router.get('/api/budget-report', async (req, res, next) => {
  try {
    const budgetIdFilter = req.query.budgetId ? parseInt(req.query.budgetId) : null;
    const budgetLineWhere = budgetIdFilter ? { budgetId: budgetIdFilter } : {};

    // 1. Get all budget lines (including unlinked ones)
    const allBudgetLines = await prisma.budgetLineItem.findMany({
      where: budgetLineWhere,
      include: {
        spendApproval: {
          select: { id: true, ref: true, title: true, vendor: true, department: true, category: true, region: true, currency: true, status: true, amount: true },
        },
      },
    });

    // 2. Get invoices for linked spend approvals
    const linkedSpendIds = [...new Set(allBudgetLines.filter(bl => bl.spendApprovalId).map(bl => bl.spendApprovalId))];
    const invoicesBySpend = {};
    if (linkedSpendIds.length > 0) {
      const invoices = await prisma.invoice.findMany({
        where: { spendApprovalId: { in: linkedSpendIds } },
        select: { id: true, amount: true, taxAmount: true, date: true, spendApprovalId: true },
      });
      invoices.forEach(inv => {
        if (!invoicesBySpend[inv.spendApprovalId]) invoicesBySpend[inv.spendApprovalId] = [];
        invoicesBySpend[inv.spendApprovalId].push(inv);
      });
    }

    // 3. Group budget lines by spend approval (null key = unlinked)
    const grouped = {};
    allBudgetLines.forEach(bl => {
      const key = bl.spendApprovalId || 'unlinked';
      if (!grouped[key]) grouped[key] = { lines: [], spend: bl.spendApproval };
      grouped[key].lines.push(bl);
    });

    // 4. Build report rows
    const rows = Object.entries(grouped).map(([key, { lines, spend }]) => {
      const budgetEur = lines.reduce((sum, bl) => sum + (parseFloat(bl.eurAnnual) || 0), 0);
      const monthlyBudgets = {};
      lines.forEach(bl => {
        if (bl.monthlyBudget && typeof bl.monthlyBudget === 'object') {
          for (const [month, val] of Object.entries(bl.monthlyBudget)) {
            monthlyBudgets[month] = (monthlyBudgets[month] || 0) + (parseFloat(val) || 0);
          }
        }
      });

      const invoices = key !== 'unlinked' ? (invoicesBySpend[parseInt(key)] || []) : [];
      const approvedEur = spend ? parseFloat(spend.amount) || 0 : 0;
      const invoicedEur = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount) + parseFloat(inv.taxAmount), 0);

      const monthlyActuals = {};
      invoices.forEach(inv => {
        const m = (inv.date || '').slice(0, 7);
        if (m) monthlyActuals[m] = (monthlyActuals[m] || 0) + parseFloat(inv.amount) + parseFloat(inv.taxAmount);
      });

      if (spend) {
        return {
          spendId: spend.id,
          ref: spend.ref,
          title: spend.title,
          vendor: spend.vendor,
          department: spend.department,
          category: spend.category,
          region: spend.region,
          currency: spend.currency,
          status: spend.status,
          budgetEur, approvedEur, invoicedEur,
          variance: budgetEur - invoicedEur,
          budgetLineCount: lines.length,
          invoiceCount: invoices.length,
          monthlyBudgets, monthlyActuals,
        };
      }

      // Unlinked budget lines — group as a single row
      return {
        spendId: null,
        ref: 'Unlinked',
        title: `${lines.length} unlinked budget line${lines.length !== 1 ? 's' : ''}`,
        vendor: '',
        department: '',
        category: '',
        region: '',
        currency: 'EUR',
        status: 'N/A',
        budgetEur, approvedEur: 0, invoicedEur: 0,
        variance: budgetEur,
        budgetLineCount: lines.length,
        invoiceCount: 0,
        monthlyBudgets, monthlyActuals: {},
      };
    });

    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
