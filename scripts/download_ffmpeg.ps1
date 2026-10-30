param(
    [string]$Destination = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $Destination) {
    $Destination = Join-Path $ProjectRoot "ffmpeg_bin\win\ffmpeg.exe"
}

$archive = Join-Path $env:TEMP "pngyu-ffmpeg.zip"
$extract = Join-Path $env:TEMP "pngyu-ffmpeg-extract"

try {
    Remove-Item -LiteralPath $extract -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Invoke-WebRequest -UseBasicParsing "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
    $executable = Get-ChildItem -LiteralPath $extract -Filter ffmpeg.exe -Recurse | Select-Object -First 1
    if (-not $executable) { throw "ffmpeg.exe was not found in the downloaded archive" }
    Copy-Item -LiteralPath $executable.FullName -Destination $Destination -Force
    & $Destination -version | Select-Object -First 1
    Write-Host "FFmpeg installed at $Destination" -ForegroundColor Green
} finally {
    Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $extract -Recurse -Force -ErrorAction SilentlyContinue
}
