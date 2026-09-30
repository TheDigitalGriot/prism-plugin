const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ========== WebSocket Protocol (RFC 6455) ==========

const OPCODES = { TEXT: 0x01, CLOSE: 0x08, PING: 0x09, PONG: 0x0A };
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function computeAcceptKey(clientKey) {
  return crypto.createHash('sha1').update(clientKey + WS_MAGIC).digest('base64');
}

function encodeFrame(opcode, payload) {
  const fin = 0x80;
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = fin | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = fin | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = fin | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}

function decodeFrame(buffer) {
  if (buffer.length < 2) return null;

  const secondByte = buffer[1];
  const opcode = buffer[0] & 0x0F;
  const masked = (secondByte & 0x80) !== 0;
  let payloadLen = secondByte & 0x7F;
  let offset = 2;

  if (!masked) throw new Error('Client frames must be masked');

  if (payloadLen === 126) {
    if (buffer.length < 4) return null;
    payloadLen = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buffer.length < 10) return null;
    payloadLen = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  const maskOffset = offset;
  const dataOffset = offset + 4;
  const totalLen = dataOffset + payloadLen;
  if (buffer.length < totalLen) return null;

  const mask = buffer.slice(maskOffset, dataOffset);
  const data = Buffer.alloc(payloadLen);
  for (let i = 0; i < payloadLen; i++) {
    data[i] = buffer[dataOffset + i] ^ mask[i % 4];
  }

  return { opcode, payload: data, bytesConsumed: totalLen };
}

// ========== Configuration ==========

const PORT = process.env.BRAINSTORM_PORT || (49152 + Math.floor(Math.random() * 16383));
const HOST = process.env.BRAINSTORM_HOST || '127.0.0.1';
const URL_HOST = process.env.BRAINSTORM_URL_HOST || (HOST === '127.0.0.1' ? 'localhost' : HOST);
const SESSION_DIR = process.env.BRAINSTORM_DIR || '/tmp/prism-brainstorm';
const CONTENT_DIR = path.join(SESSION_DIR, 'content');
const STATE_DIR = path.join(SESSION_DIR, 'state');
const CHANNEL_PORT = process.env.BRAINSTORM_CHANNEL_PORT || '52342';
const SESSION_ID = path.basename(SESSION_DIR);

// viz-companion-fusion Step 3 — the node-graph state channel, alongside decisions.json.
// Populated either by griot-viz-engine's `emit-screen.mjs --companion` (which seeds it the
// moment it writes a screen) or by the agent directly (references/workgraph-state.md), same
// read-merge-write discipline as decisions.json. Never required to exist: the GET route and
// the default below both degrade to a genesis-only seed rather than an empty structure, per
// Decision 7 — an empty LAYERS/WORKGRAPH/TIMELINE at session start is a defect, not a neutral
// initial state.
const WORKGRAPH_FILE = path.join(STATE_DIR, 'workgraph.json');
const DEFAULT_WORKGRAPH = {
  nodes: [{
    id: 'genesis', q: 'genesis', label: 'Session opened',
    summary: 'No workgraph content yet — first ideation step not seeded',
    state: 'open', layer: null,
  }],
  edges: [],
};
let ownerPid = process.env.BRAINSTORM_OWNER_PID ? Number(process.env.BRAINSTORM_OWNER_PID) : null;

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml'
};

// ========== Templates and Constants ==========

const WAITING_PAGE = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Prism Brainstorm Companion</title>
<style>body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
h1 { color: #333; } p { color: #666; }</style>
</head>
<body><h1>Prism Brainstorm Companion</h1>
<p>Waiting for the agent to push a screen...</p></body></html>`;

const frameTemplate = fs.readFileSync(path.join(__dirname, 'frame-template.html'), 'utf-8');
const helperScript = fs.readFileSync(path.join(__dirname, 'helper.js'), 'utf-8');
const helperInjection = '<script>\n' + helperScript + '\n</script>';

// ========== Helper Functions ==========

function isFullDocument(html) {
  const trimmed = html.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

const channelMetaTags =
  '<meta name="brainstorm-channel-port" content="' + CHANNEL_PORT + '">\n' +
  '<meta name="brainstorm-session-id" content="' + SESSION_ID + '">';

function injectChannelMeta(html) {
  if (html.includes('</head>')) {
    return html.replace('</head>', channelMetaTags + '\n</head>');
  }
  return channelMetaTags + '\n' + html;
}

// GMCL-C5 · Brainstorm now consumes the shared griot-widget render() primitive. injectMeta preserves
// Brainstorm's exact channel meta, so output is byte-identical to the pre-extraction wrapInFrame
// (proven by packages/griot-widget/test.cjs + the on-device real-template equivalence check).
const { render: griotRender } = require('../../../packages/griot-widget/render.cjs');

function wrapInFrame(content) {
  return griotRender(content, { template: frameTemplate, injectMeta: injectChannelMeta });
}

function getNewestScreen() {
  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => {
      const fp = path.join(CONTENT_DIR, f);
      return { path: fp, mtime: fs.statSync(fp).mtime.getTime() };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? files[0].path : null;
}

// POST /api/chat — the companion agent.
// Mirrors the Cinopsis claude_sub path: shell out to the local `claude` CLI so
// this runs on the Max subscription with no API key. The session's decisions +
// parked items are passed as context so the agent answers about THIS brainstorm
// rather than in a vacuum. Failures return a message; they never crash a screen.
function handleChat(req, res) {
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on('end', () => {
    let msg = '';
    try { msg = String(JSON.parse(body || '{}').message || '').trim(); } catch (e) { msg = ''; }
    if (!msg) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'message required' }));
    }

    let ctx = 'You are the companion agent inside a Prism brainstorm session. '
            + 'Answer briefly and concretely about this session.\n';
    try {
      const df = path.join(STATE_DIR, 'decisions.json');
      if (fs.existsSync(df)) {
        const s = JSON.parse(fs.readFileSync(df, 'utf-8'));
        const d = (s.decisions || []).map((x) => '- ' + x.q + ': ' + x.label + ' -> ' + (x.choice || '')).join('\n');
        const p = (s.parked || []).map((x) => '- (from ' + x.fromQ + ') ' + x.label).join('\n');
        ctx += '\nDECISIONS SO FAR:\n' + (d || '(none)') + '\n\nPARKED:\n' + (p || '(none)') + '\n';
      }
    } catch (e) { /* context is best-effort */ }

    const { spawn } = require('child_process');
    let out = '', err = '', done = false;
    const finish = (code) => {
      if (done) return; done = true;
      const text = out.trim() || (err.trim()
        ? 'Agent error: ' + err.trim().split('\n').slice(-2).join(' ')
        : 'No response (claude CLI exited ' + code + ').');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply: text }));
    };

    // The prompt goes over STDIN, never as a shell argument. On Windows,
    // shell:true joins argv into a command string and a multi-line prompt with
    // quotes gets shredded — the CLI then sees an empty message. Same lesson as
    // the headless launcher's "quote-free instructions file" rule.
    let child;
    try {
      child = spawn('claude', ['-p'],
        { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) { return finish(-1); }
    try {
      child.stdin.write(ctx + '\nQUESTION: ' + msg + '\n');
      child.stdin.end();
    } catch (e) { /* close handler still reports */ }

    const timer = setTimeout(() => { try { child.kill(); } catch (e) {} finish(-2); }, 120000);
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });
    child.on('error', () => { clearTimeout(timer); finish(-1); });
    child.on('close', (code) => { clearTimeout(timer); finish(code); });
  });
}

// POST /api/close — the gavel ceremony (additive, gavel-close-CONTEXT.md 2026-09-23).
// Sets a workgraph node's terminal state, stamps resolvedAt, and writes the closure
// outward to closed-outbox.ndjson so a later, separate promote step can lift it into a
// branch-capture workgraph as a COPY, not a translation. Locked decisions (see contract):
//  1. state is one of done|superseded|parked — the four-value enum is not extended.
//  2. resolvedAt is stamped server-side (ISO-8601); resolution is never invented.
//  3. a superseded close without supersededBy is REJECTED with a named error.
//  6. this route writes only inside STATE_DIR (== SESSION_DIR/state) — never outside
//     SESSION_DIR, never into another repo.
function closeError(res, code, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: code, message: message }));
}

// Mirrors helper.js:216-222's dirOf() exactly (client-side JS is not reachable from this
// Node process, so the same rule is reimplemented rather than shared) — same fields,
// same priority: destination > source > maps>1 > local.
function manyVal(v) { return Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []); }
function dirOfNode(o) {
  if (!o) return 'local';
  return manyVal(o.destination).length ? 'outbound'
       : manyVal(o.source).length      ? 'inbound'
       : (o.maps > 1)                  ? 'adjacent'
       : 'local';
}

function writeJsonAtomic(filePath, obj) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1));
  fs.renameSync(tmp, filePath);
}

const TERMINAL_STATES = ['done', 'superseded', 'parked'];

function handleClose(req, res) {
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on('end', () => {
    let payload;
    try { payload = JSON.parse(body || '{}'); } catch (e) {
      return closeError(res, 'BAD_JSON', 400, 'Request body is not valid JSON.');
    }
    const id = typeof payload.id === 'string' ? payload.id.trim() : '';
    const state = typeof payload.state === 'string' ? payload.state.trim() : '';
    const resolution = typeof payload.resolution === 'string' ? payload.resolution.trim() : '';
    const kind = typeof payload.kind === 'string' ? payload.kind.trim() : '';
    const lane = typeof payload.lane === 'string' ? payload.lane.trim() : '';
    const supersededBy = typeof payload.supersededBy === 'string' ? payload.supersededBy.trim() : '';

    if (!id) return closeError(res, 'MISSING_ID', 400, 'id is required.');
    if (TERMINAL_STATES.indexOf(state) === -1) {
      return closeError(res, 'INVALID_STATE', 400, 'state must be one of ' + TERMINAL_STATES.join(', ') + '.');
    }
    if (!resolution) return closeError(res, 'MISSING_RESOLUTION', 400, 'resolution is required — never invented.');
    if (!kind) return closeError(res, 'MISSING_KIND', 400, 'kind is required — the close dialog must collect it.');
    if (!lane) return closeError(res, 'MISSING_LANE', 400, 'lane is required — the close dialog must collect it.');
    if (state === 'superseded' && !supersededBy) {
      return closeError(res, 'MISSING_SUPERSEDED_BY', 400, 'a superseded close requires supersededBy (a node id).');
    }
    // Guards hubStateOf()'s own normalizer (helper.js:2015-2019): `if (n.supersededBy) return
    // 'superseded'` runs regardless of the node's `state` field, so a supersededBy stamped on a
    // done/parked close would silently repaint as superseded in the UI. Reject rather than allow
    // a node whose two lifecycle fields disagree about whether it was superseded.
    if (state !== 'superseded' && supersededBy) {
      return closeError(res, 'SUPERSEDED_BY_NOT_ALLOWED', 400, 'supersededBy is only valid when state is superseded.');
    }

    let wg;
    try {
      const raw = fs.existsSync(WORKGRAPH_FILE) ? fs.readFileSync(WORKGRAPH_FILE, 'utf-8') : JSON.stringify(DEFAULT_WORKGRAPH);
      wg = JSON.parse(raw);
    } catch (e) {
      return closeError(res, 'WORKGRAPH_UNREADABLE', 500, 'workgraph.json could not be read/parsed: ' + e.message);
    }
    if (!Array.isArray(wg.nodes)) wg.nodes = [];
    if (!Array.isArray(wg.edges)) wg.edges = [];
    const node = wg.nodes.find((n) => n && n.id === id);
    if (!node) return closeError(res, 'NODE_NOT_FOUND', 404, 'No workgraph node with id ' + id + '.');

    const resolvedAt = new Date().toISOString();
    node.state = state;
    node.resolvedAt = resolvedAt;
    node.resolution = resolution;
    node.kind = kind;
    node.lane = lane;
    if (state === 'superseded') node.supersededBy = supersededBy;
    else delete node.supersededBy;

    try {
      writeJsonAtomic(WORKGRAPH_FILE, wg);
    } catch (e) {
      return closeError(res, 'WRITE_FAILED', 500, 'Could not write workgraph.json: ' + e.message);
    }

    const edges = wg.edges
      .filter((e) => e && (e.fromNode === id || e.toNode === id))
      .map((e) => ({ fromNode: e.fromNode, toNode: e.toNode }));
    // stateDetail is not defined by the contract beyond its name in the outbox field list
    // (gavel-close-CONTEXT.md decision 5) — composed here as a short human-readable summary
    // of the closure (state + resolution + the supersedes target when present), since no
    // upstream branch-capture-workgraph schema was in scope to read for this run.
    const stateDetail = state + ': ' + resolution + (state === 'superseded' ? ' -> ' + supersededBy : '');
    const outboxRecord = {
      id: node.id,
      title: node.label || node.q || node.id,
      kind: kind,
      lane: lane,
      state: state,
      stateDetail: stateDetail,
      direction: dirOfNode(node),
      resolvedAt: resolvedAt,
      resolution: resolution,
      supersededBy: state === 'superseded' ? supersededBy : null,
      sourceSession: SESSION_ID,
      layer: node.layer != null ? node.layer : null,
      edges: edges,
    };

    try {
      const outboxFile = path.join(STATE_DIR, 'closed-outbox.ndjson');
      if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
      fs.appendFileSync(outboxFile, JSON.stringify(outboxRecord) + '\n');
    } catch (e) {
      // The workgraph write already succeeded and is the source of truth; the outbox is the
      // seam to the rest of the ecosystem, not the record of closure itself. Report the failure
      // rather than hide it, but do not roll back a close that already landed.
      broadcast({ type: 'workgraph-update', payload: wg });
      return closeError(res, 'OUTBOX_WRITE_FAILED', 500, 'Node closed and workgraph.json written, but the outbox append failed: ' + e.message);
    }

    touchActivity();
    broadcast({ type: 'workgraph-update', payload: wg });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, node: node, outboxRecord: outboxRecord }));
  });
}

