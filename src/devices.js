// -----------------------------------------------------------------------------
// The Gladys devices of a Tdarr server:
//   - the server (`server:main`): queues, files in progress, waiting for a
//     review, transcoded, in error, space saved, nodes online, a switch that
//     pauses every node, the version;
//   - one device per node (`node:<name>`): online, active workers, a pause
//     switch. Tdarr gives a node a new id at each start: its name (Node
//     options, `nodeName`) is its identity;
//   - one device per library (`library:<id>`): files, to process, in error,
//     space saved. The id of a library never changes, its name may.
//
// Feature category/type couples come from the core table (see
// test/gladys-rules.test.js). should_poll: false: the hub reads the server on
// its own timer (src/hub.js), at the interval chosen in the configuration.
// The switches are read-only when the configuration forbids the commands.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { hostOf } from './config.js';

export const DEVICE_TYPES = Object.freeze({
  SERVER: 'server',
  NODE: 'node',
  LIBRARY: 'library',
});

export const SERVER_ID = 'main';
export const URL_PARAM = 'TDARR_URL';
export const NODE_PARAM = 'TDARR_NODE';

// Suffixes of the feature external ids: permanent once published.
export const FEATURE_KEYS = Object.freeze({
  ONLINE: 'online',
  PAUSED: 'paused',
  TRANSCODE_QUEUE: 'transcode_queue',
  HEALTH_QUEUE: 'health_queue',
  IN_PROGRESS: 'in_progress',
  STAGED: 'staged',
  TRANSCODED: 'transcoded',
  TRANSCODE_ERRORS: 'transcode_errors',
  HEALTH_ERRORS: 'health_errors',
  SPACE_SAVED: 'space_saved',
  NODES_ONLINE: 'nodes_online',
  VERSION: 'version',
  WORKERS: 'workers',
  FILES: 'files',
  QUEUED: 'queued',
  ERRORS: 'errors',
});

const K = FEATURE_KEYS;

