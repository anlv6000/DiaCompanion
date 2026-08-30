# DiaCompanion SMS Gateway - Expo Android

This is an Expo/React Native Android app that sends SMS directly through the phone's SIM by using a small local Expo native module backed by Android `SmsManager`.

## Important

- Android only.
- **Does not work in Expo Go** because it includes custom native Android code.
- Build an APK with EAS Build or `expo run:android`.
- The app requests `android.permission.SEND_SMS` at runtime.
- For the demo, HTTP LAN traffic is enabled so the phone can poll a backend running on your laptop.
- Keep the app open while polling. This first version intentionally does not use a foreground service.

## Requirements

- Node.js 20.19.4+ (Expo SDK 56+ requirement; current bundle targets SDK 57).
- npm.
- Expo/EAS account only if using EAS Build.
- Android phone with a SIM that can send SMS.

## Install

```bash
npm install
npx expo install --fix
npx expo-doctor@latest
```

Create `.env` from `.env.example` and set your laptop LAN IP, for example:

```env
EXPO_PUBLIC_SMS_BACKEND_URL=http://192.168.1.10:8091
EXPO_PUBLIC_SMS_GATEWAY_KEY=change-this-gateway-key
```

Generate native Android project:

```bash
npx expo prebuild --clean
```

## Build APK with EAS

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

The `preview` profile in `eas.json` uses `android.buildType = apk`, so EAS produces an installable APK.

## Build locally

With Android Studio / Android SDK configured:

```bash
npx expo run:android
```

## First test

1. Install the APK on the Android phone containing the SIM.
2. Allow the SMS permission.
3. In `Manual SMS test`, enter a test phone number.
4. Press `SEND SMS BY SIM`.
5. If that works, start `sms_gateway_service`, enter its URL/key, press `Test backend`, then `Start polling`.

## LAN networking

The backend must listen on `0.0.0.0`, not only `127.0.0.1`.

Example laptop URL:

```text
http://192.168.1.10:8091
```

Windows Firewall may prompt you to allow Python on Private networks. Allow it for your home/private LAN.
