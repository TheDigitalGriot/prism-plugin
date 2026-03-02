---
title: Extension Architecture
description: High-level architecture diagram and data flow for the Prism VS Code Extension.
outline: [2, 3]
---

# Extension Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VS Code Extension Host                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PrismController                          │   │
│  │  (Central orchestrator — state, workflow, chat, spectrum)   │   │
│  │                                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │   │
│  │  │ Workflow      │  │ Spectrum     │  │ Plugin/Mode    │   │   │
│  │  │ StateMachine  │  │ Engine       │  │ Bridge         │   │   │
│  │  └──────────────┘  └──────────────┘  └────────────────┘   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │   │
│  │  │ Stories      │  │ Claude       │  │ Agent          │   │   │
│  │  │ Manager      │  │ Runner       │  │ Bridge         │   │   │
│  │  └──────────────┘  └──────────────┘  └────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                         │
│          gRPC-over-postMessage (bidirectional IPC)                  │
│                          │                                         │
│    ┌─────────────────────┴─────────────────────┐                   │
│    │                     │                     │                   │
│    ▼                     ▼                     ▼                   │
│  ┌───────────┐   ┌─────────────┐   ┌──────────────────┐          │
│  │ Sidebar   │   │ Bottom      │   │ Native Tree      │          │
│  │ Webview   │   │ Panel       │   │ Views + Status   │          │
│  │ (React)   │   │ (React)     │   │ Bar              │          │
│  │           │   │             │   │                  │          │
│  │ • Chat    │   │ • Monitor   │   │ • Research tree  │          │
│  │ • Spectrum│   │ • Office    │   │ • Plans tree     │          │
│  │ • Welcome │   │ • Workspaces│   │ • Stories tree   │          │
│  └───────────┘   └─────────────┘   └──────────────────┘          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    .prism/ Directory                         │   │
│  │  (shared with CLI — research, plans, stories, spectrum)     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Input (chat, commands, tree clicks)
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  PrismController                                              │
│                                                                │
│  Message Router:                                               │
│    ChatService.sendMessage ──▶ ClaudeRunner / PluginBridge    │
│    WorkflowService.transition ──▶ WorkflowStateMachine        │
│    SpectrumService.start ──▶ SpectrumEngine                   │
│    PluginService.executeSkill ──▶ PluginBridge                │
│                                                                │
│  State Broadcast:                                              │
│    updateState() ──▶ all subscribers via gRPC streams          │
│                                                                │
│  Events:                                                       │
│    onDidChangeFile ──▶ Tree providers refresh                  │
│    onDidChangeState ──▶ Status bar update                      │
│    onDidStartSession ──▶ AgentBridge                           │
│    onDidUpdateStory ──▶ Stories tree refresh                   │
│    onDidEndSpectrumStory ──▶ Monitor history                   │
└──────────────────────────────────────────────────────────────┘
```
