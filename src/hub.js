// -----------------------------------------------------------------------------
// The hub: reads the Tdarr server on a timer of the container (the interval
// chosen in the configuration), publishes the states of the server, node and
// library devices when they change, fires the scene events, and runs the
// commands (pause, resume, scan) of the switches, the scene actions and the
// widget.
//
// Gladys never polls these devices (should_poll: false): the scene events
// must fire even for a device that was not added, and a device created
// without should_poll is never polled by Gladys 5.2 anyway.
//
// Scene events:
//   - queue_empty: the transcode and health check queues are empty and no
//     worker is busy any more, after a reading where something was waiting;
//   - file_failed: a file entered an error table (transcode or health check).
//     The date of the newest error announced is kept under /data, so a
//     restart announces nothing twice; errors older than an hour are not
//     announced (a container stopped for a night does not replay it);
//   - node_offline: a node seen online is no longer connected to the server.
// No webhook: the sandbox has no inbound port.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS, createLogger } from '@gladysassistant/integration-sdk';
import { TABLES, TdarrClient, ERROR_KINDS } from './tdarr/client.js';
import {
  parseFailures,
  parseLibraries,
  parseNodes,
  parsePauseAll,
  parsePies,
  parseStaged,
  parseStatistics,
} from './tdarr/model.js';
import {
  DEVICE_TYPES,
  FEATURE_KEYS,
  NODE_PARAM,
  buildLibrary,
  buildNode,
  buildServer,
  featureValues,
  libraryIds,
  nodeIds,
  serverIds,
} from './devices.js';
import {
  ACTION_TEXT,
  CONNECTION_TEXT,
  ERROR_TEXT,
  REPORT_TEXT,
  SUMMARY_TEXT,
  pick,
} from './texts.js';

const logger = createLogger({ name: 'tdarr-hub' });

export const WIDGET_KEY = 'overview';

// Scene trigger keys (manifest `scene_triggers`): permanent once published.
export const TRIGGERS = Object.freeze({
  QUEUE_EMPTY: 'queue_empty',
  FILE_FAILED: 'file_failed',
  NODE_OFFLINE: 'node_offline',
});

export const HUB_TIMINGS = {
  // The version changes with an update: read it hourly, not at every reading.
  statusMs: 60 * 60_000,
  // The counts of each library are an aggregation on the Tdarr side: read
  // again when the statistics change, and every 15 minutes otherwise.
  piesMs: 15 * 60_000,
  // Errors older than this are not announced.
  failureMaxAgeMs: 60 * 60_000,
  // At most this many file_failed events per reading (a broken library).
  maxEventsPerRead: 10,
  // Republish an unchanged value this often (Gladys flags a value older than 48 h).
  heartbeatMs: 12 * 60 * 60_000,
};

const MAX_STATES_PER_REQUEST = 100;

const FAILURE_TABLES = [
  { kind: 'transcode', table: TABLES.TRANSCODE_ERRORS, count: 'transcodeErrors' },
  { kind: 'health', table: TABLES.HEALTH_ERRORS, count: 'healthErrors' },
];

export class CommandError extends Error {}

