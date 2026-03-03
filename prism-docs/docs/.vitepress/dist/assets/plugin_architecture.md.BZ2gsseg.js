import{_ as n,o as a,c as e,ai as p}from"./chunks/framework.CaiDwmc7.js";const u=JSON.parse('{"title":"Three-Layer Architecture","description":"The plugin follows a strict three-layer architecture — Skills orchestrate, Commands operate, Agents specialize.","frontmatter":{"title":"Three-Layer Architecture","description":"The plugin follows a strict three-layer architecture — Skills orchestrate, Commands operate, Agents specialize.","outline":[2,3]},"headers":[],"relativePath":"plugin/architecture.md","filePath":"plugin/architecture.md","lastUpdated":1772487797000}'),l={name:"plugin/architecture.md"};function r(i,s,c,t,o,b){return a(),e("div",null,[...s[0]||(s[0]=[p(`<h1 id="three-layer-architecture" tabindex="-1">Three-Layer Architecture <a class="header-anchor" href="#three-layer-architecture" aria-label="Permalink to “Three-Layer Architecture”">​</a></h1><p>The plugin follows a strict three-layer architecture where each layer has a distinct responsibility:</p><div class="language- line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e;" tabindex="0" dir="ltr"><code><span class="line"><span>+---------------------------------------------------------------------+</span></span>
<span class="line"><span>|                      USER / CLAUDE CODE                             |</span></span>
<span class="line"><span>|  Types &quot;/prism-research&quot; or Claude auto-detects task context        |</span></span>
<span class="line"><span>+----------------------------+----------------------------------------+</span></span>
<span class="line"><span>                             |</span></span>
<span class="line"><span>                             v</span></span>
<span class="line"><span>+---------------------------------------------------------------------+</span></span>
<span class="line"><span>|  Layer 1: SKILLS  (skills/*/SKILL.md)                               |</span></span>
<span class="line"><span>|                                                                     |</span></span>
<span class="line"><span>|  Workflow orchestrators with YAML frontmatter.                      |</span></span>
<span class="line"><span>|  Auto-activated by trigger patterns or invoked via /skill-name.     |</span></span>
<span class="line"><span>|  They decide WHAT to do: which commands to invoke, which agents     |</span></span>
<span class="line"><span>|  to spawn, and in what order.                                       |</span></span>
<span class="line"><span>|                                                                     |</span></span>
<span class="line"><span>|  Examples: prism, prism-research, prism-plan, prism-spectrum        |</span></span>
<span class="line"><span>+----------------------------+----------------------------------------+</span></span>
<span class="line"><span>                             |</span></span>
<span class="line"><span>              +--------------+--------------+</span></span>
<span class="line"><span>              |                             |</span></span>
<span class="line"><span>              v                             v</span></span>
<span class="line"><span>+------------------------------+  +----------------------------------+</span></span>
<span class="line"><span>|  Layer 2: COMMANDS           |  |  Layer 3: AGENTS                 |</span></span>
<span class="line"><span>|  (commands/*.md)             |  |  (agents/*.md)                   |</span></span>
<span class="line"><span>|                              |  |                                  |</span></span>
<span class="line"><span>|  Single-purpose operations.  |  |  Parallel specialists.           |</span></span>
<span class="line"><span>|  User-invocable via          |  |  Spawned via Task() with         |</span></span>
<span class="line"><span>|  /command-name.              |  |  subagent_type=&quot;agent-name&quot;.     |</span></span>
<span class="line"><span>|  They know HOW to do one     |  |  Run concurrently to maximize    |</span></span>
<span class="line"><span>|  thing well.                 |  |  throughput. Each has a model     |</span></span>
<span class="line"><span>|                              |  |  assignment and tool set.         |</span></span>
<span class="line"><span>|  Examples:                   |  |                                  |</span></span>
<span class="line"><span>|  /create_plan                |  |  Examples:                       |</span></span>
<span class="line"><span>|  /commit                     |  |  codebase-locator (haiku)        |</span></span>
<span class="line"><span>|  /generate_prd               |  |  codebase-analyzer (opus)        |</span></span>
<span class="line"><span>|  /decompose_plan             |  |  web-search-researcher (sonnet)  |</span></span>
<span class="line"><span>+------------------------------+  +----------------------------------+</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br><span class="line-number">19</span><br><span class="line-number">20</span><br><span class="line-number">21</span><br><span class="line-number">22</span><br><span class="line-number">23</span><br><span class="line-number">24</span><br><span class="line-number">25</span><br><span class="line-number">26</span><br><span class="line-number">27</span><br><span class="line-number">28</span><br><span class="line-number">29</span><br><span class="line-number">30</span><br><span class="line-number">31</span><br><span class="line-number">32</span><br><span class="line-number">33</span><br><span class="line-number">34</span><br><span class="line-number">35</span><br><span class="line-number">36</span><br></div></div><p><strong>Key principle</strong>: Skills orchestrate, commands operate, agents specialize. A skill never does the work itself — it delegates to commands and agents. Commands may also spawn agents for parallel research.</p>`,4)])])}const h=n(l,[["render",r]]);export{u as __pageData,h as default};
