# İç test kanalına AAB yükler (commit=true).
# Gereksinim: android/play-publish-credentials.json VEYA PLAY_SERVICE_ACCOUNT_JSON ortam değişkeni

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent

# JAVA_HOME (Gradle)
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
    $candidates = @(
        "$env:LOCALAPPDATA\Android\Sdk\jbr",
        "C:\Program Files\Android\Android Studio\jbr",
        "C:\Program Files\Android\Android Studio\jre"
    )
    foreach ($p in $candidates) {
        if (Test-Path "$p\bin\java.exe") {
            $env:JAVA_HOME = $p
            Write-Host "JAVA_HOME -> $p"
            break
        }
    }
}
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
    Write-Error "JAVA_HOME bulunamadı. Android Studio JBR yolunu ayarlayın."
}

$credFile = Join-Path $projectRoot "keys\eskici-472412-af89696e4a67.json"
$hasEnv = $env:PLAY_SERVICE_ACCOUNT_JSON -and $env:PLAY_SERVICE_ACCOUNT_JSON.Trim().Length -gt 0
if (-not $hasEnv -and -not (Test-Path $credFile)) {
    Write-Error "Play API kimlik dosyasi bulunamadi: $credFile"
}

Set-Location $projectRoot
npm run android:sync
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location (Join-Path $projectRoot "android")
& .\gradlew.bat publishReleaseBundle -PplayTrack=internal -PplayCommit=true
exit $LASTEXITCODE
