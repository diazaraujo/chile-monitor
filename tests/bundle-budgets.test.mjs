import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, test } from 'node:test';
import {
  DEFAULT_TOLERANCE_BYTES,
  DEFAULT_TOLERANCE_PCT,
  buildBudgetSnapshot,
  chunkNameFromFileName,
  compareBundleBudgets,
  measureDistChunks,
} from '../scripts/bundle-budgets.mjs';

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'scripts',
  'bundle-budgets.mjs',
);

const fixtures = [];
after(() => {
  for (const root of fixtures) rmSync(root, { recursive: true, force: true });
});

/** Repeating-pattern content: compressible, like real minified JS. */
function chunkContent(bytes) {
  return 'export const x = "worldmonitor bundle budget fixture ";\n'.repeat(
    Math.ceil(bytes / 56),
  ).slice(0, bytes);
}

function makeDistFixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'wm-bundle-budgets-'));
  fixtures.push(root);
  const assets = join(root, 'assets');
  mkdirSync(assets, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) {
    writeFileSync(join(assets, name), chunkContent(bytes));
  }
  return root;
}

describe('chunkNameFromFileName', () => {
  test('strips the trailing content hash', () => {
    assert.equal(chunkNameFromFileName('main-DYSz1bMh.js'), 'main');
    assert.equal(chunkNameFromFileName('h3-js-a1B2c3D4.js'), 'h3-js');
    // Hashes are exactly 8 chars and may themselves contain '-'.
    assert.equal(chunkNameFromFileName('_live-webcams-origin-BScNR-MD.js'), '_live-webcams-origin');
  });

  test('rejects non-chunk files', () => {
    assert.equal(chunkNameFromFileName('main-DYSz1bMh.js.br'), null);
    assert.equal(chunkNameFromFileName('main-DYSz1bMh.js.map'), null);
    assert.equal(chunkNameFromFileName('sw.js'), null);
    assert.equal(chunkNameFromFileName('style-Ab12Cd34.css'), null);
  });
});

describe('measureDistChunks', () => {
  test('measures raw, gzip, and brotli bytes per stable chunk name', () => {
    const dist = makeDistFixture({
      'main-DYSz1bMh.js': 10_000,
      'd3-Ab12Cd34.js': 5_000,
    });
    writeFileSync(join(dist, 'assets', 'main-DYSz1bMh.js.br'), 'not a chunk');
    const measured = measureDistChunks(dist);
    assert.deepEqual(Object.keys(measured.chunks).sort(), ['d3', 'main']);
    assert.equal(measured.chunks.main.raw, 10_000);
    assert.equal(measured.chunks.d3.raw, 5_000);
    assert.ok(measured.chunks.main.gzip > 0);
    assert.ok(measured.chunks.main.gzip < 10_000, 'fixture content must compress');
    assert.ok(measured.chunks.main.brotli > 0);
    assert.equal(measured.total.raw, 15_000);
    assert.equal(
      measured.total.gzip,
      measured.chunks.main.gzip + measured.chunks.d3.gzip,
    );
  });

  test('aggregates same-name chunks from one build and counts the files', () => {
    // A real full-variant build emits nine distinct index-*.js chunks.
    const dist = makeDistFixture({
      'index-BLxGuKBb.js': 4_000,
      'index-BTEierCQ.js': 6_000,
      'main-DYSz1bMh.js': 10_000,
    });
    const measured = measureDistChunks(dist);
    assert.equal(measured.chunks.index.raw, 10_000);
    assert.equal(measured.chunks.index.files, 2);
    assert.equal(measured.chunks.main.files, 1);
  });

  test('throws when the dist dir has no hashed JS chunks', () => {
    const dist = makeDistFixture({});
    assert.throws(() => measureDistChunks(dist), /no hashed JS chunks/i);
  });
});

