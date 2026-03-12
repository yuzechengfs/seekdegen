# seekdegen Android container

This directory contains the Android container app for `seekdegen`.

The current approach is intentionally pragmatic:

- connect a Solana wallet natively
- sign in with a wallet signature
- inject the authenticated web session
- render the hosted web product inside a WebView

## Why this structure

The product already has a working web client and backend flow. Keeping wallet handling in native code while reusing the web product lets the app move faster without rewriting the full experience immediately.

## Start

```bash
cd mobile
npm install
npm run dev
```

## Run on Android

```bash
npm run android
```

## Hosted endpoints

Set these values in [app.json](app.json):

- `appOrigin`
- `apiOrigin`

Use your own hosted domain before building a production APK.
