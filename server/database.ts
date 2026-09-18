import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath = resolve(process.env.DATABASE_PATH ?? "./storage/besiege.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

export const database = new DatabaseSync(databasePath);
database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

export function migrateApplicationTables(): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS child_profile (
      id TEXT PRIMARY KEY,
      parent_user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      login_code TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS child_profile_parent_idx ON child_profile(parent_user_id);

    CREATE TABLE IF NOT EXISTS child_session (
      token_hash TEXT PRIMARY KEY,
      child_id TEXT NOT NULL REFERENCES child_profile(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parent_notification (
      id TEXT PRIMARY KEY,
      parent_user_id TEXT NOT NULL,
      child_id TEXT NOT NULL REFERENCES child_profile(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      read_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS parent_notification_parent_idx ON parent_notification(parent_user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS product_record (
      id TEXT PRIMARY KEY,
      parent_user_id TEXT NOT NULL,
      child_id TEXT REFERENCES child_profile(id) ON DELETE SET NULL,
      image_url TEXT NOT NULL,
      input_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS product_record_parent_idx ON product_record(parent_user_id, created_at DESC);
  `);
}