describe('compareBundleBudgets', () => {
  const budgetFor = (files) => buildBudgetSnapshot(measureDistChunks(makeDistFixture(files)));

  test('clean tree passes', () => {
    const budget = budgetFor({ 'main-DYSz1bMh.js': 800_000, 'd3-Ab12Cd34.js': 60_000 });
    const measured = measureDistChunks(
      makeDistFixture({ 'main-Xx99Yy88.js': 800_000, 'd3-Qq77Rr66.js': 60_000 }),
    );
    const result = compareBundleBudgets(measured, budget);
    assert.deepEqual(result.failures, []);
    assert.equal(result.ok, true);
  });

  test('growth within tolerance passes', () => {
    const budget = budgetFor({ 'main-DYSz1bMh.js': 800_000 });
    const measured = measureDistChunks(makeDistFixture({ 'main-Xx99Yy88.js': 804_000 }));
    assert.equal(compareBundleBudgets(measured, budget).ok, true);
  });

  test('a +50 KB import on a tracked chunk fails, naming the chunk and the total', () => {
    const budget = budgetFor({ 'main-DYSz1bMh.js': 800_000 });
    const measured = measureDistChunks(makeDistFixture({ 'main-Xx99Yy88.js': 851_200 }));
    const result = compareBundleBudgets(measured, budget);
    assert.equal(result.ok, false);
    assert.ok(
      result.failures.some((f) => f.includes('main') && f.includes('grew')),
      `expected a main growth failure, got: ${JSON.stringify(result.failures)}`,
    );
    assert.ok(
      result.failures.some((f) => f.includes('total')),
      `expected a total failure, got: ${JSON.stringify(result.failures)}`,
    );
  });

  test('shrinking past tolerance fails and asks for a ratchet re-seed', () => {
    const budget = budgetFor({ 'main-DYSz1bMh.js': 800_000 });
    const measured = measureDistChunks(makeDistFixture({ 'main-Xx99Yy88.js': 740_000 }));
    const result = compareBundleBudgets(measured, budget);
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((f) => f.includes('shrank') && f.includes('bundle:budgets')));
  });

  test('a new untracked chunk fails until the snapshot is regenerated', () => {
    const budget = budgetFor({ 'main-DYSz1bMh.js': 800_000 });
    const measured = measureDistChunks(
      makeDistFixture({ 'main-Xx99Yy88.js': 800_000, 'heavy-dep-Ab12Cd34.js': 90_000 }),
    );
    const result = compareBundleBudgets(measured, budget);
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((f) => f.includes('heavy-dep') && f.includes('not in the budget')));
  });

  test('a changed same-name file count fails even when total bytes are stable', () => {
    const budget = budgetFor({ 'index-BLxGuKBb.js': 4_000, 'index-BTEierCQ.js': 6_000 });
    const measured = measureDistChunks(makeDistFixture({ 'index-Xx99Yy88.js': 10_000 }));
    const result = compareBundleBudgets(measured, budget);
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((f) => f.includes('index') && f.includes('file(s)')));
  });

  test('a budgeted chunk missing from the build fails', () => {
    const budget = budgetFor({ 'main-DYSz1bMh.js': 800_000, 'd3-Ab12Cd34.js': 60_000 });
    const measured = measureDistChunks(makeDistFixture({ 'main-Xx99Yy88.js': 800_000 }));
    const result = compareBundleBudgets(measured, budget);
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((f) => f.includes('d3') && f.includes('missing')));
  });

  test('default tolerance is a floor of bytes or a percentage, whichever is larger', () => {
    assert.equal(DEFAULT_TOLERANCE_PCT, 2);
    assert.equal(DEFAULT_TOLERANCE_BYTES, 2048);
    // A tiny chunk can move by the byte floor even when 2% would be less.
    const budget = budgetFor({ 'tiny-Ab12Cd34.js': 4_000 });
    const measured = measureDistChunks(makeDistFixture({ 'tiny-Xx99Yy88.js': 5_900 }));
    assert.equal(compareBundleBudgets(measured, budget).ok, true);
  });
});

describe('bundle-budgets CLI', () => {
  function runCli(args) {
    return spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: 'utf8' });
  }

  test('--check exits 0 against a budget seeded from the same dist', () => {
    const dist = makeDistFixture({ 'main-DYSz1bMh.js': 100_000 });
    const budgetPath = join(dist, 'budget.json');
    const write = runCli(['--dist', dist, '--budget', budgetPath]);
    assert.equal(write.status, 0, write.stderr);
    const check = runCli(['--check', '--dist', dist, '--budget', budgetPath]);
    assert.equal(check.status, 0, check.stderr);
  });

  test('--check exits 1 when a chunk grew past tolerance', () => {
    const dist = makeDistFixture({ 'main-DYSz1bMh.js': 100_000 });
    const budgetPath = join(dist, 'budget.json');
    assert.equal(runCli(['--dist', dist, '--budget', budgetPath]).status, 0);
    writeFileSync(join(dist, 'assets', 'main-DYSz1bMh.js'), chunkContent(160_000));
    const check = runCli(['--check', '--dist', dist, '--budget', budgetPath]);
    assert.equal(check.status, 1);
    assert.ok(check.stderr.includes('grew'), check.stderr);
  });

  test('--check exits 2 when dist is missing — never a silent pass', () => {
    const dist = makeDistFixture({ 'main-DYSz1bMh.js': 100_000 });
    const budgetPath = join(dist, 'budget.json');
    assert.equal(runCli(['--dist', dist, '--budget', budgetPath]).status, 0);
    const check = runCli(['--check', '--dist', join(dist, 'nope'), '--budget', budgetPath]);
    assert.equal(check.status, 2);
  });

  test('--check exits 2 when the committed budget is absent', () => {
    const dist = makeDistFixture({ 'main-DYSz1bMh.js': 100_000 });
    const check = runCli(['--check', '--dist', dist, '--budget', join(dist, 'absent.json')]);
    assert.equal(check.status, 2);
  });
});
