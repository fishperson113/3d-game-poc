import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined || connectionString.length === 0) {
  throw new Error("DATABASE_URL is required. Use a pooled Neon PostgreSQL connection string.");
}

export const database = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export async function migrateApplicationTables(): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS child_profile (
      id TEXT PRIMARY KEY,
      parent_user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      login_code TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS child_profile_parent_idx ON child_profile(parent_user_id);

    CREATE TABLE IF NOT EXISTS child_session (
      token_hash TEXT PRIMARY KEY,
      child_id TEXT NOT NULL REFERENCES child_profile(id) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parent_notification (
      id TEXT PRIMARY KEY,
      parent_user_id TEXT NOT NULL,
      child_id TEXT NOT NULL REFERENCES child_profile(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      read_at BIGINT
    );
    CREATE INDEX IF NOT EXISTS parent_notification_parent_idx ON parent_notification(parent_user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS product_record (
      id TEXT PRIMARY KEY,
      parent_user_id TEXT NOT NULL,
      child_id TEXT REFERENCES child_profile(id) ON DELETE SET NULL,
      image_url TEXT NOT NULL,
      input_json JSONB NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS product_record_parent_idx ON product_record(parent_user_id, created_at DESC);
  `);
}
