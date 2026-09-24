
// android/app/src/main/java/com/wifiscanner/ArpModule.java
// TUNAY NA ARP READER - Ito yung hindi peke
package com.wifiscanner;

import com.facebook.react.bridge.*;
import java.io.BufferedReader;
import java.io.FileReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public class ArpModule extends ReactContextBaseJavaModule {
  public ArpModule(ReactApplicationContext reactContext) { super(reactContext); }

  @Override public String getName() { return "ArpModule"; }

  @ReactMethod
  public void getArpTable(Promise promise) {
    try {
      BufferedReader br = new BufferedReader(new FileReader("/proc/net/arp"));
      String line;
      WritableArray result = Arguments.createArray();
      br.readLine(); // skip header
      while ((line = br.readLine()) != null) {
        String[] parts = line.split(" +");
        if (parts.length >= 4) {
          String ip = parts[0];
          String mac = parts[3];
          String device = parts[5];
          if (!mac.equals("00:00:00:00:00:00")) {
            WritableMap map = Arguments.createMap();
            map.putString("ip", ip);
            map.putString("mac", mac);
            map.putString("device", device);
            result.pushMap(map);
          }
        }
      }
      br.close();
      promise.resolve(result);
    } catch (Exception e) {
      promise.reject("ARP_ERROR", e.getMessage());
    }
  }
}
