import { 
  BrowserDatabaseAdapter, 
  BrowserDatabaseAdapterFactory 
} from '../lib/db/browser-adapter';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

describe('Browser Adapter', () => {
  // Mock the browser SQL.js environment
  const mockExec = vi.fn();
  const mockClose = vi.fn();
  
  const mockDB = {
    exec: mockExec,
    close: mockClose
  };
  
  class MockSqlJs {
    Database = class {
      constructor() {
        return mockDB;
      }
    };
  }
  
  // Set up the browser environment
  beforeAll(() => {
    // Mock the browser window
    global.window = {
      initSqlJs: vi.fn().mockResolvedValue(new MockSqlJs()),
      SQL: new MockSqlJs(),
      document: {} as any,
      performance: { now: () => 1000 }
    } as any;
    
    // Mock the global fetch function with a proper implementation
    global.fetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array(10).buffer),
        statusText: "OK"
      });
    });
  });
  
  afterEach(() => {
    mockExec.mockReset();
    mockClose.mockReset();
    (global.fetch as any).mockReset();
  });
  
  describe('BrowserDatabaseAdapter', () => {
    it('should execute queries correctly', async () => {
      // Mock query results
      const mockResults = [{
        columns: ['id', 'name'],
        values: [[1, 'Test']]
      }];
      
      mockExec.mockReturnValue(mockResults);
      
      // Create adapter instance
      const adapter = new BrowserDatabaseAdapter(mockDB as any);
      
      // Run query
      const result = await adapter.exec('SELECT * FROM test', [1, 'string']);
      
      // Verify
      expect(mockExec).toHaveBeenCalled();
      expect(result).toEqual(mockResults);
    });
    
    it('should handle query with no results', async () => {
      mockExec.mockReturnValue([]);
      
      const adapter = new BrowserDatabaseAdapter(mockDB as any);
      const result = await adapter.exec('SELECT * FROM test WHERE 0=1');
      
      expect(result).toEqual([{ columns: [], values: [] }]);
    });
    
    it('should close the database', async () => {
      const adapter = new BrowserDatabaseAdapter(mockDB as any);
      await adapter.close();
      
      expect(mockClose).toHaveBeenCalled();
    });
    
    it('should handle query errors', async () => {
      mockExec.mockImplementation(() => {
        throw new Error('SQL Error');
      });
      
      const adapter = new BrowserDatabaseAdapter(mockDB as any);
      
      await expect(adapter.exec('INVALID SQL')).rejects.toThrow('SQL Error');
    });
  });
  
  describe('BrowserDatabaseAdapterFactory', () => {
    it('should create a browser adapter', async () => {
      const factory = new BrowserDatabaseAdapterFactory();
      const adapter = await factory.createAdapter('test.db');
      
      expect(adapter).toBeInstanceOf(BrowserDatabaseAdapter);
      expect(global.fetch).toHaveBeenCalledWith('test.db');
    });
    
    it('should handle fetch errors', async () => {
      (global.fetch as any).mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          statusText: 'Not Found',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
        });
      });
      
      const factory = new BrowserDatabaseAdapterFactory();
      
      await expect(factory.createAdapter('bad-path.db'))
        .rejects.toThrow('Failed to load database: Not Found');
    });
  });
});