import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { logAudit } from '../services/auditService.js';
import { sendTemplateEmail } from '../services/emailService.js';

const router = Router();

// GET /api/users
router.get('/api/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: { select: { id: true, name: true } } },
      orderBy: { id: 'asc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

// POST /api/users/invite
router.post('/api/users/invite', async (req, res, next) => {
  try {
    const { email, roleId } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'User with this email already exists' });

    const role = roleId
      ? await prisma.role.findUnique({ where: { id: roleId } })
      : await prisma.role.findFirst({ where: { name: 'User' } });

    if (!role) return res.status(400).json({ error: 'Invalid role' });

    const user = await prisma.user.create({
      data: {
        name: email.split('@')[0],
        email,
        roleId: role.id,
        status: 'Pending',
        invitedBy: req.user?.name || 'System',
      },
      include: { role: { select: { id: true, name: true } } },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'USER_INVITED', details: `Invited ${email} with role ${role.name}`, performedBy, userId: req.user?.id });

    // Send welcome notification email (fire-and-forget)
    sendTemplateEmail('user_invited', email, {
      user_name: user.name,
      invited_by: performedBy,
      role_name: role.name,
    }, { performedBy, userId: req.user?.id });

    res.status(201).json(user);
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/role
router.patch('/api/users/:id/role', async (req, res, next) => {
  try {
    const { roleId } = req.body;
    if (!roleId) return res.status(400).json({ error: 'roleId is required' });

    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { roleId },
      include: { role: { select: { id: true, name: true } } },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'USER_ROLE_CHANGED', details: `Changed role for ${user.name} to ${user.role.name}`, performedBy, userId: req.user?.id });

    res.json(user);
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/remove
router.patch('/api/users/:id/remove', async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'Removed' },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'USER_REMOVED', details: `Removed user ${user.name} (${user.email})`, performedBy, userId: req.user?.id });

    res.json(user);
  } catch (err) { next(err); }
});

// POST /api/users/:id/anonymize
router.post('/api/users/:id/anonymize', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const anonymized = await prisma.user.update({
      where: { id },
      data: {
        name: `Anonymized User ${id}`,
        email: `anonymized-${id}@removed.local`,
        status: 'Anonymized',
        azureOid: null,
        azureTenantId: null,
      },
    });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'USER_ANONYMIZED', details: `Anonymized user #${id} (GDPR request)`, performedBy, userId: req.user?.id });

    res.json(anonymized);
  } catch (err) { next(err); }
});

export default router;
