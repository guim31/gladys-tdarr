// -----------------------------------------------------------------------------
// The `overview` widget: content valid for the core (budget, vocabulary), in
// every language, and its pause / resume button.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { CONFIG, FakeTdarr, createWorld } from './helpers/world.js';

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const get = async (w, language = 'en') => {
  const ack = await w.fake.widgetGet('overview', { settings: {}, language });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(validateWidgetContent(ack.data.content), [], JSON.stringify(ack.data));
  return ack.data.content.components;
};

test('the widget shows the queue, the nodes and a pause button, in every language', async (t) => {
  const tdarr = new FakeTdarr();
  tdarr.addNode('GPU Node');
  tdarr.setWorkers('InternalNode', 2);
  tdarr.setQueues(5, 1);
  const w = await world(t, { tdarr });
  for (const language of ['en', 'fr', 'de', 'es']) {
    const components = await get(w, language);
    assert.ok(components.length <= 8);
    assert.ok(components.filter((c) => c.type === 'text').length <= 2);
    const values = components.filter((c) => c.type === 'value').map((c) => c.value);
    assert.deepEqual(values, [6, 2, 2, 0]);
    const status = components.find((c) => c.type === 'status');
    assert.equal(status.items.length, 2);
    assert.equal(components.at(-1).action.key, 'pause_all');
  }
});

test('the button pauses every node, then offers to resume', async (t) => {
  const w = await world(t);
  const ack = await w.fake.widgetAction('overview', 'pause_all', {}, { settings: {} });
  assert.equal(ack.success, true, ack.error);
  assert.match(ack.data.message.en, /paused/);
  assert.equal(w.tdarr.settings.pauseAllNodes, true);
  const components = await get(w);
  assert.equal(components.at(-1).action.key, 'resume_all');
  assert.equal(components.find((c) => c.type === 'status').items[0].label, 'Tdarr');
  await w.fake.widgetAction('overview', 'resume_all', {}, { settings: {} });
  assert.equal(w.tdarr.settings.pauseAllNodes, false);
});

test('commands off: no button', async (t) => {
  const w = await world(t, { config: { ...CONFIG, allow_control: false } });
  const components = await get(w);
  assert.ok(!components.some((c) => c.type === 'button'));
});

test('no server, or a server down: a message instead of figures', async (t) => {
  const empty = await world(t, { config: {} });
  assert.match((await get(empty))[0].text, /address of your Tdarr server/);
  const w = await world(t);
  w.tdarr.online = false;
  await w.hub.pollAll();
  const components = await get(w, 'fr');
  assert.equal(components[0].items[0].value, 'Hors ligne');
});
