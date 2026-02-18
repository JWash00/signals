#!/usr/bin/env node

/**
 * Test Product Hunt Live ingestion locally.
 *
 * Default: Calls PH API + checks Supabase connection directly (no server needed)
 *   node scripts/test-cron-ph-live.mjs
 *
 * --http: Calls the HTTP cron route (requires dev server: npm run dev)
 *   node scripts/test-cron-ph-live.mjs --http
 *   node scripts/test-cron-ph-live.mjs --http https://your-app.vercel.app
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

const isHttp = process.argv.includes("--http");

// ── Mode: HTTP route test ──────────────────────────────────
if (isHttp) {
  const urlArg = process.argv.find(
    (a) => a !== "--http" && a.startsWith("http"),
  );
  const baseUrl = urlArg || "http://localhost:3000";
  const url = `${baseUrl.replace(/\/$/, "")}/api/cron/product-hunt-live`;

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
  process.exit(0);
}

// ── Mode: Direct test (default) ────────────────────────────
console.log("\nDirect-call mode (no HTTP server needed)\n");

const { createClient } = await import("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ownerId = process.env.CRON_OWNER_ID;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key.");
  process.exit(1);
}
if (!ownerId) {
  console.error("Missing CRON_OWNER_ID.");
  process.exit(1);
}

console.log(`Supabase: ${supabaseUrl}`);
console.log(`Key:      ${supabaseKey.slice(0, 16)}... (${supabaseKey.length} chars)`);
console.log(`Owner:    ${ownerId}\n`);

const phClientId = process.env.PRODUCT_HUNT_CLIENT_ID;
const phClientSecret = process.env.PRODUCT_HUNT_CLIENT_SECRET;

if (!phClientId || !phClientSecret) {
  console.error("Missing PRODUCT_HUNT_CLIENT_ID or PRODUCT_HUNT_CLIENT_SECRET");
  process.exit(1);
}

// 1. PH access token
console.log("1. Getting Product Hunt access token...");
const tokenRes = await fetch("https://api.producthunt.com/v2/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    client_id: phClientId,
    client_secret: phClientSecret,
    grant_type: "client_credentials",
  }),
});
if (!tokenRes.ok) {
  console.error(`   FAILED (${tokenRes.status})`);
  process.exit(1);
}
const { access_token } = await tokenRes.json();
console.log(`   OK (${access_token.length} chars)`);

// 2. Fetch latest posts
const postedAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
console.log(`\n2. Fetching posts since ${postedAfter}...`);

const query = `query($first:Int!,$postedAfter:DateTime){posts(first:$first,postedAfter:$postedAfter,order:NEWEST){edges{node{id name tagline votesCount commentsCount}}pageInfo{endCursor hasNextPage}}}`;

const gqlRes = await fetch("https://api.producthunt.com/v2/api/graphql", {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${access_token}`,
  },
  body: JSON.stringify({ query, variables: { first: 5, postedAfter } }),
});
const gqlJson = await gqlRes.json();
if (gqlJson.errors) {
  console.error("   GraphQL errors:", JSON.stringify(gqlJson.errors));
  process.exit(1);
}

const edges = gqlJson?.data?.posts?.edges || [];
console.log(`   OK — ${edges.length} posts (showing up to 5)\n`);
for (const e of edges) {
  const n = e.node;
  console.log(
    `   ${n.name} — ${n.votesCount} votes, ${n.commentsCount} comments (id=${n.id})`,
  );
}

// 3. Supabase connection
console.log("\n3. Testing Supabase...");
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const { count, error } = await supabase
  .from("raw_signals")
  .select("id", { count: "exact", head: true })
  .eq("owner_id", ownerId)
  .eq("source", "product_hunt");

if (error) {
  console.error(`   raw_signals query FAILED: ${error.message}`);
} else {
  console.log(`   OK — ${count} existing product_hunt rows`);
}

const { data: stateData, error: stateErr } = await supabase
  .from("ingestion_state")
  .select("cursor, last_success_at, meta")
  .eq("owner_id", ownerId)
  .eq("source", "product_hunt")
  .eq("mode", "live")
  .maybeSingle();

if (stateErr) {
  console.error(
    `   ingestion_state FAILED: ${stateErr.message} (code: ${stateErr.code})`,
  );
  console.log(
    "   If table missing, run: supabase db push or apply the migration",
  );
} else if (stateData) {
  console.log(`   ingestion_state: last_success_at=${stateData.last_success_at}`);
} else {
  console.log("   ingestion_state: no row yet (first run creates one)");
}

console.log("\n── SUMMARY ─────────────────────────────────");
console.log(`PH API:           OK`);
console.log(`Supabase query:   ${error ? "FAIL" : "OK"}`);
console.log(`ingestion_state:  ${stateErr ? "FAIL — run migration" : "OK"}`);

if (!process.env.SUPABASE_SECRET_KEY) {
  console.log(`\nBLOCKER: SUPABASE_SECRET_KEY is empty.`);
  console.log(`The cron route needs it to bypass RLS (no user session in cron).`);
  console.log(`Get it from: Supabase Dashboard > Settings > API > secret key`);
  console.log(`Then set it in .env.local and in Vercel env vars.`);
}
