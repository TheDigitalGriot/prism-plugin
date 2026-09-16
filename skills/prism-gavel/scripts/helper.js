(function() {
  // ============================================================================
  // prism-gavel popout helper — the DRIVE layer (S3c).
  //
  // Adapted from prism-brainstorm/scripts/helper.js. Two differences from brainstorm:
  //   1. Gavel's cockpit owns its OWN in-frame drawer (the .gvdrawer), so this helper
  //      does NOT render the brainstorm side-drawer (no #decisions-list DOM here).
  //   2. The wake model is inverted. brainstorm wakes on EVERY [data-choice] click.
  //      Gavel splits interactions:
  //        • use / role / stage / notes  → LOCAL cockpit mutation (handled inside
  //          frame.html's cockpit script). NO wake. This helper never touches them.
  //        • verb buttons [data-verb] (open · scan · verify · commit) → the ONLY wake
  //          events. Detected here by delegation (survives every draw() re-render) and
  //          POSTed to the shared digital-griot-mcp channel on :52342.
  //
  // The channel is reached BY PORT, via the same meta mechanism brainstorm uses — the
  // server injects <meta name="brainstorm-channel-port" content="52342"> + a session id.
  // ============================================================================

  const WS_URL = 'ws://' + window.location.host;
  let ws = null;
  let eventQueue = [];

  // ---------- Channel discovery (shared wake channel, reached by PORT) ----------
  function readMeta(name) {
    const el = document.querySelector('meta[name="' + name + '"]');
    return el ? el.getAttribute('content') : null;
  }
  const CHANNEL_PORT = readMeta('brainstorm-channel-port');
  const SESSION_ID = readMeta('brainstorm-session-id');
  const CHANNEL_URL = CHANNEL_PORT
    ? 'http://127.0.0.1:' + CHANNEL_PORT + '/channel'
    : null;

  function postToChannel(payload) {
    if (!CHANNEL_URL) return;
    try {
      fetch(CHANNEL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).then(res => {
        // fetch only rejects on network failure — a non-2xx (routed:false, 400, 404…) still
        // resolves. Surface it so a dropped wake isn't silent.
        if (res && !res.ok) console.warn('[gavel] channel POST non-2xx:', res.status);
      }).catch(err => console.warn('[gavel] channel POST failed:', err));
    } catch (err) {
      console.warn('[gavel] channel POST threw:', err);
    }
  }

  // ---------- WebSocket to gavel's server.cjs (event log + reload) ----------
  function connect() {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      eventQueue.forEach(e => ws.send(JSON.stringify(e)));
      eventQueue = [];
    };
    ws.onmessage = (msg) => {
      let data;
      try { data = JSON.parse(msg.data); } catch (e) { return; }
      // Gavel's cockpit re-renders itself; a server 'reload' (e.g. an S4 live-state push)
      // reloads the frame so the cockpit re-reads its data.
      if (data.type === 'reload') window.location.reload();
    };
    ws.onclose = () => { setTimeout(connect, 1000); };
  }

  function sendEvent(event) {
    event.timestamp = Date.now();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    } else {
      eventQueue.push(event);
    }
  }

  // ---------- The wake path: verb buttons only ----------
  // Delegated so it keeps working across the cockpit's frequent innerHTML re-renders.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-verb]');
    if (!btn) return; // use/role/stage/notes/nav are local — not our concern.

    const verb = btn.dataset.verb;
    const cardId = btn.dataset.cardId || '';
    const cardTitle = btn.dataset.cardTitle || '';

    // Human-readable wake summary. commit is a batch verb (no single card).
    const content = verb === 'commit'
      ? 'Gavel: commit the decided batch (route through dgs-plan-update)'
      : 'Gavel: ' + verb + (cardTitle ? ' — ' + cardTitle : (cardId ? ' — ' + cardId : ''));

    // For commit, carry the full decided-batch payload (cockpit local state) into the WS
    // event so server.cjs writes it to STATE_DIR/events — gavel_commit reads the latest
    // commit event's `batch` to assemble what dgs-plan-update receives. (Meta over the wake
    // channel must be small strings, so the batch travels via the events file, not the POST.)
    const evt = { type: 'verb', skill: 'gavel', verb: verb, card_id: cardId, card_title: cardTitle };
    if (verb === 'commit') {
      try { evt.batch = (typeof window.__gavelPayload === 'function') ? window.__gavelPayload() : null; } catch (_) { evt.batch = null; }
    }

    // Log to gavel's own server (WS event file) …
    sendEvent(evt);

    // … and wake Claude via the shared channel. THIS is the only wake event.
    postToChannel({
      content: content,
      session_id: SESSION_ID || '',
      skill: 'gavel',
      verb: verb,
      card_id: cardId
    });

    // Brief visual ack on the button.
    try {
      btn.classList.add('fired');
      setTimeout(() => btn.classList.remove('fired'), 600);
    } catch (_) {}
  });

  connect();
})();
