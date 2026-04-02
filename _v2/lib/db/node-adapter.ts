import type { DatabaseAdapter, QueryResult, DatabaseAdapterFactory } from './adapter';
import type { Database as BetterSQLite3Database } from 'better-sqlite3';
import Database from 'better-sqlite3';
import { createLogger } from '../logger';

const logger = createLogger('NodeDatabaseAdapter');

/**
 * Node.js implementation of the DatabaseAdapter using better-sqlite3
 */
export class NodeDatabaseAdapter implements DatabaseAdapter {
  private db: BetterSQLite3Database;
  private queryCount: number = 0;

  /**
   * Create a new database adapter for Node.js environment
   * 
   * @param dbPath - Path to the SQLite database file
   */
  constructor(dbPath: string) {
    logger.debug({ dbPath }, 'Opening database');
    
    // Open in read-only mode with optimizations for better performance
    this.db = new Database(dbPath, {
      readonly: true,
      fileMustExist: true,
      timeout: 5000,
    });

    // Apply read-only optimizations
    this.db.pragma('mmap_size=268435456'); // Use memory mapping (268MB)
    this.db.pragma('cache_size=-2000'); // 2MB cache 
    this.db.pragma('temp_store=MEMORY'); // Store temp tables in memory
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
      
      // Prepare and execute the statement
      const stmt = this.db.prepare(query);
      const results = stmt.all(...params) as Record<string, any>[];
      
      const executionTime = Date.now() - startTime;
      
      if (!results || results.length === 0) {
        logger.debug({ queryId, executionTime }, 'Query returned no results');
        return [{ columns: [], values: [] }];
      }

      // Convert the results to the expected format
      const columns = Object.keys(results[0]);
      const values = results.map(row => columns.map(col => (row as Record<string, any>)[col]));
      
      logger.debug({ 
        queryId, 
        executionTime, 
        rowCount: results.length 
      }, 'Query completed');
      
      return [{ columns, values }];
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
    this.db.close();
  }
}

/**
 * Factory for creating Node.js database adapters
 */
export class NodeDatabaseAdapterFactory implements DatabaseAdapterFactory {
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
    return new NodeDatabaseAdapter(pathOrUrl);
  }
}