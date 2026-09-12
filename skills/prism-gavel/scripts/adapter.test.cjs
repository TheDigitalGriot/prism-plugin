'use strict';
/**
 * GMCL-B1 · Gavel adapter acceptance (automated).
 * Proves: (1) render() delegation is BYTE-IDENTICAL to Gavel's old wrapInFrame on the REAL
 * frame.html — zero regression; (2) a card-stack fragment with [data-verb] frames + carries
 * the channel meta; (3) the adapter registers on the broker + handshake advertises it;
 * (4) verb buttons drive() through the shared hook across rungs.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { register, renderCardStack, driveVerb, makeInjectChannelMeta, VERBS } = require('./adapter.cjs');
const { createRegistry } = require('../../../packages/griot-widget/registry.cjs');

let n = 0;
const ok = (m) => { n++; console.log('  ok ·', m); };

// The real frame + the old, pre-adapter wrapInFrame (verbatim from server.cjs history).
const frameHtml = fs.readFileSync(path.join(__dirname, 'frame.html'), 'utf-8');
const PORT = '52342', SID = 's1';
const injectOld = makeInjectChannelMeta(PORT, SID); // same injector the adapter uses
const wrapOld = (content) => injectOld(frameHtml.replace('<!-- CONTENT -->', content));

// (1) byte-identical equivalence — the zero-regression proof, on the real 303KB frame.
const samples = [
  '<p>hi</p>',
  '',
  '<div class="gv-card" data-item="GMCL-B1"><button data-verb="verify">Verify</button></div>',
  '<section>x &amp; y</section>',
];
for (const s of samples) {
  assert.strictEqual(
    renderCardStack(s, { template: frameHtml, channelPort: PORT, sessionId: SID }),
    wrapOld(s),
    'equivalence broke on sample: ' + JSON.stringify(s.slice(0, 40))
  );
}
ok('renderCardStack is byte-identical to the old wrapInFrame on the real frame.html (4 samples)');

// full-document passthrough: a full <html> screen is not double-wrapped (only meta injected).
const fullDoc = '<!DOCTYPE html><html><head></head><body>z</body></html>';
assert.strictEqual(
  renderCardStack(fullDoc, { template: frameHtml, channelPort: PORT, sessionId: SID }),
  injectOld(fullDoc)
);
ok('full-document screen passes through framed (meta only, not double-wrapped)');

// (2) a card-stack fragment frames + carries the channel meta + the verb button survives.
const carded = renderCardStack(
  '<div class="gv-card" data-item="GMCL-B1"><button data-verb="commit">Commit</button></div>',
  { template: frameHtml, channelPort: PORT, sessionId: SID }
);
assert(carded.includes('data-verb="commit"'));
assert(carded.includes('brainstorm-channel-port') && carded.includes('content="52342"'));
ok('card-stack fragment frames with a [data-verb] CTA + the :52342 channel meta intact');

// (3) broker registration + handshake advertises gavel.
const reg = createRegistry();
register(reg);
const hs = reg.handshake('cowork');
assert(hs.tools.includes('gavel')); ok('handshake(cowork) advertises the registered gavel adapter');
const a = reg.get('gavel');
assert(a && typeof a.render === 'function' && typeof a.drive === 'function');
assert.deepStrictEqual(a.verbs, VERBS); ok('broker.get(gavel) exposes render + drive + the four verbs');

// (4) verb buttons drive() through the shared hook, across the ladder.
let sent = null;
global.sendPrompt = (t) => { sent = t; };
assert.strictEqual(driveVerb('verify', 'GMCL-B1', { sendPrompt: true }), 'cowork');
assert.strictEqual(sent, 'Gavel: verify — GMCL-B1'); ok('verb -> cowork rung calls sendPrompt with the human text');
delete global.sendPrompt;
global.fetch = () => Promise.resolve({ ok: true }); // hermetic: no real socket in the unit env
assert.strictEqual(driveVerb('scan', 'x', { meta: { channelPort: '52342' } }), 'channel');
delete global.fetch;
ok('verb -> :52342 channel rung when only a channel port is present');
assert.strictEqual(driveVerb('open', 'x', {}), 'clipboard');
ok('verb -> clipboard rung when no surface is live (never a dead end)');

console.log(`\nALL ${n} ASSERTIONS PASSED`);
