// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `overview`.
//
// The use case: is Tdarr working, at a glance on the wall tablet. Four tiles
// (files in queue, in progress, in error, space saved), one status row per
// node (active workers, paused, offline), and one button that pauses every
// node or resumes them, when the configuration allows the commands.
//
// The figures are sent as values, not bound to device features, so the widget
// works before the devices are added to Gladys.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { ERROR_KINDS } from './tdarr/client.js';
import { WIDGET_KEY } from './hub.js';
import { ERROR_TEXT, pick } from './texts.js';

// Action keys of the buttons: permanent once published.
export const ACTIONS = Object.freeze({
  PAUSE_ALL: 'pause_all',
  RESUME_ALL: 'resume_all',
});

export const TEXT = {
  pick: {
    en: 'Enter the address of your Tdarr server in the configuration of the integration.',
    fr: "Saisissez l'adresse de votre serveur Tdarr dans la configuration de l'intégration.",
    de: 'Gib die Adresse deines Tdarr-Servers in der Konfiguration der Integration ein.',
    es: 'Introduzca la dirección de su servidor Tdarr en la configuración de la integración.',
  },
  waiting: {
    en: 'Waiting for the first reading of Tdarr…',
    fr: 'En attente de la première lecture de Tdarr…',
    de: 'Warte auf die erste Abfrage von Tdarr…',
    es: 'Esperando la primera lectura de Tdarr…',
  },
  queue: { en: 'In queue', fr: 'En file', de: 'Warteschlange', es: 'En cola' },
  inProgress: { en: 'In progress', fr: 'En cours', de: 'In Arbeit', es: 'En curso' },
  errors: { en: 'In error', fr: 'En échec', de: 'Mit Fehler', es: 'Con error' },
  spaceSaved: { en: 'Space saved', fr: 'Place gagnée', de: 'Gespart', es: 'Ahorrado' },
  workers: { en: 'worker(s)', fr: 'travailleur(s)', de: 'Worker', es: 'trabajador(es)' },
  idle: { en: 'Idle', fr: 'Inactif', de: 'Untätig', es: 'Inactivo' },
  paused: { en: 'Paused', fr: 'En pause', de: 'Pausiert', es: 'En pausa' },
  offline: { en: 'Offline', fr: 'Hors ligne', de: 'Offline', es: 'Sin conexión' },
  allPaused: {
    en: 'All nodes paused',
    fr: 'Tous en pause',
    de: 'Alle pausiert',
    es: 'Todos en pausa',
  },
  noNode: { en: 'No node', fr: 'Aucun nœud', de: 'Kein Node', es: 'Ningún nodo' },
  pauseAll: {
    en: 'Pause all',
    fr: 'Tout mettre en pause',
    de: 'Alle pausieren',
    es: 'Pausar todo',
  },
  resumeAll: { en: 'Resume all', fr: 'Tout reprendre', de: 'Alle fortsetzen', es: 'Reanudar todo' },
  unit: { en: 'GB', fr: 'Go', de: 'GB', es: 'GB' },
};

// Toasts after a tap (≤ 200 characters).
export const DONE_TEXT = {
  pauseAll: {
    en: 'Every Tdarr node is paused: the files in progress finish, no new one starts.',
    fr: 'Tous les nœuds Tdarr sont en pause : les fichiers en cours se terminent, aucun nouveau ne démarre.',
    de: 'Alle Tdarr-Nodes sind pausiert: Laufende Dateien werden fertig, keine neue startet.',
    es: 'Todos los nodos Tdarr están en pausa: los archivos en curso terminan, no empieza ninguno nuevo.',
  },
  resumeAll: {
    en: 'Every Tdarr node resumed.',
    fr: 'Tous les nœuds Tdarr ont repris.',
    de: 'Alle Tdarr-Nodes laufen wieder.',
    es: 'Todos los nodos Tdarr se han reanudado.',
  },
};

const t = (text, language) => pick(text, language);
const fit = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

function message(text, language) {
  return {
    ttl_seconds: 300,
    components: [{ type: 'text', variant: 'body', text: fit(t(text, language), 300) }],
  };
}

