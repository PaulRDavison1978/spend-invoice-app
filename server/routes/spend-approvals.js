import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { logAudit } from '../services/auditService.js';
import { sendTemplateEmail } from '../services/emailService.js';

const router = Router();

// GET /api/spend-approvals
router.get('/api/spend-approvals', async (req, res, next) => {
  try {
    const spends = await prisma.spendApproval.findMany({
      include: {
        approver: { select: { id: true, name: true } },
        invoices: { select: { id: true, invoiceNumber: true, amount: true } },
      },
      orderBy: { id: 'asc' },
    });
    res.json(spends);
  } catch (err) { next(err); }
});

// POST /api/spend-approvals
router.post('/api/spend-approvals', async (req, res, next) => {
  try {
    const {
      ref, department, title, currency, amount, category, vendor,
      costCentre, atom, region, project, approverId,
      submittedBy, exceptional, timeSensitive, justification, ccRecipients,
    } = req.body;

    // Escalation logic: if approver has a limit and amount exceeds it and approver is not CEO
    let status = 'Pending';
    if (approverId) {
      const approver = await prisma.user.findUnique({ where: { id: approverId } });
      if (approver && approver.approvalLimit > 0 && parseFloat(amount) > parseFloat(approver.approvalLimit) && !approver.isCeo) {
        status = 'Escalated';
      }
    }

    const spend = await prisma.spendApproval.create({
      data: {
        ref,
        department,
        title,
        currency,
        amount: parseFloat(amount) || 0,
        category,
        vendor,
        costCentre,
        atom,
        region,
        project,
        approverId,
        status,
        submittedBy: submittedBy || req.user?.name || 'Unknown',
        exceptional: exceptional || 'No',
        timeSensitive: timeSensitive || false,
        justification,
        ccRecipients: ccRecipients || null,
      },
      include: { approver: { select: { id: true, name: true } } },
    });

    const performedBy = req.user?.name || submittedBy || 'System';
    await logAudit({ action: 'SPEND_CREATED', details: `Spend approval "${title}" (${ref}) created — ${currency} ${amount}`, performedBy, userId: req.user?.id });

    // Notify approver via email (fire-and-forget), CC additional recipients
    const ccEmails = ccRecipients ? ccRecipients.split(',').map(e => e.trim()).filter(Boolean) : [];
    if (approverId) {
      const approver = spend.approver || await prisma.user.findUnique({ where: { id: approverId } });
      if (approver?.email) {
        sendTemplateEmail('new_spend_approval', approver.email, {
          approver_name: approver.name,
          spend_ref: ref,
          spend_title: title,
          vendor: vendor || '',
          currency: currency || '',
          amount: String(amount),
          submitted_by: spend.submittedBy,
          submitted_date: new Date().toISOString().split('T')[0],
        }, { performedBy, userId: req.user?.id, cc: ccEmails });
      }
    }

    res.status(201).json(spend);
  } catch (err) { next(err); }
});

// GET /api/spend-approvals/:id
router.get('/api/spend-approvals/:id', async (req, res, next) => {
  try {
    const spend = await prisma.spendApproval.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        approver: { select: { id: true, name: true } },
        invoices: { select: { id: true, invoiceNumber: true, amount: true, vendor: true } },
      },
    });
    if (!spend) return res.status(404).json({ error: 'Spend approval not found' });
    res.json(spend);
  } catch (err) { next(err); }
});

