# Static dev server in plain PowerShell — no installs needed.
#   powershell -ExecutionPolicy Bypass -File serve.ps1 [port]
param([int]$Port = 8080, [switch]$NoOpen)
$root = $PSScriptRoot
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript'; '.mjs'='text/javascript'; '.css'='text/css'; '.json'='application/json'; '.png'='image/png'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.md'='text/markdown' }
$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch { Write-Host "Could not listen on port $Port ($($_.Exception.Message)). Try: powershell -ExecutionPolicy Bypass -File serve.ps1 $($Port+1)"; exit 1 }
Write-Host "Explorers Acquisitions v2 -> $prefix   (Ctrl+C or close this window to stop)"
Write-Host "Serving files from: $root"
if (-not $NoOpen) { Start-Process $prefix }
while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $req = $ctx.Request; $res = $ctx.Response
  $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
  Write-Host "$($req.HttpMethod) $path"
  if ($path.EndsWith('/')) { $path += 'index.html' }
  $file = Join-Path $root ($path.TrimStart('/') -replace '/', '\')
  $full = [IO.Path]::GetFullPath($file)
  if (-not $full.StartsWith($root) -or -not (Test-Path $full -PathType Leaf)) {
    $res.StatusCode = 404; $buf = [Text.Encoding]::UTF8.GetBytes("Not found: $path")
  } else {
    $ext = [IO.Path]::GetExtension($full).ToLower()
    $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    $res.Headers.Add('Cache-Control', 'no-store')
    $buf = [IO.File]::ReadAllBytes($full)
  }
  $res.ContentLength64 = $buf.Length
  $res.OutputStream.Write($buf, 0, $buf.Length)
  $res.OutputStream.Close()
}
