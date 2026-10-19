// -----------------------------------------------------------------------------
// An in-memory Tdarr server behind the `request` seam of the client
// (src/tdarr/http.js). Answers come from a real Tdarr 3.01 server
// (test/fixtures/tdarr/), with the behaviors that matter: the API key, nodes
// that connect, work, pause and disconnect, queues that fill and empty, files
// that fail, libraries, a server that does not answer.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/tdarr/${name}.json`, import.meta.url), 'utf8'));

const json = (status, body) => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
const ok = () => ({ status: 200, headers: { 'content-type': 'text/plain' }, body: 'OK' });

// The internal node of the captures, idle, and one of its busy workers.
const NODE_TEMPLATE = Object.values(fixture('nodes-idle'))[0];
const WORKER_TEMPLATE = Object.values(Object.values(fixture('nodes-busy'))[0].workers)[0];
const FAILED_TEMPLATE = fixture('table3-transcode-errors').array[0];

export class FakeTdarr {
  /**
   * @param {object} [options]
   * @param {string|null} [options.apiKey] null: authentication off
   */
  constructor({ apiKey = 'tapi_test' } = {}) {
    this.apiKey = apiKey;
    this.online = true;
    this.status = fixture('status');
    this.statistics = fixture('statistics-done');
    this.settings = fixture('globalsettings');
    this.libraries = fixture('libraries');
    this.pies = {
      LibMovies01: fixture('pies-LibMovies01'),
      LibShows02: fixture('pies-LibShows02'),
    };
    this.stagedCount = fixture('staged').totalCount;
    this.tables = {
      table3: fixture('table3-transcode-errors').array,
      table6: fixture('table6-health-errors').array,
    };
    this.nodes = {};
    this.addNode('InternalNode', NODE_TEMPLATE._id);
    this.requests = [];
    this.scans = [];
  }

  addNode(name, id = `n${Object.keys(this.nodes).length + 1}${name.length}`) {
    this.nodes[id] = structuredClone({ ...NODE_TEMPLATE, _id: id, nodeName: name, workers: {} });
    return id;
  }

  nodeId(name) {
    return Object.keys(this.nodes).find((id) => this.nodes[id].nodeName === name);
  }

  removeNode(name) {
    delete this.nodes[this.nodeId(name)];
  }

  /** `count` busy transcode workers on a node. */
  setWorkers(name, count) {
    const node = this.nodes[this.nodeId(name)];
    node.workers = {};
    for (let i = 0; i < count; i += 1) {
      node.workers[`worker-${i}`] = { ...WORKER_TEMPLATE, _id: `worker-${i}` };
    }
  }

  /** Files waiting in the transcode and health check queues. */
  setQueues(transcode, health = 0) {
    this.statistics.table1Count = transcode;
    this.statistics.table4Count = health;
  }

  /** A file of a library fails its transcode at `at` (ms). */
  addFailure(at, name = 'Broken Movie', library = 'LibMovies01') {
    this.tables.table3.unshift({
      ...FAILED_TEMPLATE,
      _id: `/media/movies/${name}.mkv`,
      file: `/media/movies/${name}.mkv`,
      fileNameWithoutExtension: name,
      DB: library,
      lastTranscodeDate: at,
    });
    this.statistics.table3Count = this.tables.table3.length;
  }

  handle(url, { method = 'GET', headers = {}, json: body } = {}) {
    const path = new URL(url).pathname;
    this.requests.push({ method, path, body, headers });
    if (!this.online) {
      const error = new Error('connect ECONNREFUSED');
      error.code = 'ECONNREFUSED';
      throw error;
    }
    if (!path.startsWith('/api/v2/')) {
      return { status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html>' };
    }
    if (path !== '/api/v2/status' && this.apiKey) {
      const key = headers['x-api-key'];
      if (!key) {
        return json(401, { status: 401, message: 'No auth token provided' });
      }
      if (key !== this.apiKey) {
        return json(401, { status: 401, message: 'Invalid API key' });
      }
    }
    const route = `${method} ${path.slice('/api/v2/'.length)}`;
    switch (route) {
      case 'GET status':
        return json(200, this.status);
      case 'GET get-nodes':
        return json(200, this.nodes);
      case 'POST cruddb':
        return this.cruddb(body.data);
      case 'POST stats/get-pies':
        return json(
          200,
          body.data.libraryId ? (this.pies[body.data.libraryId] ?? { pieStats: {} }) : {},
        );
      case 'POST client/staged':
        return json(200, { array: [], totalCount: this.stagedCount });
      case 'POST client/status-tables': {
        const rows = this.tables[body.data.opts.table];
        return rows
          ? json(200, { array: rows.slice(0, body.data.pageSize), totalCount: rows.length })
          : { status: 400, headers: {}, body: 'Invalid status table' };
      }
      case 'POST update-node': {
        const node = this.nodes[body.data.nodeID];
        if (node) {
          Object.assign(node, body.data.nodeUpdates);
        }
        return ok();
      }
      case 'POST scan-files':
        this.scans.push(body.data.scanConfig);
        return ok();
      default:
        return json(404, { status: 'error', message: 'Endpoint not found' });
    }
  }

  cruddb({ collection, mode, obj }) {
    if (collection === 'StatisticsJSONDB' && mode === 'getById') {
      return json(200, this.statistics);
    }
    if (collection === 'LibrarySettingsJSONDB' && mode === 'getAll') {
      return json(200, this.libraries);
    }
    if (collection === 'SettingsGlobalJSONDB' && mode === 'getById') {
      return json(200, this.settings);
    }
    if (collection === 'SettingsGlobalJSONDB' && mode === 'update') {
      Object.assign(this.settings, obj);
      return ok();
    }
    return json(400, { message: 'Unknown collection' });
  }
}

/** A fake network: the servers by base URL; any other host does not answer. */
export function createNetwork(servers = {}) {
  return {
    servers,
    async request(url, options) {
      const origin = new URL(url).origin;
      const server = Object.entries(servers).find(([base]) => new URL(base).origin === origin);
      if (!server) {
        const error = new Error('connect EHOSTUNREACH');
        error.code = 'EHOSTUNREACH';
        throw error;
      }
      return server[1].handle(url, options);
    },
  };
}