export class TdarrHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {object} options.store persistence (src/store.js)
   * @param {Function} [options.request] HTTP seam (src/tdarr/http.js)
   * @param {boolean} [options.timers] periodic timer (off in tests)
   * @param {object} [options.timings] HUB_TIMINGS overrides
   * @param {() => number} [options.now]
   */
  constructor({ gladys, store, request, timers = true, timings, now }) {
    this.gladys = gladys;
    this.store = store;
    this.request = request;
    this.timersEnabled = timers;
    this.timings = { ...HUB_TIMINGS, ...timings };
    this.now = now ?? (() => Date.now());
    this.config = null;
    this.client = null;
    this.signature = null;
    this.server = this.emptyServer();
    /** @type {Map<string, object>} nodes by name, online or last seen */
    this.nodes = new Map();
    /** @type {Map<string, object>} libraries by id */
    this.libraries = new Map();
    this.error = null;
    this.devicesKey = null;
    /** Last value published per feature external id: { value, at }. */
    this.published = new Map();
    this.transports = new Map();
    this.connection = null;
    this.saved = { nodes: [], failures: {} };
    this.pollTimer = null;
    this.polling = null;
    this.stopped = false;
    /** Problems already logged, by key: repeats go to debug. */
    this.warned = new Set();
  }

  emptyServer() {
    return {
      reachable: null,
      version: null,
      statusAt: 0,
      stats: null,
      staged: null,
      pausedAll: null,
      inProgress: null,
      nodesOnline: null,
      piesAt: 0,
      piesKey: null,
      busy: null,
    };
  }

  // --- Logs ------------------------------------------------------------------

  /** Log a problem once (`level` warn or error), its repeats at debug. */
  problem(key, message, err, level = 'warn') {
    const args = err === undefined ? [message] : [message, err];
    if (this.warned.has(key)) {
      logger.debug(...args);
      return;
    }
    this.warned.add(key);
    logger[level](...args);
  }

  /** The problem `key` is gone: the next occurrence is logged again. */
  resolved(key, message) {
    if (this.warned.delete(key) && message) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    const saved = await this.store.load();
    this.saved = {
      nodes: Array.isArray(saved.nodes)
        ? saved.nodes.filter((name) => typeof name === 'string')
        : [],
      failures: saved.failures && typeof saved.failures === 'object' ? saved.failures : {},
      url: typeof saved.url === 'string' ? saved.url : null,
    };
    // Nodes added to Gladys are shown offline until the server lists them.
    try {
      const devices = await this.gladys.getDevices();
      for (const device of devices ?? []) {
        const name = device.params?.find((param) => param.name === NODE_PARAM)?.value;
        if (typeof name === 'string' && name && !this.saved.nodes.includes(name)) {
          this.saved.nodes.push(name);
        }
      }
    } catch (err) {
      this.problem('devices', `Cannot read the devices of Gladys: ${err.message}`);
    }
    for (const name of this.saved.nodes) {
      this.nodes.set(name, { name, id: null, online: false, workers: 0, paused: false });
    }
    await this.reconfigure(config);
  }

  /** Gladys reconnected (it restarted): send everything again. */
  async resync(config) {
    this.published.clear();
    this.transports.clear();
    this.connection = null;
    this.devicesKey = null;
    await this.reconfigure(config);
  }

  async reconfigure(config) {
    this.config = config;
    const signature = JSON.stringify([config.url, config.apiKey]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.client = config.url
        ? new TdarrClient({ url: config.url, apiKey: config.apiKey, request: this.request })
        : null;
      this.error = null;
      this.server = this.emptyServer();
      if (config.url && this.saved.url && this.saved.url !== config.url) {
        // Another server: its errors and nodes are new, not news.
        this.saved = { nodes: [], failures: {}, url: config.url };
        this.nodes.clear();
        this.libraries.clear();
        this.store.save(this.saved);
      } else if (config.url && !this.saved.url) {
        this.saved.url = config.url;
        this.store.save(this.saved);
      }
    }
    this.devicesKey = null; // the language or the commands may have changed
    await this.pollAll();
    this.schedulePoll();
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.pollTimer);
    await this.store.flush();
  }

  schedulePoll() {
    clearTimeout(this.pollTimer);
    if (!this.timersEnabled || this.stopped || !this.client) {
      return;
    }
    this.pollTimer = setTimeout(async () => {
      try {
        await this.pollAll();
        this.resolved('poll');
      } catch (err) {
        this.problem('poll', 'Poll failed', err, 'error');
      }
      this.schedulePoll();
    }, this.config.pollIntervalMs);
  }

  // --- Devices ---------------------------------------------------------------

  devices() {
    if (!this.client) {
      return [];
    }
    return [
      buildServer(this.gladys, this.config),
      ...[...this.nodes.values()].map((node) => buildNode(this.gladys, this.config, node.name)),
      ...[...this.libraries.values()].map((library) =>
        buildLibrary(this.gladys, this.config, library),
      ),
    ];
  }

  /** Publish the devices when the list (or a name) changed. */
  async publishDevices({ force = false } = {}) {
    const devices = this.devices();
    const key = JSON.stringify(devices);
    if (!force && key === this.devicesKey) {
      return;
    }
    try {
      // Even an empty list: the Discovery tab then shows no stale device.
      await this.gladys.publishDiscoveredDevices(devices);
      this.devicesKey = key;
      this.resolved('discovery');
    } catch (err) {
      this.problem('discovery', `Devices refused: ${err.message}`);
    }
  }

  /** "Search" in the Discovery tab: read the server, publish the devices again. */
  async rediscover() {
    await this.pollAll();
    await this.publishDevices({ force: true });
  }

  /** The user added a device: its states sent before were dropped by Gladys. */
  async onDeviceCreated(device) {
    const target = this.resolve(device.external_id);
    if (!target) {
      return;
    }
    await this.publishStates({ force: true, only: device.external_id });
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  /** What a device external id designates: { type, node?, library? }, or null. */
  resolve(externalId) {
    if (!externalId) {
      return null;
    }
    if (externalId === serverIds(this.gladys).device) {
      return { type: DEVICE_TYPES.SERVER };
    }
    for (const node of this.nodes.values()) {
      if (nodeIds(this.gladys, node.name).device === externalId) {
        return { type: DEVICE_TYPES.NODE, node };
      }
    }
    for (const library of this.libraries.values()) {
      if (libraryIds(this.gladys, library.id).device === externalId) {
        return { type: DEVICE_TYPES.LIBRARY, library };
      }
    }
    return null;
  }

  // --- Reading the server ----------------------------------------------------

  /** Read the server and apply what changed. Concurrent calls share the read. */
  pollAll() {
    this.polling ??= this.readAll().finally(() => {
      this.polling = null;
    });
    return this.polling;
  }

  /** Gladys asks for a refresh (onPoll): read the server now. */
  async pollDevice(device) {
    if (this.resolve(device.external_id)) {
      await this.pollAll();
    }
  }

  async readAll() {
    if (!this.client) {
      await this.publishDevices();
      await this.publishConnectionStatus();
      return;
    }
    const client = this.client;
    let widgetChanged;
    try {
      const statusDue =
        !this.server.version || this.now() - this.server.statusAt >= this.timings.statusMs;
      const [status, nodes, statistics, staged, settings, libraries] = await Promise.all([
        statusDue ? client.status() : null,
        client.nodes(),
        client.statistics(),
        client.staged(),
        client.globalSettings(),
        client.libraries(),
      ]);
      if (client !== this.client) {
        return; // reconfigured meanwhile
      }
      const stats = parseStatistics(statistics);
      const libs = parseLibraries(libraries);
      const pies = await this.readPies(client, libs, stats);
      if (client !== this.client) {
        return;
      }
      widgetChanged = await this.applySuccess({
        version: status ? status.version : this.server.version,
        statusAt: status ? this.now() : this.server.statusAt,
        stats,
        staged: parseStaged(staged),
        pausedAll: parsePauseAll(settings),
        nodes: parseNodes(nodes),
        libraries: libs,
        pies,
      });
      await this.readFailures(client, stats);
    } catch (err) {
      if (!err.kind) {
        throw err;
      }
      if (client !== this.client) {
        return;
      }
      widgetChanged = await this.applyFailure(err);
    }
    await this.publishDevices();
    await this.publishStates();
    await this.publishTransports();
    await this.publishConnectionStatus();
    if (widgetChanged) {
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  /** The counts of every library, when due; else the ones already read. */
  async readPies(client, libraries, stats) {
    const key = JSON.stringify([stats, libraries.map((library) => library.id)]);
    const due =
      key !== this.server.piesKey || this.now() - this.server.piesAt >= this.timings.piesMs;
    if (!due) {
      return null;
    }
    const answers = await Promise.all(
      libraries.map((library) =>
        client.pies(library.id).catch((err) => {
          if (!err.kind) {
            throw err;
          }
          this.problem(`pies:${library.id}`, `Library ${library.name} not read: ${err.message}`);
          return null;
        }),
      ),
    );
    this.server.piesKey = key;
    this.server.piesAt = this.now();
    return new Map(libraries.map((library, index) => [library.id, parsePies(answers[index])]));
  }

  async applySuccess(next) {
    const previous = this.server;
    if (this.error) {
      logger.info(`Tdarr ${this.config.url}: connection restored`);
    } else if (previous.reachable === null) {
      logger.info(`Tdarr ${this.config.url}: connected, version ${next.version}`);
    }
    this.error = null;
    this.resolved('server');

    // Nodes: the ones listed are online, the others known stay offline.
    const online = new Map(next.nodes.map((node) => [node.name, node]));
    const wentOffline = [];
    for (const [name, node] of this.nodes) {
      if (!online.has(name) && node.online) {
        wentOffline.push(node);
        node.online = false;
        node.workers = 0;
        logger.info(`Tdarr node ${name}: offline`);
      }
    }
    let nodesChanged = false;
    for (const node of next.nodes) {
      const known = this.nodes.get(node.name);
      if (!known) {
        nodesChanged = true;
      } else if (!known.online && previous.reachable !== null) {
        logger.info(`Tdarr node ${node.name}: online`);
      }
      this.nodes.set(node.name, { ...node, online: true });
    }
    if (nodesChanged) {
      this.saved.nodes = [...this.nodes.keys()];
      this.store.save(this.saved);
    }

    // Libraries: the list follows Tdarr (a deleted library is no longer shown).
    const libraries = new Map();
    for (const library of next.libraries) {
      const pies = next.pies ? next.pies.get(library.id) : this.libraries.get(library.id)?.pies;
      libraries.set(library.id, { ...library, pies: pies ?? null });
    }
    this.libraries = libraries;

    const inProgress = next.nodes.reduce((total, node) => total + node.workers, 0);
    const { stats } = next;
    const waiting =
      stats.transcodeQueue === null || stats.healthQueue === null
        ? null
        : stats.transcodeQueue + stats.healthQueue + inProgress;
    this.server = {
      ...previous,
      reachable: true,
      version: next.version,
      statusAt: next.statusAt,
      stats,
      staged: next.staged,
      pausedAll: next.pausedAll,
      inProgress,
      nodesOnline: next.nodes.length,
      busy: waiting === null ? previous.busy : waiting > 0,
    };

    for (const node of wentOffline) {
      await this.fire(TRIGGERS.NODE_OFFLINE, {
        device: nodeIds(this.gladys, node.name).device,
        node: node.name,
      });
    }
    if (previous.busy === true && this.server.busy === false) {
      logger.info('Tdarr: queues empty');
      await this.fire(TRIGGERS.QUEUE_EMPTY, {
        device: serverIds(this.gladys).device,
        transcoded: stats.transcoded ?? 0,
        transcode_errors: stats.transcodeErrors ?? 0,
        health_errors: stats.healthErrors ?? 0,
        space_saved: stats.spaceSaved ?? 0,
      });
    }

    const view = (server) =>
      JSON.stringify([
        server.reachable,
        server.stats,
        server.inProgress,
        server.pausedAll,
        server.staged,
      ]);
    const nodesView = JSON.stringify(
      next.nodes.map((node) => [node.name, node.paused, node.workers]),
    );
    const nodesMoved = nodesView !== this.nodesView;
    this.nodesView = nodesView;
    return view(previous) !== view(this.server) || wentOffline.length > 0 || nodesMoved;
  }

  async applyFailure(err) {
    const wasError = this.error?.kind;
    this.error = { kind: err.kind, message: err.message };
    this.server = { ...this.server, reachable: false };
    // One warning when the problem starts (or changes), not one per reading.
    if (wasError !== err.kind) {
      logger.warn(`Tdarr ${this.config.url}: ${err.message}`);
    } else {
      logger.debug(`Tdarr ${this.config.url}: ${err.message} (again)`);
    }
    return wasError !== err.kind;
  }

  /**
   * Read the error tables when their counts grew, fire file_failed for the
   * files that failed since the last one announced.
   */
  async readFailures(client, stats) {
    for (const { kind, table, count } of FAILURE_TABLES) {
      const cursor = this.saved.failures[kind];
      const total = stats[count];
      if (total === null) {
        continue;
      }
      const known = cursor && Number.isFinite(cursor.at) ? cursor : null;
      // Nothing new: the count did not grow since the last reading.
      if (known && total <= (known.count ?? 0)) {
        if (total !== known.count) {
          known.count = total;
          this.store.save(this.saved);
        }
        continue;
      }
      let failures;
      try {
        failures = total === 0 ? [] : parseFailures(await client.failures(table), kind);
        this.resolved(`failures:${kind}`);
      } catch (err) {
        if (!err.kind) {
          throw err;
        }
        this.problem(`failures:${kind}`, `Tdarr ${kind} errors not read: ${err.message}`);
        continue;
      }
      if (client !== this.client) {
        return;
      }
      const newest = failures.reduce((max, failure) => Math.max(max, failure.at), 0);
      if (!known) {
        // First reading of this server: start from now, announce nothing old.
        this.saved.failures[kind] = { at: newest, count: total };
        this.store.save(this.saved);
        continue;
      }
      const fresh = failures
        .filter(
          (failure) =>
            failure.at > known.at && this.now() - failure.at <= this.timings.failureMaxAgeMs,
        )
        .sort((a, b) => a.at - b.at)
        .slice(-this.timings.maxEventsPerRead);
      this.saved.failures[kind] = { at: Math.max(known.at, newest), count: total };
      this.store.save(this.saved);
      for (const failure of fresh) {
        const library = this.libraries.get(failure.library);
        logger.info(`Tdarr: ${kind} error on ${failure.name}`);
        await this.fire(TRIGGERS.FILE_FAILED, {
          device: library
            ? libraryIds(this.gladys, library.id).device
            : serverIds(this.gladys).device,
          kind,
          file: failure.name,
          path: failure.file,
          library: library?.name ?? '',
        });
      }
    }
  }

  async fire(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
      this.resolved('scene-event');
    } catch (err) {
      this.problem('scene-event', `Scene event ${key} refused: ${err.message}`);
    }
  }

  // --- Publishing to Gladys --------------------------------------------------

  /** Every feature value of every device: [deviceExternalId, values]. */
  values() {
    if (!this.client) {
      return [];
    }
    const entries = [
      [
        serverIds(this.gladys).device,
        featureValues(DEVICE_TYPES.SERVER, serverIds(this.gladys), this.server),
      ],
    ];
    for (const node of this.nodes.values()) {
      const ids = nodeIds(this.gladys, node.name);
      // Before the first answer, nothing is known of the node.
      const source = this.server.reachable === null ? {} : node;
      entries.push([ids.device, featureValues(DEVICE_TYPES.NODE, ids, source)]);
    }
    for (const library of this.libraries.values()) {
      const ids = libraryIds(this.gladys, library.id);
      entries.push([ids.device, featureValues(DEVICE_TYPES.LIBRARY, ids, library)]);
    }
    return entries;
  }

  async publishStates({ force = false, only = null } = {}) {
    const now = this.now();
    const down = this.server.reachable === false;
    const states = [];
    for (const [deviceId, values] of this.values()) {
      if (only && deviceId !== only) {
        continue;
      }
      for (const { key, externalId, value, text } of values) {
        if (value === null) {
          continue;
        }
        const last = this.published.get(externalId);
        // While the server is down, its last counts are not republished as fresh.
        const stale =
          down && !(deviceId === serverIds(this.gladys).device && key === FEATURE_KEYS.ONLINE);
        const fresh =
          last && last.value === value && (stale || now - last.at < this.timings.heartbeatMs);
        if (!force && fresh) {
          continue;
        }
        states.push(
          text
            ? { device_feature_external_id: externalId, text: String(value) }
            : { device_feature_external_id: externalId, state: value },
        );
      }
    }
    for (let at = 0; at < states.length; at += MAX_STATES_PER_REQUEST) {
      const batch = states.slice(at, at + MAX_STATES_PER_REQUEST);
      try {
        await this.gladys.publishStates(batch);
        for (const state of batch) {
          this.published.set(state.device_feature_external_id, {
            value: state.text ?? state.state,
            at: now,
          });
        }
        this.resolved('states');
      } catch (err) {
        this.problem('states', `States refused: ${err.message}`);
      }
    }
  }

  async publishTransports() {
    if (!this.client || this.server.reachable === null) {
      return;
    }
    const entries = [];
    const transport = (ok) => (ok ? DEVICE_TRANSPORTS.LOCAL : DEVICE_TRANSPORTS.UNREACHABLE);
    const wanted = [[serverIds(this.gladys).device, transport(this.server.reachable)]];
    for (const node of this.nodes.values()) {
      wanted.push([
        nodeIds(this.gladys, node.name).device,
        transport(this.server.reachable && node.online),
      ]);
    }
    for (const library of this.libraries.values()) {
      wanted.push([libraryIds(this.gladys, library.id).device, transport(this.server.reachable)]);
    }
    for (const [externalId, value] of wanted) {
      if (this.transports.get(externalId) !== value) {
        entries.push({ external_id: externalId, transport: value });
      }
    }
    if (entries.length === 0) {
      return;
    }
    try {
      await this.gladys.publishTransports(entries);
      for (const entry of entries) {
        this.transports.set(entry.external_id, entry.transport);
      }
      this.resolved('transports');
    } catch (err) {
      this.problem('transports', `Transports refused: ${err.message}`);
    }
  }

  /** The status under the integration name. */
  connectionStatus() {
    if (!this.config.url) {
      return {
        connected: false,
        message: this.config.invalidUrl ? CONNECTION_TEXT.invalid : CONNECTION_TEXT.noServer,
      };
    }
    if (this.error) {
      return { connected: false, message: ERROR_TEXT[this.error.kind] };
    }
    return { connected: true };
  }

  async publishConnectionStatus() {
    const status = this.connectionStatus();
    const key = JSON.stringify(status);
    if (key === this.connection) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(status.connected, status.message);
      this.connection = key;
      this.resolved('connection-status');
    } catch (err) {
      this.problem('connection-status', `Connection status refused: ${err.message}`);
    }
  }

  // --- Commands ----------------------------------------------------------------

  fail(text) {
    throw new CommandError(pick(text, this.config?.language));
  }

  ensureServer() {
    if (!this.client) {
      this.fail(ACTION_TEXT.noServer);
    }
  }

  /**
   * Pause or resume: one node, or every node (the server device, or none).
   * @param {string|null} deviceExternalId
   * @param {boolean} paused
   */
  async setPaused(deviceExternalId, paused) {
    this.ensureServer();
    if (!this.config.allowControl) {
      this.fail(ACTION_TEXT.controlOff);
    }
    const target = deviceExternalId
      ? this.resolve(deviceExternalId)
      : { type: DEVICE_TYPES.SERVER };
    if (!target || target.type === DEVICE_TYPES.LIBRARY) {
      this.fail(ACTION_TEXT.notANode);
    }
    if (target.type === DEVICE_TYPES.NODE && (!target.node.online || !target.node.id)) {
      this.fail(ACTION_TEXT.nodeOffline);
    }
    const what = target.type === DEVICE_TYPES.NODE ? `node ${target.node.name}` : 'all nodes';
    try {
      if (target.type === DEVICE_TYPES.NODE) {
        await this.client.setNodePaused(target.node.id, paused);
      } else {
        await this.client.setAllPaused(paused);
      }
    } catch (err) {
      if (!err.kind) {
        throw err;
      }
      logger.warn(`Tdarr: ${paused ? 'pause' : 'resume'} of ${what} refused: ${err.message}`);
      throw new CommandError(pick(ERROR_TEXT[err.kind], this.config.language));
    }
    logger.info(`Tdarr: ${what} ${paused ? 'paused' : 'resumed'}`);
    await this.pollAll();
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
    return target;
  }

  /** A switch of the server or of a node (onSetValue). */
  async setValue(device, feature, value) {
    if (feature.external_id !== `${device.external_id}:${FEATURE_KEYS.PAUSED}`) {
      throw new Error(`Feature ${feature.external_id} is read-only`);
    }
    await this.setPaused(device.external_id, Number(value) === 1);
  }

  /**
   * Look for new files: one library, or every library. Resolves with the
   * number of libraries scanned.
   */
  async scan(deviceExternalId) {
    this.ensureServer();
    if (this.libraries.size === 0) {
      await this.pollAll();
    }
    let libraries = [...this.libraries.values()];
    if (deviceExternalId) {
      const target = this.resolve(deviceExternalId);
      if (!target || target.type !== DEVICE_TYPES.LIBRARY) {
        this.fail(ACTION_TEXT.notALibrary);
      }
      libraries = [target.library];
    }
    if (libraries.length === 0) {
      this.fail(ACTION_TEXT.noLibrary);
    }
    let done = 0;
    for (const library of libraries) {
      try {
        await this.client.scan(library.id, library.folder);
        done += 1;
        logger.info(`Tdarr: scan of ${library.name} started`);
      } catch (err) {
        if (!err.kind) {
          throw err;
        }
        logger.warn(`Tdarr: scan of ${library.name} refused: ${err.message}`);
        if (libraries.length === 1) {
          throw new CommandError(pick(ERROR_TEXT[err.kind], this.config.language));
        }
      }
    }
    if (done === 0) {
      this.fail(ACTION_TEXT.failed);
    }
    return done;
  }

  // --- Reports -----------------------------------------------------------------

  totals() {
    const stats = this.server.stats ?? {};
    return {
      queue: (stats.transcodeQueue ?? 0) + (stats.healthQueue ?? 0),
      inProgress: this.server.inProgress ?? 0,
      errors: (stats.transcodeErrors ?? 0) + (stats.healthErrors ?? 0),
      staged: this.server.staged ?? 0,
      spaceSaved: stats.spaceSaved ?? 0,
      nodesOnline: this.server.nodesOnline ?? 0,
    };
  }

  /** The sentence of the summary scene action, in the configured language. */
  summary() {
    this.ensureServer();
    const text = SUMMARY_TEXT[this.config.language] ?? SUMMARY_TEXT.en;
    if (this.error || !this.server.reachable) {
      return text.down;
    }
    const totals = this.totals();
    const parts = [text.queue(totals.queue), text.inProgress(totals.inProgress)];
    if (totals.errors) {
      parts.push(text.errors(totals.errors));
    }
    if (totals.staged) {
      parts.push(text.staged(totals.staged));
    }
    parts.push(text.spaceSaved(totals.spaceSaved));
    if (this.server.pausedAll) {
      parts.push(text.paused);
    }
    return `Tdarr: ${parts.join(', ')}.`.slice(0, 1000);
  }

  /** "Test the connection": read the server now, one report. */
  async testConnection() {
    await this.pollAll();
    const message = {};
    for (const [language, text] of Object.entries(REPORT_TEXT)) {
      if (!this.client || this.error) {
        message[language] = pick(this.connectionStatus().message, language);
        continue;
      }
      const totals = this.totals();
      message[language] = [
        text.ok(this.server.version),
        text.nodes(totals.nodesOnline),
        text.libraries(this.libraries.size),
        text.queue(totals.queue),
        ...(totals.errors ? [text.errors(totals.errors)] : []),
      ].join(', ');
    }
    return message;
  }
}

export { ERROR_KINDS };
