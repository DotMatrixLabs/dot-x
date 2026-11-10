# Tauri's custom Windows sign command for release builds. The release workflow
# points bundle.windows.signCommand here; Tauri calls it once per binary (app,
# NSIS plugins, uninstaller, installer) with the file path as the only argument.
# It sends the file over the tailnet to the signer VM, which holds the code
# signing token, and replaces the file with the signed copy it gets back.
param([Parameter(Mandatory)][string]$Path)
$ErrorActionPreference = 'Stop'

$signer = if ($env:SIGNER_HOST) { $env:SIGNER_HOST } else { 'svc_signing@signer' }
$key = if ($env:SIGNER_KEY_FILE) { $env:SIGNER_KEY_FILE } else { "$HOME\.ssh\signer" }

$file = (Resolve-Path -LiteralPath $Path).Path
# The signer only takes [A-Za-z0-9._+-] names ending in .exe, .dll or .msi. The
# name labels the request in its log and tells jsign the file type. NSIS hands
# us the uninstaller under a temporary name, so anything else is sent as .exe.
$name = (Split-Path $file -Leaf) -replace '[^A-Za-z0-9._+-]', '_'
if ($name -notmatch '\.(exe|dll)$') { $name += '.exe' }

# PowerShell pipes are not binary-safe; let cmd.exe do the redirection.
$signed = "$file.signed"
cmd /c "ssh -i `"$key`" -o BatchMode=yes $signer sign $name < `"$file`" > `"$signed`""
if ($LASTEXITCODE -ne 0) {
  Remove-Item -LiteralPath $signed -ErrorAction SilentlyContinue
  throw "Signing $name failed (ssh exit $LASTEXITCODE)."
}
Move-Item -LiteralPath $signed -Destination $file -Force

$signature = Get-AuthenticodeSignature -LiteralPath $file
if ($signature.Status -ne 'Valid') { throw "$name came back with signature status $($signature.Status)." }
"Signed ${name}: $($signature.SignerCertificate.Subject)"
