
# WiFi Watch - Native Real Scanner (Pure English)

This is the REAL version that can scan your actual WiFi network. No simulation.

## How it works (Real, not fake)
1. Gets your phone IP (e.g. 192.168.1.120)
2. Scans every IP from 192.168.1.1 to 192.168.1.254 using REAL TCP socket connections (port 80 and 443)
3. If host responds, it's alive = a device is there
4. Reads Android ARP table at /proc/net/arp to get real MAC addresses

## Why browser version was fake?
Browsers BLOCK local network scanning for security. JavaScript in Chrome cannot ping 192.168.1.x. Only a native app can.

## How to build APK

Option 1 - Test instantly (Expo Go):
1. Install Expo Go on your Android
2. npm install
3. npx expo start -> scan QR

Option 2 - Build real APK:
1. npm install -g eas-cli
2. eas login
3. eas build -p android --profile preview
4. Download APK after 10-15 mins

## Permissions needed in AndroidManifest.xml:
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

## What you get:
- Real device count
- Real IP of every connected device
- Ping/latency
- Detect which one is you
- MAC via ARP module

Blocking still requires router admin login (192.168.1.1), but you can copy IP to block.
