import prisma from '../lib/prisma.js';

export async function logAudit({ action, details, performedBy, userId = null, metadata = null }) {
  return prisma.auditLog.create({
    data: {
      action,
      details,
      performedBy,
      userId,
      metadataJson: metadata,
    },
  });
}
