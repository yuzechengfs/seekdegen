# seekdegen Android app

This directory contains the Android container app for `seekdegen`.

The Android app does three things:

- connects a Solana wallet natively
- signs the user in with a wallet signature
- loads the hosted `seekdegen` web app inside a WebView

## Before you run Android

The mobile app expects a deployed web app and API. Deploy those first from the repository root:

```bash
npm install
cp .env.example .env.local
firebase login
npm run deploy:firebase
```

Then update [app.json](app.json) so both endpoints point to your deployed server:

```json
{
  "expo": {
    "extra": {
      "appOrigin": "https://your-firebase-project.web.app/app/",
      "apiOrigin": "https://your-firebase-project.web.app"
    }
  }
}
```

## Install dependencies

```bash
cd mobile
npm install
```

## Run on Android

```bash
npm run android
```

## Build a release APK

From [android](android), build the release APK with your own keystore setup:

```bash
cd android
./gradlew assembleRelease
```

## Notes

- Do not leave `localhost` in [app.json](app.json) for a phone build.
- If the wallet is already connected, the app should restore entry automatically.
- After sign-in, the user completes the profile flow in `Me`.
- For signed release builds, create [android/keystore.properties](android/keystore.properties) from [android/keystore.properties.example](android/keystore.properties.example).
