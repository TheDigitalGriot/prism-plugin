import{_ as n,o as a,c as e,ai as p}from"./chunks/framework.CaiDwmc7.js";const m=JSON.parse('{"title":"Source Structure","description":"Complete file tree for the Electron desktop app, including main process, preload, office subsystem, and React SPA.","frontmatter":{"title":"Source Structure","description":"Complete file tree for the Electron desktop app, including main process, preload, office subsystem, and React SPA.","outline":[2,3]},"headers":[],"relativePath":"electron/source-structure.md","filePath":"electron/source-structure.md","lastUpdated":0}'),i={name:"electron/source-structure.md"};function l(r,s,t,c,o,b){return a(),e("div",null,[...s[0]||(s[0]=[p(`<h1 id="electron-source-structure" tabindex="-1">Electron Source Structure <a class="header-anchor" href="#electron-source-structure" aria-label="Permalink to “Electron Source Structure”">​</a></h1><div class="language- line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e;" tabindex="0" dir="ltr"><code><span class="line"><span>cmd/prism-electron/</span></span>
<span class="line"><span>├── src/                               # Main process (Node.js + TypeScript)</span></span>
<span class="line"><span>│   ├── main.ts                        # App lifecycle, window, menu, CLI args (111 lines)</span></span>
<span class="line"><span>│   ├── preload.ts                     # contextBridge: electronAPI + office IPC (62 lines)</span></span>
<span class="line"><span>│   ├── window-state.ts                # Window bounds + lastProjectDir persistence (58 lines)</span></span>
<span class="line"><span>│   ├── renderer.tsx                   # Renderer entry (minimal, unused — webview-ui is root)</span></span>
<span class="line"><span>│   ├── App.tsx                        # Placeholder (webview-ui/src/App.tsx is real app)</span></span>
<span class="line"><span>│   │</span></span>
<span class="line"><span>│   ├── hosts/electron/                # Platform shell (mirrors hosts/vscode/)</span></span>
<span class="line"><span>│   │   ├── ElectronIPCBridge.ts      # ipcMain handler registration + controller wiring (511 lines)</span></span>
<span class="line"><span>│   │   └── ElectronPrismController.ts # VSCode-free controller (thin — extends BasePrismController, 45 lines)</span></span>
<span class="line"><span>│   │</span></span>
<span class="line"><span>│   ├── auth/                          # Authentication (NEW)</span></span>
<span class="line"><span>│   │   └── ElectronSecretStorage.ts  # SecretStore via Electron safeStorage API (102 lines)</span></span>
<span class="line"><span>│   │</span></span>
<span class="line"><span>│   ├── office/                        # Office subsystem (NEW — 692 lines combined)</span></span>
<span class="line"><span>│   │   ├── ElectronAgentManager.ts   # Spawns Claude CLI, watches JSONL transcripts (386 lines)</span></span>
<span class="line"><span>│   │   └── ElectronOfficeProvider.ts # Orchestrates office: assets, agents, messages, layout (306 lines)</span></span>
<span class="line"><span>│   │</span></span>
<span class="line"><span>│   └── prism/                         # Electron-specific Prism domain modules</span></span>
<span class="line"><span>│       │   # NOTE: config.ts (79 lines), watcher.ts (72 lines), init.ts (50 lines)</span></span>
<span class="line"><span>│       │   # have moved to packages/prism-core/src/prism/ and are consumed via @prism-core/*.</span></span>
<span class="line"><span>│       │   # This directory may be empty or contain thin wrappers.</span></span>
<span class="line"><span>│</span></span>
<span class="line"><span>├── webview-ui/                        # React SPA (separate Vite build root, dev port 5174)</span></span>
<span class="line"><span>│   ├── src/</span></span>
<span class="line"><span>│   │   ├── main.tsx                   # React root entry</span></span>
<span class="line"><span>│   │   ├── App.tsx                    # Top-level IDE shell (AppShell + view switcher)</span></span>
<span class="line"><span>│   │   ├── Providers.tsx              # PrismStateContextProvider</span></span>
<span class="line"><span>│   │   ├── electron.ts               # Transport adapter (replaces vscode.ts)</span></span>
<span class="line"><span>│   │   │</span></span>
<span class="line"><span>│   │   ├── services/                  # gRPC clients (imported from @prism-ui or local)</span></span>
<span class="line"><span>│   │   │   ├── grpc-client-base.ts</span></span>
<span class="line"><span>│   │   │   └── grpc-client.ts</span></span>
<span class="line"><span>│   │   │</span></span>
<span class="line"><span>│   │   ├── context/</span></span>
<span class="line"><span>│   │   │   ├── PrismStateContext.tsx  # Global state (hydrated from main process)</span></span>
<span class="line"><span>│   │   │   └── LayoutContext.tsx      # IDE shell layout state management (233 lines, NEW)</span></span>
<span class="line"><span>│   │   │</span></span>
<span class="line"><span>│   │   ├── views/                     # View components (NEW)</span></span>
<span class="line"><span>│   │   │   ├── FileContentView.tsx   # File content viewer with syntax highlighting (215 lines)</span></span>
<span class="line"><span>│   │   │   ├── GitGraphView.tsx      # Visual git commit graph (309 lines)</span></span>
<span class="line"><span>│   │   │   └── StoryDetailView.tsx   # Story details with progress bars + file lists (291 lines)</span></span>
<span class="line"><span>│   │   │</span></span>
<span class="line"><span>│   │   ├── components/</span></span>
<span class="line"><span>│   │   │   ├── layout/               # IDE shell layout components (NEW — 8 files)</span></span>
<span class="line"><span>│   │   │   │   ├── ActivityBar.tsx   # Vertical icon bar, left rail (200 lines)</span></span>
<span class="line"><span>│   │   │   │   ├── AppShell.tsx      # Top-level IDE layout shell (178 lines)</span></span>
<span class="line"><span>│   │   │   │   ├── BottomPanel.tsx   # Collapsible bottom panel area (211 lines)</span></span>
<span class="line"><span>│   │   │   │   ├── BottomStatusBar.tsx # Status bar at bottom (101 lines)</span></span>
<span class="line"><span>│   │   │   │   ├── ContentRail.tsx   # Content panel for tree views (138 lines)</span></span>
<span class="line"><span>│   │   │   │   ├── FloatingChatPill.tsx # Floating chat trigger button (63 lines)</span></span>
<span class="line"><span>│   │   │   │   ├── HeaderBar.tsx     # Top header with phase buttons (392 lines)</span></span>
<span class="line"><span>│   │   │   │   └── TabBar.tsx        # Tab bar for editor area (164 lines)</span></span>
<span class="line"><span>│   │   │   │</span></span>
<span class="line"><span>│   │   │   ├── panels/               # Panel components (NEW — 6 files)</span></span>
<span class="line"><span>│   │   │   │   ├── FilesPanel.tsx    # File tree panel</span></span>
<span class="line"><span>│   │   │   │   ├── GitPanel.tsx      # Git status panel</span></span>
<span class="line"><span>│   │   │   │   ├── MonitorPanel.tsx  # Quality gates panel</span></span>
<span class="line"><span>│   │   │   │   ├── SpectrumPanel.tsx # Spectrum execution panel</span></span>
<span class="line"><span>│   │   │   │   ├── StoriesPanel.tsx  # Stories list panel</span></span>
<span class="line"><span>│   │   │   │   └── WorkspacePanel.tsx # Workspace management panel</span></span>
<span class="line"><span>│   │   │   │</span></span>
<span class="line"><span>│   │   │   ├── chat/                  # ChatRow, ChatTextArea, ToolRow (via @prism-ui)</span></span>
<span class="line"><span>│   │   │   ├── spectrum/             # ActivityLog, ProgressBar, StoryList, Controls (via @prism-ui)</span></span>
<span class="line"><span>│   │   │   ├── workflow/             # PhaseIndicator (via @prism-ui)</span></span>
<span class="line"><span>│   │   │   └── common/               # MarkdownBlock, shared UI (via @prism-ui)</span></span>
<span class="line"><span>│   │   │</span></span>
<span class="line"><span>│   │   ├── office/                    # Office transport (NEW)</span></span>
<span class="line"><span>│   │   │   └── electronOfficeTransport.ts  # Wires canvas office to Electron IPC (36 lines)</span></span>
<span class="line"><span>│   │   │</span></span>
<span class="line"><span>│   │   ├── lib/                       # Utilities (cn, formatters)</span></span>
<span class="line"><span>│   │   └── theme/                     # theme.css (--prism-* vars), spectral.css</span></span>
<span class="line"><span>│   │</span></span>
<span class="line"><span>│   ├── package.json                   # React SPA dependencies</span></span>
<span class="line"><span>│   ├── vite.config.ts                 # Vite SPA config (port 5174, @prism-ui alias)</span></span>
<span class="line"><span>│   └── tsconfig.json                  # React/JSX TypeScript config (@prism-ui/* alias)</span></span>
<span class="line"><span>│</span></span>
<span class="line"><span>├── package.json                       # Main app dependencies + scripts</span></span>
<span class="line"><span>├── forge.config.ts                    # Electron Forge config (extraResource: [&#39;../prism-vscode/assets&#39;])</span></span>
<span class="line"><span>├── tsconfig.json                      # Main process config (paths: @prism-core/* dual fallback)</span></span>
<span class="line"><span>├── vite.main.config.mts               # Vite config for main process (prismCoreAliasPlugin)</span></span>
<span class="line"><span>├── vite.preload.config.mts            # Vite config for preload script</span></span>
<span class="line"><span>└── vite.renderer.config.mts           # Vite config for renderer (root: webview-ui/, @prism-ui alias)</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br><span class="line-number">19</span><br><span class="line-number">20</span><br><span class="line-number">21</span><br><span class="line-number">22</span><br><span class="line-number">23</span><br><span class="line-number">24</span><br><span class="line-number">25</span><br><span class="line-number">26</span><br><span class="line-number">27</span><br><span class="line-number">28</span><br><span class="line-number">29</span><br><span class="line-number">30</span><br><span class="line-number">31</span><br><span class="line-number">32</span><br><span class="line-number">33</span><br><span class="line-number">34</span><br><span class="line-number">35</span><br><span class="line-number">36</span><br><span class="line-number">37</span><br><span class="line-number">38</span><br><span class="line-number">39</span><br><span class="line-number">40</span><br><span class="line-number">41</span><br><span class="line-number">42</span><br><span class="line-number">43</span><br><span class="line-number">44</span><br><span class="line-number">45</span><br><span class="line-number">46</span><br><span class="line-number">47</span><br><span class="line-number">48</span><br><span class="line-number">49</span><br><span class="line-number">50</span><br><span class="line-number">51</span><br><span class="line-number">52</span><br><span class="line-number">53</span><br><span class="line-number">54</span><br><span class="line-number">55</span><br><span class="line-number">56</span><br><span class="line-number">57</span><br><span class="line-number">58</span><br><span class="line-number">59</span><br><span class="line-number">60</span><br><span class="line-number">61</span><br><span class="line-number">62</span><br><span class="line-number">63</span><br><span class="line-number">64</span><br><span class="line-number">65</span><br><span class="line-number">66</span><br><span class="line-number">67</span><br><span class="line-number">68</span><br><span class="line-number">69</span><br><span class="line-number">70</span><br><span class="line-number">71</span><br><span class="line-number">72</span><br><span class="line-number">73</span><br><span class="line-number">74</span><br><span class="line-number">75</span><br><span class="line-number">76</span><br><span class="line-number">77</span><br><span class="line-number">78</span><br><span class="line-number">79</span><br><span class="line-number">80</span><br><span class="line-number">81</span><br><span class="line-number">82</span><br><span class="line-number">83</span><br><span class="line-number">84</span><br></div></div><h2 id="import-strategy" tabindex="-1">Import Strategy <a class="header-anchor" href="#import-strategy" aria-label="Permalink to “Import Strategy”">​</a></h2><p>The Electron app imports shared business logic using TypeScript path aliases with a <strong>dual-path fallback</strong> — it checks <code>packages/prism-core/src</code> first, then falls back to <code>../prism-vscode/src</code>:</p><div class="language-json line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">json</span><pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e;" tabindex="0" dir="ltr"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// tsconfig.json</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">{</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;paths&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;@prism-core/*&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;../../packages/prism-core/src/*&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;../prism-vscode/src/*&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br></div></div><div class="language-typescript line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">typescript</span><pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e;" tabindex="0" dir="ltr"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// vite.main.config.mts — custom plugin with dual resolution</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">function</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> prismCoreAliasPlugin</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">() {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  // Checks packages/prism-core/src first, falls back to ../prism-vscode/src</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br></div></div><p>Additionally, a <strong><code>@prism-ui/*</code> alias</strong> provides access to shared React components:</p><div class="language-json line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">json</span><pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e;" tabindex="0" dir="ltr"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// webview-ui/tsconfig.json</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">{</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;paths&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;@prism-ui/*&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;../../../packages/prism-ui/src/*&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br></div></div><p>Both <code>webview-ui/vite.config.ts</code> and <code>vite.renderer.config.mts</code> set up the same <code>@prism-ui</code> alias. This means both apps remain independently buildable while sharing all platform-agnostic code.</p>`,9)])])}const h=n(i,[["render",l]]);export{m as __pageData,h as default};
