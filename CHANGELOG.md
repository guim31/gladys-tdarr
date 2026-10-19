# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-10-19

### Added

- Tdarr in Gladys: one device for the server (transcode and health check
  queues, files in progress, waiting for review, transcoded, in error, space
  saved, nodes online, version, a switch that pauses every node), one per node
  (online, active workers, pause switch) and one per library (files, to
  process, in error, space saved).
- Scene triggers: the queue is emptied, a file failed (transcode or health
  check), a node went offline.
- Scene actions: pause Tdarr, resume Tdarr (one node or every node), scan a
  library, read the summary sentence.
- A dashboard widget: queue, files in progress and in error, space saved, one
  row per node, and a button to pause or resume every node.
- Configuration: address, API key (Tdarr 2.24+ authentication), commands
  allowed or not (read only), refresh interval, language of the feature names.
  Documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-tdarr/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-tdarr/releases/tag/v1.0.0
