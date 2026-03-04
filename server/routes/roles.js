import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

// GET /api/roles
router.get('/api/roles', async (req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
      },
      orderBy: { id: 'asc' },
    });

    // Flatten permissions for frontend compatibility
    const result = roles.map(r => ({
      id: r.id,
      name: r.name,
      isDefault: r.isDefault,
      permissions: r.permissions.map(rp => rp.permission.key),
    }));

    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/roles
router.post('/api/roles', async (req, res, next) => {
  try {
    const { name, permissions = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const role = await prisma.role.create({ data: { name } });

    // Add permissions
    if (permissions.length > 0) {
      const perms = await prisma.permission.findMany({ where: { key: { in: permissions } } });
      await prisma.rolePermission.createMany({
        data: perms.map(p => ({ roleId: role.id, permissionId: p.id })),
      });
    }

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'ROLE_CREATED', details: `Created role "${name}"`, performedBy, userId: req.user?.id });

    res.status(201).json({ id: role.id, name: role.name, isDefault: role.isDefault, permissions });
  } catch (err) { next(err); }
});

// PATCH /api/roles/:id
router.patch('/api/roles/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { name, permissions } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;

    const role = await prisma.role.update({ where: { id }, data });

    // Replace permissions if provided
    if (permissions !== undefined) {
      await prisma.rolePermission.deleteMany({ where: { roleId: id } });

      if (permissions.length > 0) {
        const perms = await prisma.permission.findMany({ where: { key: { in: permissions } } });
        await prisma.rolePermission.createMany({
          data: perms.map(p => ({ roleId: id, permissionId: p.id })),
        });
      }
    }

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'ROLE_UPDATED', details: `Updated role "${role.name}"`, performedBy, userId: req.user?.id });

    res.json({ id: role.id, name: role.name, isDefault: role.isDefault, permissions: permissions || [] });
  } catch (err) { next(err); }
});

// DELETE /api/roles/:id
router.delete('/api/roles/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return res.status(404).json({ error: 'Role not found' });
    if (role.isDefault) return res.status(400).json({ error: 'Cannot delete a default role' });

    // Check if any users have this role
    const usersWithRole = await prisma.user.count({ where: { roleId: id } });
    if (usersWithRole > 0) return res.status(400).json({ error: 'Cannot delete a role that is assigned to users' });

    await prisma.role.delete({ where: { id } });

    const performedBy = req.user?.name || 'System';
    await logAudit({ action: 'ROLE_DELETED', details: `Deleted role "${role.name}"`, performedBy, userId: req.user?.id });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/permissions
router.get('/api/permissions', async (req, res, next) => {
  try {
    const permissions = await prisma.permission.findMany({ orderBy: { id: 'asc' } });
    res.json(permissions);
  } catch (err) { next(err); }
});

export default router;
