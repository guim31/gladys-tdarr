// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake Tdarr server on a fake
// network, a temporary /data and a manual clock, with the integration wired
// on top through registerHandlers. No timer runs unless `timers: true`: the
// tests read the server with `world.hub.pollAll()`.
// -----------------------------------------------------------------------------

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';
import { FakeTdarr, createNetwork } from './fakeTdarr.js';

process.env.LOG_LEVEL ??= 'silent';

export const TDARR_URL = 'http://192.0.2.10:8265';

/** A manual clock, just after the real captures. */
export function createClock(start = Date.parse('2026-10-19T20:10:00Z')) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

export const CONFIG = { url: '192.0.2.10', api_key: 'tapi_test', language: 'en' };

/**
 * @param {object} [options]
 * @param {FakeTdarr} [options.tdarr]
 * @param {object} [options.config] raw integration config
 */
export async function createWorld({
  clock = createClock(),
  tdarr = new FakeTdarr(),
  config = CONFIG,
  devices = [],
  connect = true,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-tdarr-')),
  timings = {},
  timers = false,
} = {}) {
  const network = createNetwork({ [TDARR_URL]: tdarr });
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    store: new Store(dataDir),
    request: network.request,
    timers,
    timings,
    now: clock.now,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
  }
  return { gladys, fake: gladys.fake, network, tdarr, app, hub: app.hub, clock, dataDir };
}

export const ids = (gladys, type, id) => gladys.externalIds(type, id);
export const serverFeature = (gladys, key) => gladys.externalIds('server', 'main').feature(key);
export const nodeDevice = (gladys, slug = 'internalnode') =>
  gladys.externalIds('node', slug).device;
export const nodeFeature = (gladys, key, slug = 'internalnode') =>
  gladys.externalIds('node', slug).feature(key);
export const libraryDevice = (gladys, id = 'LibMovies01') =>
  gladys.externalIds('library', id).device;
export const libraryFeature = (gladys, key, id = 'LibMovies01') =>
  gladys.externalIds('library', id).feature(key);

export { FakeTdarr };
