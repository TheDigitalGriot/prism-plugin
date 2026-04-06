package terminal

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ThemeColors holds additional colors extracted from the terminal's active theme.
// These supplement the background color (BgR/BgG/BgB) already in Info.
type ThemeColors struct {
	// Primary accent — the theme's "action" color (button.background).
	AccentR, AccentG, AccentB uint8

	// Terminal foreground — useful as a legibility reference.
	FgR, FgG, FgB uint8

	// Editor background — the main editing surface color (editor.background).
	// Used as the secondary color for inactive UI elements (e.g. inactive tabs).
	EditorBgR, EditorBgG, EditorBgB uint8

	// Source describes which fallback resolved the accent (for debug label).
	AccentSource string

	// EditorBgSource describes which fallback resolved the editor background.
	EditorBgSource string
}

// Default accent: a muted steel-blue that works on any dark bg.
var defaultAccent = [3]uint8{0x60, 0x70, 0x88}

// Default editor background: matches the hardcoded TabBarInactiveBg (#2c2d3a).
var defaultEditorBg = [3]uint8{0x2c, 0x2d, 0x3a}

// DetectThemeColors extracts accent, foreground, and editor background colors
// using the same fallback chain as background detection: IDE settings → theme file → lookup → default.
func DetectThemeColors(info Info) ThemeColors {
	tc := ThemeColors{
		AccentR:   defaultAccent[0],
		AccentG:   defaultAccent[1],
		AccentB:   defaultAccent[2],
		FgR:       0xd8,
		FgG:       0xde,
		FgB:       0xe9,
		EditorBgR: defaultEditorBg[0],
		EditorBgG: defaultEditorBg[1],
		EditorBgB: defaultEditorBg[2],
	}

	// Only IDE terminals have parseable theme files
	switch info.Terminal {
	case "Cursor", "VS Code", "Windsurf":
		// continue to extraction
	default:
		tc.AccentSource = "default"
		tc.EditorBgSource = "default"
		return tc
	}

	cfg := readIDEConfig(info.Terminal)
	if cfg == nil {
		tc.AccentSource = "default"
		tc.EditorBgSource = "default"
		return tc
	}

	accentFound := false
	editorBgFound := false

	// Approach 1: workbench.colorCustomizations overrides
	if customs, ok := cfg.settings["workbench.colorCustomizations"].(map[string]interface{}); ok {
		if extractAccentFromColors(customs, &tc) {
			tc.AccentSource = "settings.json[colorCustomizations]"
			extractForegroundFromColors(customs, &tc)
			accentFound = true
		}
		if extractEditorBgFromColors(customs, &tc) {
			tc.EditorBgSource = "settings.json[colorCustomizations]"
			editorBgFound = true
		}
	}

	// Approach 2: Parse the active theme's JSON file
	if cfg.themeName != "" {
		for _, extDir := range ideExtensionDirs(info.Terminal) {
			if accentFound && editorBgFound {
				break
			}
			extractColorsFromThemeDir(extDir, cfg.themeName, &tc, &accentFound, &editorBgFound)
		}
	}

	// Approach 3: Known theme lookups
	if cfg.themeName != "" {
		if !accentFound {
			if accent, ok := knownThemeAccents[cfg.themeName]; ok {
				tc.AccentR, tc.AccentG, tc.AccentB = accent[0], accent[1], accent[2]
				tc.AccentSource = fmt.Sprintf("lookup[%s]", cfg.themeName)
				if fg, ok := knownThemeForegrounds[cfg.themeName]; ok {
					tc.FgR, tc.FgG, tc.FgB = fg[0], fg[1], fg[2]
				}
				accentFound = true
			}
		}
		if !editorBgFound {
			if rgb, ok := knownThemeEditorBackgrounds[cfg.themeName]; ok {
				tc.EditorBgR, tc.EditorBgG, tc.EditorBgB = rgb[0], rgb[1], rgb[2]
				tc.EditorBgSource = fmt.Sprintf("lookup[%s]", cfg.themeName)
				editorBgFound = true
			}
		}
	}

	if !accentFound {
		tc.AccentSource = "default"
	}
	if !editorBgFound {
		tc.EditorBgSource = "default"
	}

	return tc
}

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

