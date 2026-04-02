/**
 * Common interface for database operations across different environments
 */
export interface DatabaseAdapter {
  /**
   * Execute a SQL query with parameters and return the results
   * 
   * @param query - SQL query to execute
   * @param params - Optional array of parameters to bind to the query
   * @returns Array of query results
   */
  exec(query: string, params?: any[]): Promise<QueryResult[]>;
  
  /**
   * Close the database connection
   */
  close(): Promise<void>;
}

/**
 * Result from a database query
 */
export interface QueryResult {
  /**
   * Array of column names in the result set
   */
  columns: string[];
  
  /**
   * Two-dimensional array of values:
   * - First dimension: rows
   * - Second dimension: column values for each row
   */
  values: any[][];
}

/**
 * Factory function to create the appropriate database adapter
 */
export interface DatabaseAdapterFactory {
  /**
   * Create a database adapter for the given path or URL
   * 
   * @param pathOrUrl - Path to SQLite file or URL for remote database
   * @returns Initialized database adapter
   */
  createAdapter(pathOrUrl: string): Promise<DatabaseAdapter>;
}