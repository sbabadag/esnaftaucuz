# App Store Rejection Fixes (v1.0 → resubmit)

Reviewed: 2026-07-24 · Submission `9985ab17-2d35-4d84-a4a3-fcdb7b4069de` · Build `1784653409` · Device: iPhone 17 Pro Max / iOS 26.5.2

## Issues from Apple

| Guideline | Problem | Fix |
|---|---|---|
| **5.2.5** IP – Apple Products | App name was `EsnaftaUcuz iOS` (uses “iOS”) | Rename to **`EsnaftaUcuz`** (no Apple product terms). Freed name by renaming unused duplicate app to `EsnaftaUcuz Draft`. |
| **2.3.8** Accurate Metadata | App icons looked like Capacitort placeholders | Add branded `assets/icon.png` and generate AppIcon in Codemagic via `@capacitor/assets`. |
| **2.1(a)** App Completeness | Crash on launch | Harden AppDelegate Firebase configure (never call bare `FirebaseApp.configure()`); keep GoogleService-Info.plist IPA verify step. Ship **new build**. |

## ASC metadata checklist (before Resubmit)

- [x] Name: `EsnaftaUcuz` (no “iOS”)
- [x] Subtitle: `Mahalle fiyatları`
- [ ] Version page Description / Keywords / Copyright cleaned up if still weak
- [ ] Upload new IPA build after Codemagic finishes
- [ ] Confirm App Icon in binary is green shopping-bag (not blue X)
- [ ] Reply to App Review noting: renamed app, finalized icons, fixed launch crash, please re-review

## Local code changes for resubmit

1. `assets/icon.png` + `resources/icon.png` — final 1024×1024 brand icon  
2. `scripts/patch_ios_appdelegate.py` — crash-safe Firebase bootstrap  
3. `codemagic.yaml` / `codemagic.yml` — generate iOS icons after `cap sync`

## Resubmit flow

1. Push these fixes to `main` → Codemagic `ios-appstore-release`  
2. Wait for IPA upload to App Store Connect  
3. Version 1.0 → select **new build**  
4. **Update Review** / **Resubmit to App Review**
