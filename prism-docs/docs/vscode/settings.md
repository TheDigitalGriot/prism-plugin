---
title: Extension Settings
description: The 7 configurable VS Code extension settings — model selection, Spectrum parameters, and auto-approval options.
outline: [2, 3]
---

# Extension Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `prism.defaultModel` | enum | `"sonnet"` | Claude model for implementation work |
| `prism.planningModel` | enum | `"opus"` | Claude model for research/planning |
| `prism.spectrum.maxIterations` | number | `50` | Max iterations before stopping |
| `prism.spectrum.pauseSeconds` | number | `2` | Pause between iterations (seconds) |
| `prism.autoApprove.readFile` | boolean | `true` | Auto-approve file reads |
| `prism.autoApprove.listFiles` | boolean | `true` | Auto-approve directory listing |
| `prism.autoApprove.searchFiles` | boolean | `true` | Auto-approve file searches |
