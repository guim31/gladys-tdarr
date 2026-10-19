// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// One Tdarr server: its address (port 8265 by default), the API key when the
// authentication is on (Tdarr 2.24+), whether Gladys may pause and resume the
// nodes, the refresh interval and the language of the feature names.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Refresh intervals offered in the configuration, in seconds.
export const POLL_INTERVALS = ['30', '60', '120', '300'];

export const DEFAULT_PORT = 8265;

export const DEFAULT_CONFIG = {
  url: '',
  api_key: '',
  allow_control: true,
  poll_interval: '60',
  language: 'fr',
};

/**
 * Parse the address typed by the user into a base URL: a bare host or IP
 * (`192.0.2.10`, port 8265 added), or the URL copied from the browser, with
 * the base path of a server behind a reverse proxy. HTTP by default; the
 * query, the fragment, the page and a trailing slash dropped.
 * @param {unknown} raw
 * @returns {string|null} `http(s)://host[:port][/base]`, null when unusable
 */
export function parseServerUrl(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const text = raw.trim();
  if (!text) {
    return null;
  }
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  let url;
  try {
    url = new URL(hasScheme ? text : `http://${text}`);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    return null;
  }
  // Credentials in the address would end up in the logs and the device params.
  if (url.username || url.password) {
    return null;
  }
  // A bare host means the default port of Tdarr, not 80.
  if (!hasScheme && !url.port) {
    url.port = String(DEFAULT_PORT);
  }
  // The page of the web interface copied from the browser (`/#/` is a fragment).
  const path = url.pathname.replace(/\/(api)(\/.*)?$/i, '').replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

/** Host part shown to the user (no scheme). */
export const hostOf = (url) => url.replace(/^https?:\/\//, '');

const bool = (value, fallback) =>
  typeof value === 'boolean'
    ? value
    : value === 'true'
      ? true
      : value === 'false'
        ? false
        : fallback;

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const text = (key) => (typeof source[key] === 'string' ? source[key].trim() : '');
  const typed = text('url');
  const url = parseServerUrl(typed);
  const interval =
    source.poll_interval === undefined || source.poll_interval === null
      ? ''
      : String(source.poll_interval);
  return {
    url,
    invalidUrl: Boolean(typed) && !url,
    apiKey: text('api_key'),
    allowControl: bool(source.allow_control, DEFAULT_CONFIG.allow_control),
    pollIntervalMs:
      Number(POLL_INTERVALS.includes(interval) ? interval : DEFAULT_CONFIG.poll_interval) * 1000,
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
