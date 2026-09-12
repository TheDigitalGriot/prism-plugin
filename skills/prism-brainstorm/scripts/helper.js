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
        renderState(data.payload);
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

  // ---------- Shared ordering ----------
  // One rule, used by BOTH the graph rail and the drawer, so the two panes can
  // never disagree about sequence. "Q3.1" sorts after "Q3" and before "Q4";
  // un-numbered ids (standing decisions like "D·slices") keep their relative
  // order and sit after the numbered spine. Array#sort is stable, so ties hold.
  function qKey(q) {
    var m = String(q || '').match(/^Q\s*(\d+)(?:\.(\d+))?/i);
    return m ? [parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0]
             : [Number.MAX_SAFE_INTEGER, 0];
  }
  function byQ(field) {
    return function (a, b) {
      var ka = qKey(a[field]), kb = qKey(b[field]);
      return (ka[0] - kb[0]) || (ka[1] - kb[1]);
    };
  }
  function orderDecisions(list) { return list.slice().sort(byQ('q')); }
  function orderParked(list) { return list.slice().sort(byQ('fromQ')); }

  function renderDrawer(state) {
    const decisions = orderDecisions((state && Array.isArray(state.decisions)) ? state.decisions : []);
    const parked = orderParked((state && Array.isArray(state.parked)) ? state.parked : []);

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
          var merged = !!p.resolvedAt;
          var concern = p.concern ? '<span class="concern">' + escapeHtml(p.concern) + '</span>' : '';
          // a resolved tangent shows where it merged back instead of a revisit note
          var tail = merged
            ? '<span class="revisit">resolved at ' + escapeHtml(p.resolvedAt) +
              (p.resolution ? ' — ' + escapeHtml(p.resolution) : '') + '</span>'
            : (p.revisit ? '<span class="revisit">revisit: ' + escapeHtml(p.revisit) + '</span>' : '');
          return '<li class="parked-item' + (merged ? ' merged' : '') + '">' +
                 '<span class="q">' + (merged ? '↵ ' : 'from ') + fromQ + '</span>' +
                 '<span class="label">' + label + '</span>' + concern + tail + '</li>';
        }).join('');
      }
    }

    if (pWarn) {
      pWarn.style.display = parked.length >= 5 ? '' : 'none';
    }
  }

  // ---------- Question graph (multi-state rail) ----------
  // Renders the session as a vertical git-lane spine from the SAME state file
  // the drawer uses. Trunk = decisions in order. Parked items hang off their
  // fromQ as dangling branches (raised, never merged). Optional `current` and
  // `upcoming[]` render the live node and the road ahead.
  function renderGraph(state) {
    var host = document.getElementById('qrail-graph');
    if (!host) return;

    var decisions = (state && Array.isArray(state.decisions)) ? state.decisions : [];
    var parked = (state && Array.isArray(state.parked)) ? state.parked : [];
    var current = (state && state.current) ? String(state.current) : '';
    var upcoming = (state && Array.isArray(state.upcoming)) ? state.upcoming : [];

    if (!decisions.length && !parked.length && !current && !upcoming.length) {
      host.innerHTML = '<div class="qg-empty">No questions yet</div>';
      return;
    }

    function many(v) { return Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []); }
    function dirBadge(cls, arrow, list) {
      if (!list.length) return '';
      var extra = list.length > 1 ? ' +' + (list.length - 1) : '';
      return '<span class="qg-bdg ' + cls + '" title="' + escapeHtml(list.join(', ')) + '">' +
             arrow + ' ' + escapeHtml(list[0]) + extra + '</span>';
    }
    function badge(o) {
      if (!o) return '';
      var out = many(o.destination), inb = many(o.source);
      if (out.length) return dirBadge('out', '&rarr;', out);
      if (inb.length) return dirBadge('in', '&larr;', inb);
      if (o.maps > 1) return '<span class="qg-bdg adj">&harr; ' + o.maps + '</span>';
      if (o.supersededBy) return '<span class="qg-bdg sup">&#8676; ' + escapeHtml(o.supersededBy) + '</span>';
      if (o.resolvedAt) return '<span class="qg-bdg back">&crarr; ' + escapeHtml(o.resolvedAt) + '</span>';
      return '';
    }
    function isSplinter(q) { return /^Q\s*\d+\.\d/i.test(String(q || '')); }
    function row(cls, q, text, title, o) {
      var scr = (o && o.screen) ? ' data-screen="' + escapeHtml(o.screen) + '"' : '';
      // A node with no screen has nothing to navigate to (an unasked question).
      // Mark it so the click handler can say so instead of looking broken.
      var noscr = scr ? '' : ' no-screen';
      return '<div class="qg-row ' + cls + (isSplinter(q) ? ' splinter' : '') + noscr +
             '" data-q="' + escapeHtml(q) + '"' + scr +
             ' title="' + escapeHtml(title || text) + (scr ? '' : ' \u2014 not rendered yet') + '">' +
             '<span class="qg-dot"></span><span class="qg-txt">' + escapeHtml(text) + '</span>' +
             badge(o) + '</div>';
    }

    // LAYERS — every layer collapses and filters independently. Spine order is
    // preserved INSIDE each layer, so grouping never scrambles sequence.
    // TWO PANELS, ONE DATA SET.
    //   L = lanes by STATE      (where a thing stands)
    //   D = lanes by DIRECTION  (where it points)
    // These are ORTHOGONAL axes, so an item legitimately appears in one lane of
    // each -- a parked item that spawns work in Cinopsis is BOTH parked AND
    // outbound. It is not double-counting: the panels are two views, like the
    // Explorer and Outline views of the same file in VS Code.
    //
    // The previous build bucketed on direction FIRST, so any parked item with a
    // destination silently left the Parked lane -- "Parked 0" was shown while five
    // parked items existed. Splitting the panels is what lets both axes be true.
    var L = { done: [], superseded: [], parked: [], open: [] };
    var D = { outbound: [], inbound: [], adjacent: [] };
    function dirOf(o) {
      if (!o) return 'local';
      return many(o.destination).length ? 'outbound'
           : many(o.source).length      ? 'inbound'
           : o.maps > 1                 ? 'adjacent'
           : 'local';
    }
    function fileIt(stateKey, o, rowHtml) {
      if (L[stateKey]) L[stateKey].push(rowHtml);
      var dk = dirOf(o);
      if (D[dk]) D[dk].push(rowHtml);
    }

    orderDecisions(decisions).forEach(function (d) {
      var q = String(d.q || '');
      var text = q + (d.label ? ' \u00b7 ' + d.label : '');
      // Same rule as parked below: STATE decides the lane, never direction.
      var bucket = d.supersededBy ? 'superseded' : 'done';
      fileIt(bucket, d, row(bucket, q, text,
                         d.supersededBy ? (d.label || '') + ' \u2014 superseded by ' + d.supersededBy
                                        : (d.summary || d.label), d));
    });

    orderParked(parked).forEach(function (pk) {
      var cls = pk.resolvedAt ? 'done' : 'parked';
      var tip = pk.resolvedAt
        ? (pk.label || '') + ' \u2014 resolved at ' + pk.resolvedAt + (pk.resolution ? ': ' + pk.resolution : '')
        : (pk.concern || pk.label || '');
      // STATE decides the lane. Direction is a SEPARATE axis, carried by badge()
      // on the row. Bucketing on direction first is what emptied the Parked lane:
      // five parked items existed, three had a destination and one had maps>1, so
      // they were filed as outbound/adjacent and "Parked 0" was displayed. That
      // inverted the Q3.4 lock (border = state, badge = direction).
      var bucket = pk.resolvedAt ? 'done' : 'parked';
      fileIt(bucket, pk, row(cls + ' splinter', pk.fromQ || '', pk.label || 'parked', tip, pk));
    });

    upcoming.forEach(function (u) {
      var q = (typeof u === 'string') ? u : (u.q || '');
      // the live node is rendered separately; never render it twice
      if (q && q === current) return;
      var lab = (typeof u === 'string') ? u : (q + (u.label ? ' \u00b7 ' + u.label : ''));
      var uo = (typeof u === 'object') ? u : null;
      fileIt('open', uo, row('open', q, lab, 'not answered yet', uo));
    });

    // Every decision state gets a layer, and every layer renders even at zero.
    // inbound and adjacent are deliberately SEPARATE: inbound arrived and lands
    // here; adjacent lives elsewhere permanently and never resolves here.
    // Each layer carries an icon so the COLLAPSED rail still reads:
    // icon + count, with no labels.
    //
    // ---- ICON SET - INTERIM: Lucide (ISC / MIT) ----------------------------
    // THE CANONICAL DGS ICON SET IS AN OPEN DECISION.
    //   research: .prism/shared/research/2026-09-04-icon-system-decision.md
    //   field:    Streamline (449k, paid) / Phosphor (6 weights) / Tabler /
    //             Lucide / Iconoir / Heroicons / Material Symbols
    //   constraint: Morphicons (already on the Potluck shelf) morphs only
    //             STROKE-BASED icons -- that rules out variable fonts and solid sets.
    //   why Lucide for now: lowest regret. Permissive, Morphicons names it first,
    //             and Streamline BUNDLES Lucide -- so a later move is a migration
    //             INWARD, not a rewrite.
    //
    // TO SWAP THE SUITE'S GLYPHS, EDIT ONLY THIS MAP. Nothing else references an
    // icon. An "interim" with scattered call sites is a permanent decision wearing
    // a temporary label, so there is exactly one call site.
    // Paths are verbatim from lucide-icons/lucide@main/icons/<name>.svg
    function glyph(inner) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
             'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
             'aria-hidden="true" focusable="false">' + inner + '</svg>';
    }
    var LAYER_ICONS = {
      /* circle-check */
      done:       glyph('<circle cx="12" cy="12" r="10"/><path d="m16 9-5.5 5.5L8 12"/>'),
      /* rotate-ccw - decided once, then turned back and replaced */
      superseded: glyph('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
      /* arrow-up-right - spawns work elsewhere */
      outbound:   glyph('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'),
      /* arrow-down-left - work arriving from elsewhere */
      inbound:    glyph('<path d="M17 7 7 17"/><path d="M17 17H7V7"/>'),
      /* arrow-left-right - related in both directions, never resolves here */
      adjacent:   glyph('<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>'),
      /* circle-pause - deliberately held */
      parked:     glyph('<circle cx="12" cy="12" r="10"/><line x1="10" x2="10" y1="15" y2="9"/><line x1="14" x2="14" y1="15" y2="9"/>'),
      /* circle-dashed - not yet closed */
      open:       glyph('<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>')
    };

    // Panel 1 - STATES. Panel 2 - RELATIONS. Every lane renders even at zero:
    // "Inbound 0" is information; a missing lane says nothing at all.
    var STATE_LAYERS = [
      { key: 'done',       label: 'Decided',    icon: LAYER_ICONS.done },
      { key: 'superseded', label: 'Superseded', icon: LAYER_ICONS.superseded },
      { key: 'parked',     label: 'Parked',     icon: LAYER_ICONS.parked },
      { key: 'open',       label: 'Open',       icon: LAYER_ICONS.open }
    ];
    var DIR_LAYERS = [
      { key: 'outbound',   label: 'Outbound',   icon: LAYER_ICONS.outbound },
      { key: 'inbound',    label: 'Inbound',    icon: LAYER_ICONS.inbound },
      { key: 'adjacent',   label: 'Adjacent',   icon: LAYER_ICONS.adjacent }
    ];
    var LAYERS = STATE_LAYERS.concat(DIR_LAYERS);   // filter chips still see all 7

    var html = '';
    // the live node is never grouped and never filtered away
    if (current) {
      html += '<div class="qg-spine now-wrap">' +
              row('now', current, current, 'you are here', { screen: state.currentScreen || null }) +
              '</div>';
    }

    // ── TIMELINE MODE — the original chronological spine. Same records, read
    //    in sequence instead of by layer. Splinters stay nested under parents.
    if (viewMode() === 'time') {
      var branches = {};
      orderParked(parked).forEach(function (pk) {
        var k = String(pk.fromQ || '');
        (branches[k] = branches[k] || []).push(pk);
      });
      function kids(q) {
        return (branches[q] || []).map(function (pk) {
          var cls = pk.resolvedAt ? 'done' : 'parked';
          var tip = pk.resolvedAt
            ? (pk.label || '') + ' \u2014 resolved at ' + pk.resolvedAt
            : (pk.concern || pk.label || '');
          return row(cls + ' splinter', pk.fromQ || '', pk.label || 'parked', tip, pk);
        }).join('');
      }
      // Each parent Q owns its children so a whole question collapses to one
      // line — scan Q1, Q2, Q3 without the sub-threads in the way.
      function item(parentRow, q) {
        var children = kids(q);
        if (!children) return '<div class="qg-item">' + parentRow + '</div>';
        return '<div class="qg-item has-kids" data-parent="' + escapeHtml(q) + '">' +
                 '<div class="qg-itemhead">' +
                   '<button class="kid-toggle" data-parent="' + escapeHtml(q) + '"' +
                     ' title="Collapse sub-items">\u25be</button>' +
                   parentRow +
                 '</div>' +
                 '<div class="qg-kids">' + children + '</div>' +
               '</div>';
      }
      var seq = [];
      orderDecisions(decisions).forEach(function (d) {
        var q = String(d.q || '');
        seq.push(item(row('done', q, q + (d.label ? ' \u00b7 ' + d.label : ''),
                          d.summary || d.label, d), q));
      });
      if (current) { var ck = kids(current); if (ck) seq.push('<div class="qg-kids">' + ck + '</div>'); }
      upcoming.forEach(function (u) {
        var q = (typeof u === 'string') ? u : (u.q || '');
        var lab = (typeof u === 'string') ? u : (q + (u.label ? ' \u00b7 ' + u.label : ''));
        seq.push(row('open', q, lab, 'not answered yet', (typeof u === 'object' ? u : null)));
      });
      Object.keys(branches).forEach(function (k) {
        var seen = decisions.some(function (d) { return String(d.q || '') === k; }) || current === k;
        if (!seen) seq.push(kids(k));
      });
      host.innerHTML = html + '<div class="qg-spine">' + seq.join('') + '</div>';
      applyLayerPrefs();
      applyItemPrefs();
      return;
    }

    function renderPanel(title, defs, store) {
      var total = defs.reduce(function (n, g) { return n + (store[g.key] || []).length; }, 0);
      var out = '<section class="qg-panel" data-panel="' + title.toLowerCase() + '">' +
        '<button class="qg-phead" data-panel="' + title.toLowerCase() + '">' +
          // No caret, no dot. A section TITLE is not a row -- giving it a glyph
          // made it read as another lane instead of a heading above the lanes.
          '<span class="pname">' + title + '</span>' +
          '<span class="pcount">' + total + '</span>' +
        '</button><div class="qg-pbody">';
      defs.forEach(function (g) { out += groupHtml(g, store[g.key] || []); });
      return out + '</div></section>';
    }
    function groupHtml(g, rows) {
      // Empty layers still render. "Parked 0" is information — it says nothing
      // is un-dispositioned. A missing group says nothing at all.
      var empty = rows.length === 0;
      return '' +
        '<section class="qg-group' + (empty ? ' empty' : '') + '" data-layer="' + g.key + '">' +
          '<button class="qg-ghead" data-layer="' + g.key + '" title="' +
              escapeHtml(g.label + ' \u00b7 ' + rows.length) + '">' +
            '<span class="chev">\u25be</span>' +
            '<span class="glight"></span>' +
            '<span class="gicon">' + g.icon + '</span>' +
            '<span class="gname">' + g.label + '</span>' +
            '<span class="gcount">' + rows.length + '</span>' +
          '</button>' +
          '<div class="qg-gbody"><div class="qg-spine">' +
            (empty ? '<div class="qg-none">none</div>' : rows.join('')) +
          '</div></div>' +
        '</section>';
    }
    html += renderPanel('STATES', STATE_LAYERS, L);
    html += '<div class="qg-panel-split"></div>';
    html += renderPanel('RELATIONS', DIR_LAYERS, D);
    host.innerHTML = html;
    applyLayerPrefs();
    applyPanelPrefs();
    wirePanelSplit();
  }

  // ---------- view mode: layers | time ----------
  function viewMode() {
    try { return sessionStorage.getItem('qg-view') === 'time' ? 'time' : 'layers'; }
    catch (e) { return 'layers'; }
  }
  function setViewMode(m) {
    try { sessionStorage.setItem('qg-view', m); } catch (e) {}
    document.querySelectorAll('.vchip').forEach(function (c) {
      c.classList.toggle('on', c.getAttribute('data-v') === m);
    });
    var fb = document.getElementById('grail-filters');
    var ff = document.getElementById('grail-filter');
    // filters group layers; in timeline mode there are no groups to filter
    if (ff) ff.style.display = m === 'time' ? 'none' : '';
    if (fb && m === 'time') { fb.hidden = true; if (ff) ff.classList.remove('on'); }
    fetch('/state/decisions.json').then(function (r) { return r.json(); })
      .then(renderState).catch(function () {});
  }
  function wireViewMode() {
    document.querySelectorAll('.vchip').forEach(function (c) {
      c.addEventListener('click', function () { setViewMode(c.getAttribute('data-v')); });
      c.classList.toggle('on', c.getAttribute('data-v') === viewMode());
    });
    var ff = document.getElementById('grail-filter');
    var fb2 = document.getElementById('grail-filters');
    if (ff && fb2) ff.classList.toggle('on', !fb2.hidden);
    if (ff && viewMode() === 'time') ff.style.display = 'none';
  }

  // ---------- the STATES/RELATIONS splitter (drag to redistribute) ------
  // The divider between the two sections is a real handle, like a VS Code sidebar
  // section boundary: drag it to give one panel more room. The height lands on
  // the STATES body; RELATIONS simply flows beneath it.
  function wirePanelSplit() {
    var split = document.querySelector('#qrail-graph .qg-panel-split');
    var body  = document.querySelector('#qrail-graph .qg-panel[data-panel="states"] .qg-pbody');
    if (!split || !body) return;

    try {
      var saved = sessionStorage.getItem('qg-states-h');
      if (saved) body.style.maxHeight = saved + 'px';
    } catch (e) {}

    var startY = 0, startH = 0;
    function move(ev) {
      var h = Math.max(70, Math.min(window.innerHeight - 180,
                                    startH + (ev.clientY - startY)));
      body.style.maxHeight = h + 'px';
      try { sessionStorage.setItem('qg-states-h', String(Math.round(h))); } catch (e) {}
    }
    function up() {
      document.body.classList.remove('resizing-v');
      split.classList.remove('dragging');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    }
    split.addEventListener('mousedown', function (ev) {
      startY = ev.clientY;
      startH = body.getBoundingClientRect().height;
      document.body.classList.add('resizing-v');
      split.classList.add('dragging');
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      ev.preventDefault();
    });
    // double-click restores the default share
    split.addEventListener('dblclick', function () {
      body.style.maxHeight = '';
      try { sessionStorage.removeItem('qg-states-h'); } catch (e) {}
    });
  }

  // ---------- panel collapse (VS Code-style stacked sections) ----------
  function panelPrefs() {
    try { return JSON.parse(sessionStorage.getItem('qg-panels') || '{}'); } catch (e) { return {}; }
  }
  function applyPanelPrefs() {
    var prefs = panelPrefs();
    document.querySelectorAll('#qrail-graph .qg-panel').forEach(function (s) {
      s.classList.toggle('collapsed', prefs[s.getAttribute('data-panel')] === 'c');
    });
  }
  function wirePanelCollapse() {
    var host = document.getElementById('qrail-graph');
    if (!host) return;
    host.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.qg-phead') : null;
      if (!btn) return;
      e.stopPropagation(); e.preventDefault();
      var k = btn.getAttribute('data-panel');
      var prefs = panelPrefs();
      prefs[k] = prefs[k] === 'c' ? '' : 'c';
      try { sessionStorage.setItem('qg-panels', JSON.stringify(prefs)); } catch (err) {}
      applyPanelPrefs();
    }, true);
  }

  // ---------- per-question collapse (timeline mode) ----------
  function itemPrefs() {
    try { return JSON.parse(sessionStorage.getItem('qg-items') || '{}'); } catch (e) { return {}; }
  }
  function applyItemPrefs() {
    var prefs = itemPrefs();
    document.querySelectorAll('#qrail-graph .qg-item.has-kids').forEach(function (it) {
      it.classList.toggle('collapsed', prefs[it.getAttribute('data-parent')] === 'c');
    });
  }
  function wireItemCollapse() {
    var host = document.getElementById('qrail-graph');
    if (!host) return;
    host.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.kid-toggle') : null;
      if (!btn) return;
      e.stopPropagation();
      e.preventDefault();
      var k = btn.getAttribute('data-parent');
      var prefs = itemPrefs();
      prefs[k] = prefs[k] === 'c' ? '' : 'c';
      try { sessionStorage.setItem('qg-items', JSON.stringify(prefs)); } catch (err) {}
      applyItemPrefs();
    }, true);
  }

  // ---------- layer collapse + filter chips ----------
  function layerPrefs() {
    try { return JSON.parse(sessionStorage.getItem('qg-layers') || '{}'); } catch (e) { return {}; }
  }
  function saveLayerPrefs(p) {
    try { sessionStorage.setItem('qg-layers', JSON.stringify(p)); } catch (e) {}
  }
  function applyLayerPrefs() {
    var prefs = layerPrefs();
    document.querySelectorAll('#qrail-graph .qg-group').forEach(function (sec) {
      var k = sec.getAttribute('data-layer');
      sec.classList.toggle('collapsed', prefs[k] === 'c');
      sec.classList.toggle('filtered-out', prefs['hide-' + k] === 1);
    });
    var bar = document.getElementById('grail-filters');
    if (!bar) return;
    bar.querySelectorAll('.fchip').forEach(function (c) {
      var k = c.getAttribute('data-f');
      c.classList.toggle('off', prefs['hide-' + k] === 1);
      var sec = document.querySelector('#qrail-graph .qg-group[data-layer="' + k + '"]');
      var n = sec ? sec.querySelectorAll('.qg-row').length : 0;
      var b = c.querySelector('b');
      if (b) b.textContent = n;
      c.classList.toggle('zero', n === 0);
    });
  }
  function wireLayerControls() {
    var host = document.getElementById('qrail-graph');
    if (host) {
      host.addEventListener('click', function (e) {
        var head = e.target.closest ? e.target.closest('.qg-ghead') : null;
        if (!head) return;
        e.stopPropagation();
        var k = head.getAttribute('data-layer');
        var prefs = layerPrefs();
        prefs[k] = prefs[k] === 'c' ? '' : 'c';
        saveLayerPrefs(prefs);
        applyLayerPrefs();
      }, true);
    }
    var fbtn = document.getElementById('grail-filter');
    var fbar = document.getElementById('grail-filters');
    if (fbtn && fbar) {
      fbtn.addEventListener('click', function () {
        fbar.hidden = !fbar.hidden;
        fbtn.classList.toggle('on', !fbar.hidden);
      });
      fbar.addEventListener('click', function (e) {
        var chip = e.target.closest('.fchip');
        if (!chip) return;
        var k = chip.getAttribute('data-f');
        var prefs = layerPrefs();
        prefs['hide-' + k] = prefs['hide-' + k] === 1 ? 0 : 1;
        saveLayerPrefs(prefs);
        applyLayerPrefs();
      });
    }
  }

  // Pull a stored screen into the content area. Screens are usually fragments;
  // a few older ones are full documents, so unwrap the body when needed.
  function showScreen(file, label) {
    var host = document.getElementById('claude-content');
    if (!host) return;
    fetch('/files/' + encodeURIComponent(file))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        var t = html.trimStart().toLowerCase();
        if (t.indexOf('<!doctype') === 0 || t.indexOf('<html') === 0) {
          var m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          if (m) html = m[1];
        }
        host.innerHTML = '<div class="qg-history">Viewing <b>' + escapeHtml(label || file) +
          '</b><button id="qg-latest">back to current</button></div>' + html;
        host.scrollIntoView({ block: 'start' });
        var b = document.getElementById('qg-latest');
        if (b) b.addEventListener('click', function () { location.reload(); });
      })
      .catch(function () {
        host.insertAdjacentHTML('afterbegin',
          '<div class="qg-history">Could not load ' + escapeHtml(file) + '</div>');
      });
  }

  function wireGraphClicks() {
    var host = document.getElementById('qrail-graph');
    if (!host) return;
    host.addEventListener('click', function (e) {
      var row = e.target.closest ? e.target.closest('.qg-row') : null;
      if (!row) return;
      host.querySelectorAll('.qg-row').forEach(function (r) { r.classList.remove('sel'); });
      row.classList.add('sel');
      var screen = row.getAttribute('data-screen');
      var label = (row.querySelector('.qg-txt') || row).textContent.trim();
      var ind = document.getElementById('indicator-text');
      if (screen) {
        showScreen(screen, label);
      } else if (ind) {
        // honest: nothing to open. Do not imply a navigation happened.
        ind.innerHTML = '<span class="selected-text">' + escapeHtml(label) +
          '</span> has no screen yet \u2014 it has not been asked';
      }
      sendEvent({ type: 'graph-nav', q: row.getAttribute('data-q') || '',
                  label: label, hasScreen: !!screen });

    });
  }

  function wireRailModes() {
    var modes = document.querySelectorAll('.qrail-mode');
    if (!modes.length) return;
    modes.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var want = btn.getAttribute('data-mode');
        modes.forEach(function (b) { b.classList.toggle('on', b === btn); });
        document.querySelectorAll('.qrail-pane').forEach(function (p) {
          p.hidden = p.getAttribute('data-mode') !== want;
        });
      });
    });
  }

  // ---------- Companion agent (rail "agent" state) ----------
  // Posts to /api/chat, which shells out to the local `claude` CLI — the same
  // subscription path the Cinopsis companion uses. No API key, no streaming.
  function wireAgent() {
    var log = document.getElementById('ag-log');
    var box = document.getElementById('ag-text');
    var btn = document.getElementById('ag-send');
    if (!log || !box || !btn) return;

    function add(cls, text) {
      var d = document.createElement('div');
      d.className = 'ag-msg ' + cls;
      d.textContent = text;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d;
    }

    function send() {
      var msg = (box.value || '').trim();
      if (!msg || btn.disabled) return;
      box.value = '';
      btn.disabled = true;
      add('you', msg);
      var pending = add('think', 'thinking…');
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          pending.remove();
          if (d && d.reply) add('bot', d.reply);
          else add('err', (d && d.error) || 'No reply.');
        })
        .catch(function (e) {
          pending.remove();
          add('err', 'Chat failed: ' + e.message);
        })
        .then(function () { btn.disabled = false; box.focus(); });
    }

    btn.addEventListener('click', send);
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
  }

  // ---------- Rail collapse (graph -> thin spine, agent -> tab) ----------
  // A dragged rail carries an INLINE width, which CSS collapse rules can never
  // beat. So collapsing must strip the inline size (and expanding restores the
  // width the user dragged to).
  function stashAndClearWidth(el, key) {
    var w = el.style.flexBasis || el.style.width;
    if (w) { try { sessionStorage.setItem(key, parseInt(w, 10) || ''); } catch (e) {} }
    el.style.flexBasis = ''; el.style.width = '';
  }
  function restoreWidth(el, key) {
    try {
      var w = sessionStorage.getItem(key);
      if (w) { el.style.flexBasis = w + 'px'; el.style.width = w + 'px'; }
    } catch (e) {}
  }

  function wireRailCollapse() {
    var grail = document.getElementById('grail');
    var gtog = document.getElementById('grail-toggle');
    if (grail && gtog) {
      function applyThin(thin) {
        grail.classList.toggle('thin', thin);
        if (thin) stashAndClearWidth(grail, 'railw-grail');
        else restoreWidth(grail, 'railw-grail');
        gtog.title = thin ? 'Expand graph' : 'Collapse to spine';
        try { sessionStorage.setItem('grail-thin', thin ? '1' : '0'); } catch (e) {}
      }
      gtog.addEventListener('click', function () {
        applyThin(!grail.classList.contains('thin'));
      });
      try { if (sessionStorage.getItem('grail-thin') === '1') applyThin(true); } catch (e) {}
    }

    // lucide: bot-message-square (interim set -- see LAYER_ICONS for the
    // canonical-icon decision this is standing in for)
    var AGENT_TAB_BOT = '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 6V2H8\"/><path d=\"M15 11v2\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z\"/><path d=\"M9 11v2\"/></svg>';
    var arail = document.getElementById('arail');
    var atab = document.getElementById('arail-tab');
    if (arail && atab) {
      function applyAgent(collapsed) {
        // ORDER IS LOad-BEARING: apply the real class FIRST, then release the
        // pre-paint guard. Releasing first leaves one frame where neither rule
        // applies, so the rail snaps out to its 268px default and animates shut
        // -- the visible "wonky" reload.
        arail.classList.toggle('collapsed', collapsed);
        document.documentElement.classList.remove('pre-arail-collapsed');
        atab.classList.toggle('collapsed-state', collapsed);
        if (collapsed) stashAndClearWidth(arail, 'railw-arail');
        else restoreWidth(arail, 'railw-arail');
        // The JS owns this button's contents, so the glyph MUST be set here --
        // markup added in frame-template.html is overwritten on the first toggle
        // (which is exactly why the bot icon never appeared).
        //   collapsed -> bot-message-square: says WHAT is behind the tab.
        //   open      -> a caret: says what the click will DO.
        atab.innerHTML = collapsed ? AGENT_TAB_BOT : '▶';
        atab.title = collapsed ? 'Show agent' : 'Hide agent';
        try { sessionStorage.setItem('arail-collapsed', collapsed ? '1' : '0'); } catch (e) {}
      }
      atab.addEventListener('click', function () {
        applyAgent(!arail.classList.contains('collapsed'));
      });
      // agent starts collapsed — the graph is the always-on state
      var st = null;
      try { st = sessionStorage.getItem('arail-collapsed'); } catch (e) {}
      applyAgent(st === null ? true : st === '1');
    }
  }

  // ---------- Drag-to-resize rails ----------
  function wireResizers() {
    document.querySelectorAll('.rail-resizer').forEach(function (rz) {
      var el = document.getElementById(rz.getAttribute('data-target'));
      if (!el) return;
      var fromRight = rz.getAttribute('data-side') === 'right';
      var key = 'railw-' + rz.getAttribute('data-target');

      try {
        var saved = sessionStorage.getItem(key);
        // NEVER restore a width onto a rail that is currently closed. An inline
        // width beats the .collapsed / .thin class rule, so the pane ends up
        // invisible (opacity:0) while STILL occupying its full width -- a dead
        // gutter pushing the content across, which is what made a reload with the
        // chat closed look broken. The width is re-applied by restoreWidth() at
        // the moment the pane is re-opened, which is the only time it is wanted.
        var target = rz.getAttribute('data-target');
        var closed = el.classList.contains('collapsed') || el.classList.contains('thin');
        // wireResizers() may run before the collapse wiring has applied classes,
        // so consult the persisted flag too rather than trusting call order.
        try {
          if (target === 'arail' && sessionStorage.getItem('arail-collapsed') === '1') closed = true;
        } catch (e2) {}
        if (saved && !closed) { el.style.flexBasis = saved + 'px'; el.style.width = saved + 'px'; }
      } catch (e) {}

      var dragging = false, startX = 0, startW = 0;
      rz.addEventListener('pointerdown', function (e) {
        dragging = true; startX = e.clientX;
        startW = el.getBoundingClientRect().width;
        el.style.transition = 'none';
        rz.classList.add('dragging');
        document.body.classList.add('resizing');
        try { rz.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });
      rz.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var dx = e.clientX - startX;
        var w = fromRight ? startW - dx : startW + dx;
        w = Math.max(40, Math.min(620, w));
        el.style.flexBasis = w + 'px';
        el.style.width = w + 'px';
      });
      function end() {
        if (!dragging) return;
        dragging = false;
        el.style.transition = '';
        rz.classList.remove('dragging');
        document.body.classList.remove('resizing');
        try {
          sessionStorage.setItem(key, String(Math.round(el.getBoundingClientRect().width)));
        } catch (e) {}
      }
      rz.addEventListener('pointerup', end);
      rz.addEventListener('pointercancel', end);
      rz.addEventListener('dblclick', function () {
        el.style.flexBasis = ''; el.style.width = '';
        try { sessionStorage.removeItem(key); } catch (e) {}
      });
    });
  }

  function renderState(state) {
    renderDrawer(state);
    renderGraph(state);
  }

  function fetchInitialDrawer() {
    fetch('/state/decisions.json')
      .then(function (r) { return r.json(); })
      .then(renderState)
      .catch(function () { renderState({ decisions: [], parked: [] }); });
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
      // Drawer starts COLLAPSED by default — the graph rail carries orientation
      // now, and the drawer is reserved for future uses. '0' means the user
      // explicitly opened it this session.
      try {
        applyDrawerState(sessionStorage.getItem('drawer-collapsed') !== '0');
      } catch (e) { applyDrawerState(true); }
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
  function setupAllControls() {
    setupDrawerControls();
    wireRailModes();
    wireGraphClicks();
    wireAgent();
    wireRailCollapse();
    wireResizers();
    wireLayerControls();
    wireViewMode();
    wireItemCollapse();
    wirePanelCollapse();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAllControls);
  } else {
    setupAllControls();
  }

  connect();
  fetchInitialDrawer();
})();
