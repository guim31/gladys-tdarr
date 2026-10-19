// -----------------------------------------------------------------------------
// Parsers of the Tdarr answers (shapes taken from a real Tdarr 3.01 server,
// see test/fixtures/tdarr/). Each one keeps what the integration shows and
// tolerates a missing field (older or newer Tdarr): a number it cannot read
// becomes null, never NaN.
// -----------------------------------------------------------------------------

const count = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
};

/** Gigabytes, two decimals (Tdarr counts the space saved in GB, negative when files grew). */
const gigabytes = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
};

const text = (value, max = 120) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** StatisticsJSONDB / statistics: the counters of the Tdarr home page. */
export function parseStatistics(answer) {
  const source = answer && typeof answer === 'object' ? answer : {};
  return {
    files: count(source.totalFileCount),
    transcodeQueue: count(source.table1Count),
    transcoded: count(source.table2Count),
    transcodeErrors: count(source.table3Count),
    healthQueue: count(source.table4Count),
    healthy: count(source.table5Count),
    healthErrors: count(source.table6Count),
    spaceSaved: gigabytes(source.sizeDiff),
  };
}

/** The nodes connected to the server, by name (the id changes at each node start). */
export function parseNodes(answer) {
  const source = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
  const nodes = [];
  for (const [id, node] of Object.entries(source)) {
    if (!node || typeof node !== 'object') {
      continue;
    }
    const name = text(node.nodeName, 60) || text(node._id, 60) || text(id, 60);
    if (!name) {
      continue;
    }
    const workers = Object.values(
      node.workers && typeof node.workers === 'object' ? node.workers : {},
    );
    const active = workers.filter((worker) => worker && worker.idle !== true);
    nodes.push({
      id: text(node._id, 60) || id,
      name,
      paused: node.nodePaused === true,
      workers: active.length,
      files: active.map((worker) => text(worker.file, 300)).filter(Boolean),
    });
  }
  return nodes.sort((a, b) => a.name.localeCompare(b.name));
}

/** LibrarySettingsJSONDB / getAll. */
export function parseLibraries(answer) {
  return (Array.isArray(answer) ? answer : [])
    .filter((library) => library && typeof library._id === 'string' && library._id)
    .map((library) => ({
      id: library._id,
      name: text(library.name, 60) || library._id,
      folder: typeof library.folder === 'string' ? library.folder : '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const statusCount = (list, names) =>
  (Array.isArray(list) ? list : [])
    .filter((entry) => entry && names.includes(entry.name))
    .reduce((total, entry) => total + (count(entry.value) ?? 0), 0);

/** stats/get-pies of one library. */
export function parsePies(answer) {
  const pies = answer?.pieStats && typeof answer.pieStats === 'object' ? answer.pieStats : null;
  if (!pies) {
    return null;
  }
  const transcode = pies.status?.transcode;
  const health = pies.status?.healthcheck;
  return {
    files: count(pies.totalFiles),
    queued: statusCount(transcode, ['Queued']) + statusCount(health, ['Queued']),
    errors:
      statusCount(transcode, ['Transcode error']) + statusCount(health, ['Error', 'Health error']),
    spaceSaved: gigabytes(pies.sizeDiff),
  };
}

/** Transcoded files waiting for a review. */
export const parseStaged = (answer) => count(answer?.totalCount);

/**
 * Rows of an error table (client/status-tables).
 * @param {'transcode'|'health'} kind
 */
export function parseFailures(answer, kind) {
  const dateKey = kind === 'health' ? 'lastHealthCheckDate' : 'lastTranscodeDate';
  return (Array.isArray(answer?.array) ? answer.array : [])
    .filter((row) => row && typeof row.file === 'string' && Number.isFinite(Number(row[dateKey])))
    .map((row) => ({
      kind,
      file: row.file,
      name: text(row.fileNameWithoutExtension) || row.file.split('/').pop(),
      library: typeof row.DB === 'string' ? row.DB : '',
      at: Number(row[dateKey]),
    }));
}

/** `pauseAllNodes` of the global settings (nothing else is kept: they hold the Pro key). */
export const parsePauseAll = (answer) => answer?.pauseAllNodes === true;
