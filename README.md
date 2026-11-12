# DoodleDungeon

CST438 Project 3. React Native with Expo and TypeScript for web and Android,
with a Spring Boot backend planned.

## Structure

- `app-frontend/`: Expo client.
- `api-backend/`: Backend placeholder.
- `docs/`: Requirements, architecture, API contract, and team documents.
- `.github/workflows/`: Build checks and container image publishing.
- `docker-compose.yml`: Local frontend build verification.

## Requirements

- Node.js 24 and npm.
- Android development: JDK 17, Android SDK tools, and an emulator or USB device.
- Docker Desktop for container builds.

## Web

From the repository root in PowerShell:

```powershell
cd app-frontend
npm.cmd ci
npm.cmd run web
```

Open [localhost:8081](http://localhost:8081). Changes to `App.tsx` refresh the
screen. Press Ctrl+C to stop the server. On macOS/Linux use `npm` instead of
`npm.cmd`.

## Guardian creation demo

Run `npm.cmd run web` from `app-frontend/`, open http://localhost:8081, and
select **Try guardian creation**. No sign-in or backend is needed for this demo.

Enter a name, choose Warrior/Brawler/Ranger/Mage, draw in the white art area,
and select **Create guardian**. Color, Undo, and Clear art work like the card
editor in CardBattle. The completed card shows the name, artwork, and class.
**Create another guardian** starts an empty draft. The demo keeps data only while
this screen is open; leaving it or refreshing discards the guardian.

Edit TypeScript/TSX files in IntelliJ or VS Code. Use the editor's terminal at
`app-frontend/` to run the app; saving a file refreshes the browser. The relevant
files are:

- `src/guardians/CreateGuardianScreen.tsx`: the form and completed card.
- `src/guardians/GuardianDrawing.tsx`: mouse/touch drawing and artwork rendering.
- `src/guardians/guardian.ts`: guardian data and validation.
- `App.tsx`: the button that opens the demo.

Run `npm.cmd test -- --runInBand` and `npm.cmd run typecheck` before committing.
For a quick manual check, verify that blank fields are rejected, all four classes
can be selected, Undo/Clear change the drawing, and the completed card matches
what you entered. Existing login tests remain part of the test suite.

For Android, use `npm.cmd run android` with an emulator/device. Rebuild an existing
development client after installing the new `react-native-svg` dependency.
Android Studio supplies SDK/emulator tools; it is not required for browser testing.

## GitHub configuration

The client exchanges the authorization code with the backend and displays the
signed-in user. The backend must expose the endpoints in `docs/openapi.yaml`.

The Android callback is `doodledungeon://login`. Web development uses
`http://localhost:8081`. Register a separate GitHub OAuth App for each callback.
The Android client ID defaults to the value in `App.tsx`.

To configure the API and public client IDs, copy `app-frontend/.env.example` to
`app-frontend/.env` and set:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_GITHUB_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GITHUB_WEB_REDIRECT_URI`
- `EXPO_PUBLIC_GITHUB_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_REDIRECT_URI`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

Google client IDs are intentionally not bundled as defaults. Configure the
appropriate web and Android client IDs in `.env`; do not commit credentials.

Restart Expo after changing `.env`. Never put provider secrets in the frontend;
`EXPO_PUBLIC_*` values are included in the application bundle.

## Android

Set `JAVA_HOME` to JDK 17 and `ANDROID_HOME` to the Android SDK location. Install
the SDK/build tools required by the Expo SDK, then start an emulator or connect
a device with USB debugging enabled. From `app-frontend/`:

```powershell
npm.cmd run android
```

This creates and installs a development build. Use `npm.cmd start` for subsequent
sessions. Rebuild after changing native dependencies, plugins, or the URL scheme.
OAuth requires a development build rather than Expo Go.

See [Expo's Android setup guide](https://docs.expo.dev/get-started/set-up-your-environment/?buildEnv=local&device=simulated&mode=development-build&platform=android).

## Build checks

From `app-frontend/`:

```powershell
npm.cmd run test -- --runInBand
npm.cmd run typecheck
npm.cmd run export:web
```

The web export is written to `app-frontend/dist/`.

From the repository root, with Docker Desktop running:

```powershell
docker compose config
docker compose up --build --exit-code-from frontend-checks
```

The Docker build checks TypeScript and exports the web client. It produces a
verification image, not a running API or web server. CI builds on pull requests
and publishes the image to GHCR on pushes to `main`.

## Current scope

The frontend contains GitHub/Google sign-in UI and a local guardian creation
demo. The backend is a placeholder in this checkout. The guardian demo does not
write to an API or database.
