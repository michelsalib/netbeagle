# Install netbeagle on Windows, into %LOCALAPPDATA%\Programs\netbeagle:
#   irm https://github.com/michelsalib/netbeagle/releases/latest/download/install.ps1 | iex
#
# NETBEAGLE_INSTALL_DIR  where to put netbeagle (default %LOCALAPPDATA%\Programs\netbeagle)
# NETBEAGLE_VERSION      a version such as 0.2.1 (default: the latest release)
# NETBEAGLE_BASE_URL     where netbeagle.js and SHA256SUMS are downloaded from: https://, or file: (mirrors, tests)
# NETBEAGLE_BINARY=1     install the standalone netbeagle.exe even when Node or Bun is there
#
# netbeagle is one small JavaScript file that runs on Node >= 20 or Bun. Without either, install.ps1
# installs the standalone netbeagle.exe instead, which needs nothing.
# Like install.sh, it never edits your Path: it prints what to run.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# Plain .NET for downloads and hashes: started from PowerShell 7, Windows PowerShell can
# inherit a PSModulePath that hides its own Get-FileHash and Invoke-WebRequest.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

# throw, never exit: run through `irm | iex`, exit would close the user's PowerShell window
function Fail($message) {
  throw "netbeagle install: $message"
}

$repo = 'michelsalib/netbeagle'
$dir = if ($env:NETBEAGLE_INSTALL_DIR) { $env:NETBEAGLE_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\netbeagle' }
$version = if ($env:NETBEAGLE_VERSION) { $env:NETBEAGLE_VERSION -replace '^v', '' } else { 'latest' }
if ($version -ne 'latest' -and $version -notmatch '^\d+\.\d+\.\d+$') { Fail "NETBEAGLE_VERSION must look like 0.2.1, not $version" }
$base = if ($env:NETBEAGLE_BASE_URL) { $env:NETBEAGLE_BASE_URL }
  elseif ($version -eq 'latest') { "https://github.com/$repo/releases/latest/download" }
  else { "https://github.com/$repo/releases/download/v$version" }
# https only (file: for local mirrors and tests)
if ($base -notlike 'https://*' -and $base -notlike 'file:*') { Fail "NETBEAGLE_BASE_URL must start with https://, not $base" }

# the runtime: Node >= 20 first, then Bun, else the binary
$runtime = $null
if ($env:NETBEAGLE_BINARY) { $runtime = 'binary' }
if (-not $runtime -and (Get-Command node -ErrorAction SilentlyContinue) -and ((& node --version) -match '^v(\d+)\.') -and [int]$Matches[1] -ge 20) {
  $runtime = 'node'
}
if (-not $runtime -and (Get-Command bun -ErrorAction SilentlyContinue)) { $runtime = 'bun' }
if (-not $runtime) { $runtime = 'binary' }
# x64 only: Windows on Arm runs it emulated
$file = if ($runtime -eq 'binary') { 'netbeagle-windows-x64.exe' } else { 'netbeagle.js' }

function Download($url, $file) {
  if ($url -like 'file:*') { Copy-Item -LiteralPath ([Uri]$url).LocalPath -Destination $file }
  else { (New-Object Net.WebClient).DownloadFile($url, $file) }
}

function Sha256($file) {
  $sha = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($file)
  try { -join ($sha.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') }) } finally { $stream.Dispose() }
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("netbeagle-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  try { Download "$base/$file" "$tmp\$file" } catch { Fail "could not download $base/$file" }
  try { Download "$base/SHA256SUMS" "$tmp\SHA256SUMS" } catch { Fail "could not download $base/SHA256SUMS" }
  $expected = $null
  foreach ($line in [IO.File]::ReadAllLines("$tmp\SHA256SUMS")) {
    $sum, $name = $line -split '\s+', 2
    if (-not $expected -and ($name -eq $file -or $name -eq "*$file")) { $expected = $sum }
  }
  if (-not $expected) { Fail "SHA256SUMS has no entry for $file" }
  if ((Sha256 "$tmp\$file") -ne $expected) { Fail "checksum mismatch for $file; nothing was installed" }

  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  # copy next to the target, then rename: a running netbeagle is never left half-written
  $name = if ($runtime -eq 'binary') { 'netbeagle.exe' } else { 'netbeagle.mjs' }
  $new = Join-Path $dir ".$name.new"
  $target = Join-Path $dir $name
  [IO.File]::Copy((Join-Path $tmp $file), $new, $true)
  if ($runtime -eq 'binary' -and [IO.File]::Exists($target)) {
    # a running program can't be replaced, but it can be renamed
    Remove-Item -Force "$target.old" -ErrorAction SilentlyContinue
    [IO.File]::Move($target, "$target.old")
  }
  if ([IO.File]::Exists($target)) { [IO.File]::Replace($new, $target, [NullString]::Value) } else { [IO.File]::Move($new, $target) }
  # only one way to start it: cmd and PowerShell would pick netbeagle.exe over netbeagle.cmd
  if ($runtime -eq 'binary') {
    Remove-Item -Force "$dir\netbeagle.cmd", "$dir\netbeagle.mjs" -ErrorAction SilentlyContinue
  } else {
    Remove-Item -Force "$dir\netbeagle.exe", "$dir\netbeagle.exe.old" -ErrorAction SilentlyContinue
    Set-Content -Encoding ASCII -Path "$dir\netbeagle.cmd" -Value "@$runtime `"%~dp0netbeagle.mjs`" %*"
  }
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

$exe = if ($runtime -eq 'binary') { "$dir\netbeagle.exe" } else { "$dir\netbeagle.cmd" }
$installed = & $exe --version
$how = if ($runtime -eq 'binary') { 'standalone binary' } else { "runs on $runtime" }
Write-Output "installed netbeagle $installed in $dir ($how)"
Write-Output "to see the command lines of other users' processes too: run it from an administrator terminal"

$inPath = ($env:Path -split ';' | Where-Object { $_.TrimEnd('\') -eq $dir.TrimEnd('\') }).Count -gt 0
if (-not $inPath) {
  Write-Output "$dir is not in your Path. To add it for new terminals, run:"
  Write-Output "  [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';$dir', 'User')"
}
