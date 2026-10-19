// -----------------------------------------------------------------------------
// Texts the integration sends to Gladys outside the widget (src/widgets.js):
// connection status, errors, the "Test the connection" report, the command
// errors and the summary sentence. Four languages, the four of the Gladys
// interface; German says "du", Spanish "usted". test/i18n.test.js checks
// every table.
// -----------------------------------------------------------------------------

import { ERROR_KINDS } from './tdarr/client.js';

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

export const CONNECTION_TEXT = {
  noServer: {
    en: 'Enter the address of your Tdarr server in the configuration.',
    fr: "Saisissez l'adresse de votre serveur Tdarr dans la configuration.",
    de: 'Gib die Adresse deines Tdarr-Servers in der Konfiguration ein.',
    es: 'Introduzca la dirección de su servidor Tdarr en la configuración.',
  },
  invalid: {
    en: 'The address of the Tdarr server is not valid (e.g. http://192.168.1.2:8265).',
    fr: "L'adresse du serveur Tdarr n'est pas valide (ex. http://192.168.1.2:8265).",
    de: 'Die Adresse des Tdarr-Servers ist ungültig (z. B. http://192.168.1.2:8265).',
    es: 'La dirección del servidor Tdarr no es válida (p. ej. http://192.168.1.2:8265).',
  },
};

// One explanation per error kind (src/tdarr/client.js).
export const ERROR_TEXT = {
  [ERROR_KINDS.UNREACHABLE]: {
    en: 'Tdarr does not answer: check the address and the port (8265).',
    fr: "Tdarr ne répond pas : vérifiez l'adresse et le port (8265).",
    de: 'Tdarr antwortet nicht: Prüfe die Adresse und den Port (8265).',
    es: 'Tdarr no responde: compruebe la dirección y el puerto (8265).',
  },
  [ERROR_KINDS.TLS]: {
    en: 'Certificate refused: use the http:// address on your network.',
    fr: 'Certificat refusé : utilisez l’adresse en http:// de votre réseau.',
    de: 'Zertifikat abgelehnt: Verwende die http://-Adresse in deinem Netzwerk.',
    es: 'Certificado rechazado: use la dirección http:// de su red.',
  },
  [ERROR_KINDS.AUTH]: {
    en: 'API key refused or missing (Tdarr: Tools → API keys).',
    fr: "Clé d'API refusée ou manquante (Tdarr : Tools → API keys).",
    de: 'API-Schlüssel abgelehnt oder fehlend (Tdarr: Tools → API keys).',
    es: 'Clave de API rechazada o ausente (Tdarr: Tools → API keys).',
  },
  [ERROR_KINDS.NOT_TDARR]: {
    en: 'No Tdarr server at this address (web interface port, 8265 by default).',
    fr: "Aucun serveur Tdarr à cette adresse (port de l'interface web, 8265 par défaut).",
    de: 'Kein Tdarr-Server unter dieser Adresse (Port der Weboberfläche, standardmäßig 8265).',
    es: 'No hay ningún servidor Tdarr en esta dirección (puerto de la interfaz web, 8265).',
  },
  [ERROR_KINDS.REDIRECT]: {
    en: 'The address redirects: enter the final address of the Tdarr server.',
    fr: "L'adresse redirige : saisissez l'adresse finale du serveur Tdarr.",
    de: 'Die Adresse leitet um: Gib die endgültige Adresse des Tdarr-Servers ein.',
    es: 'La dirección redirige: introduzca la dirección final del servidor Tdarr.',
  },
  [ERROR_KINDS.HTTP]: {
    en: 'Unexpected answer from Tdarr, see the logs of the integration.',
    fr: "Réponse inattendue de Tdarr, voir les logs de l'intégration.",
    de: 'Unerwartete Antwort von Tdarr, sieh in den Protokollen der Integration nach.',
    es: 'Respuesta inesperada de Tdarr, consulte los registros de la integración.',
  },
};

const gb = (value, language) =>
  `${value.toLocaleString(language, { maximumFractionDigits: 1 })} ${language === 'fr' ? 'Go' : 'GB'}`;