// ========== HTTP Request Handler ==========

function handleRequest(req, res) {
  touchActivity();
  if (req.method === 'POST' && req.url === '/api/chat') {
    return handleChat(req, res);
  }
  if (req.method === 'POST' && req.url === '/api/close') {
    return handleClose(req, res);
  }
  if (req.method === 'GET' && req.url === '/') {
    const screenFile = getNewestScreen();
    let html = screenFile
      ? (raw => isFullDocument(raw) ? injectChannelMeta(raw) : wrapInFrame(raw))(fs.readFileSync(screenFile, 'utf-8'))
      : injectChannelMeta(WAITING_PAGE);

    if (html.includes('</body>')) {
      html = html.replace('</body>', helperInjection + '\n</body>');
    } else {
      html += helperInjection;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else if (req.method === 'GET' && req.url === '/state/decisions.json') {
    const decisionsFile = path.join(STATE_DIR, 'decisions.json');
    const body = fs.existsSync(decisionsFile)
      ? fs.readFileSync(decisionsFile, 'utf-8')
      : '{"decisions":[],"parked":[]}';
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(body);
  } else if (req.method === 'GET' && req.url === '/state/workgraph.json') {
    // Mirrors the decisions.json route immediately above — same shape, same fallback
    // discipline — except the fallback is a genesis seed, never an empty object (Decision 7).
    const body = fs.existsSync(WORKGRAPH_FILE)
      ? fs.readFileSync(WORKGRAPH_FILE, 'utf-8')
      : JSON.stringify(DEFAULT_WORKGRAPH);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(body);
  } else if (req.method === 'GET' && req.url.startsWith('/files/')) {
    const fileName = req.url.slice(7);
    const filePath = path.join(CONTENT_DIR, path.basename(fileName));
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

// ========== WebSocket Connection Handling ==========

const clients = new Set();

function handleUpgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }

  const accept = computeAcceptKey(key);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );

  let buffer = Buffer.alloc(0);
  clients.add(socket);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length > 0) {
      let result;
      try {
        result = decodeFrame(buffer);
      } catch (e) {
        socket.end(encodeFrame(OPCODES.CLOSE, Buffer.alloc(0)));
        clients.delete(socket);
        return;
      }
      if (!result) break;
      buffer = buffer.slice(result.bytesConsumed);

      switch (result.opcode) {
        case OPCODES.TEXT:
          handleMessage(result.payload.toString());
          break;
        case OPCODES.CLOSE:
          socket.end(encodeFrame(OPCODES.CLOSE, Buffer.alloc(0)));
          clients.delete(socket);
          return;
        case OPCODES.PING:
          socket.write(encodeFrame(OPCODES.PONG, result.payload));
          break;
        case OPCODES.PONG:
          break;
        default: {
          const closeBuf = Buffer.alloc(2);
          closeBuf.writeUInt16BE(1003);
          socket.end(encodeFrame(OPCODES.CLOSE, closeBuf));
          clients.delete(socket);
          return;
        }
      }
    }
  });

  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
}

function handleMessage(text) {
  let event;
  try {
    event = JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse WebSocket message:', e.message);
    return;
  }
  touchActivity();
  console.log(JSON.stringify({ source: 'user-event', ...event }));
  if (event.choice) {
    const eventsFile = path.join(STATE_DIR, 'events');
    fs.appendFileSync(eventsFile, JSON.stringify(event) + '\n');
  }
}

function broadcast(msg) {
  const frame = encodeFrame(OPCODES.TEXT, Buffer.from(JSON.stringify(msg)));
  for (const socket of clients) {
    try { socket.write(frame); } catch (e) { clients.delete(socket); }
  }
}

// ========== Activity Tracking ==========

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let lastActivity = Date.now();

function touchActivity() {
  lastActivity = Date.now();
}

// ========== File Watching ==========

const debounceTimers = new Map();

// ========== Server Startup ==========

function startServer() {
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

  // Track known files to distinguish new screens from updates.
  // macOS fs.watch reports 'rename' for both new files and overwrites,
  // so we can't rely on eventType alone.
  const knownFiles = new Set(
    fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.html'))
  );

  const server = http.createServer(handleRequest);
  server.on('upgrade', handleUpgrade);

  // Watch the decisions.json state file (Phase C drawer). Claude writes this
  // file directly via the Write tool whenever a decision is confirmed or
  // a question is parked. Broadcasts a state-update so the drawer re-renders.
  const decisionsFile = path.join(STATE_DIR, 'decisions.json');
  let decisionsTimer = null;
  function broadcastDecisions() {
    try {
      const body = fs.existsSync(decisionsFile)
        ? fs.readFileSync(decisionsFile, 'utf-8')
        : '{"decisions":[],"parked":[]}';
      const payload = JSON.parse(body);
      broadcast({ type: 'state-update', payload });
    } catch (err) {
      console.error('decisions.json parse error:', err.message);
    }
  }
  // Step 3 (companion half) — the second watched file. Root cause was
  // `if (filename !== 'decisions.json') return`: a hard filter that made a second state file
  // structurally unreachable no matter what emitted it. This still filters (unknown filenames
  // in STATE_DIR — server.pid, server.log, events — are correctly ignored) but no longer to a
  // single name.
  let workgraphTimer = null;
  function broadcastWorkgraph() {
    try {
      const body = fs.existsSync(WORKGRAPH_FILE)
        ? fs.readFileSync(WORKGRAPH_FILE, 'utf-8')
        : JSON.stringify(DEFAULT_WORKGRAPH);
      const payload = JSON.parse(body);
      broadcast({ type: 'workgraph-update', payload });
    } catch (err) {
      console.error('workgraph.json parse error:', err.message);
    }
  }
  const stateWatcher = fs.watch(STATE_DIR, (eventType, filename) => {
    if (filename === 'decisions.json') {
      if (decisionsTimer) clearTimeout(decisionsTimer);
      decisionsTimer = setTimeout(() => {
        decisionsTimer = null;
        touchActivity();
        broadcastDecisions();
      }, 100);
    } else if (filename === 'workgraph.json') {
      if (workgraphTimer) clearTimeout(workgraphTimer);
      workgraphTimer = setTimeout(() => {
        workgraphTimer = null;
        touchActivity();
        broadcastWorkgraph();
      }, 100);
    }
  });
  stateWatcher.on('error', (err) => console.error('state fs.watch error:', err.message));

  const watcher = fs.watch(CONTENT_DIR, (eventType, filename) => {
    if (!filename || !filename.endsWith('.html')) return;

    if (debounceTimers.has(filename)) clearTimeout(debounceTimers.get(filename));
    debounceTimers.set(filename, setTimeout(() => {
      debounceTimers.delete(filename);
      const filePath = path.join(CONTENT_DIR, filename);

      if (!fs.existsSync(filePath)) return; // file was deleted
      touchActivity();

      if (!knownFiles.has(filename)) {
        knownFiles.add(filename);
        const eventsFile = path.join(STATE_DIR, 'events');
        if (fs.existsSync(eventsFile)) fs.unlinkSync(eventsFile);
        console.log(JSON.stringify({ type: 'screen-added', file: filePath }));
      } else {
        console.log(JSON.stringify({ type: 'screen-updated', file: filePath }));
      }

      broadcast({ type: 'reload' });
    }, 100));
  });
  watcher.on('error', (err) => console.error('fs.watch error:', err.message));

  function shutdown(reason) {
    console.log(JSON.stringify({ type: 'server-stopped', reason }));
    const infoFile = path.join(STATE_DIR, 'server-info');
    if (fs.existsSync(infoFile)) fs.unlinkSync(infoFile);
    fs.writeFileSync(
      path.join(STATE_DIR, 'server-stopped'),
      JSON.stringify({ reason, timestamp: Date.now() }) + '\n'
    );
    watcher.close();
    clearInterval(lifecycleCheck);
    server.close(() => process.exit(0));
  }

  function ownerAlive() {
    if (!ownerPid) return true;
    try { process.kill(ownerPid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
  }

  // Check every 60s: exit if owner process died or idle for 30 minutes
  const lifecycleCheck = setInterval(() => {
    if (!ownerAlive()) shutdown('owner process exited');
    else if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) shutdown('idle timeout');
  }, 60 * 1000);
  lifecycleCheck.unref();

  // Validate owner PID at startup. If it's already dead, the PID resolution
  // was wrong (common on WSL, Tailscale SSH, and cross-user scenarios).
  // Disable monitoring and rely on the idle timeout instead.
  if (ownerPid) {
    try { process.kill(ownerPid, 0); }
    catch (e) {
      if (e.code !== 'EPERM') {
        console.log(JSON.stringify({ type: 'owner-pid-invalid', pid: ownerPid, reason: 'dead at startup' }));
        ownerPid = null;
      }
    }
  }

  server.listen(PORT, HOST, () => {
    const url = 'http://' + URL_HOST + ':' + PORT;
    const info = JSON.stringify({
      type: 'server-started', port: Number(PORT), host: HOST,
      url_host: URL_HOST, url: url,
      screen_dir: CONTENT_DIR, state_dir: STATE_DIR
    });
    console.log(info);
    fs.writeFileSync(path.join(STATE_DIR, 'server-info'), info + '\n');
    // Trigger file for the prism-vscode extension's BrainstormViewerWatcher.
    // The watcher reads this file and opens the URL in Simple Browser.
    fs.writeFileSync(path.join(STATE_DIR, 'open-viewer'), url);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { computeAcceptKey, encodeFrame, decodeFrame, OPCODES };
