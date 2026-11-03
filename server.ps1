# Shorts Recorder local server - Windows PowerShell 5.1 compatible, nothing to install.
# Serves .\app on http://localhost:8765 and provides /api/version and /api/update.
# The updater only ever writes app\*, server.ps1 and the .bat. It never touches scripts\ or recordings.
$ErrorActionPreference = 'Stop'
$Port    = 8765
$Base    = $PSScriptRoot
$AppDir  = Join-Path $Base 'app'
$CfgPath = Join-Path $Base 'update.json'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

function Get-LocalVersion {
  $html = [IO.File]::ReadAllText((Join-Path $AppDir 'index.html'))
  $m = [regex]::Match($html, "APP_VERSION\s*=\s*'([^']+)'")
  if ($m.Success) { return $m.Groups[1].Value } else { return '0.0.0' }
}
function Get-ManifestUrl {
  if (-not (Test-Path -LiteralPath $CfgPath)) { return '' }
  try { $c = [IO.File]::ReadAllText($CfgPath) | ConvertFrom-Json; return [string]$c.manifestUrl } catch { return '' }
}
function New-WebClient {
  $wc = New-Object System.Net.WebClient
  $wc.Headers.Add('User-Agent', 'ShortsRecorder')
  $wc.Encoding = [Text.Encoding]::UTF8
  return $wc
}
function Add-NoCache([string]$u) { if ($u.Contains('?')) { return "$u&t=$([DateTime]::UtcNow.Ticks)" } else { return "$u`?t=$([DateTime]::UtcNow.Ticks)" } }
function Get-Manifest {
  $u = Get-ManifestUrl
  if ([string]::IsNullOrWhiteSpace($u)) { throw 'No manifestUrl set in update.json' }
  $wc = New-WebClient
  try { $txt = $wc.DownloadString((Add-NoCache $u)) } finally { $wc.Dispose() }
  $man = $txt | ConvertFrom-Json
  if (-not $man.version -or -not $man.files) { throw 'Manifest is missing version or files' }
  return $man
}
function Test-Newer([string]$a, [string]$b) {  # is $a newer than $b?
  try { return ([version]$a) -gt ([version]$b) } catch { return $a -ne $b }
}
function Get-Sha256([string]$path) { return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToUpperInvariant() }

function Invoke-Update {
  $man = Get-Manifest
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $tmp = Join-Path ([IO.Path]::GetTempPath()) "shorts-recorder-update-$stamp"
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  $plan = @()
  $i = 0
  try {
    # 1) download everything to temp and verify hashes before touching anything
    foreach ($f in @($man.files)) {
      $rel = [string]$f.path
      if ($rel -notmatch '^(app/[A-Za-z0-9._-]+|server\.ps1|Start Shorts Recorder\.bat)$') { throw "Refusing to write path: $rel" }
      $dest = Join-Path $Base ($rel -replace '/', '\')
      $i++
      $t = Join-Path $tmp ("$i-" + [IO.Path]::GetFileName($rel))
      $wc = New-WebClient
      try { $wc.DownloadFile((Add-NoCache ([string]$f.url)), $t) } finally { $wc.Dispose() }
      $h = Get-Sha256 $t
      if ($h -ne ([string]$f.sha256).ToUpperInvariant()) { throw "Checksum mismatch for $rel" }
      if ($rel -eq 'app/index.html') {
        $m = [regex]::Match([IO.File]::ReadAllText($t), "APP_VERSION\s*=\s*'([^']+)'")
        if (-not $m.Success -or $m.Groups[1].Value -ne [string]$man.version) { throw 'Downloaded index.html version does not match the manifest' }
      }
      $changed = (-not (Test-Path -LiteralPath $dest)) -or ((Get-Sha256 $dest) -ne $h)
      $plan += New-Object PSObject -Property @{ Rel = $rel; Dest = $dest; Tmp = $t; Changed = $changed }
    }
    $todo = @($plan | Where-Object { $_.Changed })
    if ($todo.Count -eq 0) { return @{ ok = $true; version = [string]$man.version; changed = @(); restart = $false } }
    # 2) back up the current files
    $bak = Join-Path $Base (".backup\$stamp")
    foreach ($p in $todo) {
      if (Test-Path -LiteralPath $p.Dest) {
        $b = Join-Path $bak ($p.Rel -replace '/', '\')
        New-Item -ItemType Directory -Path (Split-Path $b -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $p.Dest -Destination $b -Force
      }
    }
    # 3) replace; on any failure restore from the backup
    $done = @()
    try {
      foreach ($p in $todo) {
        New-Item -ItemType Directory -Path (Split-Path $p.Dest -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $p.Tmp -Destination $p.Dest -Force
        $done += $p
      }
    } catch {
      foreach ($p in $done) {
        $b = Join-Path $bak ($p.Rel -replace '/', '\')
        if (Test-Path -LiteralPath $b) { Copy-Item -LiteralPath $b -Destination $p.Dest -Force }
      }
      throw "Update failed and was rolled back: $($_.Exception.Message)"
    }
    $restart = @($todo | Where-Object { $_.Rel -eq 'server.ps1' }).Count -gt 0
    return @{ ok = $true; version = [string]$man.version; changed = @($todo | ForEach-Object { $_.Rel }); restart = $restart }
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Send-Json($ctx, $obj, [int]$code = 200) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress -Depth 5))
  $ctx.Response.StatusCode = $code
  $ctx.Response.ContentType = 'application/json; charset=utf-8'
  $ctx.Response.Headers.Add('Cache-Control', 'no-store')
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

# Start the listener. Retry for ~10 s so a restart after a self-update can wait for the old instance to let go.
$listener = $null
for ($try = 0; $try -lt 20; $try++) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$Port/")
  try { $l.Start(); $listener = $l; break } catch { $l.Close(); Start-Sleep -Milliseconds 500 }
}
if (-not $listener) { Write-Host "Port $Port is busy - the recorder is probably already running."; exit 0 }
Write-Host "Shorts Recorder v$(Get-LocalVersion) running at http://localhost:$Port/  (close this window to stop)"

$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon' }
$appFull = [IO.Path]::GetFullPath($AppDir).TrimEnd('\') + '\'
$restartNow = $false

while ($listener.IsListening -and -not $restartNow) {
  $ctx = $listener.GetContext()
  try {
    $req = $ctx.Request
    $path = $req.Url.AbsolutePath
    if ($path.StartsWith('/api/')) {
      # Custom header forces a CORS preflight from other sites, which we never answer, so only this app can call the API.
      if ($req.Headers['X-Shorts-Recorder'] -ne '1') { Send-Json $ctx @{ error = 'forbidden' } 403 }
      elseif ($path -eq '/api/version') {
        $cur = Get-LocalVersion
        $res = @{ version = $cur; latest = $null; updateAvailable = $false; error = $null }
        if ($req.QueryString['local'] -ne '1') {
          try { $man = Get-Manifest; $res.latest = [string]$man.version; $res.updateAvailable = (Test-Newer ([string]$man.version) $cur) }
          catch { $res.error = "Couldn't check for updates: $($_.Exception.Message)" }
        }
        Send-Json $ctx $res
      }
      elseif ($path -eq '/api/update' -and $req.HttpMethod -eq 'POST') {
        try { $r = Invoke-Update; Send-Json $ctx $r; if ($r.restart) { $restartNow = $true } }
        catch { Send-Json $ctx @{ ok = $false; error = $_.Exception.Message } 500 }
      }
      else { Send-Json $ctx @{ error = 'not found' } 404 }
    } else {
      $rel = [Uri]::UnescapeDataString($path.TrimStart('/'))
      if ($rel -eq '') { $rel = 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $AppDir $rel))
      if ($file.StartsWith($appFull, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($file)
        $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
        if ($types.ContainsKey($ext)) { $ctx.Response.ContentType = $types[$ext] } else { $ctx.Response.ContentType = 'application/octet-stream' }
        $ctx.Response.Headers.Add('Cache-Control', 'no-store')
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else { $ctx.Response.StatusCode = 404 }
    }
  } catch {
    try { $ctx.Response.StatusCode = 500 } catch {}
  } finally {
    try { $ctx.Response.Close() } catch {}
  }
}

$listener.Stop(); $listener.Close()
if ($restartNow) {
  # server.ps1 was replaced: start the new copy (it waits for the port), then this one exits.
  Start-Process -FilePath 'powershell.exe' -WindowStyle Minimized -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
}
