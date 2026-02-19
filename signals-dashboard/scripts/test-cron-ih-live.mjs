#!/usr/bin/env node

/**
 * Test Indie Hackers Live cron ingestion.
 *
 * Default: HTTP mode — calls the cron route (requires dev server: npm run dev)
 *   node scripts/test-cron-ih-live.mjs
 *
 * Remote:
 *   node scripts/test-cron-ih-live.mjs https://signals-mu.vercel.app
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ────────────────────────────────────────
function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key] || process.env[key] === "") {
        process.env[key] = val;
      }
    }
    console.log(`Loaded env from ${filePath}`);
  } catch {
    console.warn(`No .env.local found — using existing env`);
  }
}

loadEnvFile(resolve(__dirname, "..", ".env.local"));

const baseUrl =
  process.argv.find((a) => a.startsWith("http")) || "http://localhost:3000";
const url = `${baseUrl.replace(/\/$/, "")}/api/cron/indie-hackers-live`;

const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
  console.error("ERROR: CRON_SECRET not found. Set it in .env.local.");
  process.exit(1);
}

console.log(`\nCalling: ${url}`);
console.log(
  `Authorization: Bearer <CRON_SECRET> (${cronSecret.length} chars)\n`,
);

try {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const body = await res.json().catch(() => res.text());
  console.log(`Status: ${res.status}`);
  console.log(`Response:\n${JSON.stringify(body, null, 2)}`);
  if (res.ok && body.ok) {
    console.log("\nSUCCESS");
  } else {
    console.error("\nFAILED");
    process.exit(1);
  }
} catch (err) {
  console.error(`\nFetch failed: ${err.message}`);
  if (baseUrl.includes("localhost")) {
    console.error("Is the dev server running? Start it with: npm run dev");
  }
  process.exit(1);
}
