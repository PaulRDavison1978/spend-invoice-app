import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

// GET /api/audit-logs
router.get('/api/audit-logs', async (req, res, next) => {
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
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total });
  } catch (err) { next(err); }
});

export default router;
