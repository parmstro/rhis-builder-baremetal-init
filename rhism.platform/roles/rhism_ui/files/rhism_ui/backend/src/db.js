import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? join(__dirname, '../../data/session.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS session (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export function getKey(key) {
  const row = db.prepare('SELECT value FROM session WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}

export function setKey(key, value) {
  db.prepare('INSERT OR REPLACE INTO session (key, value) VALUES (?, ?)')
    .run(key, JSON.stringify(value));
}

export function clearSession() {
  db.prepare('DELETE FROM session').run();
}
