# Capacitor Live Reload Setup Script for Windows
# This script helps you run the app with live reload on your device

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Capacitor Live Reload Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get local IP address
Write-Host "Finding your local IP address..." -ForegroundColor Yellow
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*" } | Select-Object -First 1).IPAddress

if (-not $ipAddress) {
    Write-Host "Could not find local IP address. Please enter it manually:" -ForegroundColor Red
    $ipAddress = Read-Host "Enter your local IP address"
}

Write-Host "Your local IP address: $ipAddress" -ForegroundColor Green
Write-Host ""

# Update capacitor.config.ts
Write-Host "Updating capacitor.config.ts..." -ForegroundColor Yellow
$configFile = "capacitor.config.ts"
$configContent = Get-Content $configFile -Raw

# Check if server config is already uncommented
if ($configContent -match "server:\s*\{") {
    Write-Host "Server config already active in capacitor.config.ts" -ForegroundColor Green
} else {
    # Uncomment server config
    $configContent = $configContent -replace "// server: \{", "server: {"
    $configContent = $configContent -replace "//   url: 'http://192\.168\.\d+\.\d+:5173',", "  url: 'http://$ipAddress:5173',"
    $configContent = $configContent -replace "//   cleartext: true", "  cleartext: true"
    $configContent = $configContent -replace "// \},", "},"
    
    Set-Content $configFile $configContent
    Write-Host "✅ capacitor.config.ts updated with IP: $ipAddress" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Make sure your device is on the same WiFi network" -ForegroundColor Yellow
Write-Host "2. Start Vite dev server in one terminal:" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "3. In another terminal, run one of these:" -ForegroundColor Yellow
Write-Host "   For Android: npx cap run android --livereload --external" -ForegroundColor White
Write-Host "   For iOS:     npx cap run ios --livereload --external" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANT: Comment out server config in capacitor.config.ts before production build!" -ForegroundColor Red
Write-Host ""
Read-Host "Press Enter to exit"