// extractEditorBgFromColors checks colorCustomizations for editor.background.
func extractEditorBgFromColors(colors map[string]interface{}, tc *ThemeColors) bool {
	if hex, ok := colors["editor.background"].(string); ok {
		if r, g, b, ok := parseHexColor(hex); ok {
			tc.EditorBgR, tc.EditorBgG, tc.EditorBgB = r, g, b
			return true
		}
	}
	return false
}

// extractColorsFromThemeDir scans an extensions directory for a theme matching
// themeName and extracts both accent and editor.background from a single file read.
func extractColorsFromThemeDir(extDir, themeName string, tc *ThemeColors, accentFound, editorBgFound *bool) {
	entries, err := os.ReadDir(extDir)
	if err != nil {
		return
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		pkgPath := filepath.Join(extDir, entry.Name(), "package.json")
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
			if !strings.EqualFold(theme.Label, themeName) {
				continue
			}

			themePath := filepath.Join(extDir, entry.Name(), theme.Path)
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

			// Extract accent if not yet found
			if !*accentFound {
				for _, key := range accentKeys {
					if hex, ok := themeJSON.Colors[key]; ok {
						if r, g, b, ok := parseHexColor(hex); ok {
							tc.AccentR, tc.AccentG, tc.AccentB = r, g, b
							tc.AccentSource = fmt.Sprintf("theme-file[%s]", themeName)
							// Also grab foreground while we have the file open
							for _, fk := range foregroundKeys {
								if fhex, ok := themeJSON.Colors[fk]; ok {
									if fr, fg, fb, ok := parseHexColor(fhex); ok {
										tc.FgR, tc.FgG, tc.FgB = fr, fg, fb
										break
									}
								}
							}
							*accentFound = true
							break
						}
					}
				}
			}

			// Extract editor background if not yet found
			if !*editorBgFound {
				if hex, ok := themeJSON.Colors["editor.background"]; ok {
					if r, g, b, ok := parseHexColor(hex); ok {
						tc.EditorBgR, tc.EditorBgG, tc.EditorBgB = r, g, b
						tc.EditorBgSource = fmt.Sprintf("theme-file[%s]", themeName)
						*editorBgFound = true
					}
				}
			}

			return // Found the matching theme, done with this dir
		}
	}
}

// Known theme accent colors (button.background values).
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

// Known theme editor.background values.
// Used as a final fallback when settings.json and theme file parsing both miss.
var knownThemeEditorBackgrounds = map[string][3]uint8{
	// Cursor themes
	"Cursor Dark Midnight": {0x19, 0x1c, 0x22},
	"Cursor Light":         {0xff, 0xff, 0xff},

	// VS Code built-in dark themes
	"Default Dark Modern": {0x1f, 0x1f, 0x1f},
	"Default Dark+":       {0x1e, 0x1e, 0x1e},
	"Visual Studio Dark":  {0x1e, 0x1e, 0x1e},
	"Monokai":             {0x27, 0x28, 0x22},

	// VS Code built-in light themes
	"Default Light Modern": {0xff, 0xff, 0xff},
	"Default Light+":       {0xff, 0xff, 0xff},
	"Visual Studio Light":  {0xff, 0xff, 0xff},

	// Popular marketplace themes
	"One Dark Pro":        {0x28, 0x2c, 0x34},
	"Dracula":             {0x28, 0x2a, 0x36},
	"Nord":                {0x2e, 0x34, 0x40},
	"Solarized Dark":      {0x00, 0x2b, 0x36},
	"Solarized Light":     {0xfd, 0xf6, 0xe3},
	"GitHub Dark":         {0x24, 0x29, 0x2e},
	"GitHub Light":        {0xff, 0xff, 0xff},
	"Ayu Dark":            {0x0a, 0x0e, 0x14},
	"Tokyo Night":         {0x1a, 0x1b, 0x26},
	"Catppuccin Mocha":    {0x1e, 0x1e, 0x2e},
	"Gruvbox Dark Hard":   {0x1d, 0x20, 0x21},
	"Gruvbox Dark Medium": {0x28, 0x28, 0x28},
	"Quiet Light":         {0xf5, 0xf5, 0xf5},
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
