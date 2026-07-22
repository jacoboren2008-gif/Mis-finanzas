# Servidor estático local para "Mis Finanzas" — cero dependencias (usa .NET incluido en Windows).
# Uso:  powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 8080]
# Abre luego http://localhost:8080 en el navegador (o en el celular vía la guía de instalación en GUIA.md).

param(
  [int]$Port = 8080
)

$root = Split-Path -Parent $PSScriptRoot
$prefix = "http://localhost:$Port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "No se pudo iniciar el servidor en $prefix. ¿Ya hay algo corriendo en ese puerto?" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}

Write-Host "Mis Finanzas corriendo en $prefix" -ForegroundColor Green
Write-Host "Carpeta servida: $root"
Write-Host "Presiona Ctrl+C para detener." -ForegroundColor DarkGray

$mimeTypes = @{
  ".html"       = "text/html; charset=utf-8"
  ".js"         = "text/javascript; charset=utf-8"
  ".mjs"        = "text/javascript; charset=utf-8"
  ".css"        = "text/css; charset=utf-8"
  ".json"       = "application/json; charset=utf-8"
  ".webmanifest"= "application/manifest+json; charset=utf-8"
  ".svg"        = "image/svg+xml"
  ".png"        = "image/png"
  ".ico"        = "image/x-icon"
  ".md"         = "text/markdown; charset=utf-8"
}

$rootFull = [IO.Path]::GetFullPath($root)

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    try {
      $urlPath = [Uri]::UnescapeDataString($request.Url.AbsolutePath)
      if ($urlPath -eq "/") { $urlPath = "/index.html" }

      $relative = $urlPath.TrimStart("/") -replace "/", [IO.Path]::DirectorySeparatorChar
      $filePath = [IO.Path]::GetFullPath((Join-Path $rootFull $relative))

      if (-not $filePath.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
        $response.StatusCode = 403
        $response.Close()
        continue
      }

      if (Test-Path -LiteralPath $filePath -PathType Leaf) {
        $ext = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
        $contentType = $mimeTypes[$ext]
        if (-not $contentType) { $contentType = "application/octet-stream" }
        $response.ContentType = $contentType
        $response.Headers.Add("Cache-Control", "no-cache")
        $bytes = [IO.File]::ReadAllBytes($filePath)
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $response.StatusCode = 404
        $msg = [Text.Encoding]::UTF8.GetBytes("404 - No encontrado: $urlPath")
        $response.ContentType = "text/plain; charset=utf-8"
        $response.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      try { $response.StatusCode = 500 } catch {}
    } finally {
      $response.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
