// -----------------------------------------------------------------------------
// Scene action handlers (manifest `scene_actions`, Gladys 5.1+).
//
// Pause or resume the processing (one node, or every node), look for new
// files in a library (after a Sonarr or Radarr import, for example), and read
// the summary sentence (for a "say" or a notification). Nothing destructive:
// a paused node finishes nothing new, it loses nothing.
// -----------------------------------------------------------------------------

export const SCENE_ACTIONS = {
  async pause_processing(hub, { fields = {} }) {
    await hub.setPaused(fields.device || null, true);
    return {};
  },

  async resume_processing(hub, { fields = {} }) {
    await hub.setPaused(fields.device || null, false);
    return {};
  },

  async scan_library(hub, { fields = {} }) {
    const libraries = await hub.scan(fields.device || null);
    return { libraries };
  },

  async read_summary(hub) {
    hub.ensureServer();
    // Read now: the sentence says what is true at the time of the scene.
    await hub.refresh();
    const totals = hub.totals();
    return {
      summary: hub.summary(),
      queue: totals.queue,
      in_progress: totals.inProgress,
      errors: totals.errors,
    };
  },
};
