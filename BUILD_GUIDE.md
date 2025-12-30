# Sumthing - Play Store Build Guide

This guide explains how to build the final Android App Bundle (.aab) for the Google Play Store.

## 1. Prepare Web Assets
Whenever you make changes to the game (HTML/CSS/JS), you must update the `www` folder and sync with Capacitor:

```bash
# Update www folder
cp index.html game.js styles.css manifest.json sw.js www/
cp -r icons www/

# Sync with Android project
npx cap copy android
```

## 2. App Signing (Optional but Recommended for Play Store)
To upload to the Play Store, you need to sign your app.

### Generate a Keystore
Run this command to generate a `my-release-key.keystore`:
```bash
keytool -genkey -v -keystore my-release-key.keystore -alias alias_name -keyalg RSA -keysize 2048 -validity 10000
```
*Keep this file safe! You will need it for every update.*

## 3. Generate Android App Bundle (.aab)
1. Open the project in Android Studio:
   ```bash
   npx cap open android
   ```
2. In Android Studio, go to **Build > Generate Signed Bundle / APK...**
3. Select **Android App Bundle** and click **Next**.
4. Choose your keystore file and enter the passwords.
5. Select **release** destination and click **Finish**.

The generated `.aab` file will be located in `android/app/release/`.

## 4. Privacy Policy
The Privacy Policy is located at `PRIVACY_POLICY.md`. You will need to host this online and provide the link in the Google Play Console.
