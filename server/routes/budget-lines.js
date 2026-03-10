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

// GET /api/budget-report  — Budget compliance: Budget vs SA Approved vs Actuals
router.get('/api/budget-report', async (req, res, next) => {
  try {
    const budgetIdFilter = req.query.budgetId ? parseInt(req.query.budgetId) : null;

    // 0. Load currency exchange rates for EUR conversion
    const currencies = await prisma.currency.findMany();
    const rateMap = {};
    currencies.forEach(c => { rateMap[c.code] = parseFloat(c.exchangeRateToEur) || 1; });
    const toEur = (amount, currency) => {
      if (!currency || currency === 'EUR') return amount;
      const rate = rateMap[currency];
      return rate ? amount * rate : amount;
    };

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // 1. Get all budgets with their line items and linked spend approvals + invoices
    const budgetWhere = budgetIdFilter ? { id: budgetIdFilter } : {};
    const allBudgets = await prisma.budget.findMany({
      where: budgetWhere,
      include: {
        function: { select: { name: true } },
        lineItems: {
          include: {
            spendApproval: {
              select: {
                id: true, ref: true, currency: true, amount: true, status: true,
                invoices: { select: { id: true, amount: true, taxAmount: true, date: true, currency: true, monthlyCosts: true } },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    // 2. Build one row per budget
    const rows = allBudgets.map(budget => {
      const budgetEur = budget.lineItems.reduce((sum, bl) => sum + (parseFloat(bl.eurAnnual) || 0), 0);

      // Monthly budgets from line items
      const monthlyBudgets = {};
      budget.lineItems.forEach(bl => {
        if (bl.monthlyBudget && typeof bl.monthlyBudget === 'object') {
          for (const [month, val] of Object.entries(bl.monthlyBudget)) {
            monthlyBudgets[month] = (monthlyBudgets[month] || 0) + (parseFloat(val) || 0);
          }
        }
      });

      // Collect unique linked spend approvals (avoid double-counting)
      const seenSpendIds = new Set();
      let approvedEur = 0;
      let invoicedEur = 0;
      const monthlyActuals = {};

      budget.lineItems.forEach(bl => {
        if (!bl.spendApproval || seenSpendIds.has(bl.spendApproval.id)) return;
        seenSpendIds.add(bl.spendApproval.id);

        const sp = bl.spendApproval;
        approvedEur += toEur(parseFloat(sp.amount) || 0, sp.currency);

        (sp.invoices || []).forEach(inv => {
          const total = toEur(parseFloat(inv.amount) + parseFloat(inv.taxAmount), inv.currency);
          invoicedEur += total;

          if (inv.monthlyCosts && inv.monthlyCosts.length > 0) {
            inv.monthlyCosts.forEach(mc => {
              monthlyActuals[mc.month] = (monthlyActuals[mc.month] || 0) + toEur(parseFloat(mc.amount), inv.currency);
            });
          } else {
            const dateStr = inv.date || '';
            const monthIdx = dateStr ? parseInt(dateStr.slice(5, 7), 10) - 1 : -1;
            const mName = monthIdx >= 0 ? MONTH_NAMES[monthIdx] : null;
            if (mName) monthlyActuals[mName] = (monthlyActuals[mName] || 0) + total;
          }
        });
      });

      return {
        budgetId: budget.id,
        title: budget.title,
        year: budget.year,
        functionName: budget.function?.name || '',
        status: budget.status,
        budgetEur,
        approvedEur,
        invoicedEur,
        variance: budgetEur - invoicedEur,
        budgetLineCount: budget.lineItems.length,
        linkedSpendCount: seenSpendIds.size,
        monthlyBudgets,
        monthlyActuals,
      };
    });

    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
