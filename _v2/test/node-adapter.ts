import type { DatabaseAdapter } from '../lib/db/adapter';
import Database from 'better-sqlite3';

export class NodeDatabaseAdapter implements DatabaseAdapter {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Open in read-only mode with a larger page cache for better performance
    this.db = new Database(dbPath, {
      readonly: true,
      fileMustExist: true,
      timeout: 5000,
    });

    // Read-only optimizations that don't require writes
    this.db.pragma('mmap_size=268435456'); // Use memory mapping (268MB)
    this.db.pragma('cache_size=-2000'); // 2MB cache
    this.db.pragma('temp_store=MEMORY');
  }

  async exec(query: string, params: any[] = []): Promise<Array<{ columns: string[]; values: any[][] }>> {
    try {
      const stmt = this.db.prepare(query);
      const results = stmt.all(...params) as Record<string, any>[];

      if (!results || results.length === 0) {
        return [{ columns: [], values: [] }];
      }

      const columns = Object.keys(results[0]);
      const values = results.map(row => columns.map(col => (row as Record<string, any>)[col]));

      return [{ columns, values }];
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
} 
