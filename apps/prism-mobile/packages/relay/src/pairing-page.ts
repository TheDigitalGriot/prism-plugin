/**
 * Pairing landing page + universal-link association files, served by the relay Worker.
 *
 * Why this exists: the daemon builds a pairing offer as an HTTPS URL whose payload lives in
 * the URL *fragment* — `https://prism.digitalgriot.studio/#offer=<base64url>`. A fragment never
 * reaches the server, so a client-side page must read it and bridge the link into the app. Before
 * this page existed the apex `/` had no origin (only `/relay/*` was routed), so opening the offer
 * link returned Cloudflare 522.
 *
 * The page is intentionally "dumb": it re-emits the *identical* `#offer=<b64>` fragment under the
 * app's custom scheme (`prism://…#offer=<b64>`). It decodes the payload only to show a friendly
 * "pair with <server>" label — it never has to understand the offer schema, so schema changes on
 * the daemon side can't break it.
 *
 * Deep-link path: the app registers `scheme: "prism"` and a global offer listener
 * (`OfferLinkListener` in `packages/app/src/app/_layout.tsx`) that fires on ANY incoming URL
 * containing `#offer=` (cold start via `getInitialURL`, warm via `addEventListener("url")`).
 * So `prism://#offer=<b64>` (empty authority → app index route, no "not found" flash) is enough.
 */

// ---------------------------------------------------------------------------
// Universal-link identity — the ONLY place the Apple Team ID is needed. Fill it
// before deploying the AASA `.well-known` file.
//   Apple Team ID: `eas credentials -p ios` → shows "Apple Team"
//                  (or https://developer.apple.com/account → Membership → Team ID)
// Until it holds a real value, iOS won't verify the association — but the
// `prism://` redirect on the landing page still works with no rebuild.
// (Android App Links are intentionally out of scope for now.)
// ---------------------------------------------------------------------------

/** Apple Team ID (GAVIN ANDRE BENNETT). Extracted from the signed EAS iOS build's
 *  embedded.mobileprovision (TeamIdentifier / ApplicationIdentifierPrefix). */
export const APPLE_TEAM_ID = "M6K8N36JN8";

/** iOS bundle identifiers from app.config.js (production + debug variants). */
export const IOS_BUNDLE_IDS = [
  "com.thedigitalgriot.prism",
  "com.thedigitalgriot.prism.debug",
] as const;

/** Apple App Site Association (AASA) for iOS universal links. */
export function buildAppleAppSiteAssociation(): unknown {
  return {
    applinks: {
      details: [
        {
          appIDs: IOS_BUNDLE_IDS.map((bundleId) => `${APPLE_TEAM_ID}.${bundleId}`),
          components: [
            { "/": "/", comment: "Pairing offer at the apex" },
            { "/": "/pair", comment: "Pairing offer at /pair" },
            { "/": "/pair/*", comment: "Pairing offer subpaths" },
          ],
        },
      ],
    },
  };
}

/**
 * Self-contained pairing landing page. No external requests (Worker-friendly, CSP-safe):
 * inline CSS + JS only. Reads `location.hash`, decodes the offer for display, and bridges to
 * `prism://…#offer=…`.
 */
