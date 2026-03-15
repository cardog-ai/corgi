import { copyFileSync, existsSync, mkdirSync, createWriteStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { execSync } from 'child_process';
import path from 'path';

// Database download setup
const TEST_DB_URL = 'https://corgi.cardog.io/test.db.gz';
const TEST_DB_PATH = path.join(__dirname, 'test.db');

// Full database for community pattern tests
const VPIC_DB_URL = 'https://corgi.cardog.io/vpic.lite.db.gz';
const VPIC_DB_PATH = path.join(__dirname, '..', 'db', 'vpic.lite.db');

async function downloadDatabase(url: string, destPath: string, name: string) {
  if (existsSync(destPath)) {
    console.log(`${name} already exists, skipping download`);
    return;
  }

  // Ensure directory exists
  const dir = path.dirname(destPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  console.log(`Downloading ${name} from ${url}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${name}: ${response.status}`);
    }

    const gunzip = createGunzip();
    const fileStream = createWriteStream(destPath);

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Convert Web ReadableStream to Node.js Readable stream
    const nodeStream = response.body as any;
    await pipeline(nodeStream, gunzip, fileStream);

    console.log(`${name} downloaded and decompressed successfully`);
  } catch (error) {
    console.error(`Failed to download ${name}:`, error);
    throw error;
  }
}

// Download databases before tests (runs immediately when setup.ts is imported)
await Promise.all([
  downloadDatabase(TEST_DB_URL, TEST_DB_PATH, 'Test database'),
  downloadDatabase(VPIC_DB_URL, VPIC_DB_PATH, 'VPIC database'),
]);

// Apply community patterns to the VPIC database
// This ensures Tesla LRW/XP7 patterns are available for testing
try {
  console.log('Applying community patterns...');
  execSync('pnpm community:apply', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
} catch (error) {
  console.error('Failed to apply community patterns:', error);
  // Don't throw - patterns may already be applied
}

// Different possible paths for sql-wasm.wasm file
const possiblePaths = [
  path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  path.join(__dirname, '..', '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  // Add more possible paths if needed
];

const wasmDest = path.join(__dirname, 'sql-wasm.wasm');

// Skip if the destination file already exists
if (!existsSync(wasmDest)) {
  let copied = false;

  // Try each possible path
  for (const wasmSource of possiblePaths) {
    if (existsSync(wasmSource)) {
      try {
        copyFileSync(wasmSource, wasmDest);
        console.log(`Successfully copied wasm file from ${wasmSource}`);
        copied = true;
        break;
      } catch (error) {
        console.warn(`Could not copy from ${wasmSource}:`, error);
      }
    }
  }

  if (!copied) {
    console.warn(
      'Warning: Could not copy sql-wasm.wasm file from any known location. Browser tests might fail.',
    );
  }
}
