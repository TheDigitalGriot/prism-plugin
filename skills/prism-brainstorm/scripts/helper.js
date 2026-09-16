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
      } else if (data.type === 'workgraph-update') {
        renderWorkgraphState(data.payload);
      }
    };

    ws.onclose = () => {
      setTimeout(connect, 1000);
    };
  }

  // ---------- Drawer rendering (Phase C â€” decisions + parking lot) ----------
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
  // un-numbered ids (standing decisions like "DÂ·slices") keep their relative
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
          var choice = d.choice ? ' Â· <strong>' + escapeHtml(d.choice) + '</strong>' : '';
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
              (p.resolution ? ' â€” ' + escapeHtml(p.resolution) : '') + '</span>'
            : (p.revisit ? '<span class="revisit">revisit: ' + escapeHtml(p.revisit) + '</span>' : '');
          return '<li class="parked-item' + (merged ? ' merged' : '') + '">' +
                 '<span class="q">' + (merged ? 'â†µ ' : 'from ') + fromQ + '</span>' +
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
  function renderGraph(state, wgState) {
    var host = document.getElementById('qrail-graph');
    if (!host) return;

    var decisions = (state && Array.isArray(state.decisions)) ? state.decisions : [];
    var parked = (state && Array.isArray(state.parked)) ? state.parked : [];
    var current = (state && state.current) ? String(state.current) : '';
    var upcoming = (state && Array.isArray(state.upcoming)) ? state.upcoming : [];
    // viz-companion-fusion Step 4 â€” the WORKGRAPH channel, read alongside decisions.json.
    // Decisions stay their own view (never merged into wgNodes); this is a second source
    // the same render pass folds in, per Decision 2 ("both halves land in this run").
    var wgNodes = (wgState && Array.isArray(wgState.nodes)) ? wgState.nodes.slice() : [];
    wgNodes.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });

    if (!decisions.length && !parked.length && !current && !upcoming.length && !wgNodes.length) {
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

    // LAYERS â€” every layer collapses and filters independently. Spine order is
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
    // 'local' â€” viz-companion-fusion root-cause fix. dirOf() below always returned a value
    // (including the literal string 'local'), but this object never had that key, so
    // `if (D[dk]) D[dk].push(...)` silently dropped every flat/undirected item. A workgraph
    // node with no destination/source/maps â€” the common case for a harvested component that
    // hasn't been routed anywhere yet â€” is exactly what this was eating.
    var D = { outbound: [], inbound: [], adjacent: [], local: [] };
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

    // WORKGRAPH channel nodes \u2014 harvested components / the session genesis marker. State
    // decides the LAYERS lane (same rule as decisions/parked above); direction (usually none,
    // hence 'local') decides the WORKGRAPH lane via the same dirOf()/badge() this file already
    // uses for decisions, so the two channels share one bucketing rule rather than growing a
    // second one.
    function wgRow(n) {
      var label = n.label || n.id || '';
      var text = (n.layer ? n.layer + ' \u00b7 ' : '') + label;
      var scr = n.screen ? ' data-screen="' + escapeHtml(n.screen) + '"' : '';
      var noscr = scr ? '' : ' no-screen';
      var bucket = n.supersededBy ? 'superseded' : (n.state || 'open');
      return '<div class="qg-row wg ' + bucket + noscr + '" data-q="' + escapeHtml(n.id || '') + '"' + scr +
             ' title="' + escapeHtml(n.summary || label) + (scr ? '' : ' \u2014 not rendered yet') + '">' +
             '<span class="qg-dot"></span><span class="qg-txt">' + escapeHtml(text) + '</span>' +
             badge(n) + '</div>';
    }
    wgNodes.forEach(function (n) {
      var bucket = n.supersededBy ? 'superseded' : (n.state || 'open');
      fileIt(bucket, n, wgRow(n));
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
      open:       glyph('<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>'),
      /* circle - undirected, lives here and nowhere else (viz-companion-fusion root-cause fix) */
      local:      glyph('<circle cx="12" cy="12" r="9"/>')
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
      { key: 'adjacent',   label: 'Adjacent',   icon: LAYER_ICONS.adjacent },
      { key: 'local',      label: 'Local',      icon: LAYER_ICONS.local }
    ];
    var LAYERS = STATE_LAYERS.concat(DIR_LAYERS);   // filter chips still see all 8

    var html = '';
    // the live node is never grouped and never filtered away
    if (current) {
      html += '<div class="qg-spine now-wrap">' +
              row('now', current, current, 'you are here', { screen: state.currentScreen || null }) +
              '</div>';
    }

    // â”€â”€ TIMELINE MODE â€” the original chronological spine. Same records, read
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
      // line â€” scan Q1, Q2, Q3 without the sub-threads in the way.
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
      // Genesis-first: TIMELINE is a time axis (Decision 7), so the WORKGRAPH channel's own
      // records \u2014 sorted by `at` above \u2014 lead the spine. They are a separate source from the
      // decision spine below (no shared ordering key exists between the two channels yet), so
      // this renders as a leading block rather than an interleaved merge \u2014 an honest
      // simplification, not a silent one. Later entries APPEND here; nothing already rendered
      // is ever replaced.
      wgNodes.forEach(function (n) { seq.push(wgRow(n)); });
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
      // Empty layers still render. "Parked 0" is information â€” it says nothing
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
  // Posts to /api/chat, which shells out to the local `claude` CLI â€” the same
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
      var pending = add('think', 'thinkingâ€¦');
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
        atab.innerHTML = collapsed ? AGENT_TAB_BOT : 'â–¶';
        atab.title = collapsed ? 'Show agent' : 'Hide agent';
        try { sessionStorage.setItem('arail-collapsed', collapsed ? '1' : '0'); } catch (e) {}
      }
      atab.addEventListener('click', function () {
        applyAgent(!arail.classList.contains('collapsed'));
      });
      // agent starts collapsed â€” the graph is the always-on state
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

  // Two independent channels, one render pass. Each is cached so a change on either side
  // (a decision confirmed, a node harvested) re-renders qrail-graph with BOTH â€” decisions.json
  // and workgraph.json are on separate watchers/timers in server.cjs and never arrive together.
  var lastDecisionsState = { decisions: [], parked: [] };
  var lastWorkgraphState = { nodes: [], edges: [] };

  function renderState(state) {
    lastDecisionsState = state || lastDecisionsState;
    renderDrawer(lastDecisionsState);
    renderGraph(lastDecisionsState, lastWorkgraphState);
  }

  function renderWorkgraphState(wgState) {
    lastWorkgraphState = wgState || lastWorkgraphState;
    renderGraph(lastDecisionsState, lastWorkgraphState);
    if (typeof hubRefresh === 'function') hubRefresh();
  }

  function fetchInitialDrawer() {
    fetch('/state/decisions.json')
      .then(function (r) { return r.json(); })
      .then(renderState)
      .catch(function () { renderState({ decisions: [], parked: [] }); });
    // viz-companion-fusion Step 4 â€” seeded independently of decisions.json (server.cjs's GET
    // route defaults to a genesis-only payload rather than 404ing), so this always resolves.
    fetch('/state/workgraph.json')
      .then(function (r) { return r.json(); })
      .then(renderWorkgraphState)
      .catch(function () { renderWorkgraphState({ nodes: [], edges: [] }); });
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
        indicator.innerHTML = '<span class="selected-text">' + label + ' selected</span> â€” return to terminal to continue';
      } else {
        indicator.innerHTML = '<span class="selected-text">' + selected.length + ' selected</span> â€” return to terminal to continue';
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
      // Drawer starts COLLAPSED by default â€” the graph rail carries orientation
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

  // ===== PANEL SYSTEM Â· workflow registry + transients (additive Â· 2026-09-15) =====
  // A workflow REGISTERS a surface into a zone the frame already owns instead of
  // arriving as its own app. The map is declarative (#ps-registry in the frame
  // template); this runtime only reads it, so adding a workflow is one entry and never
  // a layout edit. Inert when the page carries no registry (bare full-document screens
  // get helper.js too). Contract: .prism/shared/plans/2026-09-15-brainstorm-panel-system-CONTEXT.md
  // Doc: skills/prism-brainstorm/references/panel-system.md
  var ps = {
    zones: {},       // zone key -> { label, kind, el, resident?, tabsAfter?, chrome? }
    workflows: {},   // workflow id -> normalized registry entry
    order: [],       // registration order (palette order)
    requested: {},   // workflow id -> zone the user asked for (promotion is recomputed from it)
    placement: {},   // workflow id -> zone it occupies, only while AWAY from home / mounted
    active: {},      // zone key -> occupant on top ('@resident' = the zone's own content)
    hosts: {},       // workflow id -> host element
    borrowed: {},    // workflow id -> [{ node, marker }] native nodes lent to a host
    promoted: {},    // workflow id -> why it was promoted
    renderers: {},   // workflow id -> fn(hostEl, channelJson, entry) - the seam a renderer plugs into
    stack: [],       // open transients, most recent last
    lastFocus: {},   // transient key -> element focused before it opened
    inspectNode: null,
    ready: false
  };

  // --- registry ------------------------------------------------------------
  function psNormalize(entry) {
    var why = null;
    if (!entry || typeof entry !== 'object') why = 'not an object';
    else if (!entry.id || typeof entry.id !== 'string') why = 'missing id';
    else if (!entry.label) why = 'missing label';
    else if (!Array.isArray(entry.zones) || !entry.zones.length) why = 'zones must be a non-empty array';
    else if (entry.zones.some(function (z) { return !ps.zones[z]; })) why = 'zones names a zone this frame does not own';
    else if (entry.defaultZone && entry.zones.indexOf(entry.defaultZone) === -1) why = 'defaultZone is not in zones';
    else if (Array.isArray(entry.native) && entry.native.length &&
             ps.zones[entry.defaultZone || entry.zones[0]].kind !== 'zone') why = 'a native workflow must default to a permanent zone (its home)';
    if (why) { console.warn('[panel-system] skipped registry entry', entry && entry.id, '-', why); return null; }
    return {
      id: entry.id,
      label: String(entry.label),
      zones: entry.zones.slice(),
      defaultZone: entry.defaultZone || entry.zones[0],
      minWidth: Math.max(0, Number(entry.minWidth) || 0),
      channel: entry.channel || null,
      vocabulary: entry.vocabulary || null,
      icon: entry.icon || 'â—‹',
      shortcut: entry.shortcut ? String(entry.shortcut).toLowerCase() : null,
      native: Array.isArray(entry.native) ? entry.native.slice() : [],
      screen: entry.screen || null,
      summary: entry.summary || ''
    };
  }

  function psRegister(entry) {
    var e = psNormalize(entry);
    if (!e) return false;
    if (ps.workflows[e.id]) { console.warn('[panel-system] duplicate workflow id', e.id, '- first registration kept'); return false; }
    ps.workflows[e.id] = e;
    ps.order.push(e.id);
    if (ps.ready) psRenderPalette();
    return true;
  }

  function psReadRegistry() {
    var el = document.getElementById('ps-registry');
    if (!el) return false;
    var reg;
    try { reg = JSON.parse(el.textContent); } catch (err) {
      console.warn('[panel-system] #ps-registry is not valid JSON - the panel system stays inert', err);
      return false;
    }
    ps.zones = reg.zones || {};
    (reg.workflows || []).forEach(psRegister);
    return true;
  }

  // --- transients: slide-over Â· sheet Â· inspector Â· palette -------------------
  function psZoneEl(key) {
    if (key === 'palette') return document.getElementById('ps-palette');
    var z = ps.zones[key];
    return z && z.el ? document.querySelector(z.el) : null;
  }
  function psIsTransient(key) { return key === 'palette' || !!(ps.zones[key] && ps.zones[key].kind === 'transient'); }
  function psIsOpen(key) { var el = psZoneEl(key); return !!el && el.getAttribute('data-open') === 'true'; }
  function psIsModal(key) { return key === 'palette' || key === 'slide-over'; }
  function psMs(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }

  // Measured frame offsets -> CSS variables on the layer, so a transient sits exactly over
  // the stage or beside the drawer. Offsets only: every SIZE still comes from clamp().
  function psMeasure() {
    var layer = document.getElementById('ps-layer');
    if (!layer) return;
    var W = window.innerWidth, H = window.innerHeight;
    var header = document.querySelector('.header');
    var bar = document.querySelector('.indicator-bar');
    var main = document.querySelector('.main');
    var drawer = document.getElementById('brainstorm-drawer');
    var m = main ? main.getBoundingClientRect() : { left: 0, right: W, width: W };
    var set = function (k, v) { layer.style.setProperty(k, Math.max(0, Math.round(v)) + 'px'); };
    set('--ps-top', header ? header.getBoundingClientRect().bottom : 0);
    set('--ps-bottom', bar ? H - bar.getBoundingClientRect().top : 0);
    set('--ps-stage-l', m.left);
    set('--ps-stage-r', W - m.right);
    set('--ps-stage-w', m.width);
    set('--ps-drawer-w', W - (drawer ? drawer.getBoundingClientRect().left : m.right));
  }

  // The transients live outside #claude-content, so a screen's data-fidelity does not
  // cascade to them. Mirror it onto the layer: every overlay reads the same --fidelity-*
  // values as the screen it sits over.
  function psSyncFidelity() {
    var layer = document.getElementById('ps-layer');
    if (!layer) return;
    var src = document.querySelector('#claude-content [data-fidelity]') ||
              document.querySelector('body[data-fidelity], html[data-fidelity]');
    var f = src ? src.getAttribute('data-fidelity') : 'hi';
    if (['lo', 'mid', 'hi'].indexOf(f) === -1) f = 'hi';
    if (layer.getAttribute('data-fidelity') !== f) layer.setAttribute('data-fidelity', f);
  }

  function psFocusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll('button, [href], input, textarea, select, [tabindex]'),
      // tabindex=-1 (inactive tabs, palette zone chips) is not a Tab stop - counting it would
      // let the browser tab straight out of the trap
      function (n) { return !n.disabled && n.tabIndex >= 0 && !n.closest('[hidden]') && n.getClientRects().length > 0; });
  }

  function psOpen(key) {
    var el = psZoneEl(key);
    if (!el) return;
    psMeasure();
    psSyncFidelity();
    var wasOpen = psIsOpen(key);
    if (!wasOpen) {
      var prev = document.activeElement;
      ps.lastFocus[key] = (prev && prev !== document.body && !el.contains(prev)) ? prev : null;
      el.removeAttribute('inert');
      el.setAttribute('aria-hidden', 'false');
      el.setAttribute('data-open', 'true');
    }
    ps.stack = ps.stack.filter(function (k) { return k !== key; }).concat(key);
    psSyncScrim();
    if (wasOpen && key !== 'palette') return;
    requestAnimationFrame(function () {
      if (!psIsOpen(key)) return;
      var want = key === 'palette' ? document.getElementById('ps-q') : el;
      if (want) { try { want.focus({ preventScroll: true }); } catch (err) {} }
    });
  }

  function psClose(key, opts) {
    opts = opts || {};
    var el = psZoneEl(key);
    if (!el || !psIsOpen(key)) return;
    var hadFocus = el.contains(document.activeElement) || document.activeElement === document.body;
    el.setAttribute('data-open', 'false');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('inert', '');
    ps.stack = ps.stack.filter(function (k) { return k !== key; });
    psSyncScrim();
    var back = ps.lastFocus[key];
    ps.lastFocus[key] = null;
    if (hadFocus) {
      var to = (back && document.contains(back)) ? back : (ps.stack.length ? psZoneEl(ps.stack[ps.stack.length - 1]) : null);
      if (to) { try { to.focus({ preventScroll: true }); } catch (err) {} }
    }
    if (key === 'palette' || opts.keepOccupants) return;
    // Dismiss sends the transient's workflows home - AFTER the exit motion, so the
    // content never vanishes before the surface does.
    setTimeout(function () {
      if (psIsOpen(key)) return;
      psOccupantIds(key).forEach(function (id) { if (id !== '@resident') psSendHome(id); });
      if (key === 'inspector' && ps.inspectNode != null) { ps.inspectNode = null; psRenderNode(); psRenderZone('inspector'); }
    }, psMs('--ps-dur-song', 320) + 30);
  }

  function psSyncScrim() {
    var s = document.getElementById('ps-scrim');
    if (s) s.setAttribute('data-open', ps.stack.some(psIsModal) ? 'true' : 'false');
  }

  function psOwnerOf(node) {
    if (!node) return null;
    for (var i = ps.stack.length - 1; i >= 0; i--) {
      var el = psZoneEl(ps.stack[i]);
      if (el && el.contains(node)) return ps.stack[i];
    }
    return null;
  }

  function psToast(msg) {
    var t = document.getElementById('ps-toast');
    if (!t) return;
    t.textContent = msg;
    t.setAttribute('data-open', 'true');
    clearTimeout(psToast.timer);
    psToast.timer = setTimeout(function () { t.setAttribute('data-open', 'false'); }, 3600);
  }

  function psEmpty(el, title, detail) {
    el.innerHTML = '<div class="ps-empty"><b>' + escapeHtml(title) + '</b><span>' + escapeHtml(detail) + '</span></div>';
  }

  function psEnter(el) {
    el.classList.remove('ps-enter');
    void el.offsetWidth;
    el.classList.add('ps-enter');
    setTimeout(function () { el.classList.remove('ps-enter'); }, psMs('--ps-dur-tale', 220) + 60);
  }

  // resize handles - the split persists for the session (sessionStorage, like railw-*)
  var PS_SIZE_VAR = { 'slide-over': '--ps-slide-w', 'sheet': '--ps-sheet-h', 'inspector': '--ps-inspector-w',
                      'ceremony': '--ps-ceremony-h' };
  function psApplySize(key, px) {
    var layer = document.getElementById('ps-layer');
    if (!layer) return;
    if (px == null) layer.style.removeProperty(PS_SIZE_VAR[key]);
    else { px = Math.max(0, Math.round(px)); layer.style.setProperty(PS_SIZE_VAR[key], px + 'px'); }
    try {
      if (px == null) sessionStorage.removeItem('ps-size-' + key);
      else sessionStorage.setItem('ps-size-' + key, String(px));
    } catch (err) {}
  }

  function psWireHandles() {
    Object.keys(PS_SIZE_VAR).forEach(function (key) {
      var el = psZoneEl(key), h = el && el.querySelector(':scope > .ps-handle');
      if (!h) return;
      var saved = null;
      try { saved = sessionStorage.getItem('ps-size-' + key); } catch (err) {}
      if (saved) psApplySize(key, Number(saved));
      // ceremony is anchored TOP, so it grows DOWNWARD from its bottom edge - the sheet's
      // mirror image. Every other transient still measures exactly as it did.
      var vertical = key === 'sheet' || key === 'ceremony', topAnchored = key === 'ceremony', dragging = false;
      var sizeAt = function (x, y) {
        var r = el.getBoundingClientRect();
        return vertical ? (topAnchored ? y - r.top : r.bottom - y) : r.right - x;
      };
      var stop = function () {
        if (!dragging) return;
        dragging = false;
        h.classList.remove('dragging');
        el.classList.remove('ps-resizing');
        psEnforceMinWidths();
      };
      h.addEventListener('pointerdown', function (e) {
        dragging = true;
        h.classList.add('dragging');
        el.classList.add('ps-resizing');
        try { h.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });
      h.addEventListener('pointermove', function (e) { if (dragging) psApplySize(key, sizeAt(e.clientX, e.clientY)); });
      h.addEventListener('pointerup', stop);
      h.addEventListener('pointercancel', stop);
      h.addEventListener('dblclick', function () { psApplySize(key, null); psEnforceMinWidths(); });
      h.addEventListener('keydown', function (e) {
        var r = el.getBoundingClientRect(), cur = vertical ? r.height : r.width, step = e.shiftKey ? 96 : 24;
        var k = (e.key || '').toLowerCase();
        var growKey   = vertical ? (topAnchored ? 'arrowdown' : 'arrowup')   : 'arrowleft';
        var shrinkKey = vertical ? (topAnchored ? 'arrowup'   : 'arrowdown') : 'arrowright';
        if (k === growKey) psApplySize(key, cur + step);
        else if (k === shrinkKey) psApplySize(key, cur - step);
        else if (k === 'home') psApplySize(key, null);
        else return;
        e.preventDefault();
        psEnforceMinWidths();
      });
    });
  }

  // keyboard - Ctrl/Cmd+K opens the palette Â· Esc dismisses the transient that holds focus
  // (else the top modal) Â· Tab is trapped inside the transient that holds focus, and pulled
  // into a modal one Â· tab strips take arrow keys Â· each workflow's own shortcut toggles it
  var PS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || '');
  function psOnKeydown(e) {
    if (!ps.ready || e.defaultPrevented) return;
    var k = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && k === 'k') {
      e.preventDefault();
      if (psIsOpen('palette')) psClose('palette'); else psOpenPalette();
      return;
    }
    if (k === 'escape') {
      var target = psOwnerOf(document.activeElement);
      for (var i = ps.stack.length - 1; !target && i >= 0; i--) { if (psIsModal(ps.stack[i])) target = ps.stack[i]; }
      if (target) { e.preventDefault(); psClose(target); }
      return;
    }
    if (k === 'tab') {
      var trap = psOwnerOf(document.activeElement), top = ps.stack[ps.stack.length - 1];
      if (!trap && top && psIsModal(top)) trap = top;
      if (!trap) return;
      var box = psZoneEl(trap), f = psFocusables(box);
      if (!f.length) { e.preventDefault(); box.focus(); return; }
      var at = f.indexOf(document.activeElement);
      if (e.shiftKey && at <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (at === -1 || at === f.length - 1)) { e.preventDefault(); f[0].focus(); }
      return;
    }
    var tab = e.target && e.target.closest ? e.target.closest('.ps-tab') : null;
    if (tab && (k === 'arrowleft' || k === 'arrowright' || k === 'home' || k === 'end')) {
      var all = Array.prototype.slice.call(tab.parentNode.querySelectorAll('.ps-tab'));
      var idx = all.indexOf(tab);
      var next = k === 'home' ? 0 : k === 'end' ? all.length - 1 : (idx + (k === 'arrowright' ? 1 : -1) + all.length) % all.length;
      e.preventDefault();
      psActivateTab(all[next], true);
      return;
    }
    for (var n = 0; n < ps.order.length; n++) {
      var w = ps.workflows[ps.order[n]];
      if (w.shortcut && psMatchShortcut(e, w.shortcut)) { e.preventDefault(); psToggle(w.id); return; }
    }
  }

  function psMatchShortcut(e, spec) {
    var parts = spec.split('+'), key = parts.pop();
    var want = { ctrl: false, alt: false, shift: false, meta: false };
    parts.forEach(function (p) { if (p === 'mod') want[PS_MAC ? 'meta' : 'ctrl'] = true; else if (p in want) want[p] = true; });
    if (e.ctrlKey !== want.ctrl || e.altKey !== want.alt || e.shiftKey !== want.shift || e.metaKey !== want.meta) return false;
    if (/^[a-z]$/.test(key)) return e.code === 'Key' + key.toUpperCase();
    if (/^[0-9]$/.test(key)) return e.code === 'Digit' + key;
    return (e.key || '').toLowerCase() === key;
  }

  function psShortcutLabel(spec) {
    var names = { ctrl: 'Ctrl', alt: PS_MAC ? 'Opt' : 'Alt', shift: 'Shift', meta: 'Cmd', mod: PS_MAC ? 'Cmd' : 'Ctrl' };
    return spec.split('+').map(function (p) { return names[p] || p.toUpperCase(); }).join(' ');
  }

  // inspector - node detail on shift-click, or on any node click while it is already open.
  // A plain click keeps doing exactly what it always did (load the node's screen).
  function psInspect(nodeId) {
    if (nodeId == null || nodeId === '') return;
    ps.inspectNode = String(nodeId);
    psRenderNode();
    ps.active.inspector = '@resident';
    psRenderZone('inspector');
    psOpen('inspector');
  }

  function psRenderNode() {
    var box = document.getElementById('ps-node');
    if (!box) return;
    var id = ps.inspectNode;
    if (id == null) { box.innerHTML = ''; return; }
    var wg = lastWorkgraphState || {}, ds = lastDecisionsState || {};
    // Resolve every source renderGraph draws a row from: workgraph nodes, decisions, parked
    // splinters (data-q = fromQ), upcoming questions, and the live `current` question.
    var node = (wg.nodes || []).filter(function (n) { return n && String(n.id) === id; })[0] || null;
    var dec = (ds.decisions || []).filter(function (d) { return d && String(d.q) === id; })[0] || null;
    var parkedItems = (ds.parked || []).filter(function (p) { return p && String(p.fromQ) === id; });
    var parked = parkedItems.length;
    var up = (ds.upcoming || []).filter(function (u) { return u && String(typeof u === 'string' ? u : u.q) === id; })[0] || null;
    var isCurrent = ds.current != null && String(ds.current) === id;
    if (!node && !dec && !parked && !up && !isCurrent) {
      psEmpty(box, 'Node ' + id, 'Not in workgraph.json or decisions.json yet - it fills in the moment a channel writes it.');
      return;
    }
    if (!node && !dec) {
      var pk = parkedItems[0] || {}, uo = (up && typeof up === 'object') ? up : {};
      node = {
        state: isCurrent ? 'current' : (parked ? (pk.resolvedAt ? 'resolved' : 'parked') : 'open'),
        label: uo.label || pk.label || (isCurrent ? 'the live question' : ''),
        summary: pk.concern || (isCurrent || up ? 'not answered yet' : ''),
        screen: isCurrent ? ds.currentScreen : uo.screen,
        destination: pk.destination || uo.destination,
        source: pk.source || uo.source
      };
      if (pk.revisit) node.revisit = pk.revisit;
      if (pk.resolvedAt) node.resolvedAt = pk.resolvedAt;
      var synthetic = true;
    }
    var n = node || {}, rows = [];
    var add = function (k, v) {
      if (v === undefined || v === null || v === '') return;
      rows.push('<dt>' + escapeHtml(k) + '</dt><dd>' + escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v)) + '</dd>');
    };
    add('state', node ? (n.supersededBy ? 'superseded' : (n.state || 'open')) : null);
    add('layer', n.layer);
    add('question', n.q || (dec && dec.q));
    add('choice', dec && dec.choice);
    add('summary', n.summary || (dec && dec.summary));
    add('screen', n.screen);
    add('destination', n.destination);
    add('source', n.source);
    add('maps', n.maps);
    add('at', n.at);
    add('superseded by', n.supersededBy);
    add('revisit', n.revisit);
    add('resolved at', n.resolvedAt);
    if (node && !synthetic) {
      var edges = wg.edges || [];
      var ins = edges.filter(function (e) { return e && e.toNode === id; }).length;
      var outs = edges.filter(function (e) { return e && e.fromNode === id; }).length;
      add('edges', ins + ' in Â· ' + outs + ' out');
    }
    if (parked) add('parked from here', parked);
    box.innerHTML = '<div class="ps-node-head"><span class="ps-node-id">' + escapeHtml(id) + '</span>' +
      '<h3>' + escapeHtml(n.label || (dec && dec.label) || id) + '</h3></div>' +
      '<dl class="ps-dl">' + rows.join('') + '</dl>';
  }

  // --- placement: occupants, tabs, promotion, vacancy -------------------------
  function psHome(id) { var w = ps.workflows[id]; return w && w.native.length ? w.defaultZone : null; }
  function psWhere(id) { return ps.placement[id] || psHome(id); }

  function psOccupantIds(key) {
    var z = ps.zones[key] || {}, ids = [];
    if (z.resident && (key !== 'inspector' || ps.inspectNode != null)) ids.push('@resident');
    ps.order.forEach(function (id) { if (psWhere(id) === key) ids.push(id); });
    return ids;
  }

  function psResidentId(key) {
    var z = ps.zones[key] || {};
    if (z.resident) return '@resident';
    for (var i = 0; i < ps.order.length; i++) { if (psHome(ps.order[i]) === key) return ps.order[i]; }
    return null;
  }

  // The zone's OWN nodes: a native workflow's selectors while it is home, or everything the
  // zone holds that the panel system did not add.
  function psResidentNodes(key) {
    var el = psZoneEl(key), z = ps.zones[key] || {}, rid = psResidentId(key);
    if (!el || !rid) return [];
    if (rid === '@resident') {
      if (z.kind === 'transient') return Array.prototype.slice.call(el.querySelectorAll(':scope > .ps-body > .ps-resident'));
      return Array.prototype.filter.call(el.children, function (c) {
        return !c.classList.contains('ps-tabs') && !c.classList.contains('ps-host');
      });
    }
    if (ps.placement[rid]) return [];
    return ps.workflows[rid].native.map(function (s) { return el.querySelector(s); }).filter(Boolean);
  }

  // Width a zone can give right now. A vacated zone is measured as if it were back
  // (transitions off for the probe, so nothing flickers). A closed transient keeps its
  // layout under visibility:hidden, so it measures true.
  function psAvailable(key) {
    if (key === 'slide-over') return Infinity;
    var el = psZoneEl(key);
    if (!el) return 0;
    if (!psIsTransient(key) && el.classList.contains('ps-vacant')) {
      el.classList.add('ps-measuring');
      el.classList.remove('ps-vacant');
      var w = el.getBoundingClientRect().width;
      el.classList.add('ps-vacant');
      void el.offsetWidth;
      el.classList.remove('ps-measuring');
      return w;
    }
    return el.getBoundingClientRect().width;
  }

  function psDetach(id) {
    (ps.borrowed[id] || []).forEach(function (b) {
      if (b.marker.parentNode) {
        b.marker.parentNode.insertBefore(b.node, b.marker);
        b.marker.parentNode.removeChild(b.marker);
      }
    });
    ps.borrowed[id] = [];
    var host = ps.hosts[id];
    if (host && host.parentNode) host.parentNode.removeChild(host);
  }

  function psAttach(id, key) {
    var w = ps.workflows[id], zoneEl = psZoneEl(key);
    if (!w || !zoneEl) return;
    var host = ps.hosts[id];
    if (!host) {
      host = document.createElement('div');
      host.className = 'ps-host';
      host.id = 'ps-host-' + id;
      host.setAttribute('role', 'tabpanel');
      host.setAttribute('data-ps-workflow', id);
      ps.hosts[id] = host;
    }
    host.hidden = false;
    host.innerHTML = '';
    (psIsTransient(key) ? zoneEl.querySelector(':scope > .ps-body') : zoneEl).appendChild(host);
    ps.borrowed[id] = ps.borrowed[id] || [];
    if (w.native.length) {
      // MOVE the one live surface - never render a second copy of it at another fidelity.
      var homeEl = psZoneEl(w.defaultZone);
      var wrap = document.createElement('div');
      wrap.className = 'ps-borrow ' + ((homeEl && homeEl.classList[0]) || '');
      host.appendChild(wrap);
      w.native.forEach(function (sel) {
        var node = (homeEl && homeEl.querySelector(sel)) || document.querySelector(sel);
        if (!node || host.contains(node)) return;
        var marker = document.createComment(' ps-home:' + id + ' ');
        node.parentNode.insertBefore(marker, node);
        node.classList.remove('ps-stowed');
        wrap.appendChild(node);
        ps.borrowed[id].push({ node: node, marker: marker });
      });
      if (!ps.borrowed[id].length) {
        psEmpty(host, w.label + ' Â· not in this frame', 'None of its native nodes (' + w.native.join(', ') + ') exist on this page.');
      }
    } else if (w.screen) {
      psEmpty(host, w.label, 'Loading ' + w.screen + 'â€¦');
      fetch('/files/' + encodeURIComponent(w.screen), { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (html) { if (ps.hosts[id] === host && host.parentNode) host.innerHTML = html; })
        .catch(function (err) { if (ps.hosts[id] === host) psEmpty(host, w.label + ' Â· screen not served', w.screen + ' â†’ ' + err.message); });
    } else {
      psProbe(w, host);
    }
    psEnter(host);
  }

  // A mounted workflow with no renderer reads its channel and NAMES what it found. A
  // renderer registered through brainstorm.panels.renderer(id, fn) takes the host instead -
  // that is the seam a lane primitive plugs into; this stage deliberately ships none.
  function psProbe(w, host) {
    if (!w.channel) { psEmpty(host, w.label + ' Â· no channel', 'This entry declares no channel, and no renderer is mounted.'); return; }
    psEmpty(host, w.label, 'Reading ' + w.channel + 'â€¦');
    fetch(w.channel, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        if (ps.hosts[w.id] !== host || !host.parentNode) return;
        var fn = ps.renderers[w.id];
        if (fn) {
          host.innerHTML = '';
          try { fn(host, data, w); } catch (err) { psEmpty(host, w.label + ' Â· renderer failed', String((err && err.message) || err)); }
          return;
        }
        var c = psCounts(w, data);
        host.innerHTML = '<div class="ps-empty"><b>' + escapeHtml(w.label) + (c.total ? ' Â· no renderer mounted' : ' Â· nothing yet') + '</b>' +
          '<span>' + escapeHtml(w.channel) + ' Â· ' + c.total + ' record' + (c.total === 1 ? '' : 's') + '</span>' +
          (c.lanes.length ? '<span class="ps-counts">' + c.lanes.map(function (l) {
            return '<i>' + escapeHtml(l.name) + ' <b>' + l.n + '</b></i>';
          }).join('') + '</span>' : '') +
          (w.summary ? '<span>' + escapeHtml(w.summary) + '</span>' : '') + '</div>';
      })
      .catch(function (err) {
        if (ps.hosts[w.id] !== host) return;
        psEmpty(host, w.label + ' Â· channel not served here',
          w.channel + ' â†’ ' + err.message + '. The entry is registered; this companion does not serve that channel.');
      });
  }

  function psCounts(w, data) {
    var v = w.vocabulary || {}, lanes = [], total = 0;
    if (v.collection === '@keys') {
      (v.lanes || []).forEach(function (name) {
        var n = data && Array.isArray(data[name]) ? data[name].length : 0;
        total += n;
        lanes.push({ name: name, n: n });
      });
      return { total: total, lanes: lanes };
    }
    var arr = data && v.collection && Array.isArray(data[v.collection]) ? data[v.collection] : (Array.isArray(data) ? data : []);
    if (v.field) {
      (v.lanes || []).forEach(function (name) {
        lanes.push({ name: name, n: arr.filter(function (x) { return x && x[v.field] === name; }).length });
      });
    }
    return { total: arr.length, lanes: lanes };
  }

  function psRenderZone(key) {
    var z = ps.zones[key], el = psZoneEl(key);
    if (!z || !el) return;
    var ids = psOccupantIds(key);
    if (ids.indexOf(ps.active[key]) === -1) ps.active[key] = ids.length ? ids[ids.length - 1] : null;
    var act = ps.active[key], transient = z.kind === 'transient';

    // TWO OCCUPANTS BECOME TABS - never two half-height boxes. One occupant: no strip at all.
    var tabs = el.querySelector(transient ? ':scope > .ps-tabs' : ':scope > .ps-zone-tabs');
    if (ids.length > 1) {
      if (!tabs) {
        tabs = document.createElement('div');
        tabs.className = 'ps-tabs ps-zone-tabs';
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Workflows in the ' + z.label);
        var after = z.tabsAfter ? el.querySelector(':scope > ' + z.tabsAfter) : null;
        el.insertBefore(tabs, after ? after.nextSibling : el.firstChild);
      }
      tabs.innerHTML = ids.map(function (id) {
        var w = ps.workflows[id], on = id === act;
        return '<button class="ps-tab" type="button" role="tab" data-ps-zone="' + escapeHtml(key) + '" data-ps-tab="' + escapeHtml(id) + '"' +
          ' aria-selected="' + on + '" tabindex="' + (on ? '0' : '-1') + '"' +
          (w && ps.placement[id] ? ' aria-controls="ps-host-' + escapeHtml(id) + '"' : '') + '>' +
          '<span class="ps-ico" aria-hidden="true">' + escapeHtml(w ? w.icon : 'â–¡') + '</span>' +
          escapeHtml(w ? w.label : z.resident) + '</button>';
      }).join('');
    } else if (tabs) {
      if (transient) tabs.innerHTML = ''; else tabs.parentNode.removeChild(tabs);
    }

    var rid = psResidentId(key);
    psResidentNodes(key).forEach(function (node) {
      // stowed only while ANOTHER occupant is on top - an empty zone stows nothing
      var stow = act != null && act !== rid;
      if (node.classList.contains('ps-stowed') !== stow) {
        node.classList.toggle('ps-stowed', stow);
        if (!stow) psEnter(node);
      }
    });
    ids.forEach(function (id) {
      var h = ps.hosts[id];
      if (!h || !ps.placement[id]) return;
      var show = id === act;
      if (h.hidden === show) { h.hidden = !show; if (show) psEnter(h); }
    });

    if (transient) {
      var empty = el.querySelector(':scope > .ps-body > .ps-empty');
      if (empty) empty.hidden = ids.length > 0;
      var aw = act ? ps.workflows[act] : null;
      var title = el.querySelector(':scope > .ps-head .ps-title');
      if (title) title.textContent = aw ? aw.label : (act === '@resident' ? z.label + ' Â· ' + z.resident : z.label);
      var note = el.querySelector(':scope > .ps-head .ps-note');
      if (note) note.textContent = (aw && ps.promoted[act]) || '';
      var floor = 0;
      ids.forEach(function (id) { if (ps.workflows[id]) floor = Math.max(floor, ps.workflows[id].minWidth); });
      if (floor) el.style.setProperty('--ps-min', floor + 'px'); else el.style.removeProperty('--ps-min');
    } else {
      psVacate(key, el, ids.length === 0);
    }
  }

  // AN EMPTY ZONE COLLAPSES TO ZERO - with the gutter and toggle its registry entry names.
  function psVacate(key, el, vacant) {
    if (el.classList.contains('ps-vacant') === vacant) return;
    el.classList.toggle('ps-vacant', vacant);
    (ps.zones[key].chrome || []).forEach(function (sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (c) { c.classList.toggle('ps-vacant', vacant); });
    });
  }

  function psActivateTab(btn, focus) {
    if (!btn) return;
    var key = btn.getAttribute('data-ps-zone'), id = btn.getAttribute('data-ps-tab');
    ps.active[key] = id;
    psRenderZone(key);
    if (!focus) return;
    var el = psZoneEl(key);
    var nb = el && el.querySelector('.ps-tab[data-ps-tab="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (nb) nb.focus();
  }

  function psMove(id, target, note) {
    var from = psWhere(id);
    psDetach(id);
    if (note) ps.promoted[id] = note; else delete ps.promoted[id];
    if (target === psHome(id)) delete ps.placement[id];
    else { ps.placement[id] = target; psAttach(id, target); }
    ps.active[target] = id;
    if (from && from !== target) psRenderZone(from);
    psRenderZone(target);
    if (psIsTransient(target)) psOpen(target);
    if (from && from !== target && psIsTransient(from) && !psOccupantIds(from).length) psClose(from, { keepOccupants: true });
    psPersist();
    psRenderPalette();
  }

  function psPlace(id, key, opts) {
    opts = opts || {};
    var w = ps.workflows[id];
    if (!w) { console.warn('[panel-system] no workflow registered as', id); return null; }
    if (!ps.zones[key] || w.zones.indexOf(key) === -1) {
      psToast(w.label + ' cannot occupy the ' + (ps.zones[key] ? ps.zones[key].label : key) + ' - its zones are ' + w.zones.join(', '));
      return null;
    }
    psMeasure();
    var target = key, note = '';
    // Going HOME never promotes: a thin rail or collapsed drawer is Gavin's choice, not a squeeze.
    if (key !== psHome(id) && w.minWidth) {
      var avail = psAvailable(key);
      // THE PROMOTION RULE - nothing renders below its own legible minimum. A zone that
      // cannot give minWidth hands the workflow to the slide-over instead of squeezing it.
      if (avail < w.minWidth) {
        target = 'slide-over';
        note = 'promoted from the ' + ps.zones[key].label + ' Â· needs ' + w.minWidth + 'px, ' +
               (avail > 0 ? 'it gives ' + Math.round(avail) + 'px' : 'it is collapsed');
        if (!opts.quiet) psToast(w.label + ': ' + note);
      }
    }
    if (key === psHome(id)) delete ps.requested[id]; else ps.requested[id] = key;
    psMove(id, target, note);
    return target;
  }

  function psSendHome(id) {
    var w = ps.workflows[id];
    if (!w) return;
    delete ps.requested[id];
    if (psHome(id)) { psMove(id, psHome(id), ''); return; }
    var from = ps.placement[id];
    psDetach(id);
    delete ps.placement[id];
    delete ps.promoted[id];
    if (from) psRenderZone(from);
    if (from && psIsTransient(from) && !psOccupantIds(from).length) psClose(from, { keepOccupants: true });
    psPersist();
    psRenderPalette();
  }

  // Shortcut semantics: a mounted workflow goes home (or unmounts); a native one at home is
  // summoned into its first transient; anything else mounts into its defaultZone.
  function psToggle(id) {
    var w = ps.workflows[id];
    if (!w) return;
    var where = ps.placement[id];
    if (where) {
      if (psIsTransient(where) && psOccupantIds(where).length === 1) psClose(where); else psSendHome(id);
      return;
    }
    if (w.native.length) {
      var t = w.zones.filter(function (z) { return psIsTransient(z); })[0];
      if (t) psPlace(id, t);
      return;
    }
    psPlace(id, w.defaultZone);
  }

  // Re-checked whenever a zone or transient changes size: a workflow squeezed below its
  // minWidth by a drag is promoted, never left crushed. A zone Gavin COLLAPSED (drawer
  // .collapsed, grail .thin) is hidden by choice, not squeezed - it is left alone.
  var psEnforceQueued = false;
  function psEnforceMinWidths() {
    if (!ps.ready || psEnforceQueued) return;
    psEnforceQueued = true;
    requestAnimationFrame(function () {
      psEnforceQueued = false;
      psMeasure();
      Object.keys(ps.placement).forEach(function (id) {
        var key = ps.placement[id], w = ps.workflows[id], el = psZoneEl(key);
        if (!w || !w.minWidth || key === 'slide-over' || !el) return;
        if (el.classList.contains('collapsed') || el.classList.contains('thin')) return;
        if (psIsTransient(key) && !psIsOpen(key)) return;
        var avail = psAvailable(key);
        if (avail > 0 && avail < w.minWidth) {
          var note = 'promoted from the ' + ps.zones[key].label + ' Â· squeezed to ' + Math.round(avail) + 'px, needs ' + w.minWidth + 'px';
          psToast(w.label + ': ' + note);
          psMove(id, 'slide-over', note);
        }
      });
    });
  }

  function psPersist() {
    try { sessionStorage.setItem('ps-requested', JSON.stringify(ps.requested)); } catch (err) {}
  }
  function psRestore() {
    var req = {};
    try { req = JSON.parse(sessionStorage.getItem('ps-requested') || '{}') || {}; } catch (err) {}
    Object.keys(req).forEach(function (id) { if (ps.workflows[id]) psPlace(id, req[id], { quiet: true }); });
  }

  // --- palette -----------------------------------------------------------------
  var psPal = { q: '', sel: 0, zone: {} };

  function psOpenPalette() {
    psPal.q = '';
    psPal.sel = 0;
    psPal.zone = {};
    var inp = document.getElementById('ps-q');
    if (inp) inp.value = '';
    psRenderPalette();
    psOpen('palette');
  }

  function psFiltered() {
    var q = psPal.q.trim().toLowerCase();
    return ps.order.filter(function (id) {
      var w = ps.workflows[id];
      return !q || (w.label + ' ' + w.id + ' ' + w.summary).toLowerCase().indexOf(q) !== -1;
    });
  }

  // Where Enter sends a workflow: the zone the cursor sits on - its defaultZone, unless it
  // is already there, in which case the next legal zone (so Enter always does something).
  function psPaletteTarget(w) {
    var i = psPal.zone[w.id];
    if (i == null) {
      i = w.zones.indexOf(w.defaultZone);
      if (psWhere(w.id) === w.defaultZone && w.zones.length > 1) i = (i + 1) % w.zones.length;
    }
    return w.zones[i];
  }

  function psRenderPalette() {
    var list = document.getElementById('ps-list'), empty = document.getElementById('ps-palette-empty');
    if (!list) return;
    var ids = psFiltered();
    if (psPal.sel >= ids.length) psPal.sel = Math.max(0, ids.length - 1);
    list.innerHTML = ids.map(function (id, i) {
      var w = ps.workflows[id], where = psWhere(id), on = i === psPal.sel, cursor = psPaletteTarget(w);
      return '<li class="ps-item" role="option" id="ps-opt-' + escapeHtml(id) + '" data-ps-item="' + escapeHtml(id) + '" aria-selected="' + on + '">' +
        '<span class="ps-ico" aria-hidden="true">' + escapeHtml(w.icon) + '</span>' +
        '<span class="ps-lbl">' + escapeHtml(w.label) + '<small>' + escapeHtml(w.summary || w.id) + '</small></span>' +
        (w.shortcut ? '<kbd class="ps-kbd">' + escapeHtml(psShortcutLabel(w.shortcut)) + '</kbd>' : '<span></span>') +
        '<span class="ps-zones">' + w.zones.map(function (z) {
          var cls = 'ps-zone' + (z === where ? ' here' : '') + (z === w.defaultZone ? ' default' : '') + (on && z === cursor ? ' cursor' : '');
          return '<button type="button" tabindex="-1" class="' + cls + '" data-ps-place="' + escapeHtml(id) + '" data-ps-to="' + escapeHtml(z) + '"' +
            ' title="Send ' + escapeHtml(w.label) + ' to the ' + escapeHtml(ps.zones[z].label) + '">' + escapeHtml(ps.zones[z].label) + '</button>';
        }).join('') + '<span class="ps-min">min ' + w.minWidth + 'px</span></span></li>';
    }).join('');
    if (empty) {
      empty.hidden = ids.length > 0;
      empty.innerHTML = ps.order.length
        ? '<b>No workflow matches</b><span>â€œ' + escapeHtml(psPal.q) + 'â€ is not a registered workflow.</span>'
        : '<b>No workflows registered</b><span>Add one entry to #ps-registry in the frame template.</span>';
    }
    var inp = document.getElementById('ps-q');
    if (inp) {
      if (ids.length) inp.setAttribute('aria-activedescendant', 'ps-opt-' + ids[psPal.sel]);
      else inp.removeAttribute('aria-activedescendant');
    }
  }

  function psOnPaletteKey(e) {
    var k = (e.key || '').toLowerCase(), ids = psFiltered(), inp = e.target;
    if (k === 'arrowdown' || k === 'arrowup') {
      e.preventDefault();
      if (!ids.length) return;
      psPal.sel = (psPal.sel + (k === 'arrowdown' ? 1 : -1) + ids.length) % ids.length;
      psRenderPalette();
      return;
    }
    if (k === 'arrowleft' || k === 'arrowright') {
      var atEdge = k === 'arrowright' ? inp.selectionStart === inp.value.length : inp.selectionEnd === 0;
      if (!ids.length || !atEdge) return;
      e.preventDefault();
      var w = ps.workflows[ids[psPal.sel]];
      var cur = w.zones.indexOf(psPaletteTarget(w));
      psPal.zone[w.id] = (cur + (k === 'arrowright' ? 1 : -1) + w.zones.length) % w.zones.length;
      psRenderPalette();
      return;
    }
    if (k === 'enter') {
      e.preventDefault();
      if (!ids.length) return;
      var pick = ps.workflows[ids[psPal.sel]], to = psPaletteTarget(pick);
      psClose('palette');
      psPlace(pick.id, to);
    }
  }

  function psOnClick(e) {
    if (!ps.ready) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var tab = t.closest('.ps-tab');
    if (tab) { psActivateTab(tab, false); return; }
    var chip = t.closest('[data-ps-to]');
    if (chip) { psClose('palette'); psPlace(chip.getAttribute('data-ps-place'), chip.getAttribute('data-ps-to')); return; }
    var item = t.closest('[data-ps-item]');
    if (item) {
      var w = ps.workflows[item.getAttribute('data-ps-item')];
      if (w) { var to = psPaletteTarget(w); psClose('palette'); psPlace(w.id, to); }
      return;
    }
    if (t.closest('[data-ps-dismiss]')) {
      var sec = t.closest('.ps-transient');
      if (sec) psClose(sec.getAttribute('data-zone'));
      return;
    }
    if (t.id === 'ps-scrim') {
      for (var i = ps.stack.length - 1; i >= 0; i--) { if (psIsModal(ps.stack[i])) { psClose(ps.stack[i]); break; } }
      return;
    }
    var row = t.closest('.qg-row');
    if (row && (e.shiftKey || psIsOpen('inspector'))) psInspect(row.getAttribute('data-q'));
  }

  // --- init ----------------------------------------------------------------------
  function wirePanelSystem() {
    if (ps.ready || !document.getElementById('ps-layer') || !psReadRegistry()) return;
    ps.ready = true;
    psMeasure();
    psSyncFidelity();
    psWireHandles();
    var kbd = document.querySelector('#ps-palette > .ps-head > .ps-kbd');
    if (kbd) kbd.textContent = psShortcutLabel('mod+k');
    document.addEventListener('keydown', psOnKeydown);
    document.addEventListener('click', psOnClick);
    var q = document.getElementById('ps-q');
    if (q) {
      q.addEventListener('input', function () { psPal.q = q.value; psPal.sel = 0; psRenderPalette(); });
      q.addEventListener('keydown', psOnPaletteKey);
    }
    window.addEventListener('resize', psEnforceMinWidths);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(psEnforceMinWidths);
      Object.keys(ps.zones).forEach(function (key) { var el = psZoneEl(key); if (el) ro.observe(el); });
    }
    if (window.MutationObserver) {
      var content = document.getElementById('claude-content');
      if (content) new MutationObserver(psSyncFidelity).observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-fidelity'] });
      var graph = document.getElementById('qrail-graph');
      if (graph) new MutationObserver(function () { if (ps.inspectNode != null) psRenderNode(); }).observe(graph, { childList: true });
    }
    Object.keys(ps.zones).forEach(psRenderZone);
    psRestore();
    psRenderPalette();

    window.brainstorm = window.brainstorm || {};
    window.brainstorm.panels = {
      register: function (entry) {
        var ok = psRegister(entry);
        if (ok && ps.workflows[entry.id].native.length) psRenderZone(ps.workflows[entry.id].defaultZone);
        return ok;
      },
      place: psPlace,
      home: psSendHome,
      toggle: psToggle,
      open: function (key) { if (key === 'palette') psOpenPalette(); else if (psIsTransient(key)) { psRenderZone(key); psOpen(key); } },
      close: psClose,
      palette: psOpenPalette,
      inspect: psInspect,
      renderer: function (id, fn) {
        ps.renderers[id] = fn;
        if (ps.placement[id] && ps.workflows[id] && !ps.workflows[id].native.length) psAttach(id, ps.placement[id]);
      },
      where: psWhere,
      list: function () {
        return ps.order.map(function (id) {
          var w = ps.workflows[id];
          return { id: id, label: w.label, zones: w.zones.slice(), defaultZone: w.defaultZone, minWidth: w.minWidth,
                   channel: w.channel, shortcut: w.shortcut, where: psWhere(id), promoted: ps.promoted[id] || '' };
        });
      }
    };
  }
  /* ===== HUB - the branch canvas, promoted out of a session screen (additive - 2026-09-16) =====
     The hub was proven as a session content/ screen: 78 branch nodes, 84 edges drawn as wires,
     five chapters that dim and undim the canvas, lo/mid/hi that changes what is DRAWN, and
     node-click opening the inspector. A session screen is disposable - it dies with the session
     and takes the capability with it. This is the same surface, owned by the template.

     Three things the screen hard-coded become data or a registry lookup here:
       - the 78 bnode groups and 84 wire paths are LAID OUT from the channel;
       - the five chapters come from `chapters` in the channel, or derive from the lanes;
       - the gavel button MOVES the registered gavel workflow into the top-anchored ceremony
         zone instead of iframing a hard-coded localhost port.
     Doc: references/panel-system.md */
  var HUB_W = 225, HUB_GAP_X = 18, HUB_H = 34, HUB_GAP_Y = 8, HUB_PAD = 20, HUB_TOP = 54;
  var HUB_GLYPH = '↗';   // the click-through affordance; the rect stroke carries the state

  function hubNodes(d) {
    return (d && Array.isArray(d.nodes) ? d.nodes : []).filter(function (n) { return n && n.id != null; });
  }
  function hubStateOf(n) {
    if (n.supersededBy) return 'superseded';
    var s = String(n.state || 'open').toLowerCase();
    return (s === 'done' || s === 'parked' || s === 'superseded') ? s : 'open';
  }
  function hubClip(s, max) {
    s = String(s == null ? '' : s);
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  // Columns come from `layer` in first-appearance order, rows from `at` then id - the same
  // ordering the rail already uses, so the canvas and the rail agree about what comes first.
  function hubLayout(d) {
    var nodes = hubNodes(d), cols = [], by = {};
    nodes.forEach(function (n) {
      var k = (n.layer == null || n.layer === '') ? '·' : String(n.layer);
      if (!by[k]) { by[k] = []; cols.push(k); }
      by[k].push(n);
    });
    var pos = {}, rows = 0;
    cols.forEach(function (k, ci) {
      by[k].sort(function (a, b) { return (a.at || 0) - (b.at || 0) || String(a.id).localeCompare(String(b.id)); });
      by[k].forEach(function (n, ri) {
        pos[String(n.id)] = { x: HUB_PAD + ci * (HUB_W + HUB_GAP_X), y: HUB_TOP + ri * (HUB_H + HUB_GAP_Y) };
      });
      rows = Math.max(rows, by[k].length);
    });
    return {
      pos: pos, nodes: nodes, cols: cols,
      w: HUB_PAD * 2 + cols.length * HUB_W + Math.max(0, cols.length - 1) * HUB_GAP_X,
      h: HUB_TOP + rows * (HUB_H + HUB_GAP_Y) + HUB_PAD
    };
  }

  // CHAPTERS. A session names its own in the channel (`chapters: [{ n, ids }]`) - that is how
  // hand-authored chapters like "the substrate" or "the Djeli cluster" survive as DATA instead
  // of being baked into a screen. Declare none and they derive from the lane vocabulary.
  function hubChapters(d) {
    var nodes = hubNodes(d), declared = d && Array.isArray(d.chapters) ? d.chapters : null;
    if (declared && declared.length) {
      var ok = declared.filter(function (c) { return c && Array.isArray(c.ids); })
        .map(function (c) { return { n: String(c.n || 'chapter'), ids: c.ids.map(String) }; });
      if (ok.length) return ok;
    }
    var out = [{ n: 'everything', ids: nodes.map(function (n) { return String(n.id); }) }];
    [['done', 'what landed'], ['open', 'in flight'], ['parked', 'parked'], ['superseded', 'superseded']]
      .forEach(function (p) {
        var ids = nodes.filter(function (n) { return hubStateOf(n) === p[0]; }).map(function (n) { return String(n.id); });
        if (ids.length) out.push({ n: p[1], ids: ids });
      });
    return out;
  }

  // Wires paint before nodes so a node always sits on top of its own edges. The curve is the
  // prototype's: a horizontal-tangent cubic from the source's right edge to the target's left.
  function hubSvg(d) {
    var L = hubLayout(d), out = [];
    out.push('<svg width="' + L.w + '" height="' + L.h + '" viewBox="0 0 ' + L.w + ' ' + L.h +
             '" xmlns="http://www.w3.org/2000/svg" role="img">');
    out.push('<title>Branch workgraph</title><desc>' + L.nodes.length + ' nodes, ' +
             (((d && d.edges) || []).length) + ' edges</desc>');
    ((d && Array.isArray(d.edges)) ? d.edges : []).forEach(function (e) {
      if (!e) return;
      var a = L.pos[String(e.fromNode)], b = L.pos[String(e.toNode)];
      if (!a || !b) return;
      var x1 = a.x + HUB_W, y1 = a.y + HUB_H / 2, x2 = b.x, y2 = b.y + HUB_H / 2, mx = (x1 + x2) / 2;
      out.push('<path class="wire" data-a="' + escapeHtml(e.fromNode) + '" data-b="' + escapeHtml(e.toNode) +
               '" d="M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2 + '"/>');
    });
    L.nodes.forEach(function (n) {
      var p = L.pos[String(n.id)], st = hubStateOf(n), ty = p.y + 21;
      out.push('<g class="bnode" data-id="' + escapeHtml(n.id) + '" data-state="' + st + '" tabindex="0" role="button"' +
               ' aria-label="' + escapeHtml(String(n.id) + ' ' + (n.label || '') + ' - ' + st) + '">' +
        '<rect x="' + p.x + '" y="' + p.y + '" width="' + HUB_W + '" height="' + HUB_H + '" rx="7"/>' +
        '<text class="bn-id" x="' + (p.x + 10) + '" y="' + ty + '" font-size="11">' + escapeHtml(hubClip(n.id, 6)) + '</text>' +
        '<text class="bn-lb" x="' + (p.x + 56) + '" y="' + ty + '" font-size="11">' + escapeHtml(hubClip(n.label || n.summary || '', 21)) + '</text>' +
        '<text class="bn-g" x="' + (p.x + HUB_W - 12) + '" y="' + ty + '" font-size="11" text-anchor="end">' + HUB_GLYPH + '</text>' +
      '</g>');
    });
    out.push('</svg>');
    return out.join('');
  }

  // The chapter verb: dim everything outside the set, and dim a wire unless BOTH of its ends
  // are inside it. Nothing is removed - the whole graph stays on screen, just quieter.
  function hubApplyChapter(root, i) {
    var d = root.__hub || {}, chs = hubChapters(d), c = chs[i] || chs[0];
    if (!c) return;
    root.__ch = i = chs.indexOf(c);
    var set = {}, hit = 0;
    c.ids.forEach(function (id) { set[String(id)] = 1; });
    Array.prototype.forEach.call(root.querySelectorAll('.bnode'), function (g) {
      var on = !!set[g.getAttribute('data-id')];
      if (on) hit++;
      g.classList.toggle('dim', !on);
    });
    Array.prototype.forEach.call(root.querySelectorAll('.wire'), function (p) {
      p.classList.toggle('dim', !(set[p.getAttribute('data-a')] && set[p.getAttribute('data-b')]));
    });
    Array.prototype.forEach.call(root.querySelectorAll('.ch'), function (b) {
      var on = Number(b.getAttribute('data-ch')) === i;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var nm = root.querySelector('.hub-chname'), ct = root.querySelector('.hub-chcount');
    if (nm) nm.textContent = c.n;
    if (ct) ct.textContent = hit + ' of ' + hubNodes(d).length + ' nodes';
  }

  function hubDraw(root, d) {
    if (!root) return;
    root.__hub = d || { nodes: [], edges: [] };
    var chs = hubChapters(root.__hub), bar = root.querySelector('.hub-chapters'), canvas = root.querySelector('.hubcanvas');
    if (bar) {
      bar.innerHTML = chs.map(function (c, i) {
        return '<button class="chip ch" type="button" data-ch="' + i + '" aria-pressed="false">' + escapeHtml(c.n) + '</button>';
      }).join('');
    }
    if (!canvas) return;
    if (!hubNodes(root.__hub).length) {
      // Decision 7 - a registered workflow with no data shows a NAMED empty state, never a blank box.
      psEmpty(canvas, 'The branch hub has no nodes yet',
              '/state/workgraph.json carries no nodes. The genesis seed writes the first one when the session opens.');
      var nm0 = root.querySelector('.hub-chname'), ct0 = root.querySelector('.hub-chcount');
      if (nm0) nm0.textContent = 'no chapter';
      if (ct0) ct0.textContent = '0 of 0 nodes';
      return;
    }
    canvas.innerHTML = hubSvg(root.__hub);
    hubApplyChapter(root, Math.min(root.__ch || 0, chs.length - 1));
  }

  function hubWire(root) {
    if (!root || root.__wired) return;
    root.__wired = true;
    var closest = function (t, sel) { return t && t.closest ? t.closest(sel) : null; };
    root.addEventListener('click', function (e) {
      var g = closest(e.target, '.bnode');
      if (g) { psInspect(g.getAttribute('data-id')); return; }
      var ch = closest(e.target, '.ch');
      if (ch) { hubApplyChapter(root, Number(ch.getAttribute('data-ch'))); return; }
      var fi = closest(e.target, '.fi');
      if (fi) {
        root.setAttribute('data-fidelity', fi.getAttribute('data-f'));
        Array.prototype.forEach.call(root.querySelectorAll('.fi'), function (b) { b.classList.toggle('on', b === fi); });
        return;
      }
      // The gavel MOVES into the top-anchored ceremony zone. The prototype iframed a hard-coded
      // localhost port from a session screen; the registry knows where the ceremony belongs.
      if (closest(e.target, '[data-hub-gavel]')) {
        if (ps.workflows['gavel-ceremony']) psPlace('gavel-ceremony', ps.workflows['gavel-ceremony'].defaultZone);
        else psToast('No gavel-ceremony entry in #ps-registry.');
      }
    });
    root.addEventListener('keydown', function (e) {
      var g = closest(e.target, '.bnode');
      if (g && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) {
        e.preventDefault();
        psInspect(g.getAttribute('data-id'));
      }
    });
  }

  // The renderer seam psProbe already documents - fn(host, channelJson, entry).
  ps.renderers['branch-hub'] = function (host, data) {
    var tpl = document.getElementById('ps-hub-tpl');
    if (!tpl || !('content' in tpl)) {
      psEmpty(host, 'Branch hub - chrome missing', 'This frame carries no #ps-hub-tpl template.');
      return;
    }
    host.innerHTML = '';
    host.appendChild(document.importNode(tpl.content, true));
    var root = host.querySelector('.ps-hub');
    hubDraw(root, (data && data.nodes) ? data : lastWorkgraphState);
    hubWire(root);
  };

  // Live channel -> live canvas. workgraph.json changing repaints every mounted hub in place,
  // keeping the chapter the reader is on.
  function hubRefresh() {
    Array.prototype.forEach.call(document.querySelectorAll('.ps-hub'), function (root) {
      hubDraw(root, lastWorkgraphState);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wirePanelSystem);
  else wirePanelSystem();

  /* ===== PANEL SYSTEM · public surface (additive 2026-09-16) =====
     helper.js is an IIFE, so every ps* function was sealed inside it and no inline
     handler in a rendered screen could ever reach them - the transients were built
     and unopenable. This exposes the minimum surface a screen needs, and nothing more. */
  function psFill(key, title, html) {
    var el = psZoneEl(key); if (!el) return;
    var t = el.querySelector('.ps-title'); if (t) t.textContent = title || '';
    var b = el.querySelector('.ps-body');
    if (!b) {
      b = document.createElement('div');
      b.className = 'ps-body';
      b.style.cssText = 'padding:14px 16px;overflow:auto;flex:1;font-size:13px;line-height:1.62';
      el.appendChild(b);
    }
    b.innerHTML = html || '';
  }
  window.ps = {
    open: psOpen, close: psClose, isOpen: psIsOpen, fill: psFill,
    show: function (key, title, html) { psFill(key, title, html); psOpen(key); }
  };
  window.psOpen = psOpen; window.psClose = psClose; window.psFill = psFill;
})();