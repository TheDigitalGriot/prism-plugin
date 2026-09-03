// prism-gavel popout server — a copy of prism-brainstorm/scripts/server.cjs.
//
// Functionally identical to brainstorm's server: HTTP + hand-rolled WebSocket (RFC 6455)
// on a random high port (49152 + random(16383)), fed by GAVEL_* env from start-server.sh.
// The ONLY shared thing with brainstorm is the wake channel on :52342 — this server gets
// its own random port, so the two popouts never collide.
//
// Gavel deltas vs. brainstorm's server.cjs:
//   • Env prefix GAVEL_* (own session dir under .prism/local/gavel/).
//   • Serves frame.html (the lifted cockpit) as the default screen instead of a waiting page.
//   • WS handler logs verb events (event.verb) as well as brainstorm-style choice events.
//   • Channel meta tag names stay `brainstorm-channel-port` / `brainstorm-session-id` — that
//     is the port CONTRACT the shared channel + helper.js discovery depend on (do not rename).

const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { render: griotRender } = require('../../../packages/griot-widget/render.cjs');

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

const PORT = process.env.GAVEL_PORT || (49152 + Math.floor(Math.random() * 16383));
const HOST = process.env.GAVEL_HOST || '127.0.0.1';
const URL_HOST = process.env.GAVEL_URL_HOST || (HOST === '127.0.0.1' ? 'localhost' : HOST);
const SESSION_DIR = process.env.GAVEL_DIR || '/tmp/prism-gavel';
const CONTENT_DIR = path.join(SESSION_DIR, 'content');
const STATE_DIR = path.join(SESSION_DIR, 'state');
const CHANNEL_PORT = process.env.GAVEL_CHANNEL_PORT || process.env.BRAINSTORM_CHANNEL_PORT || '52342';
const SESSION_ID = path.basename(SESSION_DIR);
let ownerPid = process.env.GAVEL_OWNER_PID ? Number(process.env.GAVEL_OWNER_PID) : null;

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml'
};

// ========== Templates and Constants ==========

// Fallback only — shown if frame.html is somehow missing.
const WAITING_PAGE = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Prism Gavel Cockpit</title>
<style>body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
h1 { color: #333; } p { color: #666; }</style>
</head>
<body><h1>Prism Gavel Cockpit</h1>
<p>frame.html not found — the cockpit could not be served.</p></body></html>`;

// The cockpit. Gavel serves this directly as the default screen (unlike brainstorm, which
// wraps Claude-pushed partial screens). If S4 pushes a live-state screen into CONTENT_DIR,
// getNewestScreen() takes precedence and this is the fallback default.
const frameHtml = fs.readFileSync(path.join(__dirname, 'frame.html'), 'utf-8');
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

function wrapInFrame(content) {
  // GMCL-B1: delegate to the shared griot-widget render() primitive. Byte-identical to the
  // old inline wrap (frame.html has no <!-- CONTENT --> placeholder -> the slot-replace is a
  // no-op and injectChannelMeta runs exactly as before), proven by adapter.test.cjs.
  return griotRender(content, { template: frameHtml, injectMeta: injectChannelMeta });
}

function getNewestScreen() {
  if (!fs.existsSync(CONTENT_DIR)) return null;
  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => {
      const fp = path.join(CONTENT_DIR, f);
      return { path: fp, mtime: fs.statSync(fp).mtime.getTime() };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? files[0].path : null;
}

// ========== HTTP Request Handler ==========

function handleRequest(req, res) {
  touchActivity();
  if (req.method === 'GET' && req.url === '/') {
    const screenFile = getNewestScreen();
    const raw = screenFile ? fs.readFileSync(screenFile, 'utf-8') : (frameHtml || WAITING_PAGE);
    let html = isFullDocument(raw) ? injectChannelMeta(raw) : wrapInFrame(raw);

    // Inject before the LAST </body>, not the first. frame.html's header comment
    // contains the literal string "</body>" (it documents this very injection), and
    // String.replace(str, ...) only substitutes the FIRST match — which buried the
    // helper inside a CSS comment and silently killed the entire drive loop.
    const bodyClose = html.lastIndexOf('</body>');
    if (bodyClose !== -1) {
      html = html.slice(0, bodyClose) + helperInjection + '\n' + html.slice(bodyClose);
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
  } else if (req.method === 'GET' && req.url === '/state/gavel-cards.json') {
    // S4: live shelf. gavel_state (digital-griot-mcp) parses ITEMS/RESOLVE from the plan
    // at git HEAD and writes this file into STATE_DIR; the cockpit fetches it to hydrate
    // its deck (replacing the S3 baked-ITEMS stopgap). Missing file → empty shell so the
    // cockpit falls back to its baked snapshot.
    const cardsFile = path.join(STATE_DIR, 'gavel-cards.json');
    const body = fs.existsSync(cardsFile)
      ? fs.readFileSync(cardsFile, 'utf-8')
      : '{"ok":false,"cards":[],"resolve":[]}';
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
  // Log brainstorm-style choice events AND gavel verb events to the events file.
  if (event.choice || event.verb) {
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

  const knownFiles = new Set(
    fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.html'))
  );

  const server = http.createServer(handleRequest);
  server.on('upgrade', handleUpgrade);

  // Watch the decisions.json state file. S4 may write live decision state here for the
  // cockpit; a change broadcasts a state-update (and the frame can react / reload).
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
  const stateWatcher = fs.watch(STATE_DIR, (eventType, filename) => {
    if (filename !== 'decisions.json') return;
    if (decisionsTimer) clearTimeout(decisionsTimer);
    decisionsTimer = setTimeout(() => {
      decisionsTimer = null;
      touchActivity();
      broadcastDecisions();
    }, 100);
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

  const lifecycleCheck = setInterval(() => {
    if (!ownerAlive()) shutdown('owner process exited');
    else if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) shutdown('idle timeout');
  }, 60 * 1000);
  lifecycleCheck.unref();

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
    // Trigger file for the prism-vscode extension's viewer watcher (opens the URL).
    fs.writeFileSync(path.join(STATE_DIR, 'open-viewer'), url);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { computeAcceptKey, encodeFrame, decodeFrame, OPCODES };
