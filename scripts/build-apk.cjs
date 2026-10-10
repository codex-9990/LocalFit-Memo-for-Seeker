const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const outputDirectory = path.resolve(process.argv[2] || path.join(projectRoot, 'artifacts'));
const sdkDirectory = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

function fail(message) {
    console.error(message);
    process.exit(1);
}

function run(command, args, cwd = projectRoot) {
    const result = spawnSync(command, args, {
        cwd, stdio: 'inherit', env: { ...process.env, CI: '1' },
    });
    if (result.error) fail(result.error.message);
    if (result.status !== 0) process.exit(result.status || 1);
}

if (!sdkDirectory || !fs.existsSync(path.join(sdkDirectory, 'platforms'))) {
    fail('Android SDK is required. Install it and set ANDROID_HOME before running build:apk.');
}

run(process.execPath, [path.join(projectRoot, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install']);
const androidDirectory = path.join(projectRoot, 'android');
// Expo's generated release variant includes the JS bundle and uses its local
// debug signing key. This is an installable test APK, not a store release.
if (process.platform === 'win32') {
    // Windows batch files require cmd.exe; spawnSync cannot execute them directly.
    run('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat :app:assembleRelease --no-daemon'], androidDirectory);
} else {
    run('./gradlew', [':app:assembleRelease', '--no-daemon'], androidDirectory);
}

const source = path.join(androidDirectory, 'app/build/outputs/apk/release/app-release.apk');
if (!fs.existsSync(source)) fail('Gradle did not produce app-release.apk.');
fs.mkdirSync(outputDirectory, { recursive: true });
const destination = path.join(outputDirectory, 'LocalFit-Memo-1.0.0-test.apk');
fs.copyFileSync(source, destination);
console.log(`APK: ${destination}`);
