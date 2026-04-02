import { DatabaseAdapter } from './db/adapter';
import { WMIResult } from './types';
import { logger } from './logger';

/**
 * Result from a database query
 */
export interface QueryResult {
  columns: string[];
  values: any[][];
}

/**
 * Database class for handling VPIC database operations
 */
export class VPICDatabase {
  private adapter: DatabaseAdapter;
  private queryCache: Map<string, any> = new Map();

  /**
   * Create a new VPIC database instance
   *
   * @param adapter - The database adapter for the target environment
   */
  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  /**
   * Execute a query and get a single row as an object
   *
   * @param sql - SQL query to execute
   * @param params - Query parameters
   * @returns The first result row as an object, or null if no results
   */
  private async get<T>(sql: string, params: any[] = []): Promise<T | null> {
    try {
      // Create a cache key from the query and parameters
      const cacheKey = `${sql}:${JSON.stringify(params)}`;

      // Check if we have a cached result
      if (this.queryCache.has(cacheKey)) {
        return this.queryCache.get(cacheKey) as T;
      }

      // Execute the query
      const result = await this.adapter.exec(sql, params);

      // Transform result to object if we have data
      if (result[0]?.values?.length > 0) {
        const obj: any = {};
        result[0].columns.forEach((col, i) => {
          obj[col] = result[0].values[0][i];
        });

        // Cache the result for future queries
        this.queryCache.set(cacheKey, obj);

        return obj as T;
      }

      // Cache null result
      this.queryCache.set(cacheKey, null);
      return null;
    } catch (error) {
      logger.error({ error, sql, params }, 'Database get error');
      throw error;
    }
  }

  /**
   * Execute a query and get multiple rows as objects
   *
   * @param sql - SQL query to execute
   * @param params - Query parameters
   * @returns Array of result rows as objects
   */
  private async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      // Create a cache key from the query and parameters
      const cacheKey = `query:${sql}:${JSON.stringify(params)}`;

      // Check if we have a cached result
      if (this.queryCache.has(cacheKey)) {
        return this.queryCache.get(cacheKey) as T[];
      }

      // Execute the query
      const result = await this.adapter.exec(sql, params);

      // Transform results to objects
      if (result[0]?.values?.length > 0) {
        const objects = result[0].values.map(row => {
          const obj: any = {};
          result[0].columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj as T;
        });

        // Cache the result for future queries
        this.queryCache.set(cacheKey, objects);

        return objects;
      }

