package terminal

import (
	"encoding/json"
	"fmt"
	"os"
)

// ThemeColors holds additional colors extracted from the terminal's active theme.
// These supplement the background color (BgR/BgG/BgB) already in Info.
type ThemeColors struct {
	// Primary accent — the theme's "action" color (button.background).
	// Used for atmospheric tinting so the splash glow harmonises with the theme.
	AccentR, AccentG, AccentB uint8

	// Terminal foreground — useful as a legibility reference.
	FgR, FgG, FgB uint8

	// Source describes which fallback resolved the accent (for debug label).
	AccentSource string
}

// Default accent: a muted steel-blue that works on any dark bg.
// Chosen to sit between the Prism spectral blue and a neutral grey —
// visible but unobtrusive when no theme accent is available.
var defaultAccent = [3]uint8{0x60, 0x70, 0x88}

// DetectThemeColors extracts accent and foreground colors using the same
// fallback chain as background detection: IDE settings → theme file → lookup → default.
func DetectThemeColors(info Info) ThemeColors {
	tc := ThemeColors{
		AccentR: defaultAccent[0],
		AccentG: defaultAccent[1],
		AccentB: defaultAccent[2],
		FgR:     0xd8,
		FgG:     0xde,
		FgB:     0xe9,
	}

	// Only IDE terminals have parseable theme files
	switch info.Terminal {
	case "Cursor", "VS Code", "Windsurf":
		// pass — continue to extraction
	default:
		tc.AccentSource = "default"
		return tc
	}

	// Re-read IDE config (cheap — single file read, already cached by OS)
	cfg := readIDEConfig(info.Terminal)
	if cfg == nil {
		tc.AccentSource = "default"
		return tc
	}

	// ── Approach 1: workbench.colorCustomizations overrides ──
	if customs, ok := cfg.settings["workbench.colorCustomizations"].(map[string]interface{}); ok {
		if extractAccentFromColors(customs, &tc) {
			tc.AccentSource = "settings.json[colorCustomizations]"
			extractForegroundFromColors(customs, &tc)
			return tc
		}
	}

	// ── Approach 2: Parse the active theme's JSON file ──
	if cfg.themeName != "" {
		for _, extDir := range ideExtensionDirs(info.Terminal) {
			if extractAccentFromThemeDir(extDir, cfg.themeName, &tc) {
				tc.AccentSource = fmt.Sprintf("theme-file[%s]", cfg.themeName)
				return tc
			}
		}
	}

	// ── Approach 3: Known theme accent lookup ──
	if cfg.themeName != "" {
		if accent, ok := knownThemeAccents[cfg.themeName]; ok {
			tc.AccentR, tc.AccentG, tc.AccentB = accent[0], accent[1], accent[2]
			tc.AccentSource = fmt.Sprintf("lookup[%s]", cfg.themeName)
			if fg, ok := knownThemeForegrounds[cfg.themeName]; ok {
				tc.FgR, tc.FgG, tc.FgB = fg[0], fg[1], fg[2]
			}
			return tc
		}
	}

	tc.AccentSource = "default"
	return tc
}

// ── Extraction helpers ──────────────────────────────────────────────

// accentKeys in priority order — button.background is the theme author's
// intentional highlight; progressBar.background is usually identical;
// textLink.foreground is the secondary accent.
var accentKeys = []string{
	"button.background",
	"progressBar.background",
	"textLink.foreground",
	"terminal.ansiCyan",
}

var foregroundKeys = []string{
	"terminal.foreground",
	"editor.foreground",
	"foreground",
}

func extractAccentFromColors(colors map[string]interface{}, tc *ThemeColors) bool {
	for _, key := range accentKeys {
		if hex, ok := colors[key].(string); ok {
			if r, g, b, ok := parseHexColor(hex); ok {
				tc.AccentR, tc.AccentG, tc.AccentB = r, g, b
				return true
			}
		}
	}
	return false
}

func extractForegroundFromColors(colors map[string]interface{}, tc *ThemeColors) {
	for _, key := range foregroundKeys {
		if hex, ok := colors[key].(string); ok {
			if r, g, b, ok := parseHexColor(hex); ok {
				tc.FgR, tc.FgG, tc.FgB = r, g, b
				return
			}
		}
	}
}

