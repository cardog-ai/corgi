---
"@cardog/corgi": patch
---

Fix install on Node.js 24: bump better-sqlite3 to ^12.4.6 (adds Node 24 prebuilds, fixes C++20 build failure with v9). Bump @types/better-sqlite3 to ^9.6.0 and engines to >=20 to match better-sqlite3 v12 requirements. No API changes — Node adapter usage (open readonly, pragma, prepare/all, close) is stable across v9→v12.
