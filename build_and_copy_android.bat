@echo off
REM Build web assets and copy to Android Capacitor project (separate lines for PowerShell compatibility)
REM Run this from the project root or double-click this .bat file.

echo.
echo === Running npm build ===
npm run build
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo npm run build failed with exit code %ERRORLEVEL%.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo === Copying web assets to Android (Capacitor) ===
npx cap copy android
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo npx cap copy android failed with exit code %ERRORLEVEL%.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo === Assembling Android debug APK ===
if exist android (
  pushd android
  if exist gradlew.bat (
    echo Running gradlew.bat assembleDebug...
    call gradlew.bat assembleDebug
    if %ERRORLEVEL% NEQ 0 (
      echo.
      echo Gradle assembleDebug failed with exit code %ERRORLEVEL%.
      pause
      popd
      exit /b %ERRORLEVEL%
    )
  ) else (
    echo gradlew.bat not found in android folder. Skipping APK assembly.
  )
  popd
) else (
  echo android folder not found, skipping APK assembly.
)

echo.
echo === Installing APK to connected device (adb) ===
if exist android\app\build\outputs\apk\debug\app-debug.apk (
  echo.
  echo Uninstalling existing app (if any)...
  adb uninstall com.esnaftaucuz.app || (
    echo Warning: adb uninstall returned non-zero (continuing)
  )

  echo.
  echo Installing APK...
  adb install -r android\app\build\outputs\apk\debug\app-debug.apk
  if %ERRORLEVEL% NEQ 0 (
    echo.
    echo adb install failed with exit code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
  )

  echo.
  echo Launching app on device...
  adb shell am force-stop com.esnaftaucuz.app
  adb shell monkey -p com.esnaftaucuz.app -c android.intent.category.LAUNCHER 1
  if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Failed to launch app with monkey (exit %ERRORLEVEL%).
    pause
    exit /b %ERRORLEVEL%
  )
) else (
  echo APK not found, skipping adb install.
)

echo.
echo Done. Web assets built, copied and (optionally) APK installed.

echo.
echo Starting dev:android (vite + livereload)...
npm run dev:android
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo npm run dev:android failed with exit code %ERRORLEVEL%.
  pause
  exit /b %ERRORLEVEL%
)

pause
