@echo off
echo ========================================
echo Building and Syncing iOS (Windows)
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
echo [2/2] Syncing iOS...
call npx cap sync ios
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Sync failed!
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================
echo ✅ Build and Sync completed!
echo.
echo Next steps:
echo 1. git add .
echo 2. git commit -m "iOS build ready"
echo 3. git push
echo 4. Go to GitHub Actions to build iOS
echo ========================================
pause

