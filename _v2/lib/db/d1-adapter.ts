import { DatabaseAdapter } from "./adapter";
import type { D1Database } from "@cloudflare/workers-types";
import type { QueryResult } from "./adapter";

export class CloudflareD1Adapter implements DatabaseAdapter {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async exec(query: string, params: any[] = []): Promise<QueryResult[]> {
    try {
      const result = await this.db
        .prepare(query)
        .bind(...params)
        .all();

      // Transform the D1 result format to match your expected QueryResult format
      return [
        {
          columns: result.results?.[0] ? Object.keys(result.results[0]) : [],
          values: result.results?.map((row) => Object.values(row)) || [],
        },
      ];
    } catch (error) {
      console.error("Database query error:", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    // D1 connections are managed by Cloudflare, no explicit close needed
    return;
  }
}

// Factory function to create the adapter
export function createD1Adapter(db: D1Database): DatabaseAdapter {
  return new CloudflareD1Adapter(db);
}
