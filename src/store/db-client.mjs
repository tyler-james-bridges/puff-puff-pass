import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";

class PgPoolClient {
  constructor(connectionString) {
    this.pool = new Pool({ connectionString });
  }

  async query(text, values = []) {
    return this.pool.query(text, values);
  }

  async close() {
    await this.pool.end();
  }
}

class PGliteClient {
  constructor(db) {
    this.db = db;
  }

  async query(text, values = []) {
    const result = await this.db.query(text, values);
    return {
      rows: result.rows ?? []
    };
  }

  async close() {
    await this.db.close();
  }
}

export async function createDbClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    return new PgPoolClient(databaseUrl);
  }

  const dataDir = process.env.PGLITE_DATA_DIR || "./.data/pglite";
  await mkdir(path.dirname(dataDir), { recursive: true });
  const db = new PGlite(dataDir);
  return new PGliteClient(db);
}
