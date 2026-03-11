import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { logAudit } from '../services/auditService.js';
import authorize from '../middleware/authorize.js';

const router = Router();

// Helper: check if user can access this budget (manage_all or own-function approver)
const canAccessBudget = async (req, budget) => {
  if (req.userPermissions?.includes('budget.manage_all')) return true;
  if (!req.userPermissions?.includes('budget.manage_own')) return false;
  const fn = await prisma.function.findUnique({ where: { id: budget.functionId } });
  return fn && fn.approverId === req.user.id;
};

// GET /api/budgets — list budgets (filtered by permission)
router.get('/api/budgets', authorize('budget.manage_all', 'budget.manage_own'), async (req, res, next) => {
  try {
    let where = {};
    if (!req.userPermissions?.includes('budget.manage_all')) {
      // Only show budgets for functions where user is the approver
      const userFunctions = await prisma.function.findMany({ where: { approverId: req.user.id }, select: { id: true } });
      where = { functionId: { in: userFunctions.map(f => f.id) } };
    }

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        function: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        lineItems: { select: { id: true, eurAnnual: true, spendApprovalId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Gather all linked spend approval IDs across all budgets
    const allSpendIds = [...new Set(budgets.flatMap(b => b.lineItems.filter(li => li.spendApprovalId).map(li => li.spendApprovalId)))];
    const invoiceTotals = {};
    if (allSpendIds.length > 0) {
      const invoices = await prisma.invoice.findMany({
        where: { spendApprovalId: { in: allSpendIds } },
        select: { spendApprovalId: true, amount: true, taxAmount: true },
      });
      invoices.forEach(inv => {
        const sid = inv.spendApprovalId;
        invoiceTotals[sid] = (invoiceTotals[sid] || 0) + parseFloat(inv.amount) + parseFloat(inv.taxAmount || 0);
      });
    }

    const result = budgets.map(b => {
      const totalEurAnnual = b.lineItems.reduce((sum, li) => sum + (parseFloat(li.eurAnnual) || 0), 0);
      const linkedItems = b.lineItems.filter(li => li.spendApprovalId);
      const totalSpent = linkedItems.reduce((sum, li) => sum + (invoiceTotals[li.spendApprovalId] || 0), 0);
      const linkedSpendTotal = linkedItems.reduce((sum, li) => sum + (parseFloat(li.eurAnnual) || 0), 0);
      return {
        ...b,
        totalEurAnnual,
        totalSpent,
        lineItemCount: b.lineItems.length,
        linkedCount: linkedItems.length,
        unlinkedCount: b.lineItems.length - linkedItems.length,
        linkedSpendTotal,
        variance: totalEurAnnual - totalSpent,
        lineItems: undefined,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/budgets/:id — single budget with all line items
router.get('/api/budgets/:id', authorize('budget.manage_all', 'budget.manage_own'), async (req, res, next) => {
  try {
    const budget = await prisma.budget.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        function: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        lineItems: {
          include: {
            spendApproval: {
              select: {
                id: true, ref: true, title: true, currency: true, amount: true,
                invoices: {
                  select: { id: true, amount: true, taxAmount: true, date: true, currency: true, monthlyCosts: true },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    if (!await canAccessBudget(req, budget)) return res.status(403).json({ error: 'Access denied' });

    // Find approved SAs NOT linked to any budget line item in this budget (out-of-budget / inflation)
    const linkedSaIds = budget.lineItems
      .filter(li => li.spendApprovalId)
      .map(li => li.spendApprovalId);

    const unbudgetedSAs = await prisma.spendApproval.findMany({
      where: {
        status: { in: ['Approved', 'Partially Invoiced', 'Fully Invoiced'] },
        inBudget: false,
        id: { notIn: linkedSaIds.length > 0 ? linkedSaIds : [0] },
      },
      select: {
        id: true, ref: true, title: true, vendor: true, category: true,
        currency: true, amount: true, businessUnit: true, costCentre: true,
        region: true, status: true, submittedAt: true,
        invoices: {
          select: { id: true, amount: true, taxAmount: true, date: true, currency: true, monthlyCosts: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    res.json({ ...budget, unbudgetedSAs });
  } catch (err) { next(err); }
});

// POST /api/budgets — create a new budget
router.post('/api/budgets', authorize('budget.manage_all', 'budget.manage_own'), async (req, res, next) => {
  try {
    const { title, year, functionId } = req.body;
    if (!title || !year || !functionId) return res.status(400).json({ error: 'title, year, and functionId are required' });

    const fnId = parseInt(functionId);
    // Check permission for this function
    if (!req.userPermissions?.includes('budget.manage_all')) {
      const fn = await prisma.function.findUnique({ where: { id: fnId } });
      if (!fn || fn.approverId !== req.user.id) return res.status(403).json({ error: 'You can only create budgets for your own functions' });
    }

    const budget = await prisma.budget.create({
      data: { title, year: parseInt(year), functionId: fnId, createdById: req.user.id },
      include: { function: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
    });

    await logAudit({ action: 'BUDGET_CREATED', details: `Budget "${title}" created for ${budget.function.name} (${year})`, performedBy: req.user.name, userId: req.user.id });

    res.status(201).json({ ...budget, totalEurAnnual: 0, lineItemCount: 0 });
  } catch (err) { next(err); }
});

// PATCH /api/budgets/:id — update budget title/year (only if Draft)
router.patch('/api/budgets/:id', authorize('budget.manage_all', 'budget.manage_own'), async (req, res, next) => {
  try {
    const budget = await prisma.budget.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    if (budget.status !== 'Draft') return res.status(400).json({ error: 'Cannot edit a submitted budget' });
    if (!await canAccessBudget(req, budget)) return res.status(403).json({ error: 'Access denied' });

    const { title, year } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (year !== undefined) data.year = parseInt(year);

    const updated = await prisma.budget.update({
      where: { id: budget.id },
      data,
      include: { function: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
    });

    await logAudit({ action: 'BUDGET_UPDATED', details: `Budget "${updated.title}" updated`, performedBy: req.user.name, userId: req.user.id });

    res.json(updated);
  } catch (err) { next(err); }
});

// POST /api/budgets/:id/submit — submit (lock) the budget
router.post('/api/budgets/:id/submit', authorize('budget.manage_all', 'budget.manage_own'), async (req, res, next) => {
  try {
    const budget = await prisma.budget.findUnique({ where: { id: parseInt(req.params.id) }, include: { lineItems: true } });
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    if (budget.status !== 'Draft') return res.status(400).json({ error: 'Budget is already submitted' });
    if (!await canAccessBudget(req, budget)) return res.status(403).json({ error: 'Access denied' });
    if (budget.lineItems.length === 0) return res.status(400).json({ error: 'Cannot submit a budget with no line items' });

    const updated = await prisma.budget.update({
      where: { id: budget.id },
      data: { status: 'Submitted', submittedAt: new Date() },
      include: { function: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
    });

    await logAudit({ action: 'BUDGET_SUBMITTED', details: `Budget "${updated.title}" submitted with ${budget.lineItems.length} line items`, performedBy: req.user.name, userId: req.user.id });

    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/budgets/:id — delete a draft budget
router.delete('/api/budgets/:id', authorize('budget.manage_all', 'budget.manage_own'), async (req, res, next) => {
  try {
    const budget = await prisma.budget.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    if (budget.status !== 'Draft') return res.status(400).json({ error: 'Cannot delete a submitted budget' });
    if (!await canAccessBudget(req, budget)) return res.status(403).json({ error: 'Access denied' });

    await prisma.budget.delete({ where: { id: budget.id } });

    await logAudit({ action: 'BUDGET_DELETED', details: `Budget "${budget.title}" deleted`, performedBy: req.user.name, userId: req.user.id });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- Budget Line Items ---

// POST /api/budgets/:id/line-items — add line item(s) to a budget
router.post('/api/budgets/:id/line-items', authorize('budget.manage_all', 'budget.manage_own'), async (req, res, next) => {
  try {
    const budget = await prisma.budget.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    if (budget.status !== 'Draft') return res.status(400).json({ error: 'Cannot add lines to a submitted budget' });
    if (!await canAccessBudget(req, budget)) return res.status(403).json({ error: 'Access denied' });

    const items = Array.isArray(req.body) ? req.body : [req.body];
    const created = [];
    for (const item of items) {
      const li = await prisma.budgetLineItem.create({
        data: {
          budgetId: budget.id,
          type: item.type || 'BAU',
          department: item.department || null,
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
        },
      });
      created.push(li);
    }

    await logAudit({ action: 'BUDGET_LINES_ADDED', details: `${created.length} line item(s) added to budget "${budget.title}"`, performedBy: req.user.name, userId: req.user.id });

    res.status(201).json(created);
  } catch (err) { next(err); }
});

// PATCH /api/budgets/:budgetId/line-items/:lineId — update a line item
router.patch('/api/budgets/:budgetId/line-items/:lineId', authorize('budget.manage_all', 'budget.manage_own'), async (req, res, next) => {
  try {
    const budget = await prisma.budget.findUnique({ where: { id: parseInt(req.params.budgetId) } });
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    if (!await canAccessBudget(req, budget)) return res.status(403).json({ error: 'Access denied' });

    const lineId = parseInt(req.params.lineId);
    const existing = await prisma.budgetLineItem.findUnique({ where: { id: lineId } });
    if (!existing || existing.budgetId !== budget.id) return res.status(404).json({ error: 'Line item not found in this budget' });

    // Allow spendApprovalId linking on any status; other edits require Draft
    const onlyLinkingSA = Object.keys(req.body).length === 1 && req.body.spendApprovalId !== undefined;
    if (budget.status !== 'Draft' && !onlyLinkingSA) return res.status(400).json({ error: 'Cannot edit lines in a submitted budget' });

    const data = {};
    const fields = ['type','department','businessUnit','serviceCategory','licence','project','costCentre','comments','region','vendor','contractEndDate','currency','monthlyBudget','spendApprovalId'];
    for (const f of fields) { if (req.body[f] !== undefined) data[f] = req.body[f]; }
    if (req.body.contractValue !== undefined) data.contractValue = req.body.contractValue ? parseFloat(req.body.contractValue) : null;
    if (req.body.eurAnnual !== undefined) data.eurAnnual = req.body.eurAnnual ? parseFloat(req.body.eurAnnual) : null;

    const updated = await prisma.budgetLineItem.update({ where: { id: lineId }, data });

    await logAudit({ action: 'BUDGET_LINE_UPDATED', details: `Line item "${updated.licence}" updated in budget "${budget.title}"`, performedBy: req.user.name, userId: req.user.id });

    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/budgets/:budgetId/line-items/:lineId — remove a line item
router.delete('/api/budgets/:budgetId/line-items/:lineId', authorize('budget.manage_all', 'budget.manage_own'), async (req, res, next) => {
  try {
    const budget = await prisma.budget.findUnique({ where: { id: parseInt(req.params.budgetId) } });
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    if (budget.status !== 'Draft') return res.status(400).json({ error: 'Cannot delete lines from a submitted budget' });
    if (!await canAccessBudget(req, budget)) return res.status(403).json({ error: 'Access denied' });

    const lineId = parseInt(req.params.lineId);
    const existing = await prisma.budgetLineItem.findUnique({ where: { id: lineId } });
    if (!existing || existing.budgetId !== budget.id) return res.status(404).json({ error: 'Line item not found in this budget' });

    await prisma.budgetLineItem.delete({ where: { id: lineId } });

    await logAudit({ action: 'BUDGET_LINE_DELETED', details: `Line item "${existing.licence}" removed from budget "${budget.title}"`, performedBy: req.user.name, userId: req.user.id });

    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