// Feature names, per device type and language (Gladys does not tell a device
// integration the user's language). Frozen at creation in Gladys.
export const NAMES = {
  [DEVICE_TYPES.SERVER]: {
    en: {
      [K.ONLINE]: 'Online',
      [K.PAUSED]: 'All nodes paused',
      [K.TRANSCODE_QUEUE]: 'Transcode queue',
      [K.HEALTH_QUEUE]: 'Health check queue',
      [K.IN_PROGRESS]: 'Files in progress',
      [K.STAGED]: 'Waiting for review',
      [K.TRANSCODED]: 'Transcoded',
      [K.TRANSCODE_ERRORS]: 'Transcode errors',
      [K.HEALTH_ERRORS]: 'Health check errors',
      [K.SPACE_SAVED]: 'Space saved',
      [K.NODES_ONLINE]: 'Nodes online',
      [K.VERSION]: 'Version',
    },
    fr: {
      [K.ONLINE]: 'En ligne',
      [K.PAUSED]: 'Tous les nœuds en pause',
      [K.TRANSCODE_QUEUE]: 'File de transcodage',
      [K.HEALTH_QUEUE]: 'File de contrôle sanitaire',
      [K.IN_PROGRESS]: 'Fichiers en cours',
      [K.STAGED]: 'En attente de validation',
      [K.TRANSCODED]: 'Transcodés',
      [K.TRANSCODE_ERRORS]: 'Transcodages en échec',
      [K.HEALTH_ERRORS]: 'Contrôles en échec',
      [K.SPACE_SAVED]: 'Place gagnée',
      [K.NODES_ONLINE]: 'Nœuds en ligne',
      [K.VERSION]: 'Version',
    },
    de: {
      [K.ONLINE]: 'Online',
      [K.PAUSED]: 'Alle Nodes pausiert',
      [K.TRANSCODE_QUEUE]: 'Transcodierungs-Warteschlange',
      [K.HEALTH_QUEUE]: 'Integritätsprüfungs-Warteschlange',
      [K.IN_PROGRESS]: 'Dateien in Bearbeitung',
      [K.STAGED]: 'Warten auf Prüfung',
      [K.TRANSCODED]: 'Transcodiert',
      [K.TRANSCODE_ERRORS]: 'Transcodierungsfehler',
      [K.HEALTH_ERRORS]: 'Integritätsfehler',
      [K.SPACE_SAVED]: 'Gesparter Speicher',
      [K.NODES_ONLINE]: 'Nodes online',
      [K.VERSION]: 'Version',
    },
    es: {
      [K.ONLINE]: 'En línea',
      [K.PAUSED]: 'Todos los nodos en pausa',
      [K.TRANSCODE_QUEUE]: 'Cola de transcodificación',
      [K.HEALTH_QUEUE]: 'Cola de comprobación',
      [K.IN_PROGRESS]: 'Archivos en curso',
      [K.STAGED]: 'Pendientes de revisión',
      [K.TRANSCODED]: 'Transcodificados',
      [K.TRANSCODE_ERRORS]: 'Transcodificaciones fallidas',
      [K.HEALTH_ERRORS]: 'Comprobaciones fallidas',
      [K.SPACE_SAVED]: 'Espacio ahorrado',
      [K.NODES_ONLINE]: 'Nodos en línea',
      [K.VERSION]: 'Versión',
    },
  },
  [DEVICE_TYPES.NODE]: {
    en: { [K.ONLINE]: 'Online', [K.WORKERS]: 'Active workers', [K.PAUSED]: 'Paused' },
    fr: { [K.ONLINE]: 'En ligne', [K.WORKERS]: 'Travailleurs actifs', [K.PAUSED]: 'En pause' },
    de: { [K.ONLINE]: 'Online', [K.WORKERS]: 'Aktive Worker', [K.PAUSED]: 'Pausiert' },
    es: {
      [K.ONLINE]: 'En línea',
      [K.WORKERS]: 'Trabajadores activos',
      [K.PAUSED]: 'En pausa',
    },
  },
  [DEVICE_TYPES.LIBRARY]: {
    en: {
      [K.FILES]: 'Files',
      [K.QUEUED]: 'To process',
      [K.ERRORS]: 'In error',
      [K.SPACE_SAVED]: 'Space saved',
    },
    fr: {
      [K.FILES]: 'Fichiers',
      [K.QUEUED]: 'À traiter',
      [K.ERRORS]: 'En échec',
      [K.SPACE_SAVED]: 'Place gagnée',
    },
    de: {
      [K.FILES]: 'Dateien',
      [K.QUEUED]: 'Zu bearbeiten',
      [K.ERRORS]: 'Mit Fehler',
      [K.SPACE_SAVED]: 'Gesparter Speicher',
    },
    es: {
      [K.FILES]: 'Archivos',
      [K.QUEUED]: 'Por procesar',
      [K.ERRORS]: 'Con error',
      [K.SPACE_SAVED]: 'Espacio ahorrado',
    },
  },
};

// Display bounds (the core never applies them on write). The space saved is
// signed: a transcode can make a file bigger.
const COUNTER_MAX = 10_000_000;
const SPACE_BOUND = 1_000_000;

const sensor = (category, type, extra = {}) => ({
  category,
  type,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  ...extra,
});

const DEFINITIONS = {
  online: sensor(DEVICE_FEATURE_CATEGORIES.INPUT, DEVICE_FEATURE_TYPES.SENSOR.BINARY, {
    min: 0,
    max: 1,
  }),
  counter: sensor(DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR, DEVICE_FEATURE_TYPES.SENSOR.INTEGER, {
    min: 0,
    max: COUNTER_MAX,
  }),
  space: sensor(DEVICE_FEATURE_CATEGORIES.DATA, DEVICE_FEATURE_TYPES.DATA.SIZE, {
    unit: DEVICE_FEATURE_UNITS.GIGABYTE,
    min: -SPACE_BOUND,
    max: SPACE_BOUND,
  }),
  pause: (allowControl) => ({
    category: DEVICE_FEATURE_CATEGORIES.SWITCH,
    type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
    read_only: !allowControl,
    has_feedback: true,
    keep_history: true,
    min: 0,
    max: 1,
  }),
  text: {
    category: DEVICE_FEATURE_CATEGORIES.TEXT,
    type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
    read_only: true,
    has_feedback: false,
    keep_history: false,
    min: 0,
    max: 0,
  },
};

