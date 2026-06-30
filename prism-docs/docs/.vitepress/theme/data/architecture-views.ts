/* eslint-disable */
// Auto-extracted from public/architecture.html — the 3-view dataset (runtime/workflows/plugin).
// The render engine lives in ../components/ArchitectureExplorer.vue.

export const VIEWS: Record<string, any> = {};

/* ===== RUNTIME ===== */
VIEWS.runtime = {
  legend:['Main data flow','Error / edge-case','Supervision / relay'],
  bands:[
    {x:0,y:60,w:980,h:92,lab:'Layer 1',name:'Surfaces'},
    {x:0,y:224,w:980,h:92,lab:'Layer 2',name:'Seam (in-process ⇄ wire)'},
    {x:0,y:388,w:980,h:92,lab:'Layer 3',name:'Daemon Broker · :6780'},
    {x:0,y:716,w:980,h:92,lab:'Layer 4',name:'Adapters'},
    {x:0,y:880,w:1160,h:104,lab:'Layer 5',name:'Services'},
    {x:992,y:224,w:188,h:584,lab:'',name:'Relay · Clients'},
  ],
  nodes:[
    {id:'cli',x:60,y:94,kind:'surface',label:'CLI',sub:'Go · Bubble Tea TUI',detail:{desc:'Full-screen Go/Bubble Tea TUI: own plugin nav, theme engine, claude/codex/cursor adapters, 3D prism renderer. Talks to the broker via a Go WS client.',files:['apps/prism-cli/'],docs:[{t:'CLI docs',u:'cli/'},{t:'Clients',u:'daemon/clients'}]}},
    {id:'vscode',x:300,y:94,kind:'surface',label:'VS Code',sub:'TS ext + 3 React webviews',detail:{desc:'Cline-derived extension: in-process agent task loop, tree views, React webviews. Speaks the gRPC seam over postMessage.',files:['apps/prism-vscode/src/'],docs:[{t:'VS Code docs',u:'vscode/'}]}},
    {id:'electron',x:540,y:94,kind:'surface',label:'Electron',sub:'Desktop · reuses VS Code src',detail:{desc:'Forge+Vite shell reusing @prism-core + @prism-ui via gRPC-over-IPC. Hosts + supervises the broker.',files:['apps/prism-electron/src/'],docs:[{t:'Electron',u:'electron/'},{t:'Daemon-manager',u:'daemon/desktop-manager'}]}},
    {id:'mobile',x:780,y:94,kind:'surface',label:'Mobile',sub:'Vendored paseo (Expo)',detail:{desc:'paseo’s Expo app, rebranded; versions off root VERSION. Reaches the broker over the relay.',files:['apps/prism-mobile/'],docs:[{t:'Versioning',u:'monorepo/version-management'}]}},
    {id:'grpc',x:200,y:258,kind:'main',label:'gRPC seam',sub:'handleGrpcRequest',detail:{desc:'In-process service.method dispatcher (unary+stream+request-id) over postMessage/IPC. Same grammar as the broker.',files:['packages/prism-core/src/core/controller/grpc-handler.ts'],docs:[{t:'Seam bridge',u:'daemon/seam-bridge'}]}},
    {id:'bridge',x:520,y:258,kind:'main',label:'Seam bridge',sub:'BrokerForwarder',detail:{desc:'Unhandled service.method keys forward to the broker — the webview’s gRPC client transparently reaches brokered services. Wired on Electron + VS Code.',files:['packages/prism-core/.../grpc-handler.ts'],docs:[{t:'Seam bridge',u:'daemon/seam-bridge'}]}},
    {id:'broker',x:360,y:422,kind:'main',label:'Daemon Broker',sub:'WS :6780 + HTTP /call',detail:{desc:'The sovereign multi-service hub. Click ＋ to see its internals: registry, router, session, resolve, relay bridge, health loop, control plane.',files:['packages/prism-daemon/src/broker.ts'],docs:[{t:'Broker core',u:'daemon/broker'},{t:'Overview',u:'daemon/'}]},
      children:[
        {id:'b-reg',dx:-330,dy:96,label:'Registry',sub:'ServiceDescriptor[]',detail:{desc:'The live service catalog — id, status, adapterType, endpoint{local,cloud}, capabilities (from SKILL.md), gate, routes.',files:['packages/prism-daemon/src/registry.ts']}},
        {id:'b-router',dx:-165,dy:96,label:'Router',sub:'route → adapter',detail:{desc:'Routes a BrokerEnvelope to the right adapter; setAdapter / adapterFor / disconnectAll.',files:['packages/prism-daemon/src/router.ts']}},
        {id:'b-sess',dx:0,dy:96,label:'Session',sub:'supports() · timeline',detail:{desc:'Per-client session state + capability gating (session.supports(cap)). Transport-agnostic — reused by LAN + relay.',files:['packages/prism-daemon/src/session.ts']}},
        {id:'b-resolve',dx:165,dy:96,label:'resolveEndpoint',sub:'try-local→cloud + VRAM gate',detail:{desc:'Boot-readiness: probe local within AbortSignal.timeout, fall back to cloud when unreachable / gate unmet.',files:['packages/prism-daemon/src/resolve.ts']}},
        {id:'b-relay',dx:330,dy:96,label:'Relay bridge',sub:'connectRelay()',detail:{desc:'Outbound dial + channel mux to the E2EE relay; each remote client is a virtual session.',files:['packages/prism-daemon/src/relay.ts']}},
        {id:'b-ctl',dx:-110,dy:160,label:'Control plane',sub:'/services /health /call …',detail:{desc:'HTTP: GET /services, GET /health, POST /register, /deregister, /call, GET /pairing.',files:['packages/prism-daemon/src/broker.ts']}},
        {id:'b-health',dx:110,dy:160,label:'Health loop',sub:'15s · service_update',detail:{desc:'Re-probes services every 15s; status change broadcasts service_update to all clients (LAN + relay).',files:['packages/prism-daemon/src/broker.ts']}},
      ]},
    {id:'mgr',x:660,y:422,kind:'meta',label:'Desktop daemon-manager',sub:'utilityProcess.fork',detail:{desc:'Electron supervises the broker child: adopt/spawn/health-poll/crash-restart/version-sync/kill-on-quit. Headless-testable.',files:['apps/prism-electron/src/daemon/daemon-manager.ts'],docs:[{t:'Daemon-manager',u:'daemon/desktop-manager'}]}},
    {id:'a-ws',x:30,y:750,kind:'adapter',label:'WebSocketAdapter',sub:'clean dialect',detail:{desc:'Generic JSON-over-WS for a backend speaking the broker’s clean dialect.',files:['…/adapters/websocket.ts'],docs:[{t:'Adapters',u:'daemon/adapters'}]}},
    {id:'a-paseo',x:218,y:750,kind:'adapter',label:'PaseoWebSocketAdapter',sub:'websocket-paseo',detail:{desc:'Speaks the real paseo daemon dialect so agent-run targets :6767. Sovereign absorption.',files:['…/adapters/paseo-websocket.ts'],docs:[{t:'Adapters',u:'daemon/adapters'}]}},
    {id:'a-rest',x:406,y:750,kind:'adapter',label:'RestAdapter',sub:'config-driven routes',detail:{desc:'Multi-route REST for design-gen (studio relay :7457 + engine :7456).',files:['…/adapters/rest.ts'],docs:[{t:'Adapters',u:'daemon/adapters'}]}},
    {id:'a-mcp',x:594,y:750,kind:'adapter',label:'StdioMcpAdapter',sub:'stdio MCP',detail:{desc:'Spawns stdio MCP servers — code-intel (codebase-memory-mcp) + knowledge (graphify-mcp).',files:['…/adapters/stdio-mcp.ts'],docs:[{t:'Adapters',u:'daemon/adapters'}]}},
    {id:'a-flask',x:782,y:750,kind:'adapter',label:'FlaskHttpAdapter',sub:'one adapter, N Flask svcs',detail:{desc:'ONE adapter for 3d-gen, cinopsis, notebooks — parameterized by endpoint + manifest.',files:['…/adapters/flask-http.ts'],docs:[{t:'Adapters',u:'daemon/adapters'}]}},
    {id:'s-agent',x:10,y:912,kind:'svc',label:'agent-run',sub:'paseo daemon :6767',detail:{desc:'Agent orchestration. Full-managed step 1 (AgentRunClient) proves driving it behind the broker, flag-gated.',files:['packages/prism-daemon-client/src/agent-run.ts']}},
    {id:'s-code',x:170,y:912,kind:'svc',label:'code-intel',sub:'codebase-memory-mcp',detail:{desc:'Graph code-intel (search_graph, trace_path). Proven ready vs the live MCP.',files:['services.config.json']}},
    {id:'s-design',x:330,y:912,kind:'svc',label:'design-gen',sub:'studio :7457 → engine :7456',detail:{desc:'open-design engine behind the design-studio relay.',files:['apps/prism-design-studio/']}},
    {id:'s-know',x:490,y:912,kind:'svc',label:'knowledge',sub:'graphify-mcp',detail:{desc:'Sovereign Graphify fork (MIT) over stdio-mcp; powers Synaptiq.',files:['services.config.json']}},
    {id:'s-3d',x:650,y:912,kind:'svc',label:'3d-gen',sub:'Lucid/ComfyUI · try-local→cloud',detail:{desc:'3D generation; VRAM-gated local↔cloud.',files:['services.config.json']}},
    {id:'s-cin',x:810,y:912,kind:'svc',label:'cinopsis',sub:'video → structured',detail:{desc:'Video → structured (Flask); feeds the knowledge graph.',files:['services.config.json']}},
    {id:'s-nb',x:970,y:912,kind:'svc',label:'notebooks',sub:'Jupyter',detail:{desc:'Jupyter over the Flask adapter.',files:['services.config.json']}},
    {id:'relay',x:1010,y:258,kind:'meta',label:'@prism/relay',sub:'E2EE · Curve25519+NaCl',detail:{desc:'Sovereign E2EE relay. Broker dials OUT; remote clients pair via the daemon pubkey (QR).',files:['packages/prism-relay/'],docs:[{t:'Relay',u:'daemon/relay'}]}},
    {id:'c-ts',x:1010,y:422,kind:'meta',label:'@prism/daemon-client',sub:'TS client',detail:{desc:'connect/call/stream/onServiceUpdate for VS Code/Electron/mobile-web.',files:['packages/prism-daemon-client/src/client.ts'],docs:[{t:'Clients',u:'daemon/clients'}]}},
    {id:'c-go',x:1010,y:586,kind:'meta',label:'cli/daemon (Go)',sub:'coder/websocket',detail:{desc:'Go WS client; powers `prism-cli daemon ls`.',files:['apps/prism-cli/daemon/client.go'],docs:[{t:'Clients',u:'daemon/clients'}]}},
    {id:'e-fb',x:520,y:340,kind:'err',label:'daemon down → in-process',sub:'broker-preferred / fallback',detail:{desc:'If the broker is unreachable, surfaces fall back to their direct connection — the panel works with or without the daemon.',files:['…/PrismPanelProvider.ts']}},
    {id:'e-vr',x:650,y:1010,kind:'err',label:'VRAM gate → cloud',sub:'try-local→cloud',detail:{desc:'If the VRAM gate isn’t met, resolve the cloud endpoint (RunPod/HF) + cache it.',files:['…/resolve.ts']}},
    {id:'e-ver',x:660,y:540,kind:'err',label:'version mismatch → restart',sub:'meta.json sync',detail:{desc:'daemon-manager restarts once on a version mismatch (race-free).',files:['…/daemon-manager.ts']}},
  ],
  edges:[['vscode','grpc','main'],['electron','grpc','main'],['cli','c-go','main'],['mobile','relay','main'],
    ['grpc','bridge','main'],['bridge','broker','main'],['c-ts','broker','main'],['c-go','broker','main'],
    ['broker','a-ws','main'],['broker','a-paseo','main'],['broker','a-rest','main'],['broker','a-mcp','main'],['broker','a-flask','main'],
    ['a-paseo','s-agent','main'],['a-mcp','s-code','main'],['a-mcp','s-know','main'],['a-rest','s-design','main'],
    ['a-flask','s-3d','main'],['a-flask','s-cin','main'],['a-flask','s-nb','main'],
    ['mgr','broker','meta'],['broker','relay','meta'],['electron','mgr','meta'],
    ['bridge','e-fb','err'],['s-3d','e-vr','err'],['mgr','e-ver','err']],
};

