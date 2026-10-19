# Tdarr

Bring your [Tdarr](https://tdarr.io) server into Gladys, over your local
network: the transcode and health check queues, the files in progress and in
error, the space saved, the state of each node, a pause switch, and scenes that
react when everything is processed, when a file fails or when a node
disconnects.

The integration was tested against a real Tdarr 3.01 server (the official
Docker image, with its internal node), not yet in a real Gladys installation:
feedback is welcome on the [Gladys forum](https://community.gladysassistant.com)
or in the [issues](https://github.com/guim31/gladys-tdarr/issues).

## What you need

- Gladys Assistant 5.1.0 or later.
- A **Tdarr** server (version 2 or 3), reachable from Gladys (same network), on
  the port of its web interface (`8265` by default).
- When the authentication of Tdarr is on (Tdarr 2.24 or later; on by default in
  Tdarr 3), an **API key**: in Tdarr, **Tools** → **API keys**, or the
  `seededApiKey` of the server configuration.

## Set up

1. Install the integration from the Gladys catalog.
2. In **Configuration**, enter the **Address** of the Tdarr server (for example
   `192.168.1.2:8265`; without a port, `8265` is used) and, if the
   authentication is on, its **API key**.
3. Save, then click **Test the connection**: the message under the button gives
   the version of Tdarr, the nodes online, the libraries and the queue.
4. Open the **Discover** tab: one device for the server, one per node, one per
   library. Click **Add** on the ones you want, pick a room and save.

Options:

- **Allow pause and resume** (on by default): Gladys may pause and resume the
  nodes (switches, scenes, widget button) and start a library scan. Off, the
  integration only reads.
- **Refresh interval**: 30 seconds to 5 minutes (1 minute by default).
- **Language of the feature names**: the names given to the features when a
  device is added, and the language of the summary sentence.

## The devices

**The Tdarr server**

| Feature                 | What it shows                                                      |
| ----------------------- | ------------------------------------------------------------------ |
| **Online**              | 1 while the server answers.                                        |
| **All nodes paused**    | Switch: pauses or resumes every node (the "Pause all" of Tdarr).   |
| **Transcode queue**     | Files waiting for a transcode.                                     |
| **Health check queue**  | Files waiting for a health check.                                  |
| **Files in progress**   | Files being processed right now, on every node.                    |
| **Waiting for review**  | Transcoded files waiting for your approval (Staged tab).           |
| **Transcoded**          | Files transcoded with success (Tdarr home page).                   |
| **Transcode errors**    | Files whose transcode failed.                                      |
| **Health check errors** | Files whose health check failed.                                   |
| **Space saved**         | Space saved by the transcodes, in GB (negative if the files grew). |
| **Nodes online**        | Nodes connected to the server.                                     |
| **Version**             | Version of Tdarr.                                                  |

**Each node** (named after the node name set in Tdarr)

| Feature            | What it shows                                |
| ------------------ | -------------------------------------------- |
| **Online**         | 1 while the node is connected to the server. |
| **Active workers** | Workers processing a file on this node.      |
| **Paused**         | Switch: pauses or resumes this node.         |

**Each library**

| Feature         | What it shows                                              |
| --------------- | ---------------------------------------------------------- |
| **Files**       | Files of the library.                                      |
| **To process**  | Files waiting for a transcode or a health check.           |
| **In error**    | Files of the library in error (transcode or health check). |
| **Space saved** | Space saved in this library, in GB.                        |

A paused node finishes the files in progress and starts no new one: nothing is
lost. A node that disconnects stays in Gladys, offline, until it comes back.

## Dashboard

The **Tdarr** widget shows four tiles (files in queue, in progress, in error,
space saved), one row per node (active workers, paused, offline) and a button:
**Pause all** while Tdarr works, **Resume all** once paused. No button when the
commands are off in the configuration.

## Scenes

### Triggers

- **Tdarr queue emptied**: everything is processed, the transcode and health
  check queues are empty and no worker is busy any more. Variables: the files
  transcoded, the transcode and health check errors (totals), the space saved.
- **Tdarr file failed**: a file has just failed its transcode or its health
  check. Filters: the library, the step (transcode or health check).
  Variables: the file name, its full path, the library.
- **Tdarr node offline**: a node that was connected disconnected (stopped,
  crashed, network). Filter: the node. Variable: the node name.

### Actions

- **Pause Tdarr**: one node, or every node when no node is chosen.
- **Resume Tdarr**: same choice.
- **Scan a Tdarr library**: looks for new files in a library, or in every
  library (the "Scan → Find new" of Tdarr). Output: the number of libraries
  scanned.
- **Read the Tdarr summary**: a sentence for a message or a voice announcement
  ("Tdarr: 12 file(s) in queue, 2 in progress, 1 in error, 35.2 GB saved."),
  and the queue, files in progress and errors as numbers.

### Scene ideas

- At 6 pm, **Pause Tdarr** to keep the CPU and the disks for the evening
  movie; at 1 am, **Resume Tdarr**.
- **Tdarr file failed** → send a Telegram message with the file name and the
  library.
- **Tdarr queue emptied** → a notification: "Tdarr is done, space saved: …".
- After a download imported by Sonarr or Radarr, **Scan a Tdarr library** so
  the new episode is processed right away.

## Troubleshooting

- **"Tdarr does not answer"**: check the address and the port (`8265`, the port
  of the web interface, not the `8266` of the nodes), and that Gladys reaches
  the server (firewall, Docker network).
- **"API key refused or missing"**: the authentication of Tdarr is on. Create a
  key in **Tools** → **API keys** and paste it in the configuration.
- **"No Tdarr server at this address"**: another application answers on this
  port.
- **A node shows twice**: Tdarr knows a node by its name. Renaming a node in
  its configuration (`nodeName`) creates a new device in Gladys; delete the old
  one.
- **The switch does nothing**: check **Allow pause and resume** in the
  configuration.
- More details in the logs of the integration (**Integrations** → Tdarr →
  logs), at the `debug` level if needed.

## Limits

- One Tdarr server per integration.
- The figures are read every refresh interval: a short transcode may finish
  between two readings, and **Tdarr file failed** announces at most ten files
  per reading. Errors older than an hour are not announced.
- **Waiting for review** counts the files Tdarr keeps in the Staged tab until
  you accept them (when "Auto accept successful transcodes" is off). Tdarr
  still counts them in the **To process** of their library.
- The integration does not change the transcode settings, the plugins or the
  flows of Tdarr, and deletes nothing.
- Not affiliated with Tdarr or its authors.
