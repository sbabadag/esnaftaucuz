#Requires -Version 5.1
<#
.SYNOPSIS
  Build web assets, sync Capacitor Android, install debug APK on a connected device.
#>
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$adb = Join-Path $sdk 'platform-tools\adb.exe'
if (-not (Test-Path $adb)) {
  throw "adb not found at $adb. Install Android platform-tools / set ANDROID_HOME."
}
$env:Path = "$(Join-Path $sdk 'platform-tools');$env:Path"

Write-Host '=== adb devices ==='
& $adb devices -l
$devices = & $adb devices | Select-String -Pattern "`tdevice$" | ForEach-Object {
  ($_ -split '\s+')[0]
}
if (-not $devices -or $devices.Count -eq 0) {
  throw 'No authorized Android device. Connect USB and enable debugging.'
}

$skipBuild = $args -contains '-SkipBuild'
if (-not $skipBuild) {
  Write-Host '=== npm run build ==='
  npm run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host '=== npx cap sync android ==='
  npx cap sync android
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host '=== gradlew installDebug ==='
Push-Location (Join-Path $root 'android')
try {
  .\gradlew.bat installDebug
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'installDebug failed; trying uninstall + reinstall (signature mismatch)...'
    & $adb uninstall com.esnaftaucuz.app 2>$null | Out-Null
    .\gradlew.bat installDebug
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
} finally {
  Pop-Location
}

$pkg = 'com.esnaftaucuz.app'
& $adb shell am force-stop $pkg
& $adb shell monkey -p $pkg -c android.intent.category.LAUNCHER 1 | Out-Null
Write-Host "=== DONE: installed and launched $pkg ==="
