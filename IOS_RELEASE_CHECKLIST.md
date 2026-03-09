# iOS Release Checklist

## 1) Versioning
- Run one of:
  - `npm run version:bump:patch`
  - `npm run version:bump:minor`
  - `npm run version:bump:major`
- Commit and push `package.json` and `package-lock.json` updates.

## 2) Trigger Build
- Push to `main` branch.
- Codemagic auto-triggers `ios-appstore-release`.

## 3) Verify Build
- Confirm Codemagic workflow status is `finished`.
- Confirm `App.ipa` exists in artifacts.
- Confirm upload step to App Store Connect succeeds.

## 4) TestFlight
- Open App Store Connect -> TestFlight.
- Wait for Apple processing (can take 10-60 minutes).
- Confirm latest build appears for `com.esnaftaucuz.app`.

## 5) Pre-Release Metadata
- Confirm version/release notes in App Store Connect.
- Confirm screenshots, privacy details, and app info are complete.

## 6) Publish Decision
- Internal testing: assign build to internal testers.
- External testing: submit for beta app review if needed.
