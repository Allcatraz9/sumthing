# Mobile Build & Deployment Guide - Sumthing

This guide explains how to update your game, build new testing APKs, and prepare your app for the Google Play Store.

## 1. Environment Setup

To build this project on your system, these settings are **critical**:
- **Java Home**: Ensure you use **Java 11** (newer versions like 17+ are currently incompatible with this Gradle version).
- **Android SDK**: Ensure `ANDROID_SDK_ROOT` is set correctly.

**Before running any build commands, run this in your terminal:**
```bash
export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
export ANDROID_SDK_ROOT=/home/alcatraz/Android/Sdk
```

---

## 2. Standard Development Workflow

Whenever you change any files in the root folder (like `index.html`, `game.js`, or `styles.css`), follow these steps to see those changes in your mobile app:

### Step A: Sync Web Assets
This copies your web code into the Android project.
```bash
# From the project root
mkdir -p www
cp index.html game.js styles.css manifest.json sw.js www/
cp -r icons www/
npx cap copy android
```

### Step B: Build Testing APK
This generates a file (`.apk`) you can install on your phone.
```bash
# Move to android folder and build
cd android
./gradlew assembleDebug
```
**APK Location:** `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 3. Google Play Store Deployment

To publish on the Play Store, you need an **Android App Bundle (.aab)** instead of an APK, and it must be **signed**.

### Step A: Generate a Keystore (One-time setup)
If you don't have a release key yet, generate one:
```bash
keytool -genkey -v -keystore my-release-key.keystore -alias alias_name -keyalg RSA -keysize 2048 -validity 10000
```
> [!IMPORTANT]
> Keep this file safe! If you lose it, you won't be able to update your app on the Play Store.

### Step B: Generate the Signed Bundle (.aab)
1. Open the project in Android Studio: `npx cap open android`.
2. Go to **Build > Generate Signed Bundle / APK...**
3. Select **Android App Bundle** and click **Next**.
4. Use the keystore you generated in Step A.
5. Select **release** as the build variant and click **Finish**.

**AAB Location:** `android/app/release/app-release.aab`

### Step C: Upload to Play Console
1. Log in to [Google Play Console](https://play.google.com/console/).
2. Create/Select your application.
3. Go to **Production** or **Internal testing**.
4. Create a new release and upload the `.aab` file.
5. Provide the Privacy Policy link (found in `PRIVACY_POLICY.md`).

---

## Troubleshooting

### "App not installed as package appears to be invalid"
If you get this error during installation:
1.  **Uninstall First**: Make sure any old version of the app is completely uninstalled from your phone.
2.  **Download Locally**: Instead of installing directly from a cloud drive (like Google Drive), download the `.apk` file to your phone's **Downloads** folder first, then open it.
3.  **Check Manifest**: Ensure `android:exported="true"` is set for the main activity in `AndroidManifest.xml`.
4.  **Signing**: Ensure both `v1SigningEnabled` and `v2SigningEnabled` are set to `true` in your `build.gradle`.

### "This app was built for an older version of Android"
This is fixed by setting `targetSdkVersion` to at least **31** (we recommend **34** as set in this project).

---

## 4. Where to Edit?

If you want to make changes to the game later, here are the files to target:

| Feature | Target File | Notes |
| :--- | :--- | :--- |
| **Sounds & Music** | [game.js](file:///home/alcatraz/.gemini/antigravity/scratch/sumthing/game.js) | Look for `SoundManager` class (lines 40-183). Change frequencies/notes here. |
| **Grid & Puzzle Logic** | [game.js](file:///home/alcatraz/.gemini/antigravity/scratch/sumthing/game.js) | Look for `PuzzleGenerator` (lines 188-265) and `renderUnifiedBoard` (lines 759+). |
| **Menu & UI Layout** | [index.html](file:///home/alcatraz/.gemini/antigravity/scratch/sumthing/index.html) | Main HTML structure for the start menu, settings, and modals. |
| **Colors & Styling** | [styles.css](file:///home/alcatraz/.gemini/antigravity/scratch/sumthing/styles.css) | Change `--accent-primary` and other CSS variables at the top for a new look. |
| **App Name/ID** | [capacitor.config.json](file:///home/alcatraz/.gemini/antigravity/scratch/sumthing/capacitor.config.json) | Change `appName` and `appId` here. |

---

## 5. Summary: How to Re-Compile

1. **Change Code**: Edit any file listed above.
2. **Move into App**: Run `cp index.html game.js styles.css manifest.json sw.js www/` and `npx cap copy android`.
3. **Build APK**: Run `./gradlew assembleDebug` inside the `android/` folder.
4. **Deploy to Store**: Use `./gradlew bundleRelease` to get an `.aab` file for Google Play.


