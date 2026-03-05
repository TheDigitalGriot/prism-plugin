; =============================================================================
;  VSCode Extension — Optional, checked by default
;  Translates: cmd/prism-setup/src/installer/install-vscode.ts
; =============================================================================

Section "VSCode Extension" SEC_VSCODE

  ; --- Bundle the VSIX ---
  DetailPrint "Extracting VSCode extension..."
  SetOutPath "$INSTDIR\extensions"
  File "${RESOURCES_DIR}\extensions\prism.vsix"

  ; --- Detect editors by checking known install paths ---
  ; nsExec doesn't inherit the user's full PATH, so where.exe won't find
  ; editors. Instead we check the standard install locations directly.

  StrCpy $R1 "0"  ; count of successful installs

  ; --- Try VS Code ---
  StrCpy $R0 "$LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd"
  IfFileExists "$R0" 0 try_cursor
    DetailPrint "Found VS Code, installing extension..."
    nsExec::ExecToStack 'cmd.exe /c "$R0" --install-extension "$INSTDIR\extensions\prism.vsix" --force'
    Pop $0
    Pop $1
    ${If} $0 == 0
      DetailPrint "Prism extension installed in VS Code."
      IntOp $R1 $R1 + 1
    ${Else}
      DetailPrint "VS Code install returned exit code $0: $1"
    ${EndIf}

  try_cursor:
  ; --- Try Cursor ---
  StrCpy $R0 "$LOCALAPPDATA\Programs\cursor\resources\app\bin\cursor.cmd"
  IfFileExists "$R0" 0 try_windsurf
    DetailPrint "Found Cursor, installing extension..."
    nsExec::ExecToStack 'cmd.exe /c "$R0" --install-extension "$INSTDIR\extensions\prism.vsix" --force'
    Pop $0
    Pop $1
    ${If} $0 == 0
      DetailPrint "Prism extension installed in Cursor."
      IntOp $R1 $R1 + 1
    ${Else}
      DetailPrint "Cursor install returned exit code $0: $1"
    ${EndIf}

  try_windsurf:
  ; --- Try Windsurf ---
  StrCpy $R0 "$LOCALAPPDATA\Programs\windsurf\resources\app\bin\windsurf.cmd"
  IfFileExists "$R0" 0 vscode_done
    DetailPrint "Found Windsurf, installing extension..."
    nsExec::ExecToStack 'cmd.exe /c "$R0" --install-extension "$INSTDIR\extensions\prism.vsix" --force'
    Pop $0
    Pop $1
    ${If} $0 == 0
      DetailPrint "Prism extension installed in Windsurf."
      IntOp $R1 $R1 + 1
    ${Else}
      DetailPrint "Windsurf install returned exit code $0: $1"
    ${EndIf}

  vscode_done:
  ; --- Final result ---
  ${If} $R1 == 0
    DetailPrint "No editor successfully installed the extension."
    MessageBox MB_OK|MB_ICONINFORMATION \
      "The Prism extension could not be installed automatically.$\n$\nThe VSIX has been saved to:$\n$INSTDIR\extensions\prism.vsix$\n$\nYou can install it manually by running:$\ncode --install-extension $\"$INSTDIR\extensions\prism.vsix$\""
  ${Else}
    DetailPrint "Extension installed in $R1 editor(s)."
  ${EndIf}

SectionEnd

LangString DESC_VSCODE ${LANG_ENGLISH} \
  "Installs the Prism extension for VS Code, Cursor, and Windsurf. Tries all detected editors."
