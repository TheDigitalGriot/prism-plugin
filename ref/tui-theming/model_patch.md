# model.go Wiring Patch

In `NewModel()`, after the existing terminal detection block, add the theme color extraction and wire it into the splash model.

## Replace this section (lines ~211-217 of model.go):

```go
termInfo := terminal.Detect()
splashModel := splash.New()
splashModel.EnvLines = termInfo.EnvLines()
splashModel.BoostColors = termInfo.IsIDETerminal()
splashModel.BgR = termInfo.BgR
splashModel.BgG = termInfo.BgG
splashModel.BgB = termInfo.BgB
```

## With:

```go
// Create splash screen animation
termInfo := terminal.Detect()
themeColors := terminal.DetectThemeColors(termInfo)

splashModel := splash.New()
splashModel.EnvLines = termInfo.EnvLines()
splashModel.BoostColors = termInfo.IsIDETerminal()
splashModel.BgR = termInfo.BgR
splashModel.BgG = termInfo.BgG
splashModel.BgB = termInfo.BgB
splashModel.AccentR = themeColors.AccentR
splashModel.AccentG = themeColors.AccentG
splashModel.AccentB = themeColors.AccentB
```
