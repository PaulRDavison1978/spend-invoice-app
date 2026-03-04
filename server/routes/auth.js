import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// POST /api/auth/callback — exchange token info, activate invited user
router.post('/api/auth/callback', async (req, res, next) => {
  try {
    const { email, oid, tid, name } = req.body;
    if (!email || !oid) return res.status(400).json({ error: 'email and oid are required' });

    // Look up user by email
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        role: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    });

    if (!user) {
      return res.status(403).json({ error: 'No invitation found for this email. Contact an administrator.' });
    }

    // If user is Pending, activate and link azure_oid
    if (user.status === 'Pending') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'Active',
          azureOid: oid,
          azureTenantId: tid || null,
          name: name || user.name,
        },
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
        },
      });

      await logAudit({ action: 'USER_ACTIVATED', details: `User ${user.email} activated via first Microsoft login`, performedBy: user.name, userId: user.id });
    } else if (!user.azureOid) {
      // Existing active user without azure_oid — link it
      user = await prisma.user.update({
        where: { id: user.id },
        data: { azureOid: oid, azureTenantId: tid || null },
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
        },
      });
    }

    if (user.status === 'Removed' || user.status === 'Anonymized') {
      return res.status(403).json({ error: 'Account has been deactivated' });
    }

    await logAudit({ action: 'USER_LOGIN', details: `User logged in via Microsoft with role: ${user.role.name}`, performedBy: user.name, userId: user.id });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions.map(rp => rp.permission.key),
      approvalLimit: user.approvalLimit,
      isCeo: user.isCeo,
    });
  } catch (err) { next(err); }
});

// GET /api/auth/me — get current user info from token
router.get('/api/auth/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role.name,
    permissions: req.userPermissions,
    approvalLimit: req.user.approvalLimit,
    isCeo: req.user.isCeo,
  });
});

// POST /api/auth/logout
router.post('/api/auth/logout', async (req, res) => {
  if (req.user) {
    await logAudit({ action: 'USER_LOGOUT', details: `User logged out`, performedBy: req.user.name, userId: req.user.id });
  }
  res.json({ success: true });
});

export default router;
