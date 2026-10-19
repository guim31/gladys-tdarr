// -----------------------------------------------------------------------------
// The behavior of the hub against the fake Tdarr: states, scene events,
// commands, errors, persistence.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG,
  FakeTdarr,
  createWorld,
  libraryDevice,
  libraryFeature,
  nodeDevice,
  nodeFeature,
  serverFeature,
} from './helpers/world.js';

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const events = (w, key) => w.fake.sceneEvents.filter((event) => event.key === key);

test('the server, node and library states come from the real answers', async (t) => {
  const w = await world(t);
  const state = (id) => w.fake.lastState(id);
  assert.equal(state(serverFeature(w.gladys, 'online')), 1);
  assert.equal(state(serverFeature(w.gladys, 'version')), '3.01.00');
  assert.equal(state(serverFeature(w.gladys, 'transcode_errors')), 2);
  assert.equal(state(serverFeature(w.gladys, 'staged')), 5);
  assert.equal(state(serverFeature(w.gladys, 'nodes_online')), 1);
  assert.equal(state(serverFeature(w.gladys, 'paused')), 0);
  assert.equal(state(serverFeature(w.gladys, 'space_saved')), 0);
  assert.equal(state(nodeFeature(w.gladys, 'online')), 1);
  assert.equal(state(nodeFeature(w.gladys, 'workers')), 0);
  assert.equal(state(libraryFeature(w.gladys, 'files', 'LibShows02')), 2);
  assert.equal(state(libraryFeature(w.gladys, 'errors', 'LibShows02')), 2);
  assert.equal(w.fake.connectionStatus.connected, true);
  // Authentication on: the key goes in the header, never in the URL.
  const request = w.tdarr.requests.find((r) => r.path === '/api/v2/get-nodes');
  assert.equal(request.headers['x-api-key'], 'tapi_test');
});

test('only the changes are published, everything again when a device is added', async (t) => {
  const w = await world(t);
  const before = w.fake.states.length;
  await w.hub.pollAll();
  assert.equal(w.fake.states.length, before, 'an unchanged reading publishes nothing');
  w.tdarr.setQueues(4);
  await w.hub.pollAll();
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'transcode_queue')), 4);
  const count = w.fake.states.length;
  await w.fake.deviceCreated({ external_id: nodeDevice(w.gladys) });
  assert.equal(w.fake.states.length, count + 3, 'the three node features again');
  assert.ok(w.fake.widgetRefreshes.length >= 1);
});

test('queue_empty fires once when the last file is processed', async (t) => {
  const tdarr = new FakeTdarr();
  tdarr.setQueues(3, 1);
  tdarr.setWorkers('InternalNode', 1);
  const w = await world(t, { tdarr });
  tdarr.setQueues(0, 0);
  await w.hub.pollAll();
  assert.equal(events(w, 'queue_empty').length, 0, 'a worker is still busy');
  tdarr.setWorkers('InternalNode', 0);
  await w.hub.pollAll();
  await w.hub.pollAll();
  const fired = events(w, 'queue_empty');
  assert.equal(fired.length, 1);
  assert.equal(fired[0].data.transcode_errors, 2);
  assert.equal(fired[0].data.device, w.gladys.externalIds('server', 'main').device);
});

test('an idle server at start fires no queue_empty', async (t) => {
  const w = await world(t);
  await w.hub.pollAll();
  assert.equal(events(w, 'queue_empty').length, 0);
});

test('file_failed fires for a new error, once, also across a restart', async (t) => {
  const tdarr = new FakeTdarr();
  const w = await world(t, { tdarr });
  assert.equal(events(w, 'file_failed').length, 0, 'the errors found at start are not news');
  tdarr.addFailure(w.clock.now() - 60_000, 'Corrupted Film');
  await w.hub.pollAll();
  await w.hub.pollAll();
  const fired = events(w, 'file_failed');
  assert.equal(fired.length, 1);
  assert.deepEqual(fired[0].data, {
    device: libraryDevice(w.gladys),
    kind: 'transcode',
    file: 'Corrupted Film',
    path: '/media/movies/Corrupted Film.mkv',
    library: 'Movies',
  });

  // Same /data, new container: nothing is announced twice.
  await w.app.stop();
  const again = await world(t, { tdarr, dataDir: w.dataDir, clock: w.clock });
  await again.hub.pollAll();
  assert.equal(events(again, 'file_failed').length, 0);
  tdarr.addFailure(w.clock.now(), 'Another One');
  await again.hub.pollAll();
  assert.equal(events(again, 'file_failed').length, 1);
});

