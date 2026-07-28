import { PrismaClient } from '@prisma/client';

export interface CreatePrismaClientOptions {
  databaseUrl: string;
  logQueries?: boolean;
}

export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  return new PrismaClient({
    datasourceUrl: options.databaseUrl,
    log: options.logQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}