// Order = display order in Gladys. `value` reads the snapshot of the hub.
const FEATURES = {
  [DEVICE_TYPES.SERVER]: [
    { key: K.ONLINE, definition: 'online', value: (s) => bit(s.reachable) },
    { key: K.PAUSED, definition: 'pause', value: (s) => bit(s.pausedAll) },
    { key: K.TRANSCODE_QUEUE, definition: 'counter', value: (s) => s.stats?.transcodeQueue },
    { key: K.HEALTH_QUEUE, definition: 'counter', value: (s) => s.stats?.healthQueue },
    { key: K.IN_PROGRESS, definition: 'counter', value: (s) => s.inProgress },
    { key: K.STAGED, definition: 'counter', value: (s) => s.staged },
    { key: K.TRANSCODED, definition: 'counter', value: (s) => s.stats?.transcoded },
    { key: K.TRANSCODE_ERRORS, definition: 'counter', value: (s) => s.stats?.transcodeErrors },
    { key: K.HEALTH_ERRORS, definition: 'counter', value: (s) => s.stats?.healthErrors },
    { key: K.SPACE_SAVED, definition: 'space', value: (s) => s.stats?.spaceSaved },
    { key: K.NODES_ONLINE, definition: 'counter', value: (s) => s.nodesOnline },
    { key: K.VERSION, definition: 'text', value: (s) => s.version || null },
  ],
  [DEVICE_TYPES.NODE]: [
    { key: K.ONLINE, definition: 'online', value: (n) => bit(n.online) },
    { key: K.WORKERS, definition: 'counter', value: (n) => (n.online ? n.workers : null) },
    { key: K.PAUSED, definition: 'pause', value: (n) => (n.online ? bit(n.paused) : null) },
  ],
  [DEVICE_TYPES.LIBRARY]: [
    { key: K.FILES, definition: 'counter', value: (l) => l.pies?.files },
    { key: K.QUEUED, definition: 'counter', value: (l) => l.pies?.queued },
    { key: K.ERRORS, definition: 'counter', value: (l) => l.pies?.errors },
    { key: K.SPACE_SAVED, definition: 'space', value: (l) => l.pies?.spaceSaved },
  ],
};

function bit(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return value ? 1 : 0;
}

/** A node name as an id part: lower case, letters, digits and dashes. */
export const nodeSlug = (name) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'node';

export const serverIds = (gladys) => gladys.externalIds(DEVICE_TYPES.SERVER, SERVER_ID);
export const nodeIds = (gladys, name) => gladys.externalIds(DEVICE_TYPES.NODE, nodeSlug(name));
export const libraryIds = (gladys, id) => gladys.externalIds(DEVICE_TYPES.LIBRARY, id);

function features(gladys, type, ids, language, allowControl) {
  const names = NAMES[type][language] ?? NAMES[type].en;
  return FEATURES[type].map(({ key, definition }) => ({
    ...(definition === 'pause' ? DEFINITIONS.pause(allowControl) : DEFINITIONS[definition]),
    name: names[key],
    external_id: ids.feature(key),
  }));
}

/** The server device. */
export function buildServer(gladys, config) {
  const ids = serverIds(gladys);
  return {
    name: `Tdarr ${hostOf(config.url)}`.slice(0, 60),
    external_id: ids.device,
    should_poll: false,
    params: [{ name: URL_PARAM, value: config.url }],
    features: features(gladys, DEVICE_TYPES.SERVER, ids, config.language, config.allowControl),
  };
}

/** A node device. */
export function buildNode(gladys, config, name) {
  const ids = nodeIds(gladys, name);
  return {
    name: `Tdarr ${name}`.slice(0, 60),
    external_id: ids.device,
    should_poll: false,
    params: [{ name: NODE_PARAM, value: name }],
    features: features(gladys, DEVICE_TYPES.NODE, ids, config.language, config.allowControl),
  };
}

/** A library device. */
export function buildLibrary(gladys, config, library) {
  const ids = libraryIds(gladys, library.id);
  return {
    name: `Tdarr ${library.name}`.slice(0, 60),
    external_id: ids.device,
    should_poll: false,
    features: features(gladys, DEVICE_TYPES.LIBRARY, ids, config.language, config.allowControl),
  };
}

/**
 * The value of every feature of a device (null: nothing to publish).
 * @returns {Array<{ key: string, externalId: string, value: number|string|null, text: boolean }>}
 */
export function featureValues(type, ids, source) {
  return FEATURES[type].map(({ key, definition, value }) => {
    const read = value(source);
    return {
      key,
      externalId: ids.feature(key),
      value: read === undefined ? null : read,
      text: definition === 'text',
    };
  });
}
