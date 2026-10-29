import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@/lib/generated/prisma/client';

// One client for the whole dev server. Next compiles pages, route handlers and hot-reloaded modules as
// separate copies of this file (each with its own copy of the generated PrismaClient class), so the
// client is kept on globalThis and shared. It is only replaced when the generated schema changed
// (after `prisma generate`), and the old client is never closed here: closing it broke any route still
// holding it ("Cannot use a pool after calling end on the pool"). A pool per copy would also eat the
// database's small connection limit.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaSignature?: string;
};

/** Fingerprint of the generated models and their columns, to notice a regenerated client. */
function schemaSignature() {
  return Object.entries(Prisma)
    .filter(([name]) => name.endsWith('ScalarFieldEnum'))
    .map(([name, fields]) => `${name}:${Object.keys(fields as object).join(',')}`)
    .sort()
    .join('|');
}

function createPrismaClient() {
  // node-postgres defaults idleTimeoutMillis to 10s, so pooled connections to the
  // remote DB were being torn down between navigations and every request paid a
  // fresh TLS handshake (multiple seconds) to db.prisma.io. Keep them alive longer.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // 10 connections per server. A PC running the dev server AND test scripts against Supabase's session pooler (15 clients in all)
    // can lower it with DATABASE_POOL_MAX (for example 7 for the dev server and 3 for a test script).
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    idleTimeoutMillis: 5 * 60 * 1000,
  });

  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  if (process.env.NODE_ENV === 'production') {
    return createPrismaClient();
  }

  const signature = schemaSignature();

  if (!globalForPrisma.prisma || globalForPrisma.prismaSchemaSignature !== signature) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaSchemaSignature = signature;
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
