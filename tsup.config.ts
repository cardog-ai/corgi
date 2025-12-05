import { defineConfig } from "tsup";

// Properly configure tsup to generate declarations correctly
export default defineConfig([
  // Main build for Node.js
  {
    entry: [
      "lib/index.ts",
      "lib/cli.ts",
    ],
    format: ["esm", "cjs"],
    dts: {
      entry: {
        index: "lib/index.ts",
      },
    },
    clean: true,
    minify: true,
    treeshake: true,
    platform: "node",
    target: "node16",
    splitting: false,
    outExtension({ format }) {
      return {
        js: format === "esm" ? ".mjs" : ".cjs",
      };
    },
  },
  // Browser build
  {
    entry: {
      browser: "lib/browser.ts",
    },
    format: ["esm"],
    dts: {
      entry: {
        browser: "lib/browser.ts",
      },
    },
    minify: true,
    treeshake: true,
    platform: "browser",
    target: "es2020",
    splitting: false,
    external: ["better-sqlite3"],
    outExtension() {
      return {
        js: ".mjs",
      };
    },
  },
  // Browser adapter build (ESM only, no better-sqlite3)
  {
    entry: {
      "db/browser-adapter": "lib/db/browser-adapter.ts",
    },
    format: ["esm"],
    dts: {
      entry: {
        "db/browser-adapter": "lib/db/browser-adapter.ts",
      },
    },
    minify: true,
    treeshake: true,
    platform: "browser",
    target: "es2020",
    splitting: false,
    external: ["better-sqlite3"],
    outExtension() {
      return {
        js: ".mjs",
      };
    },
  },
  // D1 adapter build (ESM only for Cloudflare Workers)
  {
    entry: {
      "db/d1-adapter": "lib/db/d1-adapter.ts",
    },
    format: ["esm"],
    dts: {
      entry: {
        "db/d1-adapter": "lib/db/d1-adapter.ts",
      },
    },
    minify: true,
    treeshake: true,
    platform: "neutral",
    target: "es2020",
    splitting: false,
    external: ["better-sqlite3", "@cloudflare/workers-types"],
    outExtension() {
      return {
        js: ".mjs",
      };
    },
  },
]);
