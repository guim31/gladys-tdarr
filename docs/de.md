# Tdarr

Dein [Tdarr](https://tdarr.io)-Server in Gladys, über dein lokales Netzwerk:
die Warteschlangen für Transcodierung und Integritätsprüfung, die Dateien in
Bearbeitung und mit Fehler, der gesparte Speicher, der Zustand jedes Nodes, ein
Pausenschalter und Szenen, die reagieren, wenn alles erledigt ist, eine Datei
scheitert oder ein Node die Verbindung verliert.

Die Integration wurde mit einem echten Tdarr-3.01-Server getestet (das
offizielle Docker-Image mit seinem internen Node), noch nicht in einer echten
Gladys-Installation: Rückmeldungen sind im
[Gladys-Forum](https://community.gladysassistant.com) oder in den
[Issues](https://github.com/guim31/gladys-tdarr/issues) willkommen.

## Was du brauchst

- Gladys Assistant 5.1.0 oder neuer.
- Einen **Tdarr**-Server (Version 2 oder 3), von Gladys aus erreichbar (gleiches
  Netzwerk), auf dem Port seiner Weboberfläche (standardmäßig `8265`).
- Wenn die Authentifizierung von Tdarr aktiv ist (Tdarr 2.24 oder neuer; in
  Tdarr 3 standardmäßig aktiv), einen **API-Schlüssel**: in Tdarr **Tools** →
  **API keys** oder der `seededApiKey` der Serverkonfiguration.

## Einrichtung

1. Installiere die Integration aus dem Gladys-Katalog.
2. Gib in der **Konfiguration** die **Adresse** des Tdarr-Servers ein (zum
   Beispiel `192.168.1.2:8265`; ohne Port wird `8265` verwendet) und, wenn die
   Authentifizierung aktiv ist, seinen **API-Schlüssel**.
3. Speichere und klicke dann auf **Verbindung testen**: Die Meldung unter der
   Taste zeigt die Version von Tdarr, die Nodes online, die Bibliotheken und
   die Warteschlange.
4. Öffne den Tab **Entdecken**: ein Gerät für den Server, eines pro Node, eines
   pro Bibliothek. Klicke bei den gewünschten auf **Hinzufügen**, wähle einen
   Raum und speichere.

Optionen:

- **Pause und Fortsetzen erlauben** (standardmäßig an): Gladys darf die Nodes
  pausieren und fortsetzen (Schalter, Szenen, Widget-Taste) und einen
  Bibliotheksscan starten. Aus: Die Integration liest nur.
- **Aktualisierungsintervall**: 30 Sekunden bis 5 Minuten (standardmäßig 1
  Minute).
- **Sprache der Funktionsnamen**: die Namen der Funktionen beim Hinzufügen
  eines Geräts und die Sprache des Zusammenfassungssatzes.

## Die Geräte

**Der Tdarr-Server**

| Funktion                              | Was sie zeigt                                                               |
| ------------------------------------- | --------------------------------------------------------------------------- |
| **Online**                            | 1, solange der Server antwortet.                                            |
| **Alle Nodes pausiert**               | Schalter: pausiert alle Nodes oder setzt sie fort („Pause all“ von Tdarr).  |
| **Transcodierungs-Warteschlange**     | Dateien, die auf eine Transcodierung warten.                                |
| **Integritätsprüfungs-Warteschlange** | Dateien, die auf eine Integritätsprüfung warten.                            |
| **Dateien in Bearbeitung**            | Dateien, die gerade auf allen Nodes bearbeitet werden.                      |
| **Warten auf Prüfung**                | Transcodierte Dateien, die auf deine Freigabe warten (Tab Staged).          |
| **Transcodiert**                      | Erfolgreich transcodierte Dateien (Startseite von Tdarr).                   |
| **Transcodierungsfehler**             | Dateien, deren Transcodierung gescheitert ist.                              |
| **Integritätsfehler**                 | Dateien, deren Integritätsprüfung gescheitert ist.                          |
| **Gesparter Speicher**                | Durch die Transcodierungen gesparter Speicher in GB (negativ, wenn größer). |
| **Nodes online**                      | Mit dem Server verbundene Nodes.                                            |
| **Version**                           | Version von Tdarr.                                                          |

**Jeder Node** (benannt nach dem in Tdarr eingestellten Node-Namen)

| Funktion          | Was sie zeigt                                       |
| ----------------- | --------------------------------------------------- |
| **Online**        | 1, solange der Node mit dem Server verbunden ist.   |
| **Aktive Worker** | Worker, die auf diesem Node eine Datei bearbeiten.  |
| **Pausiert**      | Schalter: pausiert diesen Node oder setzt ihn fort. |

**Jede Bibliothek**

| Funktion               | Was sie zeigt                                                        |
| ---------------------- | -------------------------------------------------------------------- |
| **Dateien**            | Dateien der Bibliothek.                                              |
| **Zu bearbeiten**      | Dateien, die auf eine Transcodierung oder Integritätsprüfung warten. |
| **Mit Fehler**         | Dateien der Bibliothek mit Fehler (Transcodierung oder Prüfung).     |
| **Gesparter Speicher** | In dieser Bibliothek gesparter Speicher in GB.                       |

Ein pausierter Node beendet die laufenden Dateien und beginnt keine neue: Nichts
geht verloren. Ein Node, der die Verbindung verliert, bleibt offline in Gladys,
bis er zurückkommt.

## Dashboard

Das Widget **Tdarr** zeigt vier Kacheln (Dateien in der Warteschlange, in
Arbeit, mit Fehler, gesparter Speicher), eine Zeile pro Node (aktive Worker,
pausiert, offline) und eine Taste: **Alle pausieren**, während Tdarr arbeitet,
**Alle fortsetzen**, sobald pausiert. Keine Taste, wenn die Befehle in der
Konfiguration ausgeschaltet sind.

## Szenen

### Auslöser

- **Tdarr-Warteschlange leer**: Alles ist erledigt, die Warteschlangen für
  Transcodierung und Prüfung sind leer und kein Worker arbeitet mehr.
  Variablen: die transcodierten Dateien, die Transcodierungs- und
  Integritätsfehler (gesamt), der gesparte Speicher.
- **Tdarr-Datei fehlgeschlagen**: Eine Datei ist gerade bei der Transcodierung
  oder der Integritätsprüfung gescheitert. Filter: die Bibliothek, der Schritt
  (Transcodierung oder Integritätsprüfung). Variablen: der Dateiname, ihr
  vollständiger Pfad, die Bibliothek.
- **Tdarr-Node offline**: Ein verbundener Node hat sich getrennt (gestoppt,
  abgestürzt, Netzwerk). Filter: der Node. Variable: der Name des Nodes.

### Aktionen

- **Tdarr pausieren**: ein Node oder alle, wenn kein Node gewählt ist.
- **Tdarr fortsetzen**: dieselbe Wahl.
- **Tdarr-Bibliothek scannen**: sucht neue Dateien in einer Bibliothek oder in
  allen („Scan → Find new“ von Tdarr). Ausgabe: die Zahl der gescannten
  Bibliotheken.
- **Tdarr-Zusammenfassung lesen**: ein Satz für eine Nachricht oder eine
  Sprachansage („Tdarr: 12 Datei(en) in der Warteschlange, 2 in Bearbeitung, 1
  mit Fehler, 35,2 GB gespart.“), dazu Warteschlange, Dateien in Arbeit und
  Fehler als Zahlen.

### Szenenideen

- Um 18 Uhr **Tdarr pausieren**, damit Prozessor und Festplatten für den Film
  am Abend frei bleiben; um 1 Uhr **Tdarr fortsetzen**.
- **Tdarr-Datei fehlgeschlagen** → eine Telegram-Nachricht mit dem Dateinamen
  und der Bibliothek.
- **Tdarr-Warteschlange leer** → eine Benachrichtigung: „Tdarr ist fertig,
  gesparter Speicher: …“.
- Nach einem von Sonarr oder Radarr importierten Download **Tdarr-Bibliothek
  scannen**, damit die neue Episode sofort bearbeitet wird.

## Fehlerbehebung

- **„Tdarr antwortet nicht“**: Prüfe die Adresse und den Port (`8265`, der
  Port der Weboberfläche, nicht der `8266` der Nodes) und dass Gladys den
  Server erreicht (Firewall, Docker-Netzwerk).
- **„API-Schlüssel abgelehnt oder fehlend“**: Die Authentifizierung von Tdarr
  ist aktiv. Erstelle einen Schlüssel unter **Tools** → **API keys** und füge
  ihn in die Konfiguration ein.
- **„Kein Tdarr-Server unter dieser Adresse“**: Eine andere Anwendung antwortet
  auf diesem Port.
- **Ein Node erscheint doppelt**: Tdarr erkennt einen Node an seinem Namen.
  Wenn du einen Node in seiner Konfiguration umbenennst (`nodeName`), entsteht
  ein neues Gerät in Gladys; lösche das alte.
- **Der Schalter tut nichts**: Prüfe **Pause und Fortsetzen erlauben** in der
  Konfiguration.
- Mehr Details in den Protokollen der Integration (**Integrationen** → Tdarr →
  Protokolle), bei Bedarf auf der Stufe `debug`.

## Grenzen

- Ein Tdarr-Server pro Integration.
- Die Zahlen werden in jedem Aktualisierungsintervall gelesen: Eine kurze
  Transcodierung kann zwischen zwei Abfragen fertig werden, und
  **Tdarr-Datei fehlgeschlagen** meldet höchstens zehn Dateien pro Abfrage.
  Fehler, die älter als eine Stunde sind, werden nicht gemeldet.
- **Warten auf Prüfung** zählt die Dateien, die Tdarr im Tab Staged behält, bis
  du sie annimmst (wenn „Auto accept successful transcodes“ aus ist).
- Die Integration ändert weder die Transcodierungseinstellungen noch die
  Plugins oder Flows von Tdarr und löscht nichts.
- Nicht mit Tdarr oder seinen Autoren verbunden.
