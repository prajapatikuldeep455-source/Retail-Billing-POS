/**
 * Drop-in replacement for @libsql/client using better-sqlite3.
 * Provides the same createClient / db.execute / db.transaction API
 * so that server.ts needs zero changes to its database calls.
 * 
 * Why: @libsql/client uses Neon/Rust native bindings that cannot be
 * rebuilt by electron-rebuild. better-sqlite3 uses node-gyp and is
 * the standard SQLite driver for Electron apps.
 */
import Database from 'better-sqlite3';
import path from 'path';

interface ExecuteInput {
  sql: string;
  args?: any[];
}

interface ExecuteResult {
  rows: any[];
  rowsAffected: number;
  lastInsertRowid: bigint;
}

interface TransactionClient {
  execute(input: string | ExecuteInput): Promise<ExecuteResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

interface LibSqlCompatClient {
  execute(input: string | ExecuteInput): Promise<ExecuteResult>;
  transaction(): Promise<TransactionClient>;
  close(): void;
}

function executeOnDb(db: Database.Database, input: string | ExecuteInput): ExecuteResult {
  const sql = typeof input === 'string' ? input : input.sql;
  const args = typeof input === 'string' ? [] : (input.args || []);

  const trimmed = sql.trimStart().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('WITH');
  const hasReturning = /\bRETURNING\b/i.test(sql);

  if (isSelect || hasReturning) {
    const stmt = db.prepare(sql);
    const rows = args.length > 0 ? stmt.all(...args) : stmt.all();
    return { rows, rowsAffected: 0, lastInsertRowid: BigInt(0) };
  } else {
    try {
      const stmt = db.prepare(sql);
      const info = args.length > 0 ? stmt.run(...args) : stmt.run();
      return {
        rows: [],
        rowsAffected: info.changes,
        lastInsertRowid: BigInt(info.lastInsertRowid)
      };
    } catch (err: any) {
      // Handle "CREATE TABLE IF NOT EXISTS" and similar DDL that better-sqlite3
      // might handle slightly differently
      if (err.message?.includes('no tables specified')) {
        return { rows: [], rowsAffected: 0, lastInsertRowid: BigInt(0) };
      }
      throw err;
    }
  }
}

export function createClient(config: { url: string }): LibSqlCompatClient {
  let dbPath: string;
  const url = config.url;

  if (url.startsWith('file:')) {
    dbPath = url.replace(/^file:/, '');
    // Resolve relative paths
    if (!path.isAbsolute(dbPath)) {
      dbPath = path.resolve(dbPath);
    }
  } else {
    dbPath = url;
  }

  const db = new Database(dbPath);

  return {
    execute: async (input: string | ExecuteInput): Promise<ExecuteResult> => {
      return executeOnDb(db, input);
    },

    transaction: async (): Promise<TransactionClient> => {
      db.exec('BEGIN');

      return {
        execute: async (input: string | ExecuteInput): Promise<ExecuteResult> => {
          return executeOnDb(db, input);
        },
        commit: async (): Promise<void> => {
          db.exec('COMMIT');
        },
        rollback: async (): Promise<void> => {
          try {
            db.exec('ROLLBACK');
          } catch (e) {
            // Already rolled back or no transaction active
          }
        }
      };
    },

    close: () => {
      db.close();
    }
  };
}