export const PAIRING_LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="color-scheme" content="dark" />
<title>Pair with Prism</title>
<style>
  :root { --bg:#0a0a0b; --card:#141417; --edge:#242429; --fg:#f4f4f5; --muted:#9a9aa2;
          --accent:#e07a53; --accent2:#8b6cf0; --ok:#3ecf8e; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body { margin:0; height:100%; }
  body { background:radial-gradient(1200px 600px at 50% -10%, #1b1622 0%, var(--bg) 60%);
         color:var(--fg); font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
         display:flex; align-items:center; justify-content:center; padding:24px; min-height:100dvh; }
  .card { width:100%; max-width:420px; background:var(--card); border:1px solid var(--edge);
          border-radius:20px; padding:32px 28px; box-shadow:0 24px 60px rgba(0,0,0,.5); text-align:center; }
  .prism { width:56px; height:56px; margin:0 auto 20px; display:block; }
  h1 { font-size:22px; margin:0 0 6px; letter-spacing:-.02em; }
  p.sub { color:var(--muted); margin:0 0 24px; font-size:15px; }
  .server { display:flex; flex-direction:column; gap:6px; background:#0e0e10; border:1px solid var(--edge);
            border-radius:12px; padding:14px 16px; margin:0 0 22px; text-align:left; }
  .server .row { display:flex; justify-content:space-between; gap:12px; font-size:13px; }
  .server .k { color:var(--muted); } .server .v { color:var(--fg); font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
            overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px; }
  a.btn { display:block; text-decoration:none; font-weight:600; font-size:16px; padding:15px 20px; border-radius:14px;
          background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; border:0;
          box-shadow:0 8px 24px rgba(224,122,83,.28); transition:transform .08s ease; cursor:pointer; }
  a.btn:active { transform:translateY(1px) scale(.99); }
  .hint { color:var(--muted); font-size:13px; margin-top:18px; }
  .hint a { color:var(--accent); text-decoration:none; }
  .foot { margin-top:22px; color:#5b5b63; font-size:12px; }
  .err { color:#f0a; }
  [hidden] { display:none !important; }
</style>
</head>
<body>
  <main class="card">
    <svg class="prism" viewBox="0 0 64 64" aria-hidden="true">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e07a53"/><stop offset="1" stop-color="#8b6cf0"/></linearGradient></defs>
      <path d="M32 6 58 52H6z" fill="none" stroke="url(#g)" stroke-width="3" stroke-linejoin="round"/>
      <path d="M32 6 32 52M32 29 6 52M32 29 58 52" fill="none" stroke="url(#g)" stroke-width="2" opacity=".55"/>
    </svg>

    <div id="offer-view" hidden>
      <h1>Pair with Prism</h1>
      <p class="sub">Open this daemon in the Prism app to control your agents from anywhere.</p>
      <div class="server">
        <div class="row"><span class="k">Server</span><span class="v" id="server-id">—</span></div>
        <div class="row"><span class="k">Relay</span><span class="v" id="relay-endpoint">—</span></div>
      </div>
      <a class="btn" id="open-app" href="#">Open in Prism</a>
      <p class="hint">Nothing happened? Make sure Prism is installed, then tap <b>Open in Prism</b> again.</p>
    </div>

    <div id="empty-view" hidden>
      <h1>Prism pairing</h1>
      <p class="sub">This page opens a pairing link in the Prism app. To pair a device, generate an
      offer on your daemon (<code>daemon pair</code>) and open its link here.</p>
    </div>

    <div id="error-view" hidden>
      <h1>Pairing link looks off</h1>
      <p class="sub err" id="error-msg">This link doesn't contain a valid pairing offer.</p>
      <a class="btn" id="open-app-raw" href="#">Try opening in Prism anyway</a>
    </div>

    <p class="foot">prism.digitalgriot.studio</p>
  </main>

<script>
(function () {
  "use strict";
  var MARKER = "#offer=";
  var hash = window.location.hash || "";
  var idx = hash.indexOf(MARKER);

  function show(id) { var el = document.getElementById(id); if (el) el.hidden = false; }
  function text(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

  // The deep link is the app's custom scheme + the SAME fragment. Empty authority ("prism://")
  // routes the app to its index and lets the global offer listener import the offer.
  function deepLink() { return "prism://" + (window.location.hash || ""); }

  function bridge() {
    try { window.location.href = deepLink(); } catch (e) { /* ignore */ }
  }

  function shortId(s) {
    if (typeof s !== "string" || s.length <= 20) return s;
    return s.slice(0, 12) + "…" + s.slice(-4);
  }

  function b64urlToUtf8(input) {
    var s = String(input).replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  if (idx === -1) {
    show("empty-view");
    return;
  }

  var encoded = hash.slice(idx + MARKER.length).trim();
  var openApp = document.getElementById("open-app");
  var openAppRaw = document.getElementById("open-app-raw");
  if (openApp) openApp.setAttribute("href", deepLink());
  if (openAppRaw) openAppRaw.setAttribute("href", deepLink());

  var offer = null;
  try {
    offer = JSON.parse(b64urlToUtf8(encoded));
  } catch (e) {
    offer = null;
  }

  if (offer && typeof offer === "object") {
    show("offer-view");
    text("server-id", shortId(offer.serverId) || "unknown");
    var rel = offer.relay && offer.relay.endpoint ? offer.relay.endpoint : "prism.digitalgriot.studio";
    text("relay-endpoint", rel);
    if (openApp) openApp.addEventListener("click", function (ev) { ev.preventDefault(); bridge(); });
    // Auto-attempt once the page has painted (a user tap is the reliable fallback).
    setTimeout(bridge, 400);
  } else {
    // Fragment present but unreadable — still let the user hand the raw link to the app.
    show("error-view");
    if (openAppRaw) openAppRaw.addEventListener("click", function (ev) { ev.preventDefault(); bridge(); });
  }
})();
</script>
</body>
</html>`;

/**
 * Serve the pairing landing page and universal-link association files.
 * Returns `null` for any path this module doesn't own (caller continues to relay routing).
 */
export function handlePairingStaticRoutes(url: URL): Response | null {
  const pathname = url.pathname;

  if (pathname === "/" || pathname === "/pair" || pathname === "/pair/") {
    return new Response(PAIRING_LANDING_HTML, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }

  if (pathname === "/.well-known/apple-app-site-association") {
    return new Response(JSON.stringify(buildAppleAppSiteAssociation()), {
      status: 200,
      headers: {
        // Apple accepts application/json and must not be redirected.
        "content-type": "application/json",
        "cache-control": "public, max-age=3600",
      },
    });
  }

  return null;
}