/* ===== WORKFLOWS ===== */
VIEWS.workflows = {
  legend:['Primary path','Failure → debug','Branch / feeds-into'],
  bands:[
    {x:0,y:60,w:1240,h:88,lab:'Step 0',name:'Set up'},
    {x:0,y:188,w:1240,h:88,lab:'Step 1',name:'Capture & Ideate'},
    {x:0,y:316,w:1240,h:88,lab:'Step 2',name:'Architect'},
    {x:0,y:444,w:1240,h:88,lab:'Step 3',name:'Plan (the contract)'},
    {x:0,y:572,w:1240,h:112,lab:'Step 4',name:'Execute (3 scales)'},
    {x:0,y:724,w:1240,h:88,lab:'Step 5',name:'Verify'},
    {x:0,y:852,w:1240,h:88,lab:'Step 6',name:'Ship'},
  ],
  nodes:[
    {id:'init',x:60,y:92,kind:'flow',label:'/prism-init',sub:'set up .prism/',detail:{desc:'Creates the .prism/ structure (research, plans, brainstorms, designs, validation, spectrum…). Run once per project.',files:['skills/prism-init/'],docs:[]}},
    {id:'capture',x:60,y:220,kind:'flow',label:'/prism-capture',sub:'design inspiration → ledger',detail:{desc:'Capture → Triage → Translate: codify design references BEFORE brainstorming. Output: .prism/shared/captures/. Feeds brainstorm as pre-loaded context.',files:['skills/prism-capture/']}},
    {id:'brand',x:280,y:220,kind:'flow',label:'/prism-brand',sub:'brand identity',detail:{desc:'Logo ideation → refinement → system (color/type/motion). Output feeds prism-design’s token baseline.',files:['skills/prism-brand/']}},
    {id:'brainstorm',x:540,y:220,kind:'flow',label:'/prism-brainstorm',sub:'decisions ledger',detail:{desc:'Interactive ideation (optional visual companion). DECIDES Q1..Qn + parked concerns. Output: .prism/shared/brainstorms/. Upstream of design.',files:['skills/prism-brainstorm/'],docs:[]}},
    {id:'research',x:820,y:220,kind:'flow',label:'/prism-research',sub:'map the codebase',detail:{desc:'Documentarian-only: spawns parallel agents to map WHERE/HOW code works. No critique. Output: .prism/shared/research/. The code-focused entry to planning.',files:['skills/prism-research/']}},
    {id:'design',x:540,y:348,kind:'flow',label:'/prism-design',sub:'architecture from decisions',detail:{desc:'Turns a brainstorm ledger into architecture (mermaid, contracts, data models) + a .pen / design_prompt.yaml. REQUIRES a brainstorm ledger by default.',files:['skills/prism-design/'],docs:[]}},
    {id:'plan',x:430,y:476,kind:'flow',label:'/prism-plan',sub:'the contract',detail:{desc:'Interactive planning → an executable plan with two-category success criteria. "Plans are contracts." Output: .prism/shared/plans/. Entered from research OR design.',files:['skills/prism-plan/']}},
    {id:'decompose',x:740,y:476,kind:'flow',label:'/decompose_plan',sub:'plan → stories.json',detail:{desc:'Converts a plan into Spectrum-style stories (stories.json) for autonomous iteration.',files:['skills/prism-decompose/','commands/decompose_plan.md']}},
    {id:'implement',x:110,y:604,kind:'flow',label:'/prism-implement',sub:'direct · single phase',detail:{desc:'Execute the plan phase by phase with verification checkpoints. For quick / single-phase work.',files:['skills/prism-implement/']}},
    {id:'subagent',x:430,y:604,kind:'flow',label:'/prism-subagent',sub:'medium · 3–10 tasks',detail:{desc:'Same-session subagent-driven execution: fresh implementer per task, two-stage review, bounded retries. Between implement and spectrum.',files:['skills/prism-subagent/']}},
    {id:'spectrum',x:740,y:604,kind:'flow',label:'/prism-spectrum',sub:'autonomous · 10+ stories',detail:{desc:'One story per FRESH Claude session via spectrum.sh. Memory persists through stories.json + progress.md, not context. Signal protocol: <spectrum-continue> etc.',files:['skills/prism-spectrum/','scripts/spectrum.sh']}},
    {id:'dispatch',x:1010,y:604,kind:'meta',label:'/prism-dispatch',sub:'parallel fan-out',detail:{desc:'Generalized parallel agent fan-out (used by research + others).',files:['skills/prism-dispatch/']}},
    {id:'validate',x:300,y:752,kind:'flow',label:'/prism-validate',sub:'verify vs criteria',detail:{desc:'Verifies the implementation against the plan’s success criteria. Output: .prism/shared/validation/.',files:['skills/prism-validate/']}},
    {id:'verify',x:560,y:752,kind:'flow',label:'/prism-verify',sub:'run & observe',detail:{desc:'Run the app and observe real behavior (browser/visual). Confirms a change actually works.',files:['skills/prism-verify/']}},
    {id:'debug',x:880,y:752,kind:'err',label:'/prism-debug',sub:'on failure',detail:{desc:'When something fails (impl error, Spectrum gate fail): parallel git/log/state investigators find root cause.',files:['skills/prism-debug/']}},
    {id:'finish',x:300,y:880,kind:'flow',label:'/prism-finish',sub:'wrap the branch',detail:{desc:'Clean up a dev branch: PR description, handoff, cleanup.',files:['skills/prism-finish/']}},
    {id:'bookend',x:560,y:880,kind:'flow',label:'/prism-bookend',sub:'context-aware release',detail:{desc:'Analyze commits → version bump → docs snapshot → sync VitePress → release. (Used for v3.6.0.)',files:['skills/prism-bookend/']}},
    {id:'release',x:820,y:880,kind:'flow',label:'/prism-release',sub:'build + tag + publish',detail:{desc:'Bumps version across files, builds CLI/VSIX/Electron/Tauri, tags, pushes, GitHub release.',files:['skills/prism-release/']}},
  ],
  edges:[['init','research','meta'],['init','brainstorm','meta'],
    ['capture','brainstorm','main'],['brand','design','meta'],['brainstorm','design','main'],
    ['design','plan','main'],['research','plan','main'],
    ['plan','implement','main'],['plan','subagent','main'],['plan','decompose','main'],['decompose','spectrum','main'],
    ['research','dispatch','meta'],
    ['implement','validate','main'],['subagent','validate','main'],['spectrum','validate','main'],
    ['validate','verify','main'],['verify','finish','main'],['finish','bookend','main'],['bookend','release','main'],
    ['implement','debug','err'],['spectrum','debug','err']],
};

