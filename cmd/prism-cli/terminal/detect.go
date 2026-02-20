package terminal

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/muesli/termenv"
)

// Info holds detected terminal environment details.
type Info struct {
	Terminal     string // e.g. "Cursor", "VS Code", "Windows Terminal", "WezTerm"
	Shell        string // e.g. "PowerShell", "bash", "zsh", "cmd"
	Platform     string // e.g. "windows/amd64", "darwin/arm64"
	ColorProfile string // e.g. "TrueColor", "ANSI256", "ANSI", "Ascii"
	ThemeName    string // e.g. "Cursor Dark Midnight", "Default Dark+"
	HasNerdFont  bool   // true if terminal font contains "Nerd"
	GoVersion    string // e.g. "go1.22.0"
	GitBranch    string // e.g. "feat/spectrum-migration"
	BgR          uint8  // Terminal background color (0 if unavailable)
	BgG          uint8
	BgB          uint8
	BgSource     string // which fallback resolved the color (e.g. "osc11", "theme-file", "lookup")
}

// Detect inspects environment variables to identify the terminal emulator,
// shell, platform, and background color using a multi-approach fallback chain.
func Detect() Info {
	terminal := detectTerminal()

	// Read IDE config once (settings.json) — reused for bg, theme, font
	var ideCfg *ideConfig
	switch terminal {
	case "Cursor", "VS Code", "Windsurf":
		ideCfg = readIDEConfig(terminal)
	}

	r, g, b, source := detectBackground(terminal, ideCfg)

	var themeName string
	var hasNerdFont bool
	if ideCfg != nil {
		themeName = ideCfg.themeName
		hasNerdFont = ideCfg.hasNerdFont
	}

	return Info{
		Terminal:     terminal,
		Shell:        detectShell(),
		Platform:     fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH),
		ColorProfile: detectColorProfile(),
		ThemeName:    themeName,
		HasNerdFont:  hasNerdFont,
		GoVersion:    runtime.Version(),
		GitBranch:    detectGitBranch(),
		BgR:          r,
		BgG:          g,
		BgB:          b,
		BgSource:     source,
	}
}

// Label returns a compact one-line summary, e.g. "Cursor | PowerShell | windows/amd64 | bg:#191c22"
func (i Info) Label() string {
	return fmt.Sprintf("%s | %s | %s | bg:#%02x%02x%02x", i.Terminal, i.Shell, i.Platform, i.BgR, i.BgG, i.BgB)
}

// EnvLines returns formatted lines for splash display.
func (i Info) EnvLines() []string {
	lines := []string{i.Label()}

	// Line 2: rendering capabilities
	var caps []string
	if i.ColorProfile != "" {
		caps = append(caps, i.ColorProfile)
	}
	if i.ThemeName != "" {
		caps = append(caps, i.ThemeName)
	}
	if i.HasNerdFont {
		caps = append(caps, "nerd-font")
	}
	if len(caps) > 0 {
		lines = append(lines, strings.Join(caps, " | "))
	}

	// Line 3: runtime context
	var ctx []string
	if i.GoVersion != "" {
		ctx = append(ctx, i.GoVersion)
	}
	if i.GitBranch != "" {
		ctx = append(ctx, i.GitBranch)
	}
	if i.BgSource != "" {
		ctx = append(ctx, "bg via "+i.BgSource)
	}
	if len(ctx) > 0 {
		lines = append(lines, strings.Join(ctx, " | "))
	}

	return lines
}

// IsIDETerminal returns true when running inside an IDE's integrated terminal
// (Cursor, VS Code, Windsurf, etc.) which tend to render truecolor ANSI
// more washed-out than standalone terminal emulators.
func (i Info) IsIDETerminal() bool {
	switch i.Terminal {
	case "Cursor", "VS Code", "Windsurf":
		return true
	default:
		return false
	}
}

// ideConfig holds parsed IDE settings (read once, reused for bg + theme + font).
type ideConfig struct {
	themeName   string
	fontFamily  string
	hasNerdFont bool
	settings    map[string]interface{}
}

func readIDEConfig(terminal string) *ideConfig {
	settingsPath := ideSettingsPath(terminal)
	if settingsPath == "" {
		return nil
	}

	data, err := os.ReadFile(settingsPath)
	if err != nil {
		return nil
	}
	data = stripJSONCComments(data)

	var settings map[string]interface{}
	if err := json.Unmarshal(data, &settings); err != nil {
		return nil
	}

	cfg := &ideConfig{settings: settings}
	cfg.themeName, _ = settings["workbench.colorTheme"].(string)

	// Check terminal font first, fall back to editor font
	cfg.fontFamily, _ = settings["terminal.integrated.fontFamily"].(string)
	if cfg.fontFamily == "" {
		cfg.fontFamily, _ = settings["editor.fontFamily"].(string)
	}
	cfg.hasNerdFont = containsLower(cfg.fontFamily, "nerd")

	return cfg
}

func detectTerminal() string {
	// Cursor IDE (VS Code fork) — check before VS Code since it also sets VSCODE_* vars
	if os.Getenv("CURSOR_TRACE_ID") != "" || os.Getenv("CURSOR_EXTENSION_HOST_ROLE") != "" {
		return "Cursor"
	}

	// Windsurf (another VS Code fork)
	if os.Getenv("WINDSURF_PID") != "" {
		return "Windsurf"
	}

	// VS Code proper
	if os.Getenv("VSCODE_PID") != "" || os.Getenv("TERM_PROGRAM") == "vscode" {
		return "VS Code"
	}

	// Windows Terminal
	if os.Getenv("WT_SESSION") != "" {
		return "Windows Terminal"
	}

	// WezTerm
	if os.Getenv("WEZTERM_PANE") != "" {
		return "WezTerm"
	}

	// iTerm2
	if os.Getenv("ITERM_SESSION_ID") != "" || os.Getenv("TERM_PROGRAM") == "iTerm.app" {
		return "iTerm2"
	}

	// Alacritty
	if os.Getenv("ALACRITTY_WINDOW_ID") != "" {
		return "Alacritty"
	}

	// Kitty
	if os.Getenv("KITTY_WINDOW_ID") != "" {
		return "Kitty"
	}

	// Hyper
	if os.Getenv("TERM_PROGRAM") == "Hyper" {
		return "Hyper"
	}

	// Apple Terminal
	if os.Getenv("TERM_PROGRAM") == "Apple_Terminal" {
		return "Terminal.app"
	}

	// ConEmu / Cmder
	if os.Getenv("ConEmuPID") != "" {
		return "ConEmu"
	}

	// TERM_PROGRAM fallback
	if tp := os.Getenv("TERM_PROGRAM"); tp != "" {
		return tp
	}

	return "Terminal"
}

// detectColorProfile returns the terminal's color capability level.
func detectColorProfile() string {
	// COLORTERM env var is the most reliable direct signal
	if ct := os.Getenv("COLORTERM"); ct == "truecolor" || ct == "24bit" {
		return "TrueColor"
	}

	// Fall back to termenv's detection (checks TERM, COLORTERM, etc.)
	output := termenv.NewOutput(os.Stdout)
	switch output.Profile {
	case termenv.TrueColor:
		return "TrueColor"
	case termenv.ANSI256:
		return "ANSI256"
	case termenv.ANSI:
		return "ANSI"
	default:
		return "Ascii"
	}
}

// detectGitBranch reads .git/HEAD to get the current branch without shelling out.
func detectGitBranch() string {
	data, err := os.ReadFile(".git/HEAD")
	if err != nil {
		return ""
	}
	ref := strings.TrimSpace(string(data))
	if strings.HasPrefix(ref, "ref: refs/heads/") {
		return strings.TrimPrefix(ref, "ref: refs/heads/")
	}
	// Detached HEAD — return short SHA
	if len(ref) >= 7 {
		return ref[:7]
	}
	return ""
}

// detectBackground uses a multi-approach fallback chain:
//  1. OSC 11 terminal query via termenv (works on most Unix terminals)
//  2. Read IDE settings.json for explicit colorCustomizations overrides
//  3. Parse the active theme's JSON file for terminal/editor background
//  4. Lookup table of common IDE theme defaults
func detectBackground(terminal string, ideCfg *ideConfig) (uint8, uint8, uint8, string) {
	// Approach 1: OSC 11 query via termenv
	output := termenv.NewOutput(os.Stdout)
	bgColor := output.BackgroundColor()
	rgb := termenv.ConvertToRGB(bgColor)
	r := uint8(rgb.R * 255)
	g := uint8(rgb.G * 255)
	b := uint8(rgb.B * 255)
	if r+g+b > 0 {
		return r, g, b, "osc11"
	}

	// Approaches 2-4: IDE settings + theme file fallback chain
	if ideCfg != nil {
		return ideBackground(terminal, ideCfg)
	}

	return 0, 0, 0, ""
}

