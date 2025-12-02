# Native SQLite C++ Binding Performance Branch

This branch contains an experimental native C++ SQLite binding for Node.js, designed to provide true async/non-blocking database queries using libuv's thread pool.

## Overview

The native implementation removes the dependency on `better-sqlite3` and provides:
- True asynchronous, non-blocking database queries
- Full utilization of libuv's thread pool for parallel query execution
- Optimized read-only access with SQLite pragmas for maximum performance
- Zero event loop blocking, even under heavy concurrent load

## Files

### Core Implementation
- `src/readonly_sqlite.cc` - Native C++ SQLite binding using N-API
- `binding.gyp` - Node-gyp build configuration
- `lib/db/async-adapter.ts` - TypeScript adapter that wraps the native module

### Benchmarks
- `bench/test-native.cjs` - Direct test of the native C++ module
- `bench/baseline.js` - Baseline benchmark using current implementation
- `bench/async-benchmark.js` - Full benchmark comparing async adapter performance

## Building

```bash
# Install dependencies (if not already installed)
pnpm install

# Build the native module
pnpm run build:native
# or manually:
node-gyp rebuild

# Build TypeScript
pnpm run build
```

## Running Benchmarks

```bash
# Test native module directly
node bench/test-native.cjs

# Run baseline benchmark
node bench/baseline.js

# Run async adapter benchmark (requires built module)
node bench/async-benchmark.js
```

## Requirements

- Node.js 16+
- SQLite3 development libraries
- node-gyp and build tools

### macOS
```bash
# SQLite is usually pre-installed
# Install build tools if needed:
xcode-select --install
```

### Linux
```bash
sudo apt-get install sqlite3 libsqlite3-dev build-essential
```

## Performance Characteristics

The native binding provides:
- **Non-blocking I/O**: Queries execute on thread pool, never blocking the event loop
- **True concurrency**: Multiple queries can execute in parallel on different threads
- **Read-optimized**: Configured with optimal SQLite pragmas for read-only workloads
- **Memory efficient**: Minimal memory overhead compared to better-sqlite3

## Notes

This is an experimental branch for testing and benchmarking. The goal is to evaluate whether the performance gains justify replacing better-sqlite3 with a native binding.

Key considerations:
- Maintenance burden of native C++ code
- Cross-platform compatibility and build complexity
- Performance gains vs implementation complexity
- Package size and distribution challenges
