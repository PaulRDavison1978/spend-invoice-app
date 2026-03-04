import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

const modelMap = {
  atoms:        { model: 'atom',          hasCode: true },
  'cost-centres': { model: 'costCentre',  hasCode: true },
  regions:      { model: 'region',        hasCode: true },
  currencies:   { model: 'currency',      hasCode: true, extra: ['exchangeRateToEur'] },
  categories:   { model: 'spendCategory', hasCode: false },
  functions:    { model: 'function',      hasCode: false, extra: ['approverId'] },
  projects:     { model: 'project',       hasCode: false, extra: ['description'] },
};

function getDelegate(type) {
  const config = modelMap[type];
  if (!config) return null;
  return { delegate: prisma[config.model], config };
}

// GET /api/lookups/:type
router.get('/api/lookups/:type', async (req, res, next) => {
  try {
    const result = getDelegate(req.params.type);
    if (!result) return res.status(400).json({ error: `Unknown lookup type: ${req.params.type}` });

    const { delegate, config } = result;

    // For functions, include the approver relation
    const include = config.model === 'function' ? { approver: { select: { id: true, name: true } } } : undefined;
    const items = await delegate.findMany({ orderBy: { id: 'asc' }, include });
    res.json(items);
  } catch (err) { next(err); }
});

// POST /api/lookups/:type
router.post('/api/lookups/:type', async (req, res, next) => {
  try {
    const result = getDelegate(req.params.type);
    if (!result) return res.status(400).json({ error: `Unknown lookup type: ${req.params.type}` });

    const { delegate, config } = result;
    const data = { name: req.body.name };
    if (config.hasCode) data.code = req.body.code;
    if (config.extra) {
      for (const field of config.extra) {
        if (req.body[field] !== undefined) data[field] = req.body[field];
      }
    }

    const item = await delegate.create({ data });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'LOOKUP_CREATED', details: `Created ${req.params.type} "${data.name}"`, performedBy, userId: req.user?.id });

    res.status(201).json(item);
  } catch (err) { next(err); }
});

// PATCH /api/lookups/:type/:id
router.patch('/api/lookups/:type/:id', async (req, res, next) => {
  try {
    const result = getDelegate(req.params.type);
    if (!result) return res.status(400).json({ error: `Unknown lookup type: ${req.params.type}` });

    const { delegate, config } = result;
    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (config.hasCode && req.body.code !== undefined) data.code = req.body.code;
    if (config.extra) {
      for (const field of config.extra) {
        if (req.body[field] !== undefined) data[field] = req.body[field];
      }
    }

    const item = await delegate.update({ where: { id: parseInt(req.params.id) }, data });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'LOOKUP_UPDATED', details: `Updated ${req.params.type} #${req.params.id}`, performedBy, userId: req.user?.id });

    res.json(item);
  } catch (err) { next(err); }
});

// PATCH /api/lookups/:type/:id/toggle
router.patch('/api/lookups/:type/:id/toggle', async (req, res, next) => {
  try {
    const result = getDelegate(req.params.type);
    if (!result) return res.status(400).json({ error: `Unknown lookup type: ${req.params.type}` });

    const { delegate } = result;
    const id = parseInt(req.params.id);
    const current = await delegate.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: 'Not found' });

    const item = await delegate.update({ where: { id }, data: { active: !current.active } });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'LOOKUP_TOGGLED', details: `Toggled ${req.params.type} #${id} to ${item.active ? 'active' : 'inactive'}`, performedBy, userId: req.user?.id });

    res.json(item);
  } catch (err) { next(err); }
});

export default router;
