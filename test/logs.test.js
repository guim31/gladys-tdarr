// -----------------------------------------------------------------------------
// What the integration writes at the default level (info): the lifecycle
// only. A normal reading writes nothing, a failure that repeats is logged
// once, and its end once. Never an API key (the server's, nor the ones of
// the nodes that /get-nodes answers).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './helpers/world.js';

/** Capture the lines of the SDK logger at LOG_LEVEL=info. */
function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  const record =
    (stream) =>
    (...args) =>
      lines.push({
        stream,
        text: args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(' '),
      });
  t.mock.method(console, 'log', record('out'));
  t.mock.method(console, 'error', record('err'));
  return {
    lines,
    clear: () => lines.splice(0),
    texts: () => lines.map((line) => line.text),
  };
}

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('a normal reading cycle writes nothing at info', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  assert.ok(
    logs.texts().some((text) => text.includes('connected')),
    'the start is logged',
  );
  logs.clear();
  for (let i = 0; i < 5; i += 1) {
    w.tdarr.setQueues(10 - i);
    w.tdarr.setWorkers('InternalNode', i % 2);
    w.clock.advance(60 * 60_000); // the status is read again too
    await w.hub.pollAll();
  }
  assert.deepEqual(logs.texts(), []);
});

test('a server that stays down is logged once, and once when it is back', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  logs.clear();
  w.tdarr.online = false;
  for (let i = 0; i < 6; i += 1) {
    w.clock.advance(60_000);
    await w.hub.pollAll();
  }
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.equal(logs.lines[0].stream, 'err');
  logs.clear();
  w.tdarr.online = true;
  await w.hub.pollAll();
  await w.hub.pollAll();
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.match(logs.lines[0].text, /connection restored/);
});

test('a refused API key is logged once, never the key', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t, { config: { url: '192.0.2.10', api_key: 'wrong-key-42' } });
  for (let i = 0; i < 5; i += 1) {
    await w.hub.pollAll();
  }
  const warnings = logs.lines.filter((line) => line.stream === 'err');
  assert.equal(warnings.length, 1, logs.texts().join('\n'));
  assert.match(warnings[0].text, /API key refused/);
  assert.ok(!logs.texts().join('\n').includes('wrong-key-42'), 'never the key');
});

test('a failing error table is logged once, the rest keeps working', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  logs.clear();
  const original = w.tdarr.handle.bind(w.tdarr);
  w.tdarr.handle = (url, options) =>
    url.includes('/client/status-tables')
      ? { status: 500, headers: {}, body: '' }
      : original(url, options);
  for (let i = 0; i < 4; i += 1) {
    w.tdarr.addFailure(w.clock.now());
    await w.hub.pollAll();
  }
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.match(logs.lines[0].text, /errors not read/);
  assert.equal(w.hub.error, null);
});

test('Gladys refusing the states is logged once', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  logs.clear();
  w.gladys.publishStates = async () => {
    throw new Error('HTTP 500');
  };
  for (let i = 0; i < 4; i += 1) {
    w.tdarr.setQueues(i + 1);
    await w.hub.pollAll();
  }
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.match(logs.lines[0].text, /States refused/);
});

test('LOG_LEVEL=debug shows each reading problem; never the API keys', async (t) => {
  const logs = captureLogs(t, 'debug');
  const w = await world(t);
  w.tdarr.online = false;
  await w.hub.pollAll();
  await w.hub.pollAll();
  const text = logs.texts().join('\n');
  assert.match(text, /\[DEBUG\].*again/);
  assert.ok(!text.includes('tapi_'), 'never an API key, not even the one of a node');
});