// ideBackground implements approaches 2-4 for IDE terminals.
func ideBackground(terminal string, cfg *ideConfig) (uint8, uint8, uint8, string) {
	// Approach 2: Check workbench.colorCustomizations for explicit overrides
	if customs, ok := cfg.settings["workbench.colorCustomizations"].(map[string]interface{}); ok {
		for _, key := range []string{"terminal.background", "editor.background", "panel.background"} {
			if bg, ok := customs[key].(string); ok {
				if r, g, b, ok := parseHexColor(bg); ok {
					return r, g, b, fmt.Sprintf("settings.json[%s]", key)
				}
			}
		}
	}

	if cfg.themeName == "" {
		return 0, 0, 0, ""
	}

	// Approach 3: Find and parse the active theme's JSON file
	for _, extDir := range ideExtensionDirs(terminal) {
		if r, g, b, ok := searchThemeInDir(extDir, cfg.themeName); ok {
			return r, g, b, fmt.Sprintf("theme-file[%s]", cfg.themeName)
		}
	}

	// Approach 4: Lookup table of common theme defaults
	if rgb, ok := knownThemeBackgrounds[cfg.themeName]; ok {
		return rgb[0], rgb[1], rgb[2], fmt.Sprintf("lookup[%s]", cfg.themeName)
	}

	return 0, 0, 0, ""
}

// ideSettingsPath returns the path to the IDE's settings.json.
func ideSettingsPath(terminal string) string {
	var configDir string
	switch terminal {
	case "Cursor":
		configDir = "Cursor"
	case "VS Code":
		configDir = "Code"
	case "Windsurf":
		configDir = "Windsurf"
	default:
		return ""
	}

	switch runtime.GOOS {
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData == "" {
			return ""
		}
		return filepath.Join(appData, configDir, "User", "settings.json")
	case "darwin":
		home, _ := os.UserHomeDir()
		if home == "" {
			return ""
		}
		return filepath.Join(home, "Library", "Application Support", configDir, "User", "settings.json")
	default: // linux
		home, _ := os.UserHomeDir()
		if home == "" {
			return ""
		}
		return filepath.Join(home, ".config", configDir, "User", "settings.json")
	}
}

// ideExtensionDirs returns directories where IDE extensions (and their themes) live.
func ideExtensionDirs(terminal string) []string {
	var dirs []string

	switch runtime.GOOS {
	case "windows":
		// Per-user install location (common for Cursor)
		if localApp := os.Getenv("LOCALAPPDATA"); localApp != "" {
			switch terminal {
			case "Cursor":
				dirs = append(dirs, filepath.Join(localApp, "Programs", "cursor", "resources", "app", "extensions"))
			case "VS Code":
				dirs = append(dirs, filepath.Join(localApp, "Programs", "Microsoft VS Code", "resources", "app", "extensions"))
			}
		}
		// System-wide install location
		switch terminal {
		case "Cursor":
			dirs = append(dirs, filepath.Join("C:\\Program Files", "cursor", "resources", "app", "extensions"))
		case "VS Code":
			dirs = append(dirs, filepath.Join("C:\\Program Files", "Microsoft VS Code", "resources", "app", "extensions"))
		case "Windsurf":
			dirs = append(dirs, filepath.Join("C:\\Program Files", "Windsurf", "resources", "app", "extensions"))
		}
	case "darwin":
		var appName string
		switch terminal {
		case "Cursor":
			appName = "Cursor.app"
		case "VS Code":
			appName = "Visual Studio Code.app"
		case "Windsurf":
			appName = "Windsurf.app"
		}
		if appName != "" {
			dirs = append(dirs, filepath.Join("/Applications", appName, "Contents", "Resources", "app", "extensions"))
		}
	default: // linux
		switch terminal {
		case "VS Code":
			dirs = append(dirs, "/usr/share/code/resources/app/extensions")
		case "Cursor":
			dirs = append(dirs, "/usr/share/cursor/resources/app/extensions")
		}
	}

	// User-installed extensions (marketplace themes)
	home, _ := os.UserHomeDir()
	if home != "" {
		var extDirName string
		switch terminal {
		case "Cursor":
			extDirName = ".cursor"
		case "VS Code":
			extDirName = ".vscode"
		case "Windsurf":
			extDirName = ".windsurf"
		}
		if extDirName != "" {
			dirs = append(dirs, filepath.Join(home, extDirName, "extensions"))
		}
	}

	return dirs
}

