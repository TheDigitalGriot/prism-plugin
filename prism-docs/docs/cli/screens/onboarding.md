---
title: Onboarding Screen
description: Full-screen setup wizard displayed when .prism/ directory or stories.json is missing. Walks through 4 setup steps.
outline: [2, 3]
---

# Onboarding Screen

A full-screen setup wizard displayed after the splash when `.prism/` directory or `stories.json` is missing. Walks through 4 steps to initialize the project.

## Four Steps

| Step | Title | Description | Auto-detect |
|------|-------|-------------|-------------|
| 1 | Project Directory | Detect or select project directory | Yes — `os.Getwd()` |
| 2 | .prism/ Directory | Check/create .prism/ directory structure | Yes — `os.Stat` |
| 3 | Claude CLI | Verify claude CLI is installed | Yes — `exec.LookPath` |
| 4 | Stories File | Verify/create stories.json | Yes — `os.Stat` |

## UI Layout

```
  ██▀▀█▄ ██▀▀█▄ ▀██▀ ▄██▀▀ ██▄▀▄██
  ██▄▄█▀ ██▄▄█▀  ██  ▀██▄  ██ ▀ ██
  ██     ██  ██ ▄██▄ ▄▄██▀ ██   ██

  Welcome to Prism CLI! Let's set up your project.

  ✓  Project Directory     Detected: /Users/demo/project
  ▶  .prism/ Directory     Check for .prism/ directory structure
  ○  Claude CLI            Verify claude CLI is installed
  ○  Stories File          Verify stories.json exists

  Step 2 of 4

  enter execute   j/k navigate
```

## Key Bindings

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Execute current step action |
| `j` / `↓` | Next step |
| `k` / `↑` | Previous step |

## UI Layout — Migration Flow

When `HasLegacyDir == true` (legacy `thoughts/` directory detected), the welcome text and step descriptions change:

```
  ██▀▀█▄ ██▀▀█▄ ▀██▀ ▄██▀▀ ██▄▀▄██
  ██▄▄█▀ ██▄▄█▀  ██  ▀██▄  ██ ▀ ██
  ██     ██  ██ ▄██▄ ▄▄██▀ ██   ██

  Legacy Project Detected
  Found thoughts/ directory — let's migrate to .prism/

  ▶  Project Directory     Detected: /Users/demo/project
  ○  .prism/ Directory     Migrate thoughts/ → .prism/
  ○  Claude CLI            Verify claude CLI is installed
  ○  Stories File          Verify stories.json exists

  Step 1 of 4

  enter execute   j/k navigate
```

## UI Layout — Completed State

After all 4 steps finish successfully:

```
  ██▀▀█▄ ██▀▀█▄ ▀██▀ ▄██▀▀ ██▄▀▄██
  ██▄▄█▀ ██▄▄█▀  ██  ▀██▄  ██ ▀ ██
  ██     ██  ██ ▄██▄ ▄▄██▀ ██   ██

  ✓ Setup Complete!
  Navigating to Home...

  ✓  Project Directory     Detected: /Users/demo/project
  ✓  .prism/ Directory     Created .prism/ structure
  ✓  Claude CLI            Found: /usr/local/bin/claude
  ✓  Stories File          Found stories.json

  Progress: 4/4 steps complete
```

Automatically transitions to Home screen after a short delay.

Steps auto-advance when already satisfied. On completion, emits `OnboardingCompleteMsg` to transition to Home.
