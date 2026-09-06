import { DatabaseSync } from 'node:sqlite';

/** Run production repositories against SQLite without rebuilding Electron's addon. */
export default class SqliteAdapter {
  open = true;
  private raw: DatabaseSync & { deserialize(bytes: Buffer): void; serialize(): Uint8Array };
  constructor(source: string | Buffer) {
    const prototype = DatabaseSync.prototype as typeof this.raw;
    if (typeof prototype.serialize !== 'function' || typeof prototype.deserialize !== 'function') {
      throw new Error('SQLite snapshot tests require Node.js 26.1 or newer; CI uses 26.8.1.');
    }
    this.raw = new DatabaseSync(
      typeof source === 'string' ? source : ':memory:',
    ) as typeof this.raw;
    if (Buffer.isBuffer(source)) this.raw.deserialize(source);
  }
  prepare(sql: string) {
    const statement = this.raw.prepare(sql);
    statement.setAllowUnknownNamedParameters(true);
    return statement;
  }
  exec(sql: string) {
    this.raw.exec(sql);
    return this;
  }
  pragma(sql: string, options?: { simple?: boolean }): any {
    if (sql.includes('=')) {
      this.raw.exec(`PRAGMA ${sql}`);
      return;
    }
    const rows = this.raw.prepare(`PRAGMA ${sql}`).all();
    return options?.simple ? Object.values(rows[0] ?? {})[0] : rows;
  }
  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: Parameters<T>) => {
      const savepoint = `test_${Math.random().toString(16).slice(2)}`;
      this.raw.exec(`SAVEPOINT ${savepoint}`);
      try {
        const value = fn(...args);
        this.raw.exec(`RELEASE ${savepoint}`);
        return value;
      } catch (error) {
        this.raw.exec(`ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
        throw error;
      }
    }) as T;
  }
  serialize() {
    return Buffer.from(this.raw.serialize());
  }
  close() {
    this.raw.close();
    this.open = false;
  }
}
