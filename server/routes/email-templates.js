import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// GET /api/email-templates
router.get('/api/email-templates', async (req, res, next) => {
  try {
    const templates = await prisma.emailTemplate.findMany({ orderBy: { id: 'asc' } });
    res.json(templates);
  } catch (err) { next(err); }
});

// PATCH /api/email-templates/:id
router.patch('/api/email-templates/:id', async (req, res, next) => {
  try {
    const { name, subject, body, active } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (subject !== undefined) data.subject = subject;
    if (body !== undefined) data.body = body;
    if (active !== undefined) data.active = active;

    const template = await prisma.emailTemplate.update({
      where: { id: parseInt(req.params.id) },
      data,
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'EMAIL_TEMPLATE_UPDATED', details: `Updated email template "${template.key}"`, performedBy, userId: req.user?.id });

    res.json(template);
  } catch (err) { next(err); }
});

export default router;
