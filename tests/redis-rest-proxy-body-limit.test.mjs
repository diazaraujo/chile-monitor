// #7099 — docker/redis-rest-proxy.mjs capped request bodies at 1MB and answered
// an over-cap body with `req.destroy()` and NO HTTP response. Two failures in one:
//
//   1. Every stock seeder may publish up to MAX_PAYLOAD_BYTES (5MB, see
//      scripts/_seed-utils.mjs) per key, and atomicPublish sends that payload as a
//      JSON *string* inside a command array — so the wire body is always LARGER
//      than the payload. 1MB was below every seeder's ceiling, not just the fire
//      seeder's; on a self-host install `wildfire:fires:v1` was never written.
//   2. Destroying the socket means the caller sees `write EPIPE` /
//      `other side closed` with no status, which reads as an UPSTREAM outage.
//      Six scheduled runs were misdiagnosed as a NASA FIRMS connectivity problem.
//
// The proxy connects to Redis and calls server.listen() as top-level side effects
// on import (and `redis` is only installed inside the container image), so it
// cannot be imported here — extract the real source of the body-limit helpers and
// eval them standalone, same as redis-rest-proxy-url-masking.test.mjs does for
// maskRedisUrl.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MAX_PAYLOAD_BYTES } from '../scripts/_seed-utils.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const proxySrc = readFileSync(resolve(here, '../docker/redis-rest-proxy.mjs'), 'utf8');

// Line comments are stripped only for the wiring assertions, so a commented-out
// call site can never satisfy a "this is actually wired up" check.
const proxyCode = proxySrc.replace(/^\s*\/\/.*$/gm, '');

const EXTRACTS = {
  DEFAULT_MAX_BODY_BYTES: /const DEFAULT_MAX_BODY_BYTES = [^;]+;/,
  resolveMaxBodyBytes: /function resolveMaxBodyBytes\([\s\S]*?\n\}/,
  MAX_BODY_BYTES: /const MAX_BODY_BYTES = [^;]+;/,
  OVERSIZE_DRAIN_BYTES: /const OVERSIZE_DRAIN_BYTES = [^;]+;/,
  PayloadTooLargeError: /class PayloadTooLargeError extends Error \{[\s\S]*?\n\}/,
  readBody: /function readBody\([\s\S]*?\n\}/,
  respondError: /function respondError\([\s\S]*?\n\}/,
};

const sources = Object.fromEntries(
  Object.entries(EXTRACTS).map(([name, re]) => [name, proxySrc.match(re)?.[0]]),
);

function buildHelpers(env = {}) {
  const src = Object.values(sources).join('\n\n');
  // eslint-disable-next-line no-new-func
  return new Function(
    'process',
    'console',
    `${src}\nreturn { DEFAULT_MAX_BODY_BYTES, MAX_BODY_BYTES, OVERSIZE_DRAIN_BYTES, resolveMaxBodyBytes, PayloadTooLargeError, readBody, respondError };`,
  )({ env }, { warn() {}, log() {}, error() {} });
}

// A faithful stand-in for the proxy's own POST / handler: read the body through
// the real readBody, answer errors through the real respondError. Anything the
// client observes here is what the container would answer.
function startProbeServer({ limit, drainLimit } = {}) {
  const helpers = buildHelpers();
  const server = http.createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json');
    try {
      const body = await helpers.readBody(
        req,
        limit ?? helpers.MAX_BODY_BYTES,
        drainLimit ?? helpers.OVERSIZE_DRAIN_BYTES,
      );
      res.writeHead(200);
      res.end(JSON.stringify({ result: 'OK', bytes: Buffer.byteLength(body, 'utf8') }));
    } catch (err) {
      helpers.respondError(res, err);
    }
  });
  return new Promise((res) => {
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }));
  });
}

const openServers = [];
async function probeServer(opts) {
  const started = await startProbeServer(opts);
  openServers.push(started.server);
  return started;
}
after(() => {
  for (const server of openServers) server.close();
});