test('an error older than an hour is not announced', async (t) => {
  const tdarr = new FakeTdarr();
  const w = await world(t, { tdarr });
  w.clock.advance(3 * 60 * 60_000);
  tdarr.addFailure(w.clock.now() - 2 * 60 * 60_000 + 1, 'Old');
  await w.hub.pollAll();
  assert.equal(events(w, 'file_failed').length, 0);
});

test('node_offline fires when a node disconnects; it stays offline in Gladys', async (t) => {
  const tdarr = new FakeTdarr();
  tdarr.addNode('GPU Node');
  const w = await world(t, { tdarr });
  tdarr.removeNode('GPU Node');
  await w.hub.pollAll();
  await w.hub.pollAll();
  const fired = events(w, 'node_offline');
  assert.equal(fired.length, 1);
  assert.deepEqual(fired[0].data, { device: nodeDevice(w.gladys, 'gpu-node'), node: 'GPU Node' });
  assert.equal(w.fake.lastState(nodeFeature(w.gladys, 'online', 'gpu-node')), 0);
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'nodes_online')), 1);
  assert.ok(
    w.fake.discoveredDevices.some((d) => d.external_id === nodeDevice(w.gladys, 'gpu-node')),
  );
  assert.ok(
    w.fake.transports.some(
      (entry) =>
        entry.device_external_id === nodeDevice(w.gladys, 'gpu-node') &&
        entry.transport === 'unreachable',
    ),
  );
});

test('a node added to Gladys is shown offline after a restart, until Tdarr lists it', async (t) => {
  const tdarr = new FakeTdarr();
  const devices = [
    {
      external_id: nodeDevice(createWorldGladysIds(), 'gpu-node'),
      params: [{ name: 'TDARR_NODE', value: 'GPU Node' }],
      features: [],
    },
  ];
  const w = await world(t, { tdarr, devices });
  assert.equal(w.fake.lastState(nodeFeature(w.gladys, 'online', 'gpu-node')), 0);
  tdarr.addNode('GPU Node');
  await w.hub.pollAll();
  assert.equal(w.fake.lastState(nodeFeature(w.gladys, 'online', 'gpu-node')), 1);
});

function createWorldGladysIds() {
  // The external ids of the fake Gladys (selector test-integration).
  return { externalIds: (type, id) => ({ device: `ext:test-integration:${type}:${id}` }) };
}

test('the pause switch of a node pauses it in Tdarr, the server switch pauses every node', async (t) => {
  const w = await world(t);
  const node = { external_id: nodeDevice(w.gladys) };
  let ack = await w.fake.setValue(node, { external_id: nodeFeature(w.gladys, 'paused') }, 1);
  assert.equal(ack.success, true, ack.error);
  assert.equal(w.tdarr.nodes[w.tdarr.nodeId('InternalNode')].nodePaused, true);
  assert.equal(w.fake.lastState(nodeFeature(w.gladys, 'paused')), 1);

  const server = { external_id: w.gladys.externalIds('server', 'main').device };
  ack = await w.fake.setValue(server, { external_id: serverFeature(w.gladys, 'paused') }, 1);
  assert.equal(ack.success, true, ack.error);
  assert.equal(w.tdarr.settings.pauseAllNodes, true);
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'paused')), 1);

  ack = await w.fake.setValue(server, { external_id: serverFeature(w.gladys, 'version') }, 1);
  assert.equal(ack.success, false, 'a sensor is not a command');
});

test('commands off: the switches, scenes and widget refuse to pause', async (t) => {
  const w = await world(t, { config: { ...CONFIG, allow_control: false } });
  const node = { external_id: nodeDevice(w.gladys) };
  const ack = await w.fake.setValue(node, { external_id: nodeFeature(w.gladys, 'paused') }, 1);
  assert.equal(ack.success, false);
  assert.match(ack.error, /turned off/);
  const scene = await w.fake.sceneAction('pause_processing', {});
  assert.equal(scene.success, false);
  assert.equal(w.tdarr.settings.pauseAllNodes, false);
  assert.ok(!w.tdarr.requests.some((r) => r.path === '/api/v2/update-node'));
});

