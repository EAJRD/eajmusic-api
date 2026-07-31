import { PrismaClient } from '@prisma/client';

// Single shared Prisma Client instance for the whole app. Previously every
// route file (and middleware/auth.js) called `new PrismaClient()`
// independently, which means each one opened its own connection pool to
// Postgres - multiplying connection count for no benefit and risking
// exhausting max_connections as traffic grows. Import `prisma` from here
// everywhere instead of instantiating a new client.
export const prisma = new PrismaClient();
