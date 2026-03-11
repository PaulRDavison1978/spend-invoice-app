import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { logAudit } from '../services/auditService.js';
import authorize from '../middleware/authorize.js';

const router = Router();

const modelMap = {
  atoms:        { model: 'atom',          hasCode: true },
  'cost-centres': { model: 'costCentre',  hasCode: true },
  regions:      { model: 'region',        hasCode: true },
  currencies:   { model: 'currency',      hasCode: true, extra: ['exchangeRateToEur'] },
  categories:   { model: 'spendCategory', hasCode: false },
  functions:    { model: 'function',      hasCode: false, extra: ['approverId'] },
  projects:     { model: 'project',       hasCode: false, extra: ['description'] },
  'business-units': { model: 'businessUnit', hasCode: false },
};

function getDelegate(type) {
  const config = modelMap[type];
  if (!config) return null;
  return { delegate: prisma[config.model], config };
}

// GET /api/lookups/:type
router.get('/api/lookups/:type', authorize('settings.view_lookups', 'settings.manage_lookups'), async (req, res, next) => {
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
router.post('/api/lookups/:type', authorize('settings.manage_lookups'), async (req, res, next) => {
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

    const include = config.model === 'function' ? { approver: { select: { id: true, name: true } } } : undefined;
    const item = await delegate.create({ data, include });

    const performedBy = req.user?.name || 'System';
    const label = config.hasCode && item.code ? `${item.code} — ${item.name}` : item.name;
    await logAudit({ action: `${req.params.type.toUpperCase().replace(/-/g, '_')}_CREATED`, details: `Created ${req.params.type}: ${label}`, performedBy, userId: req.user?.id });

    res.status(201).json(item);
  } catch (err) { next(err); }
});

// PATCH /api/lookups/:type/:id
router.patch('/api/lookups/:type/:id', authorize('settings.manage_lookups'), async (req, res, next) => {
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

    const include = config.model === 'function' ? { approver: { select: { id: true, name: true } } } : undefined;
    const item = await delegate.update({ where: { id: parseInt(req.params.id) }, data, include });

    const performedBy = req.user?.name || 'System';
    const label = config.hasCode && item.code ? `${item.code} — ${item.name}` : item.name;
    await logAudit({ action: `${req.params.type.toUpperCase().replace(/-/g, '_')}_UPDATED`, details: `Updated ${req.params.type}: ${label}`, performedBy, userId: req.user?.id });

    res.json(item);
  } catch (err) { next(err); }
});

// PATCH /api/lookups/:type/:id/toggle
router.patch('/api/lookups/:type/:id/toggle', authorize('settings.manage_lookups'), async (req, res, next) => {
  try {
    const result = getDelegate(req.params.type);
    if (!result) return res.status(400).json({ error: `Unknown lookup type: ${req.params.type}` });

    const { delegate } = result;
    const id = parseInt(req.params.id);
    const current = await delegate.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: 'Not found' });

    const item = await delegate.update({ where: { id }, data: { active: !current.active } });

    const performedBy = req.user?.name || 'System';
    const label = item.code ? `${item.code} — ${item.name}` : item.name;
    await logAudit({ action: `${req.params.type.toUpperCase().replace(/-/g, '_')}_${item.active ? 'ACTIVATED' : 'DEACTIVATED'}`, details: `${item.active ? 'Activated' : 'Deactivated'} ${req.params.type}: ${label}`, performedBy, userId: req.user?.id });

    res.json(item);
  } catch (err) { next(err); }
});

export default router;