test('pause and resume scene actions: one node, or every node', async (t) => {
  const w = await world(t);
  let ack = await w.fake.sceneAction('pause_processing', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(w.tdarr.settings.pauseAllNodes, true);
  ack = await w.fake.sceneAction('resume_processing', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(w.tdarr.settings.pauseAllNodes, false);
  ack = await w.fake.sceneAction('pause_processing', { device: nodeDevice(w.gladys) });
  assert.equal(ack.success, true, ack.error);
  assert.equal(w.tdarr.nodes[w.tdarr.nodeId('InternalNode')].nodePaused, true);
  ack = await w.fake.sceneAction('pause_processing', { device: libraryDevice(w.gladys) });
  assert.equal(ack.success, false, 'a library is not a node');
});

test('scan_library starts a scan of one library, or of every library', async (t) => {
  const w = await world(t);
  let ack = await w.fake.sceneAction('scan_library', { device: libraryDevice(w.gladys) });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(w.tdarr.scans, [
    { dbID: 'LibMovies01', arrayOrPath: '/media/movies', mode: 'scanFindNew' },
  ]);
  ack = await w.fake.sceneAction('scan_library', {});
  assert.equal(ack.data.outputs.libraries, 2);
});

test('read_summary says the queue, the errors and the space saved', async (t) => {
  const tdarr = new FakeTdarr();
  tdarr.setQueues(7, 1);
  tdarr.statistics.sizeDiff = 12.31;
  const w = await world(t, { tdarr, config: { ...CONFIG, language: 'fr' } });
  const ack = await w.fake.sceneAction('read_summary', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(
    ack.data.outputs.summary,
    'Tdarr: 8 fichier(s) en file, 0 en cours, 2 en échec, 5 en attente de validation, 12,3 Go gagnés.',
  );
  assert.equal(ack.data.outputs.queue, 8);
  assert.equal(ack.data.outputs.errors, 2);
});

test('a server down: offline, the counts not refreshed, one status message', async (t) => {
  const w = await world(t);
  w.tdarr.online = false;
  await w.hub.pollAll();
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'online')), 0);
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.en, /does not answer/);
  const count = w.fake.states.length;
  w.clock.advance(13 * 60 * 60_000);
  await w.hub.pollAll();
  // Only "online: 0" gets its heartbeat: no stale count republished as fresh.
  assert.deepEqual(
    w.fake.states.slice(count).map((state) => state.device_feature_external_id),
    [serverFeature(w.gladys, 'online')],
  );
  w.tdarr.online = true;
  await w.hub.pollAll();
  assert.equal(w.fake.lastState(serverFeature(w.gladys, 'online')), 1);
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('authentication: a missing or wrong key is explained; no key when it is off', async (t) => {
  const w = await world(t, { config: { ...CONFIG, api_key: '' } });
  assert.equal(w.hub.error.kind, 'auth');
  assert.match(w.fake.connectionStatus.message.en, /API key refused or missing/);

  const open = new FakeTdarr({ apiKey: null });
  const w2 = await world(t, { tdarr: open, config: { ...CONFIG, api_key: '' } });
  assert.equal(w2.hub.error, null);
  assert.ok(open.requests.every((r) => r.headers['x-api-key'] === undefined));
});

test('another web server at the address is not taken for Tdarr', async (t) => {
  const tdarr = new FakeTdarr();
  tdarr.handle = () => ({ status: 404, headers: { 'content-type': 'text/html' }, body: 'nope' });
  const w = await world(t, { tdarr });
  assert.equal(w.hub.error.kind, 'not_tdarr');
});

test('no address: no device, a status that says what to do', async (t) => {
  const w = await world(t, { config: { language: 'en' } });
  assert.deepEqual(w.fake.discoveredDevices, []);
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.en, /Enter the address/);
  const ack = await w.fake.sceneAction('read_summary', {});
  assert.equal(ack.success, false);
});

test('a new configuration reads the server again with the new key', async (t) => {
  const w = await world(t, { config: { ...CONFIG, api_key: 'wrong' } });
  assert.equal(w.hub.error.kind, 'auth');
  await w.fake.configUpdated({ ...CONFIG });
  assert.equal(w.hub.error, null);
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('the test_connection action reports the version, nodes and libraries', async (t) => {
  const w = await world(t);
  const ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(
    ack.data.message.en,
    'OK, Tdarr 3.01.00, 1 node(s) online, 2 library(ies), 0 file(s) in queue, 2 in error',
  );
});

test('the container reads the server on its own timer, without onPoll', async (t) => {
  const w = await world(t, { timers: true, config: { ...CONFIG, poll_interval: '30' } });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // The timer armed at start is a real one: re-arm it under the mock.
  w.hub.schedulePoll();
  const before = w.tdarr.requests.length;
  t.mock.timers.tick(30_000);
  await w.hub.polling;
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(w.tdarr.requests.length > before);
  assert.equal(w.fake.discoveredDevices[0].should_poll, false);
});
