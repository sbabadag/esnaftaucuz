Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building and Syncing Capacitor App" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Building web app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "[2/2] Syncing Capacitor..." -ForegroundColor Yellow
npx cap sync
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Sync failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Build and Sync completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Read-Host "Press Enter to exit"


