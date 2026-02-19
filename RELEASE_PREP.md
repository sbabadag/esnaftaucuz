Release preparation and Play Store upload
======================================

This document explains how to prepare a new production release for Google Play and upload it.

1) Versioning (already applied)
- package.json version has been bumped to the next patch version.
- capacitor.config.ts now reads the version from package.json and sets android.versionCode automatically using the formula:
  versionCode = major*10000 + minor*100 + patch

2) Build steps (local)
- Build web assets:
  npm run build

- Sync with Capacitor native project:
  npx cap sync android

- Open Android project in Android Studio (recommended) to create a signed AAB:
  npx cap open android

- Or build via command line (requires signing config or to produce an unsigned bundle):
  cd android
  ./gradlew bundleRelease
  # output AAB: android/app/build/outputs/bundle/release/app-release.aab

3) Signing the AAB
- If using Android Studio, use "Build > Generate Signed Bundle / APK" to sign with your keystore.
- For command line signing, use your keystore and the Gradle signing config or apksigner/jarsigner workflows. See Android docs.

4) Upload to Play Console
- Open Google Play Console > Your app > Release > Production > Create new release
- Upload the signed AAB, fill release notes (use testers' feedback summary), and rollout.

5) CI / Automation (optional)
- Consider using Fastlane supply or Google Play Developer API to automate uploads.
- See PRODUCTION_DEPLOYMENT.md for automation examples (if present).

If you want I can:
- create a signed AAB locally (you must provide the keystore or signing config), or
- prepare a GitHub Actions / Codemagic / Fastlane workflow to build and upload automatically.

