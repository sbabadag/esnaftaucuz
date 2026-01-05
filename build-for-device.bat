@echo off
echo ========================================
echo Building for iOS Device (Windows)
echo ========================================
echo.

echo [1/3] Building web app...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Syncing iOS...
call npx cap sync ios
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Sync failed!
    pause
    exit /b %errorlevel%
)

echo.
echo [3/3] Preparing for GitHub...
echo.
echo Next steps:
echo 1. git add .
echo 2. git commit -m "iOS build for device"
echo 3. git push
echo 4. Go to GitHub Actions
echo 5. Run "iOS Build" workflow
echo 6. Download .ipa artifact
echo 7. Use Sideloadly to install on iPhone
echo.
echo ========================================
echo ✅ Ready for GitHub Actions build!
echo ========================================
pause

