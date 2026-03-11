import { Router } from 'express';
import prisma from '../lib/prisma.js';
import authorize from '../middleware/authorize.js';

const router = Router();

// GET /api/audit-logs
router.get('/api/audit-logs', authorize('settings.manage_users', 'settings.view_lookups'), async (req, res, next) => {
  try {
    const { action, search, dateFrom, dateTo, limit = '100', offset = '0' } = req.query;

    const where = {};

    if (action && action !== 'all') {
      where.action = action;
    }

    if (search) {
      where.OR = [
        { details: { contains: search, mode: 'insensitive' } },
        { performedBy: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where.performedAt = {};
      if (dateFrom) where.performedAt.gte = new Date(dateFrom);
      if (dateTo) where.performedAt.lte = new Date(dateTo + 'T23:59:59Z');
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        take: Math.max(1, Math.min(parseInt(limit, 10) || 50, 500)),
        skip: Math.max(0, parseInt(offset, 10) || 0),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total });
  } catch (err) { next(err); }
});

export default router;
