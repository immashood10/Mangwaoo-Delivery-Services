import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// node-postgres defaults idleTimeoutMillis to 10s, so pooled connections to the
// remote DB were being torn down between navigations and every request paid a
// fresh TLS handshake (multiple seconds) to db.prisma.io. Keep them alive longer.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 5 * 60 * 1000,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