/** The status row of one node. */
export function nodeRow(node, pausedAll, language) {
  const label = fit(node.name, 40);
  if (!node.online) {
    return {
      label,
      icon: 'wifi-off',
      value: t(TEXT.offline, language),
      color: WIDGET_COLORS.DANGER,
    };
  }
  if (node.paused || pausedAll) {
    return { label, icon: 'pause', value: t(TEXT.paused, language), color: WIDGET_COLORS.WARNING };
  }
  if (node.workers > 0) {
    return {
      label,
      icon: 'cpu',
      value: fit(`${node.workers} ${t(TEXT.workers, language)}`, 40),
      color: WIDGET_COLORS.SUCCESS,
    };
  }
  return { label, icon: 'cpu', value: t(TEXT.idle, language), color: WIDGET_COLORS.NEUTRAL };
}

async function get(hub, { language = 'en' } = {}) {
  if (!hub.client) {
    return message(TEXT.pick, language);
  }
  if (hub.error) {
    const unreachable = hub.error.kind === ERROR_KINDS.UNREACHABLE;
    return {
      ttl_seconds: 120,
      components: [
        {
          type: 'status',
          items: [
            {
              label: 'Tdarr',
              icon: 'alert-triangle',
              value: fit(t(unreachable ? TEXT.offline : TEXT.errors, language), 40),
              color: WIDGET_COLORS.DANGER,
            },
          ],
        },
        { type: 'text', variant: 'body', text: fit(t(ERROR_TEXT[hub.error.kind], language), 300) },
      ],
    };
  }
  if (!hub.server.reachable) {
    return message(TEXT.waiting, language);
  }
  const totals = hub.totals();
  const components = [
    { type: 'value', value: totals.queue, label: t(TEXT.queue, language), icon: 'list' },
    {
      type: 'value',
      value: totals.inProgress,
      label: t(TEXT.inProgress, language),
      icon: 'loader',
      color: totals.inProgress ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
    },
    {
      type: 'value',
      value: totals.errors,
      label: t(TEXT.errors, language),
      icon: 'alert-circle',
      color: totals.errors ? WIDGET_COLORS.DANGER : WIDGET_COLORS.NEUTRAL,
    },
    {
      type: 'value',
      value: totals.spaceSaved,
      unit: t(TEXT.unit, language),
      label: t(TEXT.spaceSaved, language),
      icon: 'hard-drive',
    },
  ];
  const nodes = [...hub.nodes.values()].sort(
    (a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name),
  );
  const rows = nodes.slice(0, 10).map((node) => nodeRow(node, hub.server.pausedAll, language));
  if (hub.server.pausedAll && rows.length < 10) {
    rows.unshift({
      label: 'Tdarr',
      icon: 'pause-circle',
      value: t(TEXT.allPaused, language),
      color: WIDGET_COLORS.WARNING,
    });
  }
  components.push({
    type: 'status',
    items: rows.length
      ? rows
      : [
          {
            label: 'Tdarr',
            icon: 'cpu',
            value: t(TEXT.noNode, language),
            color: WIDGET_COLORS.WARNING,
          },
        ],
  });
  if (hub.config.allowControl) {
    components.push(
      hub.server.pausedAll
        ? {
            type: 'button',
            label: t(TEXT.resumeAll, language),
            icon: 'play',
            style: 'secondary',
            action: { key: ACTIONS.RESUME_ALL },
          }
        : {
            type: 'button',
            label: t(TEXT.pauseAll, language),
            icon: 'pause',
            style: 'secondary',
            action: { key: ACTIONS.PAUSE_ALL },
          },
    );
  }
  return { ttl_seconds: 300, components };
}

async function action(hub, { actionKey }) {
  if (actionKey === ACTIONS.PAUSE_ALL) {
    await hub.setPaused(null, true);
    return { message: DONE_TEXT.pauseAll };
  }
  if (actionKey === ACTIONS.RESUME_ALL) {
    await hub.setPaused(null, false);
    return { message: DONE_TEXT.resumeAll };
  }
  throw new Error(`Unknown action ${actionKey}`);
}

export const WIDGETS = {
  [WIDGET_KEY]: { get, action },
};
