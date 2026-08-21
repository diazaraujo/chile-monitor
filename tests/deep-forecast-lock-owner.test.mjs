/**
 * Regression tests for owner-checked deep-forecast task cleanup.
 *
 * completeDeepForecastTask / releaseDeepForecastTask previously deleted the
 * claim lock unconditionally. A worker whose FORECAST_DEEP_LOCK_TTL_SECONDS
 * (20 min) expired mid-run could then delete a lock re-claimed by another
 * worker, letting a third worker double-run the same runId. The fix mirrors
 * _SIM_TASK_COMPLETE_LUA / _SIM_LOCK_RELEASE_LUA: only the lock OWNER may
 * clean up.
 *
 * Run: node --test tests/deep-forecast-lock-owner.test.mjs
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  __setRedisStoreForTests,
  completeDeepForecastTask,
  releaseDeepForecastTask,
} from '../scripts/seed-forecasts.mjs';

const QUEUE_KEY = 'forecast:deep-task-queue:v1';
const taskKey = (runId) => `forecast:deep-task:v1:${runId}`;
const lockKey = (runId) => `forecast:deep-lock:v1:${runId}`;

describe('owner-checked deep-forecast cleanup', () => {
  beforeEach(() => {
    __setRedisStoreForTests(null);
  });

  it('completes when the caller still owns the lock', async () => {
    const store = {
      [QUEUE_KEY]: ['run-1'],
      [taskKey('run-1')]: '{"runId":"run-1"}',
      [lockKey('run-1')]: 'worker-A',
    };
    __setRedisStoreForTests(store);

    await completeDeepForecastTask('run-1', 'worker-A');

    assert.equal(store[QUEUE_KEY].includes('run-1'), false);
    assert.equal(store[taskKey('run-1')], undefined);
    assert.equal(store[lockKey('run-1')], undefined);
  });

  it('refuses to clean up a lock owned by another worker (double-run guard)', async () => {
    const store = {
      [QUEUE_KEY]: ['run-1'],
      [taskKey('run-1')]: '{"runId":"run-1"}',
      // Lock expired, then worker-B re-claimed it; stale worker-A finishes.
      [lockKey('run-1')]: 'worker-B',
    };
    __setRedisStoreForTests(store);

    await completeDeepForecastTask('run-1', 'worker-A');

    // Everything must be preserved for the current owner's lifecycle.
    assert.equal(store[QUEUE_KEY].includes('run-1'), true);
    assert.equal(store[taskKey('run-1')], '{"runId":"run-1"}');
    assert.equal(store[lockKey('run-1')], 'worker-B');
  });

  it('leaves the task re-claimable when the lock expired with no new claimant', async () => {
    const store = {
      [QUEUE_KEY]: ['run-1'],
      [taskKey('run-1')]: '{"runId":"run-1"}',
    };
    __setRedisStoreForTests(store);

    await completeDeepForecastTask('run-1', 'worker-A');

    assert.equal(store[QUEUE_KEY].includes('run-1'), true);
    assert.equal(store[taskKey('run-1')], '{"runId":"run-1"}');
    assert.equal(store[lockKey('run-1')], undefined);
  });

  it('releases its own lock but never another worker\u2019s', async () => {
    const own = { [lockKey('run-1')]: 'worker-A' };
    __setRedisStoreForTests(own);
    await releaseDeepForecastTask('run-1', 'worker-A');
    assert.equal(own[lockKey('run-1')], undefined);

    const other = { [lockKey('run-2')]: 'worker-B' };
    __setRedisStoreForTests(other);
    await releaseDeepForecastTask('run-2', 'worker-A');
    assert.equal(other[lockKey('run-2')], 'worker-B');
  });

  it('keeps legacy unconditional behavior when no workerId is passed', async () => {
    const store = {
      [QUEUE_KEY]: ['run-1'],
      [taskKey('run-1')]: '{"runId":"run-1"}',
      [lockKey('run-1')]: 'someone-else',
    };
    __setRedisStoreForTests(store);

    await completeDeepForecastTask('run-1');

    assert.equal(store[QUEUE_KEY].includes('run-1'), false);
    assert.equal(store[taskKey('run-1')], undefined);
    assert.equal(store[lockKey('run-1')], undefined);
  });
});
