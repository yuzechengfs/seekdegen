# seekdegen deployment guide

This guide is the reproducible path for publishing `seekdegen` and then pointing the Android app at the hosted build.

## Prerequisites

- Node.js 22
- Firebase CLI
- Android Studio or a working Android SDK toolchain
- A Firebase project that you control

## 1. Install dependencies

From the repository root:

```bash
npm install
```

For the Android app:

```bash
cd mobile
npm install
cd ..
```

## 2. Configure local environment

Create a local environment file:

```bash
cp .env.example .env.local
```

Add your Firebase project ID to `.env.local`:

```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
```

If you want AI-assisted interest scoring outside Firebase Secret Manager, also add:

```bash
DEEPSEEK_API_KEY=your-deepseek-api-key
```

## 3. Sign in to Firebase

```bash
firebase login
```

Optional: create a local `.firebaserc` from [.firebaserc.example](.firebaserc.example) so `firebase` commands default to your project.

## 4. Configure Firebase secret

If you want DeepSeek scoring in Firebase Functions:

```bash
firebase functions:secrets:set DEEPSEEK_API_KEY
```

## 5. Deploy web app and API

```bash
npm run deploy:firebase
```

After deployment, your hosted app will usually be available at:

```text
https://your-firebase-project.web.app/app/
```

Your API origin will usually be:

```text
https://your-firebase-project.web.app
```

## 6. Point Android at the hosted app

Update [mobile/app.json](mobile/app.json):

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

## 7. Run Android locally

```bash
cd mobile
npm run android
```

The app should open, connect a Solana wallet, and then load the hosted web app.

## 8. Build a signed release APK

Create `mobile/android/keystore.properties` from [mobile/android/keystore.properties.example](mobile/android/keystore.properties.example), then build:

```bash
cd mobile/android
./gradlew assembleRelease
```

The release APK will be written to:

```text
mobile/android/app/build/outputs/apk/release/app-release.apk
```
