#Requires -Version 5.1
<#
.SYNOPSIS
  Starts the API locally with apps/api/.env.s3.local (and .env.local) loaded into the environment.

.DESCRIPTION
  `./gradlew bootRun` does NOT read .env files - the API has no dotenv dependency and no
  spring.config.import, so every value has to already be in the process environment (see
  apps/api/README.md). That left apps/api/.env.s3.local sitting on disk unread even though
  setup-runbook.md section 6a tells you to put the S3 credentials there, so
  POST /api/v1/admin/uploads/cover returned 503 "cover upload isn't configured" and every
  cover-image upload in /admin failed.

  This script does the one missing step: it reads those KEY=VALUE pairs into the environment,
  where BOTH Spring's ${S3_BUCKET:} placeholders and the AWS SDK's default credential chain
  (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) look for them. Then it runs bootRun.

.PARAMETER CheckOnly
  Load the files, report which variables were set, and exit without starting the API. Use this to
  answer "did my env file actually load?" without waiting for Spring to boot.

.EXAMPLE
  pwsh scripts/dev-api.ps1 -CheckOnly
.EXAMPLE
  pwsh scripts/dev-api.ps1
#>
[CmdletBinding()]
param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $repoRoot 'apps/api'

# Later files win, so a general .env.local can override the S3-only one.
$envFiles = @('.env.s3.local', '.env.local')
$loaded = New-Object System.Collections.Generic.List[string]

foreach ($name in $envFiles) {
  $file = Join-Path $apiDir $name
  if (-not (Test-Path -LiteralPath $file)) {
    Write-Host "skip   $name (not present)"
    continue
  }
  foreach ($line in Get-Content -LiteralPath $file) {
    $trimmed = $line.Trim()
    if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
    $eq = $trimmed.IndexOf('=')
    if ($eq -lt 1) { continue }
    $key = $trimmed.Substring(0, $eq).Trim()
    $value = $trimmed.Substring($eq + 1).Trim()
    # Strip ONE layer of surrounding quotes. Inline "# comments" are deliberately NOT stripped:
    # a secret may legitimately contain '#', and eating the rest of the value would produce a
    # credential that is wrong in a way nothing reports until S3 returns 403.
    if ($value.Length -ge 2 -and
        (($value.StartsWith('"') -and $value.EndsWith('"')) -or
         ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path "Env:$key" -Value $value
    if (-not $loaded.Contains($key)) { $loaded.Add($key) }
  }
  Write-Host "loaded $name"
}

if ($loaded.Count -gt 0) { Write-Host "  set: $($loaded -join ', ')" }

# The four the cover-upload endpoint needs before it will mint a presigned URL. Named individually
# because a partial .env file 503s exactly like an absent one.
$missing = @('S3_BUCKET', 'AWS_REGION', 'S3_PUBLIC_BASE_URL', 'AWS_ACCESS_KEY_ID') |
  Where-Object { -not (Get-Item -Path "Env:$_" -ErrorAction SilentlyContinue).Value }
if ($missing) {
  Write-Warning ("cover-image uploads will 503 - missing: {0}. See docs/setup-runbook.md section 6a." -f ($missing -join ', '))
} else {
  Write-Host 'cover-image uploads: configured'
}

if ($CheckOnly) { return }

$wrapper = if ($env:OS -eq 'Windows_NT') { '.\gradlew.bat' } else { './gradlew' }
Push-Location $apiDir
try { & $wrapper bootRun } finally { Pop-Location }
