; =============================================================================
;  System Check — Custom NsDialogs page
;  Translates: cmd/prism-setup/src/screens/SystemCheckScreen.tsx + detect.ts
; =============================================================================

Var hPreflightDlg
Var PreflightEditorStatus
Var PreflightClaudeStatus
Var PreflightPrismStatus

Function PreflightPageCreate
  !insertmacro MUI_HEADER_TEXT "System Check" \
    "Detecting installed tools before installation begins."

  nsDialogs::Create 1018
  Pop $hPreflightDlg
  ${If} $hPreflightDlg == error
    Abort
  ${EndIf}

  ; --- Title ---
  ${NSD_CreateLabel} 0 0 100% 16u \
    "The following tools were detected on your system:"
  Pop $0

  ; --- Editor detection (check known install paths) ---
  StrCpy $PreflightEditorStatus "Not found"

  IfFileExists "$LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd" 0 pf_check_cursor
    StrCpy $PreflightEditorStatus "VS Code found"
    Goto pf_editor_done

  pf_check_cursor:
  IfFileExists "$LOCALAPPDATA\Programs\cursor\resources\app\bin\cursor.cmd" 0 pf_check_windsurf
    StrCpy $PreflightEditorStatus "Cursor found"
    Goto pf_editor_done

  pf_check_windsurf:
  IfFileExists "$LOCALAPPDATA\Programs\windsurf\resources\app\bin\windsurf.cmd" 0 pf_editor_done
    StrCpy $PreflightEditorStatus "Windsurf found"

  pf_editor_done:

  ${NSD_CreateLabel} 0 24u 35% 12u "Code Editor:"
  Pop $0
  ${NSD_CreateLabel} 36% 24u 64% 12u "$PreflightEditorStatus"
  Pop $0

  ; --- Claude CLI detection ---
  StrCpy $PreflightClaudeStatus "Not found (will use file copy fallback)"
  IfFileExists "$LOCALAPPDATA\Programs\claude\resources\app\bin\claude.cmd" 0 pf_claude_done
    StrCpy $PreflightClaudeStatus "Claude CLI found"
  pf_claude_done:

  ${NSD_CreateLabel} 0 42u 35% 12u "Claude CLI:"
  Pop $0
  ${NSD_CreateLabel} 36% 42u 64% 12u "$PreflightClaudeStatus"
  Pop $0

  ; --- Existing prism-cli detection ---
  StrCpy $PreflightPrismStatus "Not installed"
  IfFileExists "$INSTDIR\bin\prism-cli.exe" 0 pf_prism_done
    StrCpy $PreflightPrismStatus "Already installed (will be updated)"
  pf_prism_done:

  ${NSD_CreateLabel} 0 60u 35% 12u "Prism CLI:"
  Pop $0
  ${NSD_CreateLabel} 36% 60u 64% 12u "$PreflightPrismStatus"
  Pop $0

  ; --- Separator ---
  ${NSD_CreateHLine} 0 82u 100% 1u
  Pop $0

  ; --- Info text ---
  ${NSD_CreateLabel} 0 90u 100% 24u \
    "Click Next to begin installation. Components will adapt to what is available on your system."
  Pop $0

  nsDialogs::Show

FunctionEnd

Function PreflightPageLeave
  ; Informational only — no validation needed
FunctionEnd
