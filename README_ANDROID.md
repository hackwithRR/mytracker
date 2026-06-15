# Android App (WebView wrapper)

## Goal
Ship an Android installable app that loads `index.html` by default and can open `hair.html` inside the same WebView.

## Suggested approach
Use **Capacitor** (simple) or **Cordova**. Capacitor is recommended.

This repo currently contains plain HTML/CSS/JS, so Capacitor is the fastest path.

## Build steps (Capacitor)
1. Install Node.js 18+.
2. In `/Users/jslap018/Documents/tracker`, create a Capacitor project:
   ```bash
   npm create @capacitor/app@latest
   ```
3. Follow prompts; set the app name as you like.
4. Copy your web assets into the Capacitor `www` folder (or configure `capacitor.config.ts` to serve from the repo’s root).
   - The `www/` folder should contain:
     - `index.html`
     - `hair.html`
     - `app.css`
     - `js/`
5. Update Capacitor `capacitor.config.*` so `server.dir` points to where the `www` content lives.
6. Run on device/emulator:
   ```bash
   npm install
   npx cap add android
   npx cap sync android
   npx cap open android
   ```

## Default landing page
Ensure the web content served by the WebView starts at `index.html` (Capacitor uses `index.html` by default).

## Note
If you want deep linking like `/hair`, we can add simple routing in JS (hash routing) and set the WebView to load `index.html#hair`.

