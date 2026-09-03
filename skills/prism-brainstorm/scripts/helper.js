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

    // Visually toggle the selection state on the clicked element.
    toggleSelect(target);

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
      container.querySelectorAll('.option, .opt, .card').forEach(o => o.classList.remove('selected'));
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

  // ---------- Drawer toggle + section collapse ----------
  function setupDrawerControls() {
    var toggle = document.getElementById('drawer-toggle');
    var drawer = document.getElementById('brainstorm-drawer');
    if (toggle && drawer) {
      function applyDrawerState(collapsed) {
        if (collapsed) {
          drawer.classList.add('collapsed');
          toggle.classList.add('collapsed-state');
          toggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 864 880" fill="currentColor"><path d="M290,590.8c61,0,121.5.6,182,.3,25.3-.4,43.6,26.8,32,50.1l-1.4,3.4c4.9,2.9,9.8,5.3,14.2,8.4,17.2,12.2,28,28.5,31.7,49.5.7,4.1,1.9,8.1,1.6,12.3-.4,5.4-3.4,9.1-8.6,10.2-2.3.5-4.6.6-7,.6H175.6c-2.3,0-4.7,0-7-.4-5.7-1-8.9-4.6-8.8-10.4.4-28,12.5-49.5,36.1-64.5,2.9-1.9,6.9-2.9,8.8-5.5,2-2.8-1.4-6.1-2.1-9.2-5.2-21.1,6.8-39,23.5-43.5,2.3-.6,4.6-.9,6.9-.9,18.8,0,37.7,0,57,0z"/><path d="M757.6,598.5c21.7,33.2,3.1,72-29.2,83-20.2,6.9-39.4,2.9-54.5-12.3-20.1-20.2-39.1-41.4-58.5-62.3-29.6-31.8-59.1-63.7-88.7-95.6-29.8-32.1-59.5-64.3-89.4-96.4-2.7-2.9-2.6-4.6.2-7.4,17.9-17.7,35.6-35.5,53.3-53.4,3.1-3.2,4.9-1.7,7.3.6,22.1,20.7,44.3,41.4,66.5,62.1,51.8,48.2,103.7,96.3,155.5,144.7,11.8,11,24.2,21.4,34.9,33.6.8,1,1.6,2.1,2.6,3.5z"/><path d="M441.9,376.9c-13.2,13.2-26.2,26.1-39.1,39.1-4.6,4.6-4.8,4.6-9.5-.1-37.8-37.8-75.7-75.6-113.5-113.4-4.9-4.9-4.9-4.9-.1-9.7,32.1-32.2,64.3-64.3,96.4-96.6,3.4-3.5,5.7-3.3,9,0,38.2,38.4,76.5,76.7,114.8,115,.3.3.1,2.1-3,5.1-19.3,19.1-38.5,38.4-57.9,57.8z"/><path d="M592,243.5c3.4,13-.4,23.2-9.7,32-8.4,8-16.5,16.4-24.9,24.6-12.6,12.3-30.8,12.4-43.4,0-39.6-39.1-79.1-78.2-118.6-117.5-12-12-11.8-31.4.1-43.7,8.1-8.4,16.2-16.8,24.3-25.2,13.9-14.5,33-14.6,47.2-.3,38.6,38.7,77.3,77.3,116,116,4,4,6.9,8.5,9,14.1z"/><path d="M356,404c9.6,9.7,19.1,19.1,28.4,28.6,9.5,9.8,10.8,20.7,4.3,32.9-7,13.2-18.7,21.9-28.8,32.2-6.6,6.7-13.5,11.6-23.2,12-8.9.3-16.7-2.1-23.1-8.5C274.1,461.7,234.6,422.2,195.2,382.7c-12.7-12.7-12.6-31.5,0-44.3,8.2-8.3,16.4-16.5,24.7-24.7,13.9-13.7,31.8-13.8,45.7,0,30.1,30,60.1,60.1,90.4,90.3z"/></svg>';
          toggle.title = 'Show decisions';
        } else {
          drawer.classList.remove('collapsed');
          toggle.classList.remove('collapsed-state');
          toggle.innerHTML = '\u25B6';
          toggle.title = 'Hide drawer';
        }
      }
      toggle.addEventListener('click', function () {
        var collapsed = !drawer.classList.contains('collapsed');
        applyDrawerState(collapsed);
        try { sessionStorage.setItem('drawer-collapsed', collapsed ? '1' : ''); } catch (e) {}
      });
      // Restore drawer state from sessionStorage
      try {
        if (sessionStorage.getItem('drawer-collapsed') === '1') {
          applyDrawerState(true);
        }
      } catch (e) {}
    }

    // Item expand/collapse (click a decision or parked item to show details)
    document.addEventListener('click', function (e) {
      var item = e.target.closest('.decision-item, .parked-item');
      if (!item) return;
      item.classList.toggle('expanded');
    });

    // Section collapse (Decisions / Parked)
    ['decisions', 'parking'].forEach(function (section) {
      var header = document.getElementById(section + '-header');
      var body = document.getElementById(section + '-body');
      if (!header || !body) return;
      var pane = header.closest('.pane');
      header.addEventListener('click', function () {
        var isCollapsed = header.classList.toggle('collapsed-section');
        body.classList.toggle('collapsed-content', isCollapsed);
        if (pane) pane.classList.toggle('has-collapsed-content', isCollapsed);
        try { sessionStorage.setItem(section + '-collapsed', isCollapsed ? '1' : ''); } catch (e) {}
      });
      // Restore section state
      try {
        if (sessionStorage.getItem(section + '-collapsed') === '1') {
          header.classList.add('collapsed-section');
          body.classList.add('collapsed-content');
          if (pane) pane.classList.add('has-collapsed-content');
        }
      } catch (e) {}
    });
  }

  // Run after DOM is ready (helper.js is injected before </body>)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDrawerControls);
  } else {
    setupDrawerControls();
  }

  connect();
  fetchInitialDrawer();
})();
