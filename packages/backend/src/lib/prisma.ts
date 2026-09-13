import { PrismaClient } from '@prisma/client';

// Reuse a single PrismaClient instance across the app (recommended pattern)
export const prisma = new PrismaClient();
