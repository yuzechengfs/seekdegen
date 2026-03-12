# seekdegen

`seekdegen` is a wallet-connected interest matching app prototype. It combines a web client, a lightweight Node/Firebase backend, and an Android container app that signs users in with a Solana wallet and then loads the web experience in a WebView.

This public copy has been sanitized for GitHub:

- local databases and runtime state removed
- Firebase project binding removed
- signing keys and keystore files removed
- internal planning docs and private delivery artifacts removed

## What is included

- Web app under [app](app)
- Local/API server under [server.js](server.js)
- Firebase Functions entry under [firebase-functions](firebase-functions)
- Android container app under [mobile](mobile)
- Verification and utility scripts under [scripts](scripts)

## Stack

- Web: vanilla HTML/CSS/JS
- Backend: Node.js
- Hosting/API option: Firebase Hosting + Firebase Functions
- Mobile: Expo / React Native / Android WebView container
- Wallet sign-in: Solana wallet signature flow

## Quick start (Android app)

This is the default path for running `seekdegen` as a phone app. The Android container loads a hosted web build, so the web app and API should be deployed first.

1. Install root dependencies.

```bash
npm install
```

2. Install mobile dependencies.

```bash
cd mobile
npm install
cd ..
```

3. Copy the environment template.

```bash
cp .env.example .env.local
```

4. Add your Firebase project ID to `.env.local`.

```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
```

5. Sign in to Firebase CLI.

```bash
firebase login
```

6. Deploy the web app and API to your hosted server.

```bash
npm run deploy:firebase
```

7. Update the mobile app endpoints in [mobile/app.json](mobile/app.json) so they point to your deployed server.

```json
{
  "appOrigin": "https://your-firebase-project.web.app/app/",
  "apiOrigin": "https://your-firebase-project.web.app"
}
```

8. Run the Android app.

```bash
cd mobile
npm run android
```

After the app opens, connect a Solana wallet and complete the profile flow in `Me`.

## Local web development

If you want to work on the web client without the Android container:

1. Start the local server.

```bash
npm run dev
```

2. Open the local web app.

```text
http://localhost:4173/
```

## Root scripts

```bash
npm run dev
npm run verify
npm run reset
npm run snapshot
npm run check
```

- `dev`: start the local web + API server
- `verify`: run flow verification checks
- `reset`: clear local runtime state
- `snapshot`: print a lightweight admin snapshot
- `check`: run syntax checks

## Environment

The server reads `.env` and `.env.local` when present.

See [.env.example](.env.example) for supported variables.

Important values:

- `PORT`: local server port
- `DATA_DIR`: local runtime data directory
- `FIREBASE_PROJECT_ID`: target Firebase project for deployment
- `DEEPSEEK_API_KEY`: optional local DeepSeek key if you want AI-assisted interest scoring outside Firebase Secret Manager

## Secret handling

- never commit `.env`, `.env.local`, `.firebaserc`, keystore files, or any exported Firebase config that contains real values
- Firebase Secret Manager should only store server-side machine credentials such as `DEEPSEEK_API_KEY`
- do not store user emails, wallet addresses, user IDs, admin IDs, session tokens, contact details, or any personal data in Firebase secrets
- keep project-specific IDs and private keys outside this public repository

## Firebase deployment

This repository intentionally does not include a bound Firebase project. Before deploying:

1. create your own Firebase project
2. set `FIREBASE_PROJECT_ID` in your shell or `.env.local`
3. set the `DEEPSEEK_API_KEY` secret in Firebase if you want AI scoring in Functions

Prepare and deploy with:

```bash
npm run prepare:firebase
firebase deploy --project "$FIREBASE_PROJECT_ID"
```

After deployment, use your hosted server address in [mobile/app.json](mobile/app.json):

```json
{
  "appOrigin": "https://your-firebase-project.web.app/app/",
  "apiOrigin": "https://your-firebase-project.web.app"
}
```

## Android app

The Android container project lives in [mobile](mobile).

It handles:

- wallet connection
- signature-based sign-in
- loading the hosted web app in a WebView

Before building Android, make sure [mobile/app.json](mobile/app.json) points at your deployed server, not at `localhost`.

## Repository notes

- this public copy excludes release keys and local keystore properties
- this public copy excludes local runtime databases
- this public copy keeps mock payloads because they are still useful as sample API shapes
- reproducible deployment notes live in [DEPLOYMENT.md](DEPLOYMENT.md)

## Legal

- [COPYRIGHT.md](COPYRIGHT.md)
- [LICENSE](LICENSE)
- [LICENSE.md](LICENSE.md)
- [PRIVACY.md](PRIVACY.md)

## Contact

For repository, privacy, or licensing questions:

`kuyaherber@proton.me`