// The "Test the connection" report.
export const REPORT_TEXT = {
  en: {
    ok: (version) => `OK, Tdarr ${version}`,
    nodes: (count) => `${count} node(s) online`,
    libraries: (count) => `${count} library(ies)`,
    queue: (count) => `${count} file(s) in queue`,
    errors: (count) => `${count} in error`,
  },
  fr: {
    ok: (version) => `OK, Tdarr ${version}`,
    nodes: (count) => `${count} nœud(s) en ligne`,
    libraries: (count) => `${count} bibliothèque(s)`,
    queue: (count) => `${count} fichier(s) en file`,
    errors: (count) => `${count} en échec`,
  },
  de: {
    ok: (version) => `OK, Tdarr ${version}`,
    nodes: (count) => `${count} Node(s) online`,
    libraries: (count) => `${count} Bibliothek(en)`,
    queue: (count) => `${count} Datei(en) in der Warteschlange`,
    errors: (count) => `${count} mit Fehler`,
  },
  es: {
    ok: (version) => `OK, Tdarr ${version}`,
    nodes: (count) => `${count} nodo(s) en línea`,
    libraries: (count) => `${count} biblioteca(s)`,
    queue: (count) => `${count} archivo(s) en cola`,
    errors: (count) => `${count} con error`,
  },
};

// The sentence of the "Read the summary" scene action.
export const SUMMARY_TEXT = {
  en: {
    queue: (count) => `${count} file(s) in queue`,
    inProgress: (count) => `${count} in progress`,
    errors: (count) => `${count} in error`,
    staged: (count) => `${count} waiting for review`,
    spaceSaved: (value) => `${gb(value, 'en')} saved`,
    paused: 'all nodes paused',
    down: 'Tdarr does not answer.',
  },
  fr: {
    queue: (count) => `${count} fichier(s) en file`,
    inProgress: (count) => `${count} en cours`,
    errors: (count) => `${count} en échec`,
    staged: (count) => `${count} en attente de validation`,
    spaceSaved: (value) => `${gb(value, 'fr')} gagnés`,
    paused: 'tous les nœuds en pause',
    down: 'Tdarr ne répond pas.',
  },
  de: {
    queue: (count) => `${count} Datei(en) in der Warteschlange`,
    inProgress: (count) => `${count} in Bearbeitung`,
    errors: (count) => `${count} mit Fehler`,
    staged: (count) => `${count} warten auf Prüfung`,
    spaceSaved: (value) => `${gb(value, 'de')} gespart`,
    paused: 'alle Nodes pausiert',
    down: 'Tdarr antwortet nicht.',
  },
  es: {
    queue: (count) => `${count} archivo(s) en cola`,
    inProgress: (count) => `${count} en curso`,
    errors: (count) => `${count} con error`,
    staged: (count) => `${count} pendiente(s) de revisión`,
    spaceSaved: (value) => `${gb(value, 'es')} ahorrados`,
    paused: 'todos los nodos en pausa',
    down: 'Tdarr no responde.',
  },
};

// Errors of the commands (scene actions, widget button, switches).
export const ACTION_TEXT = {
  noServer: {
    en: 'No Tdarr server is configured.',
    fr: "Aucun serveur Tdarr n'est configuré.",
    de: 'Kein Tdarr-Server ist konfiguriert.',
    es: 'No hay ningún servidor Tdarr configurado.',
  },
  controlOff: {
    en: 'Commands are turned off in the configuration of the integration.',
    fr: "Les commandes sont désactivées dans la configuration de l'intégration.",
    de: 'Befehle sind in der Konfiguration der Integration ausgeschaltet.',
    es: 'Las órdenes están desactivadas en la configuración de la integración.',
  },
  notANode: {
    en: 'Choose a Tdarr node or the Tdarr server.',
    fr: 'Choisissez un nœud Tdarr ou le serveur Tdarr.',
    de: 'Wähle einen Tdarr-Node oder den Tdarr-Server.',
    es: 'Elija un nodo Tdarr o el servidor Tdarr.',
  },
  nodeOffline: {
    en: 'This node is not connected to the Tdarr server.',
    fr: "Ce nœud n'est pas connecté au serveur Tdarr.",
    de: 'Dieser Node ist nicht mit dem Tdarr-Server verbunden.',
    es: 'Este nodo no está conectado al servidor Tdarr.',
  },
  notALibrary: {
    en: 'Choose a Tdarr library.',
    fr: 'Choisissez une bibliothèque Tdarr.',
    de: 'Wähle eine Tdarr-Bibliothek.',
    es: 'Elija una biblioteca Tdarr.',
  },
  noLibrary: {
    en: 'Tdarr has no library.',
    fr: "Tdarr n'a aucune bibliothèque.",
    de: 'Tdarr hat keine Bibliothek.',
    es: 'Tdarr no tiene ninguna biblioteca.',
  },
  failed: {
    en: 'Tdarr refused the command, see the logs of the integration.',
    fr: "Tdarr a refusé la commande, voir les logs de l'intégration.",
    de: 'Tdarr hat den Befehl abgelehnt, sieh in den Protokollen der Integration nach.',
    es: 'Tdarr ha rechazado la orden, consulte los registros de la integración.',
  },
};

export const LANGUAGE_FALLBACK = 'en';

export const pick = (text, language) => text[language] ?? text[LANGUAGE_FALLBACK];
