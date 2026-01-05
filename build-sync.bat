@echo off
echo ========================================
echo Building and Syncing Capacitor App
echo ========================================
echo.

echo [1/2] Building web app...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] Syncing Capacitor...
call npx cap sync
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Sync failed!
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================
echo ✅ Build and Sync completed successfully!
echo ========================================
pause



