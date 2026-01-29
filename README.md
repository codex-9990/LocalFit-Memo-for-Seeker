# LocalFit Memo for Seeker

**LocalFit Memo** (formerly Iron Vault) is a privacy-focused, offline-first workout tracker built with **React Native (Expo)**.

It is designed for trainees who want a frictionless, "pen-and-paper" like experience on their phone, without cloud dependencies, accounts, or subscriptions.

## 🚀 Key Features

*   **Offline First**: All data is stored locally using `expo-sqlite`. Your data belongs to you.
*   **Smart "One Log Per Day"**: Automatically resumes today's session if one exists, preventing duplicate empty logs.
*   **Calendar Mode**: Visualize your consistency. See exactly which days you trained.
*   **Body Part Focus**: The home screen summarizes workouts by target body parts (e.g., "Chest • Biceps") rather than just dates.
*   **Progress Tracking**:
    *   **Estimated 1RM Charts**: Track your strength gains over time.
    *   **Personal Records**: Automatically tracks your best Weight × Reps for every exercise.
*   **Frictionless Input**:
    *   **Efficient logging**: Large inputs, quick exercise selection.
    *   **Auto-Complete**: Creating a new set automatically pre-fills with the previous session's weight/reps for that exercise.
*   **Data Sovereignty**: Export your entire database to JSON for backup or migration.

## 🛠 Tech Stack

*   **Framework**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/)
*   **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/)
*   **Database**: [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
*   **Components**: Custom components with a clean, unified Light/Blue theme.
*   **Charts**: `react-native-chart-kit`
*   **Calendar**: `react-native-calendars`

## 🏃‍♂️ Running Locally

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npx expo start
    ```
    *   Press `a` to run on Android Emulator.
    *   Press `i` to run on iOS Simulator (macOS only).
    *   Scan the QR code with the Expo Go app to run on a physical device.

## 🔒 Privacy

No data is sent to any external server. All workout logs are stored in an SQLite database on the device's filesystem.

---

*Built with ❤️ for Seeker.*
