# LocalFit Memo for Seeker

LocalFit Memo is an offline workout notebook for iOS and Android, built with React Native and Expo. There is no account or cloud service: workouts stay in SQLite on your device.

## Everyday use

- **Start or resume today:** the home screen opens the existing workout for a local calendar day, including when you select a past date.
- **Save each set:** choose an exercise, enter kilograms and repetitions, then tap **Save set**. **Finish** returns to your history. If you have unsaved input, you can save it, discard it, or keep editing before leaving.
- **Repeat a set:** saved values stay in the inputs so you can deliberately save another matching set. Changing exercises keeps the editing context clear; previous values can be reused from the selected exercise's history.
- **Find or add exercises:** search by the displayed Japanese name or original English name, filter by body part, or add an exercise with its body part. Newly added exercises are selected immediately.
- **Check a bodyweight movement:** select Push Up, Bodyweight Squat, Pull Up, Dips, Crunch, Leg Raise, or Ab Wheel and open **See how to move**. Start/end illustrations, tap-to-play movement, equipment, and short instructions work offline. Plank has a static posture guide because it is a hold. Other exercise variations do not receive an automatically matched guide.
- **Reuse a routine:** save a workout's exercise list as a routine, then load it into a later session. A routine is a plan; sets count as completed only after you record them.
- **Review progress:** personal records show the heaviest recorded set. The progress chart shows the best estimated one-repetition maximum from each of the latest six sessions, with a text list of the values. Estimates use the Epley formula and are not a recommendation to attempt that weight.

## Language and accessibility

Japanese and English are available in Settings; the choice is stored on the device. The initial language follows the device locale (Japanese for `ja`, otherwise English). Standard exercise names are translated for display without renaming saved data or custom exercises.

Main actions have text labels, screen-reader labels and states, and larger touch targets. Higher-contrast colors, scalable text, scrollable content, keyboard-aware entry, and Android modal back handling are included. Device testing with VoiceOver/TalkBack and large system text is still recommended; these changes do not claim universal accessibility certification.

Movement guides never autoplay. The system's reduced-motion preference switches them to still positions; enabling it during playback stops movement. Playback also stops when the guide closes, the exercise changes, or the app goes into the background, and does not resume automatically. Illustrations and written instructions remain available without animation.

## Backup and restore

Use **Create backup** in Settings, then choose a destination in the system share sheet. Opening the share sheet does not confirm that a backup was saved. Keep a copy outside the app before changing devices or deleting the app.

Version 2 JSON backups include exercises, workouts, sets, and saved routines with their exercise order. Restore validates the file before replacing current workout data and performs replacement in one database transaction. Version 1 backups are still supported; they contain no routines. The language setting stays on the device and is not replaced by a workout backup.

## Development

```sh
npm ci --legacy-peer-deps
npm start
```

The app uses Expo SDK 54, React 19.1, and React Native 0.81.5. Open in a compatible Expo Go/development client, or use `npm run android` / `npm run ios` with a configured simulator. A native development environment is required for end-to-end device testing. The file backup uses the explicit `expo-file-system/legacy` entry point supported by SDK 54.

### Installable Android test APK

Install Java 17 or newer and Android SDK tools, and set `ANDROID_HOME` to the SDK directory. The native project is generated from `app.json`; its Gradle build downloads the SDK/dependencies it needs, so the Android, Maven, and Gradle download hosts must be reachable.

```sh
npm run build:apk
# Optionally choose an existing writable download directory:
npm run build:apk -- /absolute/path/to/Downloads
```

The result is `LocalFit-Memo-1.0.0-test.apk` in `artifacts/` (or your chosen directory). It is a release-mode app with the JavaScript bundle and offline assets included; Metro and Expo Go are not needed to run it. It uses Expo's generated debug signing key for device testing. A store release requires a separate production signing setup.

APK generation has not yet completed in the current cloud environment: the Android SDK is absent and network policy permits only the npm registry. The native project generation, type check, 45 regression tests, and Android JavaScript export can be verified separately; they do not establish that an APK has been built or tested on a device.

```sh
npm run typecheck
npm test
```

Tests run on Node.js 22.13+ (including `node:sqlite`) and cover database integrity, backup/restore, numeric input, and workout interactions. Native file/share dialogs and assistive technologies require device verification.
