'use strict';
/**
 * prism-gavel · griot-widget adapter  (GMCL-B1)
 *
 * Gavel is a descendant of Brainstorm — same mold, same wake channel, its own port. This
 * adapter binds Gavel onto the SHARED griot-widget spine so the decision card-stack frames
 * through render() and its verb buttons drive() through the shared response hook, registered
 * on the broker. Node-requireable; safe to load with no server running (pure functions).
 *
 * It does NOT replace server.cjs — server.cjs re-points wrapInFrame() to render() directly
 * (byte-identical, the C5 move). This module is the broker-facing surface: register(),
 * a card-stack renderer that any caller can use, and the verb→drive() binding.
 */
const { render } = require('../../../packages/griot-widget/render.cjs');
const { drive } = require('../../../packages/griot-widget/drive.cjs');

// Gavel keeps brainstorm's channel-meta contract (the port CONTRACT helper.js discovery
// depends on — meta names stay `brainstorm-*`, do NOT rename). Mirrored here so the adapter
// can frame a fragment identically to server.cjs wrapInFrame without importing the server.
function makeInjectChannelMeta(channelPort, sessionId) {
  const tags =
    '<meta name="brainstorm-channel-port" content="' + (channelPort || '52342') + '">\n' +
    '<meta name="brainstorm-session-id" content="' + (sessionId || 'gavel') + '">';
  return function (html) {
    return html.includes('</head>') ? html.replace('</head>', tags + '\n</head>') : tags + '\n' + html;
  };
}

// renderCardStack(fragment, opts) -> framed HTML.
// opts: { template (frame.html string), channelPort?, sessionId?, ember?, fidelity? }
// Delegates to the shared render() with Gavel's exact meta injector — so a card-stack
// fragment comes out framed identically to how the live server frames it.
function renderCardStack(fragment, opts) {
  opts = opts || {};
  return render(fragment, {
    template: opts.template,
    injectMeta: makeInjectChannelMeta(opts.channelPort, opts.sessionId),
    ember: opts.ember,
    fidelity: opts.fidelity,
  });
}

// Gavel's four verbs. These are the ONLY wake events (open/scan/verify/commit); use/role/
// stage/notes stay local cockpit mutations and never drive. (Matches helper.js S3c.)
const VERBS = ['open', 'scan', 'verify', 'commit'];

// driveVerb(verb, itemId, env) -> the rung that fired.
// Builds a payload that carries BOTH a human `text` (for the cowork sendPrompt rung) AND
// the structured verb/item (for the :52342 channel rung, which POSTs the whole object).
function driveVerb(verb, itemId, env) {
  const payload = {
    verb: verb,
    item: itemId,
    source: 'gavel',
    text: 'Gavel: ' + verb + (itemId ? ' — ' + itemId : ''),
  };
  return drive(payload, env);
}

// register(registry) -> the registry, with 'gavel' declared ready + its bindings exposed.
// The broker handshake() then advertises gavel among the ready tools on entry.
function register(registry) {
  return registry.register(
    'gavel',
    { name: 'gavel', render: renderCardStack, drive: driveVerb, verbs: VERBS },
    { readiness: 'ready' }
  );
}

module.exports = { register, renderCardStack, driveVerb, makeInjectChannelMeta, VERBS };
