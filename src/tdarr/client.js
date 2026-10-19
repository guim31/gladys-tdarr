// -----------------------------------------------------------------------------
// Tdarr server API client (/api/v2, port 8265), checked on Tdarr 3.01 (Rust
// server engine) and following the calls of the 2.x API the Home Assistant
// integration uses. The API key (Tdarr 2.24+, Tools → API keys, or the
// `seededApiKey` of the server configuration) goes in the x-api-key header:
// never in the URL, never in the logs. Without authentication no key is sent.
//
// The readings: /status (version), /get-nodes (nodes, workers, pause),
// /cruddb (statistics, libraries, global settings), /stats/get-pies (one
// library), /client/staged and /client/status-tables (files waiting for
// review, files in error). The commands: /update-node (pause one node),
// /cruddb on the global settings (pause every node), /scan-files.
//
// Careful: /get-nodes answers the configuration of each node, its own API key
// included, and the global settings hold the Tdarr Pro key. The parsers of
// src/tdarr/model.js keep what the integration shows, nothing else.
// -----------------------------------------------------------------------------

import { httpRequest } from './http.js';

export const ERROR_KINDS = Object.freeze({
  UNREACHABLE: 'unreachable', // no answer: down, wrong address, firewall
  TLS: 'tls', // the certificate does not verify
  AUTH: 'auth', // API key refused or missing (401, 403)
  NOT_TDARR: 'not_tdarr', // something answers, not the Tdarr API
  REDIRECT: 'redirect', // the address redirects (HTTP to HTTPS, a login page)
  HTTP: 'http', // any other HTTP error
});

export class TdarrError extends Error {
  /**
   * @param {string} kind one of ERROR_KINDS
   * @param {string} message English, for the logs (never contains a secret)
   * @param {object} [extra] { status }
   */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'TdarrError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

const TLS_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

// The tables of the Tdarr home page (statistics `tableNCount`).
export const TABLES = Object.freeze({
  TRANSCODE_QUEUE: 'table1',
  TRANSCODE_DONE: 'table2',
  TRANSCODE_ERRORS: 'table3',
  HEALTH_QUEUE: 'table4',
  HEALTH_DONE: 'table5',
  HEALTH_ERRORS: 'table6',
});

const FAILURES_PAGE_SIZE = 10;

export class TdarrClient {
  /**
   * @param {object} options
   * @param {string} options.url base URL, with the base path if any
   * @param {string} [options.apiKey] empty when the authentication is off
   * @param {Function} [options.request] HTTP seam (src/tdarr/http.js)
   */
  constructor({ url, apiKey = '', request = httpRequest }) {
    this.url = url;
    this.apiKey = apiKey;
    this.request = request;
  }

  async call(path, { method = 'GET', json, timeoutMs } = {}) {
    let answer;
    try {
      answer = await this.request(`${this.url}/api/v2/${path}`, {
        method,
        json,
        timeoutMs,
        headers: this.apiKey ? { 'x-api-key': this.apiKey } : {},
      });
    } catch (err) {
      if (TLS_CODES.has(err.code)) {
        throw new TdarrError(ERROR_KINDS.TLS, `Certificate refused (${err.code})`);
      }
      throw new TdarrError(ERROR_KINDS.UNREACHABLE, err.code ? `${err.code}` : err.message);
    }
    const { status, headers = {}, body } = answer;
    if (status === 401 || status === 403) {
      throw new TdarrError(
        ERROR_KINDS.AUTH,
        this.apiKey ? 'API key refused' : 'Authentication is on: an API key is needed',
        { status },
      );
    }
    if (status >= 300 && status < 400) {
      throw new TdarrError(ERROR_KINDS.REDIRECT, `Redirected (HTTP ${status})`, { status });
    }
    const isJson = String(headers['content-type'] ?? '').includes('json');
    if (status === 404 && !isJson) {
      throw new TdarrError(ERROR_KINDS.NOT_TDARR, `No Tdarr API at this address (/${path})`, {
        status,
      });
    }
    if (status < 200 || status >= 300) {
      throw new TdarrError(ERROR_KINDS.HTTP, `/${path} answered HTTP ${status}`, { status });
    }
    if (body === '' || body === 'OK') {
      return null;
    }
    try {
      return JSON.parse(body);
    } catch {
      throw new TdarrError(ERROR_KINDS.NOT_TDARR, `/${path} did not answer JSON`, { status });
    }
  }

  /** Version and health of the server; also tells a Tdarr from another web server. */
  async status() {
    const answer = await this.call('status');
    if (!answer || typeof answer !== 'object' || typeof answer.version !== 'string') {
      throw new TdarrError(ERROR_KINDS.NOT_TDARR, 'No Tdarr version in /status');
    }
    return answer;
  }

  nodes() {
    return this.call('get-nodes');
  }

  cruddb(data) {
    return this.call('cruddb', { method: 'POST', json: { data, timeout: 20000 } });
  }

  statistics() {
    return this.cruddb({
      collection: 'StatisticsJSONDB',
      mode: 'getById',
      docID: 'statistics',
      obj: {},
    });
  }

  libraries() {
    return this.cruddb({ collection: 'LibrarySettingsJSONDB', mode: 'getAll' });
  }

  globalSettings() {
    return this.cruddb({
      collection: 'SettingsGlobalJSONDB',
      mode: 'getById',
      docID: 'globalsettings',
      obj: {},
    });
  }

  /** Counts of one library (`''`: every library). */
  pies(libraryId) {
    return this.call('stats/get-pies', { method: 'POST', json: { data: { libraryId } } });
  }

  /** Transcoded files waiting for a review (Staged tab). Only the count is read. */
  staged() {
    return this.call('client/staged', {
      method: 'POST',
      json: { data: { filters: [], start: 0, pageSize: 1, sorts: [], opts: {} } },
    });
  }

  /** The latest files of an error table, newest first. */
  failures(table) {
    const date = table === TABLES.HEALTH_ERRORS ? 'lastHealthCheckDate' : 'lastTranscodeDate';
    return this.call('client/status-tables', {
      method: 'POST',
      json: {
        data: {
          start: 0,
          pageSize: FAILURES_PAGE_SIZE,
          filters: [],
          sorts: [{ id: date, desc: true }],
          opts: { table },
        },
      },
    });
  }

  setNodePaused(nodeId, paused) {
    return this.call('update-node', {
      method: 'POST',
      json: { data: { nodeID: nodeId, nodeUpdates: { nodePaused: paused } } },
    });
  }

  setAllPaused(paused) {
    return this.cruddb({
      collection: 'SettingsGlobalJSONDB',
      mode: 'update',
      docID: 'globalsettings',
      obj: { pauseAllNodes: paused },
    });
  }

  /** Look for new files in a library folder (the "Scan (Find new)" button). */
  scan(libraryId, folder) {
    return this.call('scan-files', {
      method: 'POST',
      json: { data: { scanConfig: { dbID: libraryId, arrayOrPath: folder, mode: 'scanFindNew' } } },
    });
  }
}
