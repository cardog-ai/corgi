import type { DatabaseAdapter, QueryResult, DatabaseAdapterFactory } from './adapter';
import { createLogger } from '../logger';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const logger = createLogger('NativeDatabaseAdapter');

// Type definitions for the native module
interface NativeDatabase {
  open(path: string): boolean;
  query(sql: string, params?: string[]): NativeQueryResult;
  close(): boolean;
}

interface NativeQueryResult {
  columns: string[];
  values: string[][];
}

interface ReadOnlyDatabaseConstructor {
  new(): NativeDatabase;
}

/**
 * Load the native SQLite binding
 */
function loadNativeBinding(): ReadOnlyDatabaseConstructor {
  try {
    // Try to load the compiled native module
    const binding = require('../../build/Release/readonly_sqlite.node');
    return binding.ReadOnlyDatabase;
  } catch (error) {
    logger.error({ error }, 'Failed to load native SQLite binding');
    throw new Error(
      'Failed to load native SQLite binding. Please ensure the module is built with: npm run build:native'
    );
  }
}

/**
 * Node.js implementation of the DatabaseAdapter using native C++ SQLite binding
 */
export class NativeDatabaseAdapter implements DatabaseAdapter {
  private db: NativeDatabase;
  private queryCount: number = 0;
  private ReadOnlyDatabase: ReadOnlyDatabaseConstructor;

  /**
   * Create a new database adapter for Node.js environment using native binding
   *
   * @param dbPath - Path to the SQLite database file
   */
  constructor(dbPath: string) {
    logger.debug({ dbPath }, 'Opening database with native binding');

    // Load the native binding
    this.ReadOnlyDatabase = loadNativeBinding();

    // Create a new database instance
    this.db = new this.ReadOnlyDatabase();

    // Open the database in read-only mode
    try {
      this.db.open(dbPath);
      logger.debug({ dbPath }, 'Database opened successfully');
    } catch (error) {
      logger.error({ dbPath, error }, 'Failed to open database');
      throw error;
    }
  }

  /**
   * Execute a SQL query with parameters
   *
   * @param query - SQL query to execute
   * @param params - Parameters to bind to the query
   * @returns Query results
   */
  async exec(query: string, params: any[] = []): Promise<QueryResult[]> {
    this.queryCount++;
    const queryId = this.queryCount;

    try {
      logger.debug({ queryId, query, params }, 'Executing query');
      const startTime = Date.now();

      // Convert params to strings for the native binding
      const stringParams = params.map(p => String(p));

      const result = this.db.query(query, stringParams.length > 0 ? stringParams : undefined);
      const executionTime = Date.now() - startTime;

      if (!result || result.values.length === 0) {
        logger.debug({ queryId, executionTime }, 'Query returned no results');
        return [{ columns: [], values: [] }];
      }

      logger.debug({
        queryId,
        executionTime,
        rowCount: result.values.length
      }, 'Query completed');

      return [{
        columns: result.columns,
        values: result.values
      }];

    } catch (error) {
      logger.error({ queryId, query, params, error }, 'Database query error');
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    logger.debug('Closing database connection');
    try {
      this.db.close();
      logger.debug('Database closed successfully');
    } catch (error) {
      logger.error({ error }, 'Error closing database');
      throw error;
    }
  }
}

/**
 * Factory for creating Native database adapters
 */
export class NativeDatabaseAdapterFactory implements DatabaseAdapterFactory {
  /**
   * Create a new database adapter for the given path
   *
   * @param pathOrUrl - Path to the SQLite database file
   * @returns Initialized database adapter
   */
  async createAdapter(pathOrUrl: string): Promise<DatabaseAdapter> {
    if (pathOrUrl.startsWith('libsql:') || pathOrUrl.startsWith('http')) {
      throw new Error('Remote database connections are not supported in the CLI. Use a local SQLite file instead.');
    }
    return new NativeDatabaseAdapter(pathOrUrl);
  }
}
