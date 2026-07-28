#!/usr/bin/env node
import pg from 'pg';

const { Client } = pg;

const DEFAULT_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1000;

export async function waitForPostgres(connectionString, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    const client = new Client({ connectionString, connectionTimeoutMillis: 2000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return true;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  throw new Error(
    `PostgreSQL did not become ready within ${timeoutMs}ms: ${lastError?.message ?? 'unknown error'}`,
  );
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  try {
    await waitForPostgres(connectionString);
    console.log('PostgreSQL is ready');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