/* ===== PLUGIN INTERNALS (category nodes → expand to members) ===== */
function g(cols,y0){ return {cols,x0:220,y0,dx:152,dy:56}; }
VIEWS.plugin = {
  legend:['Component group','—','contains (expand ＋)'],
  bands:[
    {x:0,y:60,w:1180,h:312,lab:'Orchestrators',name:'Skills (25) — /slash workflows + tooling'},
    {x:0,y:404,w:1180,h:312,lab:'Operations',name:'Commands (25)'},
    {x:0,y:748,w:1180,h:212,lab:'Specialists',name:'Agents (14)'},
    {x:0,y:992,w:1180,h:152,lab:'Lifecycle',name:'Hooks (9)'},
    {x:0,y:1176,w:1180,h:152,lab:'Automation',name:'Scripts (12)'},
    {x:0,y:1360,w:1180,h:96,lab:'Servers',name:'MCP'},
    {x:0,y:1488,w:1180,h:96,lab:'Distribution',name:'Build & installers'},
  ],
  nodes:[
    {id:'skills',x:40,y:186,kind:'main',label:'Skills',sub:'25 · click ＋',grid:g(5,-118),detail:{desc:'Auto-discovered orchestrators (YAML frontmatter) — the workflow entry points. Expand to see every one, including the meta skills (docs-update, eval, init, debug, verify) and /prism-decompose.',files:['skills/*/SKILL.md']},members:[
      ['/prism','entry · 4-phase'],['/prism-research','map codebase'],['/prism-brainstorm','decisions ledger'],['/prism-design','architecture'],['/prism-plan','the contract'],
      ['/prism-implement','execute phases'],['/prism-validate','verify criteria'],['/prism-subagent','subagent exec'],['/prism-spectrum','autonomous'],['/prism-decompose','plan→stories'],
      ['/prism-dispatch','parallel fan-out'],['/prism-capture','design refs'],['/prism-brand','brand identity'],['/prism-bookend','release flow'],['/prism-finish','wrap branch'],
      ['/prism-release','build+publish'],['/prism-init','set up .prism/'],['/prism-debug','root-cause'],['/prism-verify','run & observe'],['/prism-iterate','iterate plan'],
      ['/prism-prd','requirements'],['/prism-eval','eval dashboard'],['/prism-visual-docs','visual docs'],['/prism-docs-update','sync VitePress'],['/cl-plugin-structure','author plugins']]},
    {id:'cmds',x:40,y:530,kind:'main',label:'Commands',sub:'25 · click ＋',grid:g(5,-118),detail:{desc:'User-invocable single-purpose /slash prompts.',files:['commands/*.md']},members:[
      ['/create_plan','plan w/ research'],['/decompose_plan','plan→stories.json'],['/implement_plan','execute plan'],['/validate_plan','verify plan'],['/iterate_plan','refine plan'],
      ['/research_codebase','parallel research'],['/commit','atomic commits'],['/describe_pr','PR description'],['/create_handoff','session handoff'],['/resume_handoff','resume handoff'],
      ['/generate_prd','PRD'],['/generate_pricing','pricing'],['/generate_tech_spec','tech spec'],['/generate_user_flows','user flows'],['/worktree','isolate worktree'],
      ['/cli-install','install CLI'],['/cli-uninstall','remove CLI'],['/prism_cli','launch TUI'],['/prism-screenshot','capture UI'],['/prism-browse','in-app browse'],
      ['/prism-debug','debug'],['/prism-verify','verify'],['/prism_dir_update','migrate .prism/'],['/retroactive','backfill'],['/review-setup','review config']]},
    {id:'agents',x:40,y:842,kind:'main',label:'Agents',sub:'14 · click ＋',grid:g(5,-78),detail:{desc:'Task(subagent_type=…) specialists, run in parallel by the workflow skills.',files:['agents/*.md']},members:[
      ['codebase-locator','find WHERE'],['codebase-analyzer','understand HOW'],['codebase-pattern-finder','find patterns'],['prism-locator','find research'],['prism-analyzer','extract insights'],
      ['web-search-researcher','external docs'],['graph-navigator','blast radius'],['git-investigator','git history'],['log-investigator','logs'],['state-investigator','app state'],
      ['browser-verifier','browser checks'],['visual-regression-grader','visual diff'],['spec-reviewer','spec review'],['quality-reviewer','quality review']]},
    {id:'hooks',x:40,y:1058,kind:'meta',label:'Hooks',sub:'9 · click ＋',grid:g(5,-36),detail:{desc:'settings-driven lifecycle handlers (hooks.json).',files:['hooks/hooks.json']},members:[
      ['SessionStart','brainstorm deps'],['PreToolUse','spectrum-approval'],['PreCompact','snapshot state'],['PostCompact','restore state'],['PostToolUse','log-observation'],
      ['WorktreeCreate','worktree-setup'],['WorktreeRemove','worktree-cleanup'],['SubagentStart','log-agent'],['SubagentStop','log-agent']]},
    {id:'scripts',x:40,y:1242,kind:'meta',label:'Scripts',sub:'12 · click ＋',grid:g(6,-36),detail:{desc:'Automation behind the skills + hooks.',files:['scripts/']},members:[
      ['spectrum.sh','autonomous loop'],['spectrum-approval.sh','PreToolUse gate'],['extract-tasks.py','plan→state.json'],['bump-version.py','version sync'],['pre-compact.py','snapshot'],['post-compact.py','restore'],
      ['log-observation.py','PostToolUse log'],['log-agent.py','subagent log'],['worktree-setup.sh','wt create'],['worktree-cleanup.sh','wt remove'],['prism-cli-install.sh','CLI install'],['visual-regression.sh','visual diff']]},
    {id:'mcp',x:40,y:1386,kind:'meta',label:'MCP servers',sub:'4 · click ＋',grid:g(4,-10),detail:{desc:'Model Context Protocol servers wired to Prism.',files:['.mcp.json']},members:[
      ['brainstorm-channel','wake-on-click'],['codebase-memory-mcp','code graph'],['graphify-mcp','knowledge graph'],['chrome-devtools','browser']]},
    {id:'build',x:40,y:1514,kind:'meta',label:'Build & installers',sub:'5 · click ＋',grid:g(5,-10),detail:{desc:'How Prism ships across platforms.',files:['apps/prism-installer/']},members:[
      ['prism-installer','Tauri/Rust'],['prism-setup','legacy NSIS'],['cli-install','PATH+workspace'],['daemon bundle','esbuild .cjs'],['prism-docs','VitePress+Pages']]},
  ],
  edges:[],
};
for(const n of VIEWS.plugin.nodes) if(n.members) n.children=n.members.map((m,i)=>({id:n.id+'-'+i,dx:n.grid.x0+(i%n.grid.cols)*n.grid.dx,dy:n.grid.y0+((i/n.grid.cols|0))*n.grid.dy,label:m[0],sub:m[1]}));
