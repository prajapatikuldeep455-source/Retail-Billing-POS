/**
 * Drop-in replacement for @libsql/client using Node.js built-in node:sqlite.
 * Provides the same createClient / db.execute / db.transaction API
 * so that server.ts needs zero changes to its database calls.
 * 
 * Why: Node 22+ (and Electron 43+) has built-in SQLite, so we don't
 * need to deal with native C++ rebuilding, ABI mismatches, or crashes!
 */
import { DatabaseSync } from 'node:sqlite';
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

function executeOnDb(db: DatabaseSync, input: string | ExecuteInput): ExecuteResult {
  const sql = typeof input === 'string' ? input : input.sql;
  const args = typeof input === 'string' ? [] : (input.args || []);

  const trimmed = sql.trimStart().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('WITH');
  const hasReturning = /\bRETURNING\b/i.test(sql);

  if (isSelect || hasReturning) {
    const stmt = db.prepare(sql);
    const rows = args.length > 0 ? stmt.all(...args) : stmt.all();
    return { rows: rows as any[], rowsAffected: 0, lastInsertRowid: BigInt(0) };
  } else {
    try {
      const stmt = db.prepare(sql);
      const info = args.length > 0 ? stmt.run(...args) : stmt.run();
      return {
        rows: [],
        rowsAffected: Number(info.changes),
        lastInsertRowid: BigInt(info.lastInsertRowid)
      };
    } catch (err: any) {
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
    if (!path.isAbsolute(dbPath)) {
      dbPath = path.resolve(dbPath);
    }
  } else {
    dbPath = url;
  }

  const db = new DatabaseSync(dbPath);

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
          } catch (e) {}
        }
      };
    },

    close: () => {
      db.close();
    }
  };
}
