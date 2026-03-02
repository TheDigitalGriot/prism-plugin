---
title: Terminal Detection
description: Terminal environment detection capabilities, supported terminals, and IDE theme adaptation.
outline: [2, 3]
---

# Terminal Detection

The terminal detection system (`terminal/`) automatically identifies the user's environment and adapts the UI accordingly.

## Detection Capabilities

| Detection | Method | Fallback |
|-----------|--------|----------|
| Terminal type | Environment variables (priority-ordered) | `"Terminal"` |
| Shell | `PSModulePath`/`COMSPEC` (Windows), `$SHELL` (Unix) | `"unknown"` |
| Color profile | `COLORTERM` env, `termenv` profile | `"TrueColor"` |
| Background color | OSC 11, settings.json, theme file, lookup table | `#0A0910` |
| Nerd Font | IDE settings.json `fontFamily` contains "Nerd" | `false` |
| Git branch | `.git/HEAD` parsing | `""` |
| Accent color | IDE color customizations, theme file, lookup table | `#607088` |
| Editor background | IDE color customizations, theme file, lookup table | `#2c2d3a` |

## Supported Terminals

| Terminal | Detection Method |
|----------|-----------------|
| Cursor | `CURSOR_TRACE_ID` / `CURSOR_EXTENSION_HOST_ROLE` |
| Windsurf | `WINDSURF_PID` |
| VS Code | `VSCODE_PID` / `TERM_PROGRAM=vscode` |
| Windows Terminal | `WT_SESSION` |
| WezTerm | `WEZTERM_PANE` |
| iTerm2 | `ITERM_SESSION_ID` / `TERM_PROGRAM=iTerm.app` |
| Alacritty | `ALACRITTY_WINDOW_ID` |
| Kitty | `KITTY_WINDOW_ID` |
| Hyper | `TERM_PROGRAM=Hyper` |
| Terminal.app | `TERM_PROGRAM=Apple_Terminal` |
| ConEmu | `ConEmuPID` |

## Theme Adaptation

For IDE terminals (VS Code, Cursor, Windsurf), the system:

1. Reads `settings.json` (platform-specific path, JSONC-comment-stripped)
2. Extracts `workbench.colorTheme` and `colorCustomizations`
3. Finds matching theme extension files for accent/background colors
4. Falls back to a lookup table of 19 known themes
5. Applies `styles.ApplyTheme(accentHex)` to override Primary color and rebuild cached styles
6. Applies `styles.ApplySecondary(editorBgHex)` to match inactive tab backgrounds
7. Computes atmosphere color for splash screen blending
