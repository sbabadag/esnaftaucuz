# 🔄 Development Workflow: Cursor ↔ Android Studio

## How It Works

**Short answer:** Yes, Android Studio receives your edits, but you need to **build and sync** first.

## 📋 The Workflow

### 1. Edit in Cursor
Make changes to your React code in:
- `app/` directory (components, screens, etc.)
- `src/` directory (hooks, utils)
- Any TypeScript/React files

### 2. Build the Web App
```bash
npm run build
```
This compiles your React code into web assets in the `dist/` folder.

### 3. Sync to Native Projects
```bash
npm run mobile:sync
# OR
npm run mobile:build  # (builds + syncs in one command)
```

This copies the built files from `dist/` to:
- `android/app/src/main/assets/public/` (Android)
- `ios/App/App/public/` (iOS)

### 4. Android Studio Picks Up Changes
When you run the app in Android Studio, it uses the synced files from step 3.

## 🚀 Quick Commands

**One command to do everything:**
```bash
npm run mobile:build
```
This runs: `npm run build && npx cap sync`

## ⚡ Development Tips

### Option 1: Manual Sync (Recommended for now)
1. Edit in Cursor
2. Run `npm run mobile:build`
3. Run in Android Studio

### Option 2: Watch Mode (Future Enhancement)
You can set up a watch script to auto-sync:
```bash
# In one terminal
npm run dev

# In another terminal (watch and sync)
npm run watch:sync
```

## 📁 What Gets Synced

**Synced (copied to Android/iOS):**
- ✅ Built JavaScript files from `dist/`
- ✅ CSS files
- ✅ HTML
- ✅ Images/assets
- ✅ Capacitor config

**NOT Synced (native-only):**
- ❌ Native Android code (`android/app/src/main/java/`)
- ❌ Native iOS code (`ios/App/App/`)
- ❌ Gradle files
- ❌ Xcode project settings

## 🔍 File Locations

### Your Code (Edit in Cursor)
```
app/
├── components/     ← Edit here
├── contexts/       ← Edit here
└── services/       ← Edit here
```

### Built Files (Auto-generated)
```
dist/               ← Created by `npm run build`
├── index.html
├── assets/
│   ├── index-xxx.js
│   └── index-xxx.css
```

### Android Project (Synced from dist/)
```
android/
└── app/
    └── src/
        └── main/
            └── assets/
                └── public/    ← Synced here
```

## ⚠️ Important Notes

1. **Always build before syncing** - Android Studio uses the built files, not your source code
2. **Don't edit files in `android/` or `ios/` directly** - They get overwritten on sync
3. **Native code changes** (Java/Kotlin/Swift) should be made in Android Studio/Xcode
4. **Config changes** in `capacitor.config.ts` require a sync

## 🎯 Typical Development Session

```bash
# 1. Make changes in Cursor
# (edit app/components/screens/ExploreScreen.tsx)

# 2. Build and sync
npm run mobile:build

# 3. Open Android Studio
npm run mobile:android

# 4. In Android Studio:
#    - Click "Run" button
#    - App runs with your latest changes
```

## 🔄 Hot Reload

**Web:** `npm run dev` has hot reload ✅

**Mobile:** No automatic hot reload yet. You need to:
1. Build: `npm run mobile:build`
2. Re-run in Android Studio

**Future:** Can set up live reload with Capacitor's dev server (more complex setup).

## 💡 Pro Tips

1. **Use web dev server for quick testing:**
   ```bash
   npm run dev  # Fast iteration on web
   ```

2. **Test on mobile when needed:**
   ```bash
   npm run mobile:build
   npm run mobile:android
   ```

3. **Keep Android Studio open** - Just rebuild and re-run when needed

4. **Use Android Studio's "Apply Changes"** - Sometimes works for small changes without full rebuild

## 🐛 Troubleshooting

**Changes not showing in Android Studio?**
- ✅ Did you run `npm run mobile:build`?
- ✅ Did you re-run the app in Android Studio?
- ✅ Check `android/app/src/main/assets/public/` has latest files

**Build errors?**
- Check `dist/` folder exists
- Run `npm run build` separately to see errors
- Check TypeScript errors in Cursor

## 📚 Summary

**Cursor edits** → **Build** → **Sync** → **Android Studio** → **Run**

The workflow is: Edit → Build → Sync → Test

This is normal for hybrid apps! Your React code lives in Cursor, gets built, then runs in native containers.

