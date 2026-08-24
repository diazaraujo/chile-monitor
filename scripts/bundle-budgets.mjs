#!/usr/bin/env node
/**
 * The #7111 client bundle-size gate.
 *
 * The dashboard JS payload grew +151 KB (+11.4%) in five weeks and nothing in
 * CI could see it: `pageWeight.script` only surfaced in a weekly DebugBear
 * email, long after the PRs that shipped the bytes had merged. #7045 gates
 * bootstrap *transfer* (ajax) budgets and never observes the JS bundle.
 *
 * This is the standard mirror-script pair:
 *
 *   npm run bundle:budgets   regenerate scripts/shared/bundle-budgets.json
 *                            from a fresh dist/ (write mode)
 *   npm run bundle:check     compare a fresh dist/ against the committed
 *                            snapshot (check mode; CI runs this in test.yml's
 *                            `unit` job right after the dashboard build)
 *
 * Both modes read an EXISTING dist/ and never build. The dist must come from
 * the same build CI runs, or the numbers are for a different product:
 *
 *   npm run build:pro && VITE_VARIANT=full ./node_modules/.bin/vite build
 *
 * ENV PARITY MATTERS: budgets are seeded from a build with no .env/.env.local
 * present, because that is what CI builds. Local VITE_ vars change dead-code
 * elimination, not just inlined strings — a populated .env moved the protomaps
 * chunk from 18.1 KB to 55.6 KB. When re-seeding, temporarily move .env and
 * .env.local aside (they are symlinks in worktrees) or the snapshot will fail
 * in CI.
 *
 * Scope: hashed rollup chunks in dist/assets/*.js — the payload the issue's
 * DebugBear evidence points at. dist-root PWA files (sw.js, workbox-*.js) are
 * excluded: sw.js embeds the precache manifest, so its bytes churn with every
 * content hash and would make the gate flaky without adding signal.
 *
 * Gate semantics:
 *   - RAW bytes are the gated number. gzip/brotli are recorded per chunk for
 *     reviewer visibility but not gated: compressed output varies with the
 *     zlib build, while raw bytes are identical across environments and are a
 *     superset signal (compressed growth requires raw growth).
 *   - Per chunk, allowed drift is max(DEFAULT_TOLERANCE_BYTES, budget.raw *
 *     DEFAULT_TOLERANCE_PCT / 100) in EITHER direction. Growth past it is the
 *     regression this gate exists for. Shrinkage past it also fails, asking
 *     for a re-seed — a stale, too-generous budget would let the next +151 KB
 *     creep back in invisibly, which is the #7111 failure mode itself.
 *   - New chunks and vanished chunks fail until the snapshot is regenerated,
 *     so code-splitting changes surface as a reviewable JSON diff in the PR.
 *   - The total is gated with the same rule, so growth smeared across many
 *     chunks (each inside its own slack) still trips the gate.
 *
 * Exit codes (every non-pass is nonzero — a gate that soft-fails when it
 * cannot measure is green-while-dead, see check-style-layout-budget.mjs):
 *   0  pass (or snapshot written, in write mode)
 *   1  budget violated / snapshot stale
 *   2  could not measure: dist/ or the committed snapshot is missing/unusable
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { isMainModule } from './lib/main-module.mjs';

export const DEFAULT_TOLERANCE_PCT = 2;
export const DEFAULT_TOLERANCE_BYTES = 2048;

const DEFAULT_DIST_DIR = 'dist';
const DEFAULT_BUDGET_PATH = 'scripts/shared/bundle-budgets.json';
const BUILD_COMMAND = 'npm run build:pro && VITE_VARIANT=full ./node_modules/.bin/vite build';

/**
 * 'main-DYSz1bMh.js' -> 'main'. Vite content hashes are exactly 8 chars of
 * [A-Za-z0-9_-] and may themselves contain '-' ('_live-webcams-origin-BScNR-MD.js'),
 * so the greedy prefix keeps the longest possible chunk name and strips only
 * the final hash segment. Returns null for anything that is not a hashed JS
 * chunk (.br/.map siblings, un-hashed dist-root files, CSS).
 */
