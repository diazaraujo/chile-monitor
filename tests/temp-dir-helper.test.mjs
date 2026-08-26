// Guards tests/helpers/temp-dir.mjs.
//
// The point of the helper is that cleanup survives a THROWN test. Asserting
// that from inside a passing test proves nothing, so the exception cases run
// in child processes whose temp-dir paths are printed on stdout and checked
// from here after the child has exited.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTempDir, pendingTempDirCount, removeTempDir } from './helpers/temp-dir.mjs';

const helperUrl = new URL('./helpers/temp-dir.mjs', import.meta.url).href;

/** Run `body` in a child node process; return {stdout, status}. */
function runChild(body) {
  const source = `import { createTempDir } from ${JSON.stringify(helperUrl)};\n${body}`;
  const result = execFileSync(
    process.execPath,
    ['--input-type=module', '--eval', source],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] , env: { ...process.env } },
  );
  return result.trim();
}

/** Same, but the child is expected to exit non-zero. */
function runFailingChild(body) {
  const source = `import { createTempDir } from ${JSON.stringify(helperUrl)};\n${body}`;
  try {
    execFileSync(process.execPath, ['--input-type=module', '--eval', source], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout: '', threw: false };
  } catch (error) {
    return { stdout: String(error.stdout ?? '').trim(), threw: true };
  }
}

describe('createTempDir', () => {
  it('creates a usable directory', (t) => {
    const dir = createTempDir('wm-temp-helper-basic-', t);
    writeFileSync(join(dir, 'probe.txt'), 'ok');
    assert.ok(existsSync(join(dir, 'probe.txt')));
  });

  it('removes the directory when the test context ends', () => {
    // Capture the path from a nested test run so we can assert after it ends.
    let captured;
    const fakeContext = {
      hooks: [],
      after(fn) {
        this.hooks.push(fn);
      },
    };
    captured = createTempDir('wm-temp-helper-ctx-', fakeContext);
    assert.ok(existsSync(captured), 'directory should exist before cleanup');
    assert.equal(fakeContext.hooks.length, 1, 'cleanup must be registered at creation');
    for (const fn of fakeContext.hooks) fn();
    assert.equal(existsSync(captured), false, 'directory should be gone after t.after ran');
  });

  it('registers for the exit sweep when no test context is given', () => {
    const before = pendingTempDirCount();
    const dir = createTempDir('wm-temp-helper-sweep-');
    assert.equal(pendingTempDirCount(), before + 1);
    removeTempDir(dir);
    assert.equal(pendingTempDirCount(), before, 'removeTempDir must deregister');
    assert.equal(existsSync(dir), false);
  });

  it('cleans up after a child process exits normally', () => {
    const dir = runChild(
      "const d = createTempDir('wm-temp-helper-child-'); console.log(d);",
    );
    assert.ok(dir.length > 0, 'child should print the temp dir path');
    assert.equal(existsSync(dir), false, `child temp dir leaked: ${dir}`);
  });

  it('cleans up even when the child THROWS', () => {
    const { stdout, threw } = runFailingChild(
      "const d = createTempDir('wm-temp-helper-throw-'); console.log(d); throw new Error('boom');",
    );
    assert.equal(threw, true, 'child was supposed to fail');
    assert.ok(stdout.length > 0, 'child should have printed the path before throwing');
    assert.equal(existsSync(stdout), false, `temp dir leaked on throw: ${stdout}`);
  });

  it('cleans up when the child exits non-zero without throwing', () => {
    const { stdout } = runFailingChild(
      "const d = createTempDir('wm-temp-helper-exit1-'); console.log(d); process.exitCode = 1;",
    );
    assert.ok(stdout.length > 0);
    assert.equal(existsSync(stdout), false, `temp dir leaked on exit 1: ${stdout}`);
  });
});
