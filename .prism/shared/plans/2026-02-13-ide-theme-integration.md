# IDE Theme Color Integration

**Date:** 2026-02-13
**Branch:** feat/spectrum-migration
**Research:** `.prism/shared/docs/theme-file-color-extraction.md`
**Reference:** `ref/tui-theming/` (splash.go, theme.go, model_patch.md)

## Goal

Make the prism-cli visually adapt to the user's IDE color theme by extracting accent/primary and foreground colors from VS Code/Cursor/Windsurf theme files. Tab borders, header backgrounds, and splash atmosphere should harmonize with the active theme. Fall back to current hardcoded palette when not running inside an IDE terminal.

## What We're NOT Doing

- Not changing beam or mesh (icosahedron) colors — those are spectral brand colors
- Not extracting semantic status colors (error/warning/success) from theme — the hardcoded values work well universally
- Not adding a branded-vs-adaptive config toggle (future work)
- Not changing PrismColors (the 4-stop spectral gradient) — those are brand identity

---

## Phase 1: Add ThemeColors Detection (`terminal/theme.go`)

Create a new file `cmd/prism-cli/terminal/theme.go` based on the reference at `ref/tui-theming/theme.go`.

### Steps

- [ ] 1.1 Create `terminal/theme.go` with:
  - `ThemeColors` struct: `AccentR/G/B`, `FgR/G/B`, `AccentSource` fields
  - `DetectThemeColors(info Info) ThemeColors` function
  - `defaultAccent` = `{0x60, 0x70, 0x88}` (muted steel-blue)
  - Default foreground = `{0xd8, 0xde, 0xe9}`
  - Accent key priority: `button.background` > `progressBar.background` > `textLink.foreground` > `terminal.ansiCyan`
  - Foreground key priority: `terminal.foreground` > `editor.foreground` > `foreground`
  - Fallback chain: settings.json colorCustomizations → theme file parsing → `knownThemeAccents` lookup → default
  - `knownThemeAccents` map for common themes (Cursor Dark Midnight: `#88c0d0`, One Dark Pro: `#528bff`, Dracula: `#44475a`, Nord: `#88c0d0`, etc.)
  - `knownThemeForegrounds` map for common themes
  - Helper functions: `extractAccentFromColors`, `extractForegroundFromColors`, `extractAccentFromThemeDir`

- [ ] 1.2 Fix path separators in `extractAccentFromThemeDir`: use `filepath.Join` instead of string concatenation with `/` (the reference code uses `/` but we need cross-platform support matching the existing `searchThemeInDir` which uses `filepath.Join`)

### Key Difference from Reference

The reference `extractAccentFromThemeDir` uses `containsLower` for fuzzy matching of theme names. The existing `searchThemeInDir` uses `strings.EqualFold` (exact case-insensitive). Use `strings.EqualFold` to stay consistent with the existing codebase.

### Verification

```
cd cmd/prism-cli && go build ./terminal/
```

---

## Phase 2: Add `ApplyTheme()` to `styles/theme.go`

Make the color palette overridable so all existing style consumers automatically get theme-aware colors without any changes.

### Steps

- [ ] 2.1 Add `ApplyTheme` function to `styles/theme.go`:
  ```go
  // ApplyTheme overrides the default palette with detected IDE theme colors.
  // Call once at startup after terminal detection. When accent is zero-value,
  // the hardcoded defaults remain.
  func ApplyTheme(accentHex string) {
      if accentHex == "" {
          return
      }
      accent := lipgloss.Color(accentHex)
      Primary = accent
      TabBorderColor = accent

      // Rebuild styles that cache Primary
      TitleStyle = TitleStyle.Foreground(Primary)
      HeaderStyle = HeaderStyle.Background(Primary)
      AppHeaderStyle = AppHeaderStyle.Background(Primary)
      CurrentStyle = CurrentStyle.Foreground(Primary)
      ProgressBarStyle = ProgressBarStyle.Foreground(Primary)
      TabActiveStyle = TabActiveStyle.BorderForeground(TabBorderColor).Foreground(Primary)
      TabInactiveStyle = TabInactiveStyle.BorderForeground(TabBorderColor)
      TabGapStyle = TabGapStyle.BorderForeground(TabBorderColor)

      // Rebuild icons that reference Primary
      PlayIcon = lipgloss.NewStyle().Foreground(Primary).Render("▸")
  }
  ```

- [ ] 2.2 Verify that the lipgloss `.Style` methods return new copies (they do — lipgloss styles are immutable value types), so reassignment is safe.

### Design Decision

Only `Primary` and `TabBorderColor` get overridden. `Info`, `Success`, `Warning`, `Error`, `Dim` keep their hardcoded values because:
- They serve fixed semantic roles (success=green, error=red) that should be universal
- Overriding them from theme would require mapping theme status colors which varies wildly
- The user specifically asked for tab lines and header outlines to use the theme accent

### Verification

```
cd cmd/prism-cli && go build ./styles/
```

---

## Phase 3: Update Splash with Accent-Aware Atmosphere

Apply the reference `ref/tui-theming/splash.go` changes to the actual `splash/splash.go`.

### Steps

- [ ] 3.1 Add `AccentR, AccentG, AccentB uint8` fields to `splash.Model` struct

- [ ] 3.2 Add helper functions before `View()`:
  ```go
  func lerpColor(aR, aG, aB, bR, bG, bB, t float64) (float64, float64, float64)
  func atmosphereTint(bgR, bgG, bgB, targetR, targetG, targetB, density, maxOpacity float64) (float64, float64, float64)
  ```

- [ ] 3.3 Rework `View()` atmospheric rendering:
  - Replace the additive `grey + colorAmt` approach with `atmosphereTint` lerp approach
  - Remove `cIntensity`, `cPeakBoost`, `cGreyMax` variables (replaced by opacity caps)
  - Add opacity cap variables: `waveMaxOpacity`, `ambientMaxOpacity`, `beamAtmoOpacity`, `lumBump`
  - IDE boost adjusts opacity caps instead of color multipliers
  - Wave field: `atmosphereTint(bg → spectral color, waveDensity, waveMaxOpacity)` + `lumBump`
  - Ambient glow (beam side, no particles): `atmosphereTint(bg → desaturated accent midpoint, ambientDensity, ambientMaxOpacity)` + tiny `lumBump`
  - Beam particle glow: kept as-is (it's beam, not atmosphere)
  - Accent midpoint = `(bg + accent) * 0.5` — desaturated, harmonious but not overpowering
  - When no accent detected, use neutral steel-blue `(0x60, 0x70, 0x88)`

- [ ] 3.4 Fix indentation: the current splash.go has a misaligned `charIdx` block at line 543 — fix it while we're editing

### What Changes vs What Stays

| Element | Changes? | Notes |
|---------|----------|-------|
| Wave field coloring | Yes | Lerp-based instead of additive |
| Ambient glow (beam side) | Yes | Tints toward accent midpoint |
| Beam particle glow | No | Kept as-is |
| Mesh (icosahedron) | No | Brand blue stays |
| Title text | No | White stays |
| Gradient bar | No | Spectral brand gradient stays |
| Subtitle | No | Relative to bg, stays |

### Verification

```
cd cmd/prism-cli && go build ./splash/
```

---

## Phase 4: Wire Detection → Styles → Splash in `model.go`

Connect the three pieces in `NewModel()`.

### Steps

- [ ] 4.1 In `model.go` `NewModel()`, after `termInfo := terminal.Detect()` (line 211):
  ```go
  termInfo := terminal.Detect()
  themeColors := terminal.DetectThemeColors(termInfo)

  // Apply theme accent to global styles (tabs, headers, titles)
  if themeColors.AccentSource != "default" {
      styles.ApplyTheme(fmt.Sprintf("#%02x%02x%02x", themeColors.AccentR, themeColors.AccentG, themeColors.AccentB))
  }
  ```

- [ ] 4.2 Wire accent into splash model:
  ```go
  splashModel.AccentR = themeColors.AccentR
  splashModel.AccentG = themeColors.AccentG
  splashModel.AccentB = themeColors.AccentB
  ```

- [ ] 4.3 Add `"fmt"` to imports if not present, and add `styles` import:
  ```go
  import (
      "github.com/prism-plugin/prism-cli/styles"
  )
  ```

- [ ] 4.4 Update `Info.Label()` or `EnvLines()` to include accent source for debug visibility:
  - Add accent source to the third env line (runtime context), e.g. `accent via theme-file[Cursor Dark Midnight]`

### Verification

```
cd cmd/prism-cli && go build .
```

---

## Success Criteria

### Automated Verification

- [ ] `cd cmd/prism-cli && go build .` — compiles without errors
- [ ] `cd cmd/prism-cli && go vet ./...` — no issues
- [ ] `cd cmd/prism-cli && go test ./...` — tests pass (if any exist)

### Manual Verification

- [ ] Running inside Cursor terminal: tab borders, header background, and active tab text use the theme's accent color (`#88c0d0` for Cursor Dark Midnight) instead of purple
- [ ] Running inside Cursor terminal: splash atmosphere has subtle accent-tinted ambient glow instead of neutral grey
- [ ] Running outside IDE (e.g. Windows Terminal): UI uses original hardcoded purple palette — no visible change
- [ ] Splash env info third line shows `accent via theme-file[...]` or `accent via default`
- [ ] Beam, mesh, spectral gradient bar, and title text are unchanged in both environments

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `ApplyTheme` called too late (after styles already copied by init) | Call in `NewModel()` before any plugin `Init()` — styles are read at render time, not init time |
| Theme accent too similar to background (low contrast) | `atmosphereTint` caps opacity at 0.14–0.26, so it never overpowers; tab/header have White foreground which ensures readability |
| Light themes (white bg + light accent) | Tab Active style uses accent as foreground on transparent bg — light accents on light bg could be hard to read. Mitigation: `ApplyTheme` only runs when `AccentSource != "default"`, and we trust theme authors to pick legible accent colors |
| `filepath.Join` vs `/` on Windows | Explicitly use `filepath.Join` in new code, matching existing `searchThemeInDir` pattern |

---

## File Change Summary

| File | Action | Lines Changed (est.) |
|------|--------|---------------------|
| `cmd/prism-cli/terminal/theme.go` | Create | ~250 |
| `cmd/prism-cli/styles/theme.go` | Modify | ~25 |
| `cmd/prism-cli/splash/splash.go` | Modify | ~80 |
| `cmd/prism-cli/app/model.go` | Modify | ~15 |
