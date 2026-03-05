import { Router } from 'express';
import prisma from '../lib/prisma.js';
import authorize from '../middleware/authorize.js';
import { encrypt, decrypt, mask } from '../services/cryptoService.js';
import { logAudit } from '../services/auditService.js';

const router = Router();
const API_KEY_SETTING = 'anthropic_api_key';

// GET /api/settings/api-key
router.get(
  '/api/settings/api-key',
  authorize('settings.manage_users'),
  async (req, res, next) => {
    try {
      const setting = await prisma.appSetting.findUnique({ where: { key: API_KEY_SETTING } });

      if (!setting) {
        return res.json({ configured: false, maskedKey: null, updatedAt: null });
      }

      let maskedKey = '****';
      try {
        const plainKey = setting.encrypted ? decrypt(setting.value) : setting.value;
        maskedKey = mask(plainKey);
      } catch {
        maskedKey = '(decryption failed)';
      }

      res.json({ configured: true, maskedKey, updatedAt: setting.updatedAt });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/settings/api-key
router.put(
  '/api/settings/api-key',
  authorize('settings.manage_users'),
  async (req, res, next) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        return res.status(400).json({ error: 'apiKey is required' });
      }

      const encryptedValue = encrypt(apiKey.trim());

      await prisma.appSetting.upsert({
        where: { key: API_KEY_SETTING },
        update: { value: encryptedValue, encrypted: true, updatedBy: req.user.email },
        create: { key: API_KEY_SETTING, value: encryptedValue, encrypted: true, updatedBy: req.user.email },
      });

      await logAudit({
        action: 'API_KEY_UPDATED',
        details: `Anthropic API key updated by ${req.user.email}`,
        performedBy: req.user.email,
        userId: req.user.id,
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/settings/api-key
router.delete(
  '/api/settings/api-key',
  authorize('settings.manage_users'),
  async (req, res, next) => {
    try {
      await prisma.appSetting.deleteMany({ where: { key: API_KEY_SETTING } });

      await logAudit({
        action: 'API_KEY_DELETED',
        details: `Anthropic API key removed by ${req.user.email}`,
        performedBy: req.user.email,
        userId: req.user.id,
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
