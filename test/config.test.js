import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, parseServerUrl } from '../src/config.js';

test('the address: a bare host gets the port of Tdarr, a copied URL keeps its base', () => {
  assert.equal(parseServerUrl('192.0.2.10'), 'http://192.0.2.10:8265');
  assert.equal(parseServerUrl(' 192.0.2.10:9000 '), 'http://192.0.2.10:9000');
  assert.equal(parseServerUrl('http://tdarr.local:8265/#/'), 'http://tdarr.local:8265');
  assert.equal(parseServerUrl('https://example.org/tdarr/'), 'https://example.org/tdarr');
  assert.equal(parseServerUrl('http://192.0.2.10:8265/api/v2/status'), 'http://192.0.2.10:8265');
  assert.equal(parseServerUrl('http://user:pass@192.0.2.10'), null, 'no credentials in the URL');
  assert.equal(parseServerUrl('ftp://192.0.2.10'), null);
  assert.equal(parseServerUrl(''), null);
  assert.equal(parseServerUrl(42), null);
});

test('normalization: defaults, booleans as strings, unknown values', () => {
  const config = normalizeConfig({});
  assert.equal(config.url, null);
  assert.equal(config.invalidUrl, false);
  assert.equal(config.allowControl, DEFAULT_CONFIG.allow_control);
  assert.equal(config.pollIntervalMs, 60_000);
  assert.equal(config.language, 'fr');
  const typed = normalizeConfig({
    url: 'http://[bad',
    allow_control: 'false',
    poll_interval: 120,
    language: 'it',
    api_key: '  key  ',
  });
  assert.equal(typed.invalidUrl, true);
  assert.equal(typed.allowControl, false);
  assert.equal(typed.pollIntervalMs, 120_000);
  assert.equal(typed.language, 'fr');
  assert.equal(typed.apiKey, 'key');
  assert.equal(normalizeConfig({ poll_interval: '7' }).pollIntervalMs, 60_000);
});