async function post(port, body) {
  return fetch(`http://127.0.0.1:${port}/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

// The exact wire shape atomicPublish sends: the canonical payload is a JSON
// string nested inside the command array, so every `"` in it is escaped.
function seedCommandBody(payloadBytes) {
  const record = JSON.stringify({
    id: '30.12345--100.54321-2026-08-24-0612',
    location: { latitude: 30.12345, longitude: -100.54321 },
    brightness: 331.5,
    frp: 12.3,
    confidence: 'nominal',
    satellite: 'N21',
    detectedAt: 1756000000000,
    region: 'North America',
    dayNight: 'D',
    possibleExplosion: false,
    source: 'firms',
    kind: 'active',
    emergency: true,
  });
  const copies = Math.max(1, Math.ceil(payloadBytes / (record.length + 1)));
  const payload = `{"fireDetections":[${new Array(copies).fill(record).join(',')}]}`;
  return JSON.stringify(['SET', 'wildfire:fires:v1', payload, 'EX', 7200]);
}

describe('redis-rest proxy body limit (#7099)', () => {
  it('exposes every body-limit helper the tests drive', () => {
    for (const [name, src] of Object.entries(sources)) {
      assert.ok(src, `${name} not found in docker/redis-rest-proxy.mjs`);
    }
  });

  it('accepts the ~5MB canonical publish the fire seeder deliberately produces', async () => {
    const { port } = await probeServer();
    // 5MB payload → ~5.7MB on the wire once escaped. Under the old 1MB cap this
    // never reached an HTTP status at all: `write EPIPE` / `other side closed`.
    const body = seedCommandBody(5 * 1024 * 1024);
    assert.ok(
      Buffer.byteLength(body, 'utf8') > 1024 * 1024,
      'probe body must exceed the old 1MB cap to reproduce the bug',
    );
    const resp = await post(port, body);
    assert.equal(resp.status, 200);
    const json = await resp.json();
    assert.equal(json.bytes, Buffer.byteLength(body, 'utf8'), 'body must arrive intact');
  });

  it('answers an over-cap body with 413 and a JSON error, never a destroyed socket', async () => {
    const limit = 4096;
    const { port } = await probeServer({ limit, drainLimit: limit * 2 });
    const resp = await post(port, 'x'.repeat(limit + 512));
    // The whole point of the fix: a status, not a transport failure. A rejected
    // fetch (EPIPE / "other side closed") fails this test by throwing above.
    assert.equal(resp.status, 413);
    const json = await resp.json();
    assert.match(json.error, /too large/i);
    assert.match(json.error, new RegExp(String(limit)), 'the limit must be in the error text');
  });

  it('413 is retryable-permanent for the seeder retry policy', async () => {
    const { PERMANENT_4XX_STATUSES } = await import('../scripts/_seed-utils.mjs');
    // Without this, atomicPublish burns all 3 attempts on a limit that will
    // never pass. 413 is already in the set — this pins the pairing.
    assert.ok(PERMANENT_4XX_STATUSES.has(413));
  });

  it('a body under the cap still round-trips byte-for-byte', async () => {
    const limit = 4096;
    const { port } = await probeServer({ limit, drainLimit: limit * 2 });
    const body = JSON.stringify(['SET', 'k', 'v'.repeat(limit - 64)]);
    const resp = await post(port, body);
    assert.equal(resp.status, 200);
    assert.equal((await resp.json()).bytes, Buffer.byteLength(body, 'utf8'));
  });

  it('stops draining past the drain cap instead of becoming an unbounded sink', async () => {
    const limit = 1024;
    const { port } = await probeServer({ limit, drainLimit: limit * 2 });
    // Far past the drain budget: the proxy gives up rather than reading forever.
    // Either outcome is acceptable (413 if the response won the race, a transport
    // error if the socket closed first) — what must NOT happen is hanging.
    let outcome;
    try {
      const resp = await post(port, 'x'.repeat(limit * 200));
      outcome = `status:${resp.status}`;
      await resp.arrayBuffer();
    } catch (err) {
      outcome = `threw:${err?.cause?.code || err?.message}`;
    }
    assert.ok(outcome, 'request must settle, not hang');
    assert.doesNotMatch(outcome, /^status:2/, 'an over-cap body must never be accepted');
  });

  describe('MAX_BODY_BYTES sizing', () => {
    it('clears the worst-case JSON-command encoding of the largest stock seeder payload', () => {
      const { DEFAULT_MAX_BODY_BYTES } = buildHelpers();
      // atomicPublish nests the payload as a JSON string inside ["SET", key,
      // <payload>, "EX", ttl]. Escaping is at most 2x (a payload of nothing but
      // quotes), plus the command envelope. Raise MAX_PAYLOAD_BYTES and this
      // goes red — which is the point.
      const worstCase = 2 * MAX_PAYLOAD_BYTES + 1024;
      assert.ok(
        DEFAULT_MAX_BODY_BYTES >= worstCase,
        `DEFAULT_MAX_BODY_BYTES (${DEFAULT_MAX_BODY_BYTES}) must be >= ${worstCase} — the worst-case wire size of a ${MAX_PAYLOAD_BYTES}-byte seeder payload`,
      );
    });

    it('pairs the cap with a drain budget that is generous but bounded', () => {
      const { MAX_BODY_BYTES, OVERSIZE_DRAIN_BYTES } = buildHelpers();
      // Zero drain headroom puts us back on the destroyed socket for every
      // over-cap body; unbounded headroom turns the proxy into a free sink.
      assert.ok(
        OVERSIZE_DRAIN_BYTES > MAX_BODY_BYTES,
        'an over-cap body needs drain headroom, or it can never be answered with 413',
      );
      assert.ok(
        OVERSIZE_DRAIN_BYTES <= MAX_BODY_BYTES * 4,
        `drain budget ${OVERSIZE_DRAIN_BYTES} must stay a small multiple of the ${MAX_BODY_BYTES} cap`,
      );
    });

    it('honours SRH_MAX_BODY_BYTES', () => {
      const { resolveMaxBodyBytes } = buildHelpers();
      assert.equal(resolveMaxBodyBytes({ SRH_MAX_BODY_BYTES: '2097152' }), 2097152);
    });

    it('falls back to the default for unset, empty, and nonsense values', () => {
      const { resolveMaxBodyBytes, DEFAULT_MAX_BODY_BYTES } = buildHelpers();
      for (const raw of [undefined, '', '   ', '0', '-1', 'lots', '1.5', 'NaN', 'Infinity']) {
        assert.equal(
          resolveMaxBodyBytes(raw === undefined ? {} : { SRH_MAX_BODY_BYTES: raw }),
          DEFAULT_MAX_BODY_BYTES,
          `SRH_MAX_BODY_BYTES=${JSON.stringify(raw)} must fall back to the default`,
        );
      }
    });
  });

  describe('wiring', () => {
    it('readBody destroys the socket only past the drain cap, never on first overflow', () => {
      const body = sources.readBody.replace(/^\s*\/\/.*$/gm, '');
      const destroys = [...body.matchAll(/req\.destroy\(\)/g)];
      // Destroying the moment the body cap is passed is exactly the bug: the
      // caller loses the status and sees EPIPE. The one permitted destroy is the
      // bounded-sink backstop, and it must be guarded by the drain cap.
      assert.equal(destroys.length, 1, 'readBody must destroy the request at exactly one site');
      const guard = body.slice(0, destroys[0].index).match(/if \(totalLength > (\w+)\)\s*\{\s*$/m);
      assert.ok(guard, 'the destroy must sit directly under a totalLength comparison');
      assert.equal(guard[1], 'drainLimit', 'the destroy must be guarded by the drain cap, not the body cap');
    });

    it('the POST handlers read through readBody and errors go through respondError', () => {
      assert.match(proxyCode, /await readBody\(req\)/, 'POST handlers must use readBody');
      assert.match(proxyCode, /catch \(err\) \{\s*respondError\(res, err\);/, 'the handler catch must map status via respondError');
      assert.doesNotMatch(proxyCode, /catch \(err\) \{\s*res\.writeHead\(500\);/, 'a hardcoded 500 swallows the 413');
    });

    it('MAX_BODY_BYTES comes from resolveMaxBodyBytes, not a literal', () => {
      assert.match(proxyCode, /const MAX_BODY_BYTES = resolveMaxBodyBytes\(\);/);
    });
  });
});
