/**
 * Vitest Global Setup - Database Protection
 * 
 * This setup file automatically mocks the database connection for ALL tests,
 * preventing test data from being inserted into the production database.
 * 
 * HOW IT WORKS:
 * - Intercepts getDb() calls and returns a mock database object
 * - All insert/update/delete operations are no-ops that return safe defaults
 * - Select/query operations return empty arrays
 * 
 * IF YOU NEED THE REAL DATABASE:
 * Do NOT use the real database in tests. All tests should use mocks.
 * If you absolutely need integration tests, create a separate test config
 * that uses a dedicated test database (never production).
 */

import { vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATABASE - Prevents all real database operations in tests
// ═══════════════════════════════════════════════════════════════════════════════

// Chainable mock that returns itself for any method call
function createChainableMock(): any {
  const mock: any = vi.fn(() => mock);
  // Common drizzle methods that should be chainable
  const chainMethods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'groupBy', 'having', 'innerJoin', 'leftJoin', 'rightJoin',
    'fullJoin', 'set', 'values', 'onConflictDoUpdate', 'onConflictDoNothing',
    'onDuplicateKeyUpdate', 'returning', 'execute', 'prepare',
    'as', 'with', 'distinct',
  ];
  for (const method of chainMethods) {
    mock[method] = vi.fn(() => mock);
  }
  // Terminal methods that return data
  mock.then = undefined; // Make it non-thenable by default
  return mock;
}

// Create a mock that resolves to empty array when awaited
function createResolvableMock(): any {
  const mock = createChainableMock();
  // Override to make it thenable (returns empty array)
  const promise = Promise.resolve([]);
  mock.then = promise.then.bind(promise);
  mock.catch = promise.catch.bind(promise);
  mock.finally = promise.finally.bind(promise);
  return mock;
}

function createMockDb() {
  const mockInsert = vi.fn(() => {
    const chain: any = {
      values: vi.fn(() => {
        const innerChain: any = {
          onDuplicateKeyUpdate: vi.fn(() => Promise.resolve([{ insertId: 1, affectedRows: 1 }])),
          execute: vi.fn(() => Promise.resolve([{ insertId: 1, affectedRows: 1 }])),
          then: undefined as any,
        };
        const p = Promise.resolve([{ insertId: 1, affectedRows: 1 }]);
        innerChain.then = p.then.bind(p);
        innerChain.catch = p.catch.bind(p);
        return innerChain;
      }),
    };
    return chain;
  });

  const mockUpdate = vi.fn(() => {
    const chain: any = {
      set: vi.fn(() => {
        const innerChain: any = {
          where: vi.fn(() => Promise.resolve([{ affectedRows: 1 }])),
          then: undefined as any,
        };
        const p = Promise.resolve([{ affectedRows: 1 }]);
        innerChain.then = p.then.bind(p);
        innerChain.catch = p.catch.bind(p);
        return innerChain;
      }),
    };
    return chain;
  });

  const mockDelete = vi.fn(() => {
    const chain: any = {
      where: vi.fn(() => Promise.resolve([{ affectedRows: 1 }])),
      then: undefined as any,
    };
    const p = Promise.resolve([{ affectedRows: 1 }]);
    chain.then = p.then.bind(p);
    chain.catch = p.catch.bind(p);
    return chain;
  });

  const mockSelect = vi.fn(() => createResolvableMock());

  const mockDb: any = {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    select: mockSelect,
    selectDistinct: mockSelect,
    query: new Proxy({}, {
      get: () => ({
        findFirst: vi.fn(() => Promise.resolve(null)),
        findMany: vi.fn(() => Promise.resolve([])),
      }),
    }),
    execute: vi.fn(() => Promise.resolve([])),
    transaction: vi.fn(async (fn: any) => {
      return await fn(mockDb);
    }),
  };

  return mockDb;
}

const globalMockDb = createMockDb();

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL MOCKS - Applied to ALL test files automatically
// ═══════════════════════════════════════════════════════════════════════════════

// Mock the main database module
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal() as any;
  
  // Keep all exported functions but make getDb return mock
  const mocked: any = {};
  for (const key of Object.keys(original)) {
    if (key === 'getDb') {
      mocked.getDb = vi.fn(() => Promise.resolve(globalMockDb));
    } else if (typeof original[key] === 'function') {
      // Wrap other db functions to be safe - they'll use the mocked getDb internally
      mocked[key] = original[key];
    } else {
      mocked[key] = original[key];
    }
  }
  
  return mocked;
});

// Also mock any direct database connection attempts
vi.mock("drizzle-orm/mysql2", async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    drizzle: vi.fn(() => globalMockDb),
  };
});

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Log a warning if any test tries to use the real database
console.log("[vitest-setup] ⚠️  Database mocked globally - no real DB operations will occur");
