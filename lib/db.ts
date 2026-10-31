import { Pool, type QueryResult, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as { pgPool?: Pool };

function getPool(): Pool {
  if (!globalForPg.pgPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
    globalForPg.pgPool = new Pool({
      // Keep TLS settings in Supabase's connection string (sslmode=require).
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForPg.pgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, values);
}

export async function inTransaction<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
