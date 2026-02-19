Smooth hot-reload for Capacitor (Android) — Quick guide

1) Install new dev tools
- Run: npm install --save-dev concurrently wait-on

2) How the scripts work
- npm run dev            -> starts Vite
- npm run dev:android    -> starts Vite and, once the server is ready, runs Capacitor with livereload. This prevents race conditions.

3) Network & device
- Make sure your phone and dev machine are on the same Wi‑Fi.
- Disable VPNs/firewalls blocking port 5173.
- If your machine has multiple network interfaces, use the "Network" URL printed by Vite (http://192.x.x.x:5173) when troubleshooting.

4) If hot-reload doesn't update:
- Tap "Reload webview" in Settings (dev box) to force the WebView to reload the dev server.
- Re-deploy with: npm run dev:android
- Check Vite logs for "hmr update" entries.

5) Troubleshooting adb issues
- Make sure Android platform-tools (adb) are on your PATH so the deploy script can target devices automatically.