// searchThemeInDir scans an extensions directory for a theme matching themeName
// by reading each extension's package.json contributes.themes entries.
func searchThemeInDir(extDir, themeName string) (uint8, uint8, uint8, bool) {
	entries, err := os.ReadDir(extDir)
	if err != nil {
		return 0, 0, 0, false
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
			if r, g, b, ok := parseThemeFile(themePath); ok {
				return r, g, b, true
			}
		}
	}

	return 0, 0, 0, false
}

// parseThemeFile reads a VS Code/Cursor theme JSON and extracts the background color.
func parseThemeFile(path string) (uint8, uint8, uint8, bool) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, 0, 0, false
	}
	data = stripJSONCComments(data)

	var theme struct {
		Colors map[string]string `json:"colors"`
	}
	if err := json.Unmarshal(data, &theme); err != nil {
		return 0, 0, 0, false
	}

	for _, key := range []string{"terminal.background", "editor.background", "panel.background"} {
		if bg, ok := theme.Colors[key]; ok {
			if r, g, b, ok := parseHexColor(bg); ok {
				return r, g, b, true
			}
		}
	}

	return 0, 0, 0, false
}

// parseHexColor parses "#1e1e1e", "#fff", or "#1e1e1eff" (RGBA) into RGB bytes.
func parseHexColor(hex string) (uint8, uint8, uint8, bool) {
	hex = strings.TrimPrefix(hex, "#")
	switch len(hex) {
	case 3:
		return hexVal(hex[0]) * 17, hexVal(hex[1]) * 17, hexVal(hex[2]) * 17, true
	case 6, 8:
		r := hexVal(hex[0])<<4 | hexVal(hex[1])
		g := hexVal(hex[2])<<4 | hexVal(hex[3])
		b := hexVal(hex[4])<<4 | hexVal(hex[5])
		return r, g, b, true
	}
	return 0, 0, 0, false
}

func hexVal(c byte) uint8 {
	switch {
	case c >= '0' && c <= '9':
		return c - '0'
	case c >= 'a' && c <= 'f':
		return c - 'a' + 10
	case c >= 'A' && c <= 'F':
		return c - 'A' + 10
	}
	return 0
}

// stripJSONCComments removes // line comments and /* block comments */ from JSONC
// (the format VS Code/Cursor use for settings and theme files).
func stripJSONCComments(data []byte) []byte {
	out := make([]byte, 0, len(data))
	i := 0
	inString := false
	for i < len(data) {
		if inString {
			if data[i] == '\\' && i+1 < len(data) {
				out = append(out, data[i], data[i+1])
				i += 2
				continue
			}
			if data[i] == '"' {
				inString = false
			}
			out = append(out, data[i])
			i++
			continue
		}
		if data[i] == '"' {
			inString = true
			out = append(out, data[i])
			i++
			continue
		}
		if data[i] == '/' && i+1 < len(data) {
			if data[i+1] == '/' {
				// Line comment — skip to end of line
				i += 2
				for i < len(data) && data[i] != '\n' {
					i++
				}
				continue
			}
			if data[i+1] == '*' {
				// Block comment — skip to */
				i += 2
				for i+1 < len(data) {
					if data[i] == '*' && data[i+1] == '/' {
						i += 2
						break
					}
					i++
				}
				continue
			}
		}
		out = append(out, data[i])
		i++
	}
	return out
}

// knownThemeBackgrounds maps theme names to their terminal.background RGB values.
// Used as a final fallback when OSC 11 and theme file parsing both fail.
var knownThemeBackgrounds = map[string][3]uint8{
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

func detectShell() string {
	// On Windows, check COMSPEC and PSModulePath to distinguish cmd vs powershell
	if runtime.GOOS == "windows" {
		// If PSModulePath is set, likely PowerShell
		if os.Getenv("PSModulePath") != "" {
			return "PowerShell"
		}
		if cs := os.Getenv("COMSPEC"); cs != "" {
			return "cmd"
		}
	}

	// SHELL env var (Unix, also set by Git Bash on Windows)
	if sh := os.Getenv("SHELL"); sh != "" {
		switch {
		case contains(sh, "zsh"):
			return "zsh"
		case contains(sh, "bash"):
			return "bash"
		case contains(sh, "fish"):
			return "fish"
		case contains(sh, "nu"):
			return "nushell"
		default:
			return basename(sh)
		}
	}

	return "sh"
}

func contains(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// containsLower checks if s contains substr (case-insensitive).
func containsLower(s, substr string) bool {
	return contains(strings.ToLower(s), strings.ToLower(substr))
}

func basename(path string) string {
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '/' || path[i] == '\\' {
			return path[i+1:]
		}
	}
	return path
}