      // Return empty array for no results
      const emptyResult: T[] = [];
      this.queryCache.set(cacheKey, emptyResult);
      return emptyResult;
    } catch (error) {
      logger.error({ error, sql, params }, 'Database query error');
      throw error;
    }
  }

  /**
   * Clear the query cache
   */
  public clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.adapter.close();
  }

  /**
   * Get WMI (World Manufacturer Identifier) information
   *
   * @param wmi - 3-character WMI code
   * @returns WMI information or null if not found
   */
  async getWMI(wmi: string): Promise<WMIResult | null> {
    const sql = /*sql*/ `
      WITH RECURSIVE
      WmiMakes AS (
        SELECT 
          w.Id as WmiId,
          w.Wmi as code,
          m.Name as manufacturer,
          ma.Name as make,
          c.Name as country,
          vt.Name as vehicleType,
          CASE 
            WHEN c.Name IN ('UNITED STATES', 'CANADA', 'MEXICO') THEN 'NORTH AMERICA'
            WHEN c.Name IN ('JAPAN', 'KOREA', 'CHINA', 'TAIWAN') THEN 'ASIA'
            WHEN c.Name IN ('GERMANY', 'UNITED KINGDOM', 'ITALY', 'FRANCE', 'SWEDEN') THEN 'EUROPE'
            ELSE 'OTHER'
          END as region,
          ROW_NUMBER() OVER (PARTITION BY w.Wmi ORDER BY w.CreatedOn DESC
          ) as rn
        FROM Wmi w
        LEFT JOIN Manufacturer m ON w.ManufacturerId = m.Id
        LEFT JOIN Wmi_Make wm ON w.Id = wm.WmiId
        LEFT JOIN Make ma ON wm.MakeId = ma.Id
        LEFT JOIN Country c ON w.CountryId = c.Id
        LEFT JOIN VehicleType vt ON w.VehicleTypeId = vt.Id
        WHERE w.Wmi = ?
      )
      SELECT 
        code,
        manufacturer,
        make,
        country,
        vehicleType,
        region
      FROM WmiMakes
      WHERE rn = 1
    `;

    return this.get<WMIResult>(sql, [wmi]);
  }

  /**
   * Get valid VIN schemas for a specific WMI and model year
   *
   * @param wmi - 3-character WMI code
   * @param modelYear - Vehicle model year
   * @returns Array of valid schema IDs and names
   */
  async getValidSchemas(
    wmi: string,
    modelYear: number,
  ): Promise<Array<{ SchemaId: number; SchemaName: string }>> {
    const sql = /*sql*/ `
      SELECT DISTINCT vs.Id as SchemaId, vs.Name as SchemaName
      FROM Wmi w
      JOIN Wmi_VinSchema wvs ON w.Id = wvs.WmiId
      JOIN VinSchema vs ON wvs.VinSchemaId = vs.Id
      WHERE w.Wmi = ?
        AND ? >= wvs.YearFrom 
        AND (wvs.YearTo IS NULL OR ? <= wvs.YearTo)
    `;

    return this.query(sql, [wmi, modelYear, modelYear]);
  }

  /**
   * Get patterns for a specific set of schemas
   *
   * @param schemaIds - Array of schema IDs
   * @returns Array of pattern definitions
   */
  async getPatterns(schemaIds: number[]): Promise<any[]> {
    if (schemaIds.length === 0) {
      return [];
    }

    const sql = /*sql*/ `
      WITH ValidSchemas AS (
        SELECT vs.Id, vs.Name 
        FROM VinSchema vs 
        WHERE vs.Id IN (${schemaIds.join(',')})
      )
      SELECT DISTINCT
        p.Keys as Pattern,
        e.Id as ElementId,
        e.Name as ElementName,
        e.Code as ElementCode,
        e.GroupName,
        e.Description,
        e.LookupTable,
        p.AttributeId,
        vs.Name as SchemaName,
        wvs.YearFrom,
        wvs.YearTo,
        e.weight as ElementWeight
      FROM Pattern p
      JOIN Element e ON p.ElementId = e.Id
      JOIN ValidSchemas vs ON p.VinSchemaId = vs.Id
      JOIN Wmi_VinSchema wvs ON p.VinSchemaId = wvs.VinSchemaId
      WHERE p.VinSchemaId IN (${schemaIds.join(',')})
      
      UNION ALL
      
      SELECT 
        p.Keys as Pattern,
        (SELECT Id FROM Element WHERE Name = 'Make' LIMIT 1) as ElementId,
        'Make' as ElementName,
        'MK' as ElementCode,
        'Vehicle' as GroupName,
        NULL as Description,
        NULL as LookupTable,
        m.Name as AttributeId,
        vs.Name as SchemaName,
        wvs.YearFrom,
        wvs.YearTo,
        (SELECT weight FROM Element WHERE Name = 'Make' LIMIT 1) as ElementWeight
      FROM Pattern p
      JOIN Element e ON p.ElementId = e.Id
      JOIN ValidSchemas vs ON p.VinSchemaId = vs.Id
      JOIN Wmi_VinSchema wvs ON p.VinSchemaId = wvs.VinSchemaId
      JOIN Make_Model mm ON mm.ModelId = CAST(p.AttributeId AS INTEGER)
      JOIN Make m ON m.Id = mm.MakeId
      WHERE e.Name = 'Model'
      AND p.VinSchemaId IN (${schemaIds.join(',')})
    `;

    return this.query(sql, []);
  }

  /**
   * Look up values in a specific lookup table
   *
   * @param tableName - Name of the lookup table
   * @param ids - Array of ID values to look up
   * @returns Map of ID to name mappings
   */
  async lookupValues(tableName: string, ids: string[]): Promise<Map<string, string>> {
    if (!tableName || ids.length === 0) {
      return new Map();
    }

    try {
      const placeholders = ids.map(() => '?').join(',');
      const sql = /*sql*/ `
        SELECT CAST(Id AS TEXT) as Id, Name
        FROM ${tableName}
        WHERE CAST(Id AS TEXT) IN (${placeholders})
      `;

      const results = await this.query<{ Id: string; Name: string }>(sql, [...ids]);

      // Create lookup map for fast access
      const lookupMap = new Map<string, string>();
      for (const result of results) {
        lookupMap.set(result.Id, result.Name);
      }

      return lookupMap;
    } catch (error) {
      logger.warn({ error, tableName, ids }, 'Lookup table query failed');
      return new Map();
    }
  }
}