export function chunkNameFromFileName(fileName) {
  const match = /^(.+)-[A-Za-z0-9_-]{8}\.js$/.exec(fileName);
  return match ? match[1] : null;
}

export function measureDistChunks(distDir) {
  const assetsDir = join(distDir, 'assets');
  let entries;
  try {
    entries = readdirSync(assetsDir);
  } catch {
    throw new Error(`cannot read ${assetsDir} — run: ${BUILD_COMMAND}`);
  }

  // Several rollup chunks can legitimately share a stable name in ONE build
  // (a real `VITE_VARIANT=full` build emits nine distinct `index-*.js`), so
  // same-name chunks aggregate: sizes sum and the file count is tracked, and a
  // count change forces a re-seed just like a renamed chunk does. Stale mixed
  // dist/ trees are not a concern — vite empties outDir on every build.
  const chunks = {};
  for (const fileName of entries.sort()) {
    const name = chunkNameFromFileName(fileName);
    if (!name) continue;
    const filePath = join(assetsDir, fileName);
    if (!statSync(filePath).isFile()) continue;
    const buffer = readFileSync(filePath);
    const entry = (chunks[name] ??= { raw: 0, gzip: 0, brotli: 0, files: 0 });
    entry.files += 1;
    entry.raw += buffer.length;
    entry.gzip += gzipSync(buffer, { level: 9 }).length;
    entry.brotli += brotliCompressSync(buffer, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
        [zlibConstants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
      },
    }).length;
  }

  const names = Object.keys(chunks);
  if (names.length === 0) {
    throw new Error(`no hashed JS chunks in ${assetsDir} — run: ${BUILD_COMMAND}`);
  }

  const total = { raw: 0, gzip: 0, brotli: 0 };
  for (const name of names) {
    total.raw += chunks[name].raw;
    total.gzip += chunks[name].gzip;
    total.brotli += chunks[name].brotli;
  }
  return { chunks, total };
}

