import type { DatabaseAdapter, QueryResult } from './adapter';
import { createLogger } from '../logger';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { createRequire } from 'module';

const logger = createLogger('AsyncDatabaseAdapter');

// Import our native module
let ReadOnlyDatabase: any;

// Handle both CommonJS and ESM environments
const loadNativeModule = () => {
  try {
    // For ESM, we need to create a require function
    const require = createRequire(import.meta.url || __filename);
    
    // Try different relative paths
    const paths = [
      '../../build/Release/readonly_sqlite.node',
      '../../../build/Release/readonly_sqlite.node',
    ];
    
    for (const path of paths) {
      try {
        return require(path).ReadOnlyDatabase;
      } catch {
        // Try next path
      }
    }
    
    // If relative paths don't work, try absolute path from cwd
    try {
      const absolutePath = resolve(process.cwd(), 'build/Release/readonly_sqlite.node');
      if (existsSync(absolutePath)) {
        return require(absolutePath).ReadOnlyDatabase;
      }
    } catch {
      // Continue to error
    }
    
    throw new Error('Could not find native module');
  } catch (err) {
    logger.warn('Native module not built yet. Run: npm run build:native');
    return null;
  }
};

ReadOnlyDatabase = loadNativeModule();

/**
 * Truly async SQLite adapter using custom C++ binding
 * This adapter uses libuv thread pool for non-blocking queries
 */
export class AsyncDatabaseAdapter implements DatabaseAdapter {
  private db: any;
  private isOpen: boolean = false;

  /**
   * Create a new async database adapter
   *
   * @param dbPath - Path to the SQLite database file
   */
  constructor(dbPath: string) {
    if (!ReadOnlyDatabase) {
      throw new Error('Native async SQLite module not available. Run: npm run build:native');
    }

    logger.debug({ dbPath }, 'Opening async database');
    
    this.db = new ReadOnlyDatabase();
    this.db.open(dbPath);
    this.isOpen = true;
  }

  /**
   * Execute a SQL query with parameters (truly async)
   *
   * @param query - SQL query to execute
   * @param params - Parameters to bind to the query
   * @returns Query results
   */
  async exec(query: string, params: any[] = []): Promise<QueryResult[]> {
    if (!this.isOpen) {
      throw new Error('Database connection is closed');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      this.db.query(query, (err: Error | null, result: any) => {
        const executionTime = Date.now() - startTime;
        
        if (err) {
          logger.error({ query, params, error: err }, 'Async query error');
          reject(err);
          return;
        }

        if (!result || !result.values || result.values.length === 0) {
          logger.debug({ executionTime }, 'Query returned no results');
          resolve([{ columns: [], values: [] }]);
          return;
        }

        logger.debug(
          {
            executionTime,
            rowCount: result.values.length,
          },
          'Async query completed',
        );

        resolve([result]);
      }, params);
    });
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.isOpen) {
      logger.debug('Closing async database connection');
      this.db.close();
      this.isOpen = false;
    }
  }
}

/**
 * Factory for creating async database adapters
 */
export class AsyncDatabaseAdapterFactory {
  /**
   * Create a new async database adapter
   *
   * @param pathOrUrl - Path to the SQLite database file
   * @returns Initialized async database adapter
   */
  async createAdapter(pathOrUrl: string): Promise<DatabaseAdapter> {
    if (pathOrUrl.startsWith('libsql:') || pathOrUrl.startsWith('http')) {
      throw new Error(
        'Remote database connections are not supported with async adapter',
      );
    }
    return new AsyncDatabaseAdapter(pathOrUrl);
  }
}