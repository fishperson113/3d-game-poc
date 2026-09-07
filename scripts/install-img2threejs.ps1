[CmdletBinding()]
param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$skillsRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '.agents\skills'))
$destination = [System.IO.Path]::GetFullPath((Join-Path $skillsRoot 'img2threejs'))
$expectedPrefix = $skillsRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

if (-not $destination.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsafe img2threejs destination: $destination"
}

$lockPath = Join-Path $projectRoot 'tools\img2threejs.lock.json'
$lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
$markerPath = Join-Path $destination '.source-commit'

if (Test-Path -LiteralPath $destination) {
  $installedCommit = if (Test-Path -LiteralPath $markerPath) {
    (Get-Content -LiteralPath $markerPath -Raw).Trim()
  } elseif (Test-Path -LiteralPath (Join-Path $destination '.git')) {
    (git -C $destination rev-parse HEAD).Trim()
  } else {
    $null
  }

  if ($installedCommit -eq $lock.commit -and -not $Force) {
    Write-Output "img2threejs already matches pinned commit $installedCommit"
    exit 0
  }

  if (-not $Force) {
    throw "img2threejs exists but does not match the snapshot contract. Re-run with -Force."
  }

  Remove-Item -LiteralPath $destination -Recurse -Force
}

$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("img2threejs-" + [System.Guid]::NewGuid().ToString('N'))
$archivePath = Join-Path $temporaryRoot 'source.zip'

try {
  New-Item -ItemType Directory -Force -Path $temporaryRoot | Out-Null
  $archiveUrl = "https://codeload.github.com/img2threejs/img2threejs/zip/$($lock.commit)"
  Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath
  Expand-Archive -LiteralPath $archivePath -DestinationPath $temporaryRoot

  $extractedRoot = Get-ChildItem -LiteralPath $temporaryRoot -Directory | Select-Object -First 1
  if ($null -eq $extractedRoot -or -not (Test-Path -LiteralPath (Join-Path $extractedRoot.FullName 'SKILL.md'))) {
    throw 'Downloaded archive is not a valid img2threejs skill.'
  }

  New-Item -ItemType Directory -Force -Path $skillsRoot | Out-Null
  Move-Item -LiteralPath $extractedRoot.FullName -Destination $destination
  Set-Content -LiteralPath $markerPath -Value $lock.commit -NoNewline
  Write-Output "Installed img2threejs snapshot $($lock.commit) to $destination"
} finally {
  if (Test-Path -LiteralPath $temporaryRoot) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
}
