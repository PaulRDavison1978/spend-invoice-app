import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// GET /api/spend-alerts — active (non-dismissed) alerts
router.get('/api/spend-alerts', async (req, res, next) => {
  try {
    const alerts = await prisma.spendAlert.findMany({
      where: { dismissedAt: null },
      include: {
        spendApproval: {
          select: {
            id: true,
            ref: true,
            title: true,
            department: true,
            approver: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(alerts);
  } catch (err) { next(err); }
});

// PATCH /api/spend-alerts/:id/dismiss
router.patch('/api/spend-alerts/:id/dismiss', async (req, res, next) => {
  try {
    const alert = await prisma.spendAlert.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    const updated = await prisma.spendAlert.update({
      where: { id: alert.id },
      data: { dismissedAt: new Date() },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({
      action: 'SPEND_ALERT_DISMISSED',
      details: `Spend alert ${alert.id} (${alert.threshold}) dismissed`,
      performedBy,
      userId: req.user?.id,
      metadata: { alertId: alert.id, spendApprovalId: alert.spendApprovalId, threshold: alert.threshold },
    });

    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