export function buildBudgetSnapshot(measured) {
  const chunks = {};
  for (const name of Object.keys(measured.chunks).sort()) {
    const { raw, gzip, brotli, files } = measured.chunks[name];
    chunks[name] = { raw, gzip, brotli, files };
  }
  return {
    comment:
      'Client bundle-size budgets (#7111). Gated on raw bytes per chunk and in '
      + `total, ±max(${DEFAULT_TOLERANCE_BYTES} B, ${DEFAULT_TOLERANCE_PCT}%) per entry. `
      + `Regenerate after "${BUILD_COMMAND}" with: npm run bundle:budgets`,
    variant: 'full',
    tolerancePct: DEFAULT_TOLERANCE_PCT,
    toleranceBytes: DEFAULT_TOLERANCE_BYTES,
    total: { ...measured.total },
    chunks,
  };
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

function slackFor(budgetRaw, { tolerancePct, toleranceBytes }) {
  return Math.max(toleranceBytes, Math.round((budgetRaw * tolerancePct) / 100));
}

export function compareBundleBudgets(measured, budget, tolerances = {}) {
  const tolerance = {
    tolerancePct: tolerances.tolerancePct ?? budget.tolerancePct ?? DEFAULT_TOLERANCE_PCT,
    toleranceBytes: tolerances.toleranceBytes ?? budget.toleranceBytes ?? DEFAULT_TOLERANCE_BYTES,
  };
  const failures = [];
  const reseed = 'rerun the build above, then `npm run bundle:budgets`, and commit the snapshot diff';

  for (const [name, budgeted] of Object.entries(budget.chunks)) {
    const built = measured.chunks[name];
    if (!built) {
      failures.push(`chunk "${name}" is in the budget but missing from the build — if it was renamed or removed, ${reseed}`);
      continue;
    }
    if (budgeted.files != null && built.files !== budgeted.files) {
      failures.push(
        `chunk "${name}" is now ${built.files} file(s), budgeted as ${budgeted.files} — code splitting changed; ${reseed}`,
      );
    }
    const slack = slackFor(budgeted.raw, tolerance);
    const delta = built.raw - budgeted.raw;
    if (delta > slack) {
      failures.push(
        `chunk "${name}" grew ${kb(delta)}: ${kb(budgeted.raw)} budgeted -> ${kb(built.raw)} built `
        + `(allowed drift ${kb(slack)}). If the growth is intended, ${reseed}`,
      );
    } else if (-delta > slack) {
      failures.push(
        `chunk "${name}" shrank ${kb(-delta)}: ${kb(budgeted.raw)} budgeted -> ${kb(built.raw)} built. `
        + `Ratchet the budget down so the headroom cannot silently refill — ${reseed}`,
      );
    }
  }

  for (const name of Object.keys(measured.chunks)) {
    if (!budget.chunks[name]) {
      failures.push(
        `chunk "${name}" (${kb(measured.chunks[name].raw)}) is in the build but not in the budget — ${reseed}`,
      );
    }
  }

  const totalSlack = slackFor(budget.total.raw, tolerance);
  const totalDelta = measured.total.raw - budget.total.raw;
  if (Math.abs(totalDelta) > totalSlack) {
    const direction = totalDelta > 0 ? 'grew' : 'shrank';
    failures.push(
      `total JS payload ${direction} ${kb(Math.abs(totalDelta))}: ${kb(budget.total.raw)} budgeted -> `
      + `${kb(measured.total.raw)} built (allowed drift ${kb(totalSlack)}) — ${reseed}`,
    );
  }

  return { ok: failures.length === 0, failures };
}

function parseArgs(argv) {
  const args = { check: false, dist: DEFAULT_DIST_DIR, budget: DEFAULT_BUDGET_PATH };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--dist') args.dist = argv[(i += 1)];
    else if (arg === '--budget') args.budget = argv[(i += 1)];
    else {
      console.error(`bundle-budgets: unknown argument "${arg}"`);
      process.exit(2);
    }
  }
  if (!args.dist || !args.budget) {
    console.error('bundle-budgets: --dist and --budget need a value');
    process.exit(2);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  let measured;
  try {
    measured = measureDistChunks(resolve(args.dist));
  } catch (error) {
    console.error(`bundle-budgets: ${error.message}`);
    process.exit(2);
  }

  if (!args.check) {
    const snapshot = buildBudgetSnapshot(measured);
    writeFileSync(resolve(args.budget), `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(
      `bundle-budgets: wrote ${Object.keys(snapshot.chunks).length} chunk budgets `
      + `(total ${kb(snapshot.total.raw)} raw / ${kb(snapshot.total.gzip)} gzip) to ${args.budget}`,
    );
    return;
  }

  let budget;
  try {
    budget = JSON.parse(readFileSync(resolve(args.budget), 'utf8'));
  } catch (error) {
    console.error(`bundle-budgets: cannot read budget ${args.budget}: ${error.message}`);
    process.exit(2);
  }

  const result = compareBundleBudgets(measured, budget);
  if (!result.ok) {
    console.error(`bundle:check FAILED — ${result.failures.length} violation(s):`);
    for (const failure of result.failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(
    `bundle:check OK — ${Object.keys(budget.chunks).length} chunks within `
    + `±max(${budget.toleranceBytes ?? DEFAULT_TOLERANCE_BYTES} B, ${budget.tolerancePct ?? DEFAULT_TOLERANCE_PCT}%) `
    + `(total ${kb(measured.total.raw)} raw)`,
  );
}

if (isMainModule(import.meta.url, process.argv[1])) {
  main();
}
