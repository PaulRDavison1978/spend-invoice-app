import { PrismaClient } from '@prisma/client';

const basePrisma = new PrismaClient();

// Prevent accidental physical deletion of users — use status-based soft delete instead
const prisma = basePrisma.$extends({
  query: {
    user: {
      async delete({ args }) {
        console.error(`[BLOCKED] Attempted physical deletion of User record: ${JSON.stringify(args)}`);
        throw new Error('Physical deletion of user records is not allowed. Use status-based removal instead.');
      },
      async deleteMany({ args }) {
        console.error(`[BLOCKED] Attempted physical deletion of User records: ${JSON.stringify(args)}`);
        throw new Error('Physical deletion of user records is not allowed. Use status-based removal instead.');
      },
    },
  },
});

export default prisma;