func extractAccentFromThemeDir(extDir, themeName string, tc *ThemeColors) bool {
	entries, err := os.ReadDir(extDir)
	if err != nil {
		return false
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		pkgPath := extDir + "/" + entry.Name() + "/package.json"
		pkgData, err := os.ReadFile(pkgPath)
		if err != nil {
			continue
		}

		var pkg struct {
			Contributes struct {
				Themes []struct {
					Label string `json:"label"`
					Path  string `json:"path"`
				} `json:"themes"`
			} `json:"contributes"`
		}
		if err := json.Unmarshal(pkgData, &pkg); err != nil {
			continue
		}

		for _, theme := range pkg.Contributes.Themes {
			if !containsLower(theme.Label, themeName) && !containsLower(themeName, theme.Label) {
				continue
			}

			themePath := extDir + "/" + entry.Name() + "/" + theme.Path
			data, err := os.ReadFile(themePath)
			if err != nil {
				continue
			}
			data = stripJSONCComments(data)

			var themeJSON struct {
				Colors map[string]string `json:"colors"`
			}
			if err := json.Unmarshal(data, &themeJSON); err != nil {
				continue
			}

			// Extract accent
			for _, key := range accentKeys {
				if hex, ok := themeJSON.Colors[key]; ok {
					if r, g, b, ok := parseHexColor(hex); ok {
						tc.AccentR, tc.AccentG, tc.AccentB = r, g, b
						// Also grab foreground while we have the file open
						for _, fk := range foregroundKeys {
							if fhex, ok := themeJSON.Colors[fk]; ok {
								if fr, fg, fb, ok := parseHexColor(fhex); ok {
									tc.FgR, tc.FgG, tc.FgB = fr, fg, fb
									break
								}
							}
						}
						return true
					}
				}
			}
		}
	}

	return false
}

// ── Known theme accent colors ───────────────────────────────────────
// button.background values for common themes (fallback when file parsing fails).

var knownThemeAccents = map[string][3]uint8{
	// Cursor themes
	"Cursor Dark Midnight": {0x88, 0xc0, 0xd0},
	"Cursor Light":         {0x00, 0x7a, 0xcc},

	// VS Code built-in dark themes
	"Default Dark Modern": {0x0e, 0x63, 0x9c},
	"Default Dark+":       {0x0e, 0x63, 0x9c},
	"Visual Studio Dark":  {0x0e, 0x63, 0x9c},
	"Monokai":             {0x0e, 0x63, 0x9c},

	// VS Code built-in light themes
	"Default Light Modern": {0x00, 0x7a, 0xcc},
	"Default Light+":       {0x00, 0x7a, 0xcc},
	"Visual Studio Light":  {0x00, 0x7a, 0xcc},

	// Popular marketplace themes
	"One Dark Pro":        {0x52, 0x8b, 0xff},
	"Dracula":             {0x44, 0x47, 0x5a},
	"Nord":                {0x88, 0xc0, 0xd0},
	"Solarized Dark":      {0x26, 0x8b, 0xd2},
	"Solarized Light":     {0x26, 0x8b, 0xd2},
	"GitHub Dark":         {0x23, 0x8b, 0x45},
	"GitHub Light":        {0x23, 0x8b, 0x45},
	"Ayu Dark":            {0xff, 0xb4, 0x54},
	"Tokyo Night":         {0x3d, 0x59, 0xa1},
	"Catppuccin Mocha":    {0x89, 0xb4, 0xfa},
	"Gruvbox Dark Hard":   {0x45, 0x85, 0x88},
	"Gruvbox Dark Medium": {0x45, 0x85, 0x88},
	"Quiet Light":         {0x44, 0x88, 0xcc},
}

var knownThemeForegrounds = map[string][3]uint8{
	"Cursor Dark Midnight": {0xd8, 0xde, 0xe9},
	"Default Dark Modern":  {0xcc, 0xcc, 0xcc},
	"Default Dark+":        {0xd4, 0xd4, 0xd4},
	"One Dark Pro":         {0xab, 0xb2, 0xbf},
	"Dracula":              {0xf8, 0xf8, 0xf2},
	"Nord":                 {0xd8, 0xde, 0xe9},
	"Tokyo Night":          {0xa9, 0xb1, 0xd6},
	"Catppuccin Mocha":     {0xcd, 0xd6, 0xf4},
}
