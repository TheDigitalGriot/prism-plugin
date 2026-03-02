import{_ as s,o as a,c as p,ai as e}from"./chunks/framework.CaiDwmc7.js";const u=JSON.parse('{"title":"3D Prism Rendering Pipeline","description":"FauxGL-based 3D prism rendering with half-block Unicode ANSI encoding, animated rotation, and fallback text styles.","frontmatter":{"title":"3D Prism Rendering Pipeline","description":"FauxGL-based 3D prism rendering with half-block Unicode ANSI encoding, animated rotation, and fallback text styles.","outline":[2,3]},"headers":[],"relativePath":"cli/3d-rendering.md","filePath":"cli/3d-rendering.md","lastUpdated":0}'),l={name:"cli/3d-rendering.md"};function i(r,n,c,b,t,m){return a(),p("div",null,[...n[0]||(n[0]=[e(`<h1 id="_3d-prism-rendering-pipeline" tabindex="-1">3D Prism Rendering Pipeline <a class="header-anchor" href="#_3d-prism-rendering-pipeline" aria-label="Permalink to “3D Prism Rendering Pipeline”">​</a></h1><h2 id="pipeline-overview" tabindex="-1">Pipeline Overview <a class="header-anchor" href="#pipeline-overview" aria-label="Permalink to “Pipeline Overview”">​</a></h2><div class="language- line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e;" tabindex="0" dir="ltr"><code><span class="line"><span>┌─────────────────┐</span></span>
<span class="line"><span>│  Embedded OBJ   │  444 vertices, 360 triangular faces</span></span>
<span class="line"><span>│  (go:embed)     │  Blender 4.2.16 LTS export</span></span>
<span class="line"><span>└────────┬────────┘</span></span>
<span class="line"><span>         │</span></span>
<span class="line"><span>         ▼</span></span>
<span class="line"><span>┌─────────────────┐</span></span>
<span class="line"><span>│  FauxGL Loader  │  LoadOBJ() → Mesh</span></span>
<span class="line"><span>│  BiUnitCube()   │  Normalize to [-1, +1] cube</span></span>
<span class="line"><span>└────────┬────────┘</span></span>
<span class="line"><span>         │</span></span>
<span class="line"><span>         ▼</span></span>
<span class="line"><span>┌─────────────────┐  Camera: eye(0,0,3) center(0,0,0) up(0,1,0)</span></span>
<span class="line"><span>│  Scene Setup    │  FOV: 50°  Aspect: w/h  Near: 0.1  Far: 100</span></span>
<span class="line"><span>│  Projection     │  Clear: RGB(0.05, 0.04, 0.08) dark purple-black</span></span>
<span class="line"><span>└────────┬────────┘</span></span>
<span class="line"><span>         │</span></span>
<span class="line"><span>         ▼</span></span>
<span class="line"><span>┌─────────────────┐  Y-spin: angle = t × 0.6 rad/s</span></span>
<span class="line"><span>│  Model Transform│  X-tilt: 0.3 ± 0.15 × sin(angle × 0.7)</span></span>
<span class="line"><span>│  (animated)     │  Z-roll: ±0.1 × sin(angle × 0.5)</span></span>
<span class="line"><span>└────────┬────────┘  Matrix order: Rz × Ry × Rx</span></span>
<span class="line"><span>         │</span></span>
<span class="line"><span>         ▼</span></span>
<span class="line"><span>┌─────────────────┐  Key: dir(0.6, 0.5, 1) color(0.9, 0.92, 1.0) @0.85</span></span>
<span class="line"><span>│  Two-Light      │  Fill: dir(-0.4, -0.3, 0.5) color(1.0, 0.85, 0.7) @0.3</span></span>
<span class="line"><span>│  Lambertian     │</span></span>
<span class="line"><span>└────────┬────────┘  Fragment: Σ(color × intensity × max(0, N·L))</span></span>
<span class="line"><span>         │</span></span>
<span class="line"><span>         ▼</span></span>
<span class="line"><span>┌─────────────────┐</span></span>
<span class="line"><span>│  ctx.DrawMesh() │  Rasterize 360 triangles → pixel buffer</span></span>
<span class="line"><span>└────────┬────────┘</span></span>
<span class="line"><span>         │</span></span>
<span class="line"><span>         ▼</span></span>
<span class="line"><span>┌─────────────────┐  Each terminal row = 2 pixel rows</span></span>
<span class="line"><span>│  Half-Block     │  Top pixel → foreground ANSI color</span></span>
<span class="line"><span>│  ANSI Encoding  │  Bottom pixel → background ANSI color</span></span>
<span class="line"><span>│                 │  Character: ▀ (U+2580)</span></span>
<span class="line"><span>└────────┬────────┘</span></span>
<span class="line"><span>         │</span></span>
<span class="line"><span>         ▼</span></span>
<span class="line"><span>┌─────────────────┐</span></span>
<span class="line"><span>│  Terminal Output │  ANSI 24-bit color: \\x1b[38;2;R;G;Bm</span></span>
<span class="line"><span>│  (string)       │  Optimization: skip redundant color codes</span></span>
<span class="line"><span>└─────────────────┘</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br><span class="line-number">19</span><br><span class="line-number">20</span><br><span class="line-number">21</span><br><span class="line-number">22</span><br><span class="line-number">23</span><br><span class="line-number">24</span><br><span class="line-number">25</span><br><span class="line-number">26</span><br><span class="line-number">27</span><br><span class="line-number">28</span><br><span class="line-number">29</span><br><span class="line-number">30</span><br><span class="line-number">31</span><br><span class="line-number">32</span><br><span class="line-number">33</span><br><span class="line-number">34</span><br><span class="line-number">35</span><br><span class="line-number">36</span><br><span class="line-number">37</span><br><span class="line-number">38</span><br><span class="line-number">39</span><br><span class="line-number">40</span><br><span class="line-number">41</span><br><span class="line-number">42</span><br><span class="line-number">43</span><br><span class="line-number">44</span><br><span class="line-number">45</span><br><span class="line-number">46</span><br></div></div><h2 id="resize-behavior" tabindex="-1">Resize Behavior <a class="header-anchor" href="#resize-behavior" aria-label="Permalink to “Resize Behavior”">​</a></h2><div class="language- line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e;" tabindex="0" dir="ltr"><code><span class="line"><span>Terminal Width    Prism Columns    Formula</span></span>
<span class="line"><span>─────────────    ─────────────    ───────────────────────</span></span>
<span class="line"><span>&lt; 80              20              min(max(width/4, 20), 40)</span></span>
<span class="line"><span>80                20              80/4 = 20</span></span>
<span class="line"><span>100               25              100/4 = 25</span></span>
<span class="line"><span>120               30              120/4 = 30</span></span>
<span class="line"><span>160               40              max = 40</span></span>
<span class="line"><span>200               40              clamped at 40</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Prism rows: always 5 (fixed)</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br></div></div><h2 id="text-prism-fallback-variants" tabindex="-1">Text Prism Fallback Variants <a class="header-anchor" href="#text-prism-fallback-variants" aria-label="Permalink to “Text Prism Fallback Variants”">​</a></h2><p>When the 3D renderer is unavailable (<code>m.Prism == nil</code>), a text-based prism is used:</p><div class="language- line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e;" tabindex="0" dir="ltr"><code><span class="line"><span>Style: gradient (default, 1 line) — Spring-animated ray lengths with gradient</span></span>
<span class="line"><span>─◁◆▷▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Style: simple (1 line)</span></span>
<span class="line"><span>-&lt;&gt;====</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Style: braille (3 lines)</span></span>
<span class="line"><span>  ─⢀⣠⣤⣄⡀</span></span>
<span class="line"><span>━━⣾⣿⣿⣿⣷</span></span>
<span class="line"><span>  ⠈⠉⠛⠛⠛⠛⠛⠛</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Style: ascii (5 lines)</span></span>
<span class="line"><span>        ╱╲</span></span>
<span class="line"><span>   ━━━╱  ╲</span></span>
<span class="line"><span>      ╱    ╲━━━</span></span>
<span class="line"><span>     ╱______╲══════</span></span>
<span class="line"><span>               ▬▬▬▬▬▬</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Style: fancy (1 line)</span></span>
<span class="line"><span>─◁◆▷▬▬▬▬</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Style: compact (1 line)</span></span>
<span class="line"><span>─◆▬▬</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br><span class="line-number">19</span><br><span class="line-number">20</span><br><span class="line-number">21</span><br><span class="line-number">22</span><br><span class="line-number">23</span><br></div></div>`,8)])])}const o=s(l,[["render",i]]);export{u as __pageData,o as default};
