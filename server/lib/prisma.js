import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Prevent accidental physical deletion of users — use status-based soft delete instead
prisma.$use(async (params, next) => {
  if (params.model === 'User' && (params.action === 'delete' || params.action === 'deleteMany')) {
    console.error(`[BLOCKED] Attempted physical deletion of User record: ${JSON.stringify(params.args)}`);
    throw new Error('Physical deletion of user records is not allowed. Use status-based removal instead.');
  }
  return next(params);
});

export default prisma;
