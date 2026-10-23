; Hooks for Tauri's NSIS installer (bundle.windows.nsis.installerHooks).
;
; They take over the one-time removal of the v1.x per-machine MSI. Tauri's own
; migration (PageReinstall in its installer.nsi) runs the bare MSI uninstall
; string, which shows an unexplained "uninstall this product?" box, and in
; passive mode (the updater) it keeps installing when the removal fails. That
; leaves v1 and v2 installed side by side.
;
; Instead, .onGUIInit removes the MSI before the first page shows. Tauri's check
; then finds nothing to do. If the removal fails, the installer exits and v1
; stays installed and working.
;
; Tauri includes this file before it defines PRODUCTNAME, MANUFACTURER and
; friends and before it adds its plugin dir. Only macro bodies can use those;
; the functions below spell the names out and use no plugins.

!define MUI_CUSTOMFUNCTION_GUIINIT DotXRemoveV1Msi

Var DotXV1Key ; product code of the installed v1 MSI, "" if none
Var DotXIndex
Var DotXValue

; Sets $DotXV1Key. Matches the same uninstall entries as Tauri's WiX check:
; DisplayName + Publisher is PRODUCTNAME + MANUFACTURER, uninstalled by msiexec.
Function DotXFindV1Msi
  StrCpy $DotXIndex 0
  loop:
    EnumRegKey $DotXV1Key HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" $DotXIndex
    StrCmp $DotXV1Key "" done
    IntOp $DotXIndex $DotXIndex + 1
    ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$DotXV1Key" "DisplayName"
    ReadRegStr $R1 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$DotXV1Key" "Publisher"
    StrCmp "$R0$R1" "Dot Xdot-x" 0 loop
    ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$DotXV1Key" "UninstallString"
    ${StrCase} $R1 $R0 "L"
    ${StrLoc} $R0 $R1 "msiexec" ">"
    StrCmp $R0 0 0 loop
  done:
FunctionEnd

Function DotXRemoveV1Msi
  Call DotXFindV1Msi
  StrCmp $DotXV1Key "" done

  retry:
    ; /passive replaces the Yes/No confirmation with a progress bar, leaving only the UAC prompt.
    ExecWait '"$SYSDIR\msiexec.exe" /x $DotXV1Key /passive /norestart'
    ; Judge by the registry, not the exit code: the entry is gone only if the removal happened.
    Call DotXFindV1Msi
    StrCmp $DotXV1Key "" done

    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION|MB_TOPMOST|MB_SETFOREGROUND \
      "Dot X now installs for your user account only, so updates no longer need administrator rights.$\n$\n\
To switch, the old Dot X in Program Files has to be removed once, and Windows needs administrator approval for that. It was not removed, so nothing has changed.$\n$\n\
Select Retry to try again. If you cannot approve it, ask an administrator to uninstall Dot X from Settings > Apps, then run this installer again. Your settings are kept." \
      /SD IDCANCEL IDRETRY retry

    ; The updater closed v1 to run this installer. Start it again so the user isn't left without it.
    ${GetOptions} $CMDLINE "/R" $DotXValue
    ${IfNot} ${Errors}
      ReadRegStr $DotXValue HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$DotXV1Key" "InstallLocation"
      Exec '"$DotXValue\Dot X.exe"'
    ${EndIf}
    Quit
  done:
FunctionEnd

; Backstop for silent installs (/S), which skip .onGUIInit and every page: never
; install next to a v1 MSI that is still there.
!macro NSIS_HOOK_PREINSTALL
  Call DotXFindV1Msi
  ${If} $DotXV1Key != ""
    Abort "${PRODUCTNAME} 1.x is installed for all users. Uninstall it first."
  ${EndIf}
!macroend