// PUT /api/spend-approvals/:id
router.put('/api/spend-approvals/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.spendApproval.findUnique({ where: { id }, include: { approver: { select: { id: true, name: true, email: true } } } });
    if (!existing) return res.status(404).json({ error: 'Spend approval not found' });
    if (existing.status !== 'Pending') return res.status(400).json({ error: 'Only pending spend approvals can be updated' });

    const {
      title, amount, vendor, category, ccRecipients, justification,
      costCentre, atom, region, project, exceptional, timeSensitive, department, currency,
    } = req.body;

    const updated = await prisma.spendApproval.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(amount !== undefined && { amount: parseFloat(amount) || 0 }),
        ...(vendor !== undefined && { vendor }),
        ...(category !== undefined && { category }),
        ...(ccRecipients !== undefined && { ccRecipients }),
        ...(justification !== undefined && { justification }),
        ...(costCentre !== undefined && { costCentre }),
        ...(atom !== undefined && { atom }),
        ...(region !== undefined && { region }),
        ...(project !== undefined && { project }),
        ...(exceptional !== undefined && { exceptional }),
        ...(timeSensitive !== undefined && { timeSensitive }),
        ...(department !== undefined && { department }),
        ...(currency !== undefined && { currency }),
      },
      include: { approver: { select: { id: true, name: true, email: true } } },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'SPEND_UPDATED', details: `Spend approval "${updated.title}" (${updated.ref}) updated`, performedBy, userId: req.user?.id });

    // Notify approver + CC of changes (fire-and-forget)
    const ccEmails = updated.ccRecipients ? updated.ccRecipients.split(',').map(e => e.trim()).filter(Boolean) : [];
    if (updated.approver?.email) {
      sendTemplateEmail('spend_approval_changed', updated.approver.email, {
        approver_name: updated.approver.name,
        spend_ref: updated.ref,
        spend_title: updated.title,
        vendor: updated.vendor || '',
        currency: updated.currency || '',
        amount: String(updated.amount),
        submitted_by: updated.submittedBy,
        changed_by: performedBy,
        changed_date: new Date().toISOString().split('T')[0],
      }, { performedBy, userId: req.user?.id, cc: ccEmails });
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH /api/spend-approvals/:id/approve
router.patch('/api/spend-approvals/:id/approve', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const spend = await prisma.spendApproval.findUnique({ where: { id } });
    if (!spend) return res.status(404).json({ error: 'Spend approval not found' });

    const updated = await prisma.spendApproval.update({
      where: { id },
      data: { status: 'Approved' },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'SPEND_APPROVED', details: `Spend approval "${spend.title}" (${spend.ref}) approved`, performedBy, userId: req.user?.id });

    // Notify submitter of approval (fire-and-forget)
    if (spend.submittedBy) {
      const submitter = await prisma.user.findFirst({ where: { name: spend.submittedBy } });
      if (submitter?.email) {
        sendTemplateEmail('spend_approval_decision', submitter.email, {
          submitted_by: spend.submittedBy,
          decision: 'Approved',
          spend_ref: spend.ref,
          spend_title: spend.title,
          vendor: spend.vendor || '',
          currency: spend.currency || '',
          amount: String(spend.amount),
          decision_date: new Date().toISOString().split('T')[0],
          approver_name: performedBy,
        }, { performedBy, userId: req.user?.id });
      }
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH /api/spend-approvals/:id/reject
router.patch('/api/spend-approvals/:id/reject', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const spend = await prisma.spendApproval.findUnique({ where: { id } });
    if (!spend) return res.status(404).json({ error: 'Spend approval not found' });

    const updated = await prisma.spendApproval.update({
      where: { id },
      data: { status: 'Rejected' },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'SPEND_REJECTED', details: `Spend approval "${spend.title}" (${spend.ref}) rejected`, performedBy, userId: req.user?.id });

    // Notify submitter of rejection (fire-and-forget)
    if (spend.submittedBy) {
      const submitter = await prisma.user.findFirst({ where: { name: spend.submittedBy } });
      if (submitter?.email) {
        sendTemplateEmail('spend_approval_decision', submitter.email, {
          submitted_by: spend.submittedBy,
          decision: 'Rejected',
          spend_ref: spend.ref,
          spend_title: spend.title,
          vendor: spend.vendor || '',
          currency: spend.currency || '',
          amount: String(spend.amount),
          decision_date: new Date().toISOString().split('T')[0],
          approver_name: performedBy,
        }, { performedBy, userId: req.user?.id });
      }
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// POST /api/spend-approvals/bulk-approve
router.post('/api/spend-approvals/bulk-approve', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });

    await prisma.spendApproval.updateMany({
      where: { id: { in: ids } },
      data: { status: 'Approved' },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'SPEND_BULK_APPROVED', details: `Bulk approved ${ids.length} spend approvals`, performedBy, userId: req.user?.id });

    // Notify each submitter of approval (fire-and-forget)
    const approvedSpends = await prisma.spendApproval.findMany({ where: { id: { in: ids } } });
    for (const spend of approvedSpends) {
      if (spend.submittedBy) {
        const submitter = await prisma.user.findFirst({ where: { name: spend.submittedBy } });
        if (submitter?.email) {
          sendTemplateEmail('spend_approval_decision', submitter.email, {
            submitted_by: spend.submittedBy,
            decision: 'Approved',
            spend_ref: spend.ref,
            spend_title: spend.title,
            vendor: spend.vendor || '',
            currency: spend.currency || '',
            amount: String(spend.amount),
            decision_date: new Date().toISOString().split('T')[0],
            approver_name: performedBy,
          }, { performedBy, userId: req.user?.id });
        }
      }
    }

    res.json({ success: true, count: ids.length });
  } catch (err) { next(err); }
});

// POST /api/spend-approvals/bulk-reject
router.post('/api/spend-approvals/bulk-reject', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });

    await prisma.spendApproval.updateMany({
      where: { id: { in: ids } },
      data: { status: 'Rejected' },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'SPEND_BULK_REJECTED', details: `Bulk rejected ${ids.length} spend approvals`, performedBy, userId: req.user?.id });

    // Notify each submitter of rejection (fire-and-forget)
    const rejectedSpends = await prisma.spendApproval.findMany({ where: { id: { in: ids } } });
    for (const spend of rejectedSpends) {
      if (spend.submittedBy) {
        const submitter = await prisma.user.findFirst({ where: { name: spend.submittedBy } });
        if (submitter?.email) {
          sendTemplateEmail('spend_approval_decision', submitter.email, {
            submitted_by: spend.submittedBy,
            decision: 'Rejected',
            spend_ref: spend.ref,
            spend_title: spend.title,
            vendor: spend.vendor || '',
            currency: spend.currency || '',
            amount: String(spend.amount),
            decision_date: new Date().toISOString().split('T')[0],
            approver_name: performedBy,
          }, { performedBy, userId: req.user?.id });
        }
      }
    }

    res.json({ success: true, count: ids.length });
  } catch (err) { next(err); }
});

export default router;
