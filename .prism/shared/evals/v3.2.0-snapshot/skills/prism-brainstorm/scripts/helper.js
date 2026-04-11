(function() {
  const WS_URL = 'ws://' + window.location.host;
  let ws = null;
  let eventQueue = [];

  // ---------- Channel discovery (Phase A: persistent MCP channel server) ----------
  // server.cjs injects two meta tags into the wrapped frame:
  //   <meta name="brainstorm-channel-port" content="52342">
  //   <meta name="brainstorm-session-id" content="<session-dir-basename>">
  // helper.js POSTs click events to the channel server so Claude wakes mid-session.
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
      }).catch(err => console.warn('[brainstorm] channel POST failed:', err));
    } catch (err) {
      console.warn('[brainstorm] channel POST threw:', err);
    }
  }

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      eventQueue.forEach(e => ws.send(JSON.stringify(e)));
      eventQueue = [];
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'reload') {
        window.location.reload();
      } else if (data.type === 'state-update') {
        renderDrawer(data.payload);
      }
    };

    ws.onclose = () => {
      setTimeout(connect, 1000);
    };
  }

  // ---------- Drawer rendering (Phase C — decisions + parking lot) ----------
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderDrawer(state) {
    const decisions = (state && Array.isArray(state.decisions)) ? state.decisions : [];
    const parked = (state && Array.isArray(state.parked)) ? state.parked : [];

    const dList = document.getElementById('decisions-list');
    const dEmpty = document.getElementById('decisions-empty');
    if (dList && dEmpty) {
      if (decisions.length === 0) {
        dList.innerHTML = '';
        dEmpty.style.display = '';
      } else {
        dEmpty.style.display = 'none';
        dList.innerHTML = decisions.map(function (d) {
          var q = escapeHtml(d.q || '');
          var label = escapeHtml(d.label || '');
          var choice = d.choice ? ' · <strong>' + escapeHtml(d.choice) + '</strong>' : '';
          var summary = d.summary ? '<span class="summary">' + escapeHtml(d.summary) + '</span>' : '';
          return '<li class="decision-item"><span class="q">' + q + '</span><span class="label">' + label + choice + '</span>' + summary + '</li>';
        }).join('');
      }
    }

    const pList = document.getElementById('parking-list');
    const pEmpty = document.getElementById('parking-empty');
    const pWarn = document.getElementById('parking-warning');
    if (pList && pEmpty) {
      if (parked.length === 0) {
        pList.innerHTML = '';
        pEmpty.style.display = '';
      } else {
        pEmpty.style.display = 'none';
        pList.innerHTML = parked.map(function (p) {
          var fromQ = escapeHtml(p.fromQ || '');
          var label = escapeHtml(p.label || '');
          var concern = p.concern ? '<span class="concern">' + escapeHtml(p.concern) + '</span>' : '';
          var revisit = p.revisit ? '<span class="revisit">revisit: ' + escapeHtml(p.revisit) + '</span>' : '';
          return '<li class="parked-item"><span class="q">from ' + fromQ + '</span><span class="label">' + label + '</span>' + concern + revisit + '</li>';
        }).join('');
      }
    }

    if (pWarn) {
      pWarn.style.display = parked.length >= 5 ? '' : 'none';
    }
  }

  function fetchInitialDrawer() {
    fetch('/state/decisions.json')
      .then(function (r) { return r.json(); })
      .then(renderDrawer)
      .catch(function () { renderDrawer({ decisions: [], parked: [] }); });
  }

  function sendEvent(event) {
    event.timestamp = Date.now();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    } else {
      eventQueue.push(event);
    }
  }

  // Capture clicks on choice elements
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-choice]');
    if (!target) return;

    const clickPayload = {
      type: 'click',
      text: target.textContent.trim(),
      choice: target.dataset.choice,
      id: target.id || null
    };
    sendEvent(clickPayload);

    // Wake Claude mid-session via the persistent MCP channel server.
    postToChannel({
      content: 'Brainstorm viewer click: ' + (target.dataset.choice || target.textContent.trim().slice(0, 80)),
      session_id: SESSION_ID || '',
      choice: target.dataset.choice || '',
      element_id: target.id || ''
    });

    // Update indicator bar (defer so toggleSelect runs first)
    setTimeout(() => {
      const indicator = document.getElementById('indicator-text');
      if (!indicator) return;
      const container = target.closest('.options') || target.closest('.cards');
      const selected = container ? container.querySelectorAll('.selected') : [];
      if (selected.length === 0) {
        indicator.textContent = 'Click an option above, then return to the terminal';
      } else if (selected.length === 1) {
        const label = selected[0].querySelector('h3, .content h3, .card-body h3')?.textContent?.trim() || selected[0].dataset.choice;
        indicator.innerHTML = '<span class="selected-text">' + label + ' selected</span> — return to terminal to continue';
      } else {
        indicator.innerHTML = '<span class="selected-text">' + selected.length + ' selected</span> — return to terminal to continue';
      }
    }, 0);
  });

  // Frame UI: selection tracking
  window.selectedChoice = null;

  window.toggleSelect = function(el) {
    const container = el.closest('.options') || el.closest('.cards');
    const multi = container && container.dataset.multiselect !== undefined;
    if (container && !multi) {
      container.querySelectorAll('.option, .card').forEach(o => o.classList.remove('selected'));
    }
    if (multi) {
      el.classList.toggle('selected');
    } else {
      el.classList.add('selected');
    }
    window.selectedChoice = el.dataset.choice;
  };

  // Expose API for explicit use
  window.brainstorm = {
    send: sendEvent,
    choice: (value, metadata = {}) => sendEvent({ type: 'choice', value, ...metadata })
  };

  connect();
  fetchInitialDrawer();
})();
