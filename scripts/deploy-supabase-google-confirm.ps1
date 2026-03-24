# Deploy edge function from your PC (requires Supabase CLI + access token).
# 1) Create token: https://supabase.com/dashboard/account/tokens
# 2) PowerShell:
#    $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
# 3) Run this script from repo root.

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
  Write-Host "Eksik: SUPABASE_ACCESS_TOKEN ortam degiskeni." -ForegroundColor Red
  Write-Host "  Olustur: https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
  Write-Host "  Sonra: `$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'" -ForegroundColor Yellow
  exit 1
}

$supabase = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabase) {
  Write-Host "Supabase CLI bulunamadi. npx ile deneniyor..." -ForegroundColor Yellow
  npx supabase functions deploy merchant-subscription-google-confirm --project-ref xmskjcdwmwlcmjexnnxw
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  supabase functions deploy merchant-subscription-google-confirm --project-ref xmskjcdwmwlcmjexnnxw
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "`nTamam: merchant-subscription-google-confirm deploy edildi." -ForegroundColor Green
