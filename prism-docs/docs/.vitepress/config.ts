import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Prism',
  description: 'AI-Driven Development Workflow Suite — Research → Plan → Implement → Validate',
  base: '/',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['meta', { name: 'description', content: 'Prism — AI-Driven Development Workflow Suite for autonomous AI-driven development across CLI, VS Code, and Electron.' }],
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],

  markdown: {
    lineNumbers: true,
  },

  search: {
    provider: 'local',
  },

  themeConfig: {
    logo: { text: 'Prism' },

    nav: [
      { text: 'Guide', link: '/overview' },
      { text: 'Daemon', link: '/daemon/' },
      { text: 'CLI', link: '/cli/' },
      { text: 'VS Code', link: '/vscode/' },
      { text: 'Electron', link: '/electron/' },
      { text: 'Monorepo', link: '/monorepo/' },
      { text: 'Eval', link: '/eval/' },
      {
        text: 'GitHub',
        link: 'https://github.com/TheDigitalGriot/prism-plugin',
        target: '_blank',
      },
    ],

    outline: {
      level: [2, 3],
    },

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview', link: '/overview' },
        ],
      },
      {
        text: 'Part I — Claude Plugin',
        collapsed: true,
        items: [
          { text: 'Plugin Overview', link: '/plugin/' },
          { text: 'Plugin Manifest & Distribution', link: '/plugin/manifest' },
          { text: 'Three-Layer Architecture', link: '/plugin/architecture' },
          { text: 'Commands Reference', link: '/plugin/commands' },
          { text: 'Agents Reference', link: '/plugin/agents' },
          { text: 'Skills Reference', link: '/plugin/skills' },
          { text: 'Scripts & Automation', link: '/plugin/scripts' },
          { text: 'Hooks Reference', link: '/plugin/hooks' },
          { text: 'Model Assignment Convention', link: '/plugin/model-assignment' },
          { text: 'Component Invocation Graph', link: '/plugin/invocation-graph' },
          { text: 'Data Flow Through .prism/', link: '/plugin/data-flow' },
          { text: 'Behavioral Principles', link: '/plugin/behavioral-principles' },
          { text: 'Plugin Directory Structure', link: '/plugin/directory-structure' },
          { text: 'Plugin Statistics', link: '/plugin/statistics' },
        ],
      },
      {
        text: 'Part II — CLI Dashboard',
        collapsed: true,
        items: [
          { text: 'CLI Overview', link: '/cli/' },
          { text: 'Architecture', link: '/cli/architecture' },
          { text: 'Getting Started', link: '/cli/getting-started' },
          { text: 'Plugin System', link: '/cli/plugin-system' },
          {
            text: 'Screen Reference',
            collapsed: true,
            items: [
              { text: 'Splash Screen', link: '/cli/screens/splash' },
              { text: 'Onboarding', link: '/cli/screens/onboarding' },
              { text: 'Home Screen', link: '/cli/screens/home' },
              { text: 'Research Screen', link: '/cli/screens/research' },
              { text: 'Plans Screen', link: '/cli/screens/plans' },
              { text: 'Spectrum Dashboard', link: '/cli/screens/spectrum' },
              { text: 'Files Screen', link: '/cli/screens/files' },
              { text: 'Git Screen', link: '/cli/screens/git' },
              { text: 'Agent Screen', link: '/cli/screens/agent' },
              { text: 'Monitor Screen', link: '/cli/screens/monitor' },
              { text: 'Browser Screen', link: '/cli/screens/browser' },
              { text: 'Workspaces Screen', link: '/cli/screens/workspaces' },
            ],
          },
          { text: 'App Shell', link: '/cli/app-shell' },
          { text: 'Modal & Dialog Systems', link: '/cli/modals' },
          { text: 'User Flow Diagrams', link: '/cli/user-flows' },
          { text: 'Execution State Machine', link: '/cli/state-machine' },
          { text: 'Animation System', link: '/cli/animation' },
          { text: '3D Prism Rendering', link: '/cli/3d-rendering' },
          { text: 'Splash Screen Rendering', link: '/cli/splash-rendering' },
          { text: 'Domain Models', link: '/cli/domain-models' },
          { text: 'Claude CLI Integration', link: '/cli/claude-integration' },
          { text: 'Terminal Detection', link: '/cli/terminal-detection' },
          { text: 'Diff System', link: '/cli/diff-system' },
          { text: 'File Watcher, State & Registry', link: '/cli/file-watcher' },
          { text: 'Keyboard Reference', link: '/cli/keyboard' },
          { text: 'Styling Reference', link: '/cli/styling' },
          { text: 'Vertical Layout & Height Budget', link: '/cli/layout' },
          { text: 'Configuration', link: '/cli/configuration' },
        ],
      },
      {
        text: 'Part III — VS Code Extension',
        collapsed: true,
        items: [
          { text: 'VS Code Overview', link: '/vscode/' },
          { text: 'Extension Architecture', link: '/vscode/architecture' },
          { text: 'Source Structure', link: '/vscode/source-structure' },
          { text: 'PrismController', link: '/vscode/controller' },
          { text: 'IPC Architecture', link: '/vscode/ipc' },
          { text: 'Sidebar Webview', link: '/vscode/sidebar' },
          { text: 'Bottom Panel Webview', link: '/vscode/bottom-panel' },
          { text: 'Native Tree Views & Status Bar', link: '/vscode/tree-views' },
          { text: 'Commands & Keybindings', link: '/vscode/commands' },
          { text: 'Extension Settings', link: '/vscode/settings' },
          { text: 'Workflow State Machine', link: '/vscode/state-machine' },
          { text: 'Spectrum Execution', link: '/vscode/spectrum' },
          { text: 'Plugin Skill Integration', link: '/vscode/plugin-skills' },
          { text: 'Office Visualization', link: '/vscode/office' },
          { text: 'Technology Stack', link: '/vscode/tech-stack' },
        ],
      },
      {
        text: 'Part IV — Electron Desktop App',
        collapsed: true,
        items: [
          { text: 'Electron Overview', link: '/electron/' },
          { text: 'Architecture', link: '/electron/architecture' },
          { text: 'Source Structure', link: '/electron/source-structure' },
          { text: 'Main Process & Window Management', link: '/electron/main-process' },
          { text: 'Preload & Context Bridge', link: '/electron/preload' },
          { text: 'IPC Bridge', link: '/electron/ipc-bridge' },
          { text: 'ElectronPrismController', link: '/electron/controller' },
          { text: 'Platform Modules', link: '/electron/platform-modules' },
          { text: 'Webview UI — React SPA', link: '/electron/webview-ui' },
          { text: 'State Management', link: '/electron/state-management' },
          { text: 'Build & Packaging', link: '/electron/build' },
          { text: 'Security Hardening', link: '/electron/security' },
          { text: 'Three-Platform Feature Parity', link: '/electron/feature-parity' },
        ],
      },
      {
        text: 'Part V — Monorepo Architecture',
        collapsed: true,
        items: [
          { text: 'Repository Structure', link: '/monorepo/' },
          { text: 'npm Workspaces', link: '/monorepo/workspaces' },
          { text: 'packages/prism-core', link: '/monorepo/prism-core' },
          { text: 'packages/prism-ui', link: '/monorepo/prism-ui' },
          { text: 'Platform Shell Responsibilities', link: '/monorepo/platform-shells' },
          { text: 'Development Workflow', link: '/monorepo/dev-workflow' },
          { text: 'Production Hardening (v2.4.1+)', link: '/monorepo/production-hardening' },
          { text: 'Centralized Version Management', link: '/monorepo/version-management' },
          { text: 'Unified Tauri Installer', link: '/monorepo/installer' },
        ],
      },
      {
        text: 'Part VI — Daemon Broker',
        collapsed: true,
        items: [
          { text: 'Overview', link: '/daemon/' },
          { text: 'Broker Core', link: '/daemon/broker' },
          { text: 'Adapters', link: '/daemon/adapters' },
          { text: 'Surface Clients', link: '/daemon/clients' },
          { text: 'Desktop Daemon-Manager', link: '/daemon/desktop-manager' },
          { text: 'Seam Bridge', link: '/daemon/seam-bridge' },
          { text: 'E2EE Relay', link: '/daemon/relay' },
        ],
      },
      {
        text: 'Part VII — Eval Dashboard',
        collapsed: true,
        items: [
          { text: 'Eval Dashboard Overview', link: '/eval/' },
          { text: 'Screens & Skill Integration', link: '/eval/screens' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/TheDigitalGriot/prism-plugin' },
    ],

    footer: {
      message: 'Prism — AI-Driven Development Workflow Suite',
      copyright: 'v3.6.0',
    },

    editLink: {
      pattern: 'https://github.com/TheDigitalGriot/prism-plugin/edit/main/prism-docs/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
