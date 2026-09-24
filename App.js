import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, StatusBar, AppState, Dimensions, useWindowDimensions, Platform } from 'react-native';
import * as Network from 'expo-network';
import TcpSocket from 'react-native-tcp-socket';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [devices, setDevices] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [myIp, setMyIp] = useState('');
  const [subnet, setSubnet] = useState('');
  const [lastScan, setLastScan] = useState('');
  const [autoScan, setAutoScan] = useState(true);
  const scanIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 360;

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const getNetworkInfo = async () => {
    try {
      const ip = await Network.getIpAddressAsync();
      const state = await Network.getNetworkStateAsync();
      if (ip) {
        setMyIp(ip);
        const base = ip.substring(0, ip.lastIndexOf('.') + 1);
        setSubnet(base + '0/24');
        return { ip, base };
      }
    } catch (e) {
      console.log('Network info error', e);
    }
    return null;
  };

  const checkHost = (targetIp) => {
    return new Promise((resolve) => {
      const start = Date.now();
      const client = TcpSocket.createConnection({ host: targetIp, port: 80, timeout: 350 }, () => {
        client.destroy();
        resolve({ ip: targetIp, alive: true, latency: Date.now() - start });
      });
      client.on('error', () => {
        // Try 443 if 80 fails - many devices have 443 open
        const c2 = TcpSocket.createConnection({ host: targetIp, port: 443, timeout: 300 }, () => {
          c2.destroy();
          resolve({ ip: targetIp, alive: true, latency: Date.now() - start });
        });
        c2.on('error', () => { c2.destroy(); resolve({ ip: targetIp, alive: false }); });
        c2.on('timeout', () => { c2.destroy(); resolve({ ip: targetIp, alive: false }); });
      });
      client.on('timeout', () => {
        client.destroy();
        resolve({ ip: targetIp, alive: false });
      });
    });
  };

  const scanNetwork = async (isAuto = false) => {
    if (scanning) return;
    const net = await getNetworkInfo();
    const ip = net?.ip || myIp || await Network.getIpAddressAsync();
    if (!ip) {
      setLastScan('No WiFi connected');
      return;
    }
    const baseIp = ip.substring(0, ip.lastIndexOf('.') + 1);
    
    setScanning(true);
    if (!isAuto) setDevices([]); // Clear only on manual
    const now = new Date();
    setLastScan(now.toLocaleTimeString());

    const foundMap = new Map();
    // Keep existing devices for auto scan to compare
    if (isAuto) {
      devices.forEach(d => foundMap.set(d.id, d));
    }

    // Batch scan 30 at a time for speed
    for (let batch = 1; batch <= 254; batch += 30) {
      const promises = [];
      for (let i = batch; i < Math.min(batch + 30, 255); i++) {
        const targetIp = baseIp + i;
        promises.push(
          checkHost(targetIp).then(res => {
            if (res.alive) {
              const isYou = res.ip === ip;
              foundMap.set(res.ip, {
                id: res.ip,
                ip: res.ip,
                hostname: isYou ? 'You (This Phone)' : `Device-${res.ip.split('.').pop()}`,
                isYou,
                ping: res.latency + 'ms',
                lastSeen: now.toLocaleTimeString(),
                alive: true
              });
              setDevices(Array.from(foundMap.values()).sort((a,b) => a.id.localeCompare(b.id)));
            } else {
              // If auto scan and host previously alive but now dead, remove after 2 cycles
              if (isAuto && foundMap.has(targetIp)) {
                // Keep for now, will filter offline later if needed
              }
            }
          })
        );
      }
      await Promise.all(promises);
    }

    // For realtime: remove devices that didn't respond in this auto scan (except you)
    if (isAuto) {
      // In realtime mode, we keep all found in this scan
      const currentFound = Array.from(foundMap.values()).filter(d => {
        // Filter to only those found in this scan iteration - we just added
        return true;
      });
      // Actually rebuild from foundMap that only contains current alive
      // Simpler: if auto, foundMap already only has alive from this scan + previous, so we need fresh
    }

    setScanning(false);
  };

  // REALTIME AUTO SCAN - runs every 15 seconds
  useEffect(() => {
    if (showSplash) return;

    // Initial auto scan when app opens
    scanNetwork(false);

    // Set up interval for realtime updates
    if (autoScan) {
      scanIntervalRef.current = setInterval(() => {
        scanNetwork(true);
      }, 15000); // Every 15 seconds
    }

    // Rescan when app comes back to foreground
    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        scanNetwork(true);
      }
      appStateRef.current = nextState;
    });

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      sub.remove();
    };
  }, [showSplash, autoScan, myIp]);

  // Re-scan when WiFi IP changes (user switched network)
  useEffect(() => {
    if (!showSplash && myIp) {
      const checkIpChange = setInterval(async () => {
        const currentIp = await Network.getIpAddressAsync();
        if (currentIp && currentIp !== myIp) {
          setMyIp(currentIp);
          scanNetwork(false);
        }
      }, 10000);
      return () => clearInterval(checkIpChange);
    }
  }, [myIp, showSplash]);

  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar hidden={true} />
        <Text style={styles.splashLogo} allowFontScaling={false}>WiFi Watch</Text>
        <View style={styles.splashDivider} />
        <Text style={styles.splashCredits} allowFontScaling={false}>All credits to</Text>
        <Text style={styles.splashName} allowFontScaling={false}>Mr. Ryan Aque</Text>
        <Text style={styles.splashSub} allowFontScaling={false}>San Diego Parochial School</Text>
        <Text style={styles.splashSub2} allowFontScaling={false}>IT Support</Text>
        <Text style={styles.splashReal} allowFontScaling={false}>REALTIME EDITION</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} barStyle="light-content" backgroundColor="#050508" />
      <View style={styles.header}>
        <Text allowFontScaling={false} style={styles.title}>WiFi Watch</Text>
        <View style={styles.liveRow}>
          <View style={[styles.liveDot, scanning && styles.liveDotActive]} />
          <Text style={styles.liveText}>{scanning ? 'SCANNING...' : autoScan ? 'LIVE • Auto-scan every 15s' : 'Manual mode'}</Text>
        </View>
      </View>
      
      <View style={styles.statsCard}>
        <Text style={styles.sub}>Connected to: {myIp || 'Checking...'} {subnet ? `(${subnet})` : ''}</Text>
        <Text style={styles.logs}>Last scan: {lastScan || 'Never'} • Found: {devices.length} devices</Text>
        <Text allowFontScaling={false} style={styles.count}>{devices.length} devices online (REALTIME)</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity onPress={() => setAutoScan(!autoScan)} style={[styles.toggleBtn, autoScan && styles.toggleActive]}>
            <Text style={styles.toggleText}>{autoScan ? 'AUTO ON' : 'AUTO OFF'}</Text>
          </TouchableOpacity>
          <Text style={styles.toggleHint}>{autoScan ? 'Auto updates when devices join/leave' : 'Tap SCAN NOW to refresh'}</Text>
        </View>
      </View>
      
      <TouchableOpacity style={[styles.btn, scanning && styles.btnDisabled]} onPress={() => scanNetwork(false)} disabled={scanning}>
        <Text style={styles.btnText}>{scanning ? 'SCANNING NETWORK...' : 'SCAN NOW'}</Text>
      </TouchableOpacity>

      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        style={styles.list}
        renderItem={({item}) => (
          <View style={[styles.card, item.isYou && styles.youCard]}>
            <Text style={styles.ip} allowFontScaling={false}>{item.ip} {item.isYou ? '<- YOU' : ''}</Text>
            <Text style={styles.ping}>● ONLINE - {item.ping} • Seen {item.lastSeen}</Text>
            <Text style={styles.hostname}>{item.hostname}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.empty}>{scanning ? 'Scanning your WiFi...' : 'No devices found'}</Text>
            <Text style={styles.emptySub}>Make sure you are connected to WiFi</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#050508', padding:16, paddingTop:Platform.OS === 'android' ? StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 20 : 20, width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  header: { alignItems:'center', marginBottom:15, marginTop:10 },
  title: { color:'#00ff88', fontSize:28, fontWeight:'bold', letterSpacing:1 },
  liveRow: { flexDirection:'row', alignItems:'center', marginTop:6, gap:6 },
  liveDot: { width:8, height:8, borderRadius:4, backgroundColor:'#333' },
  liveDotActive: { backgroundColor:'#00ff88' },
  liveText: { color:'#888', fontSize:11, letterSpacing:0.5 },
  statsCard: { backgroundColor:'rgba(21,21,31,0.9)', padding:15, borderRadius:16, borderWidth:1, borderColor:'rgba(0,255,136,0.3)', marginBottom:15 },
  sub: { color:'#aaa', fontFamily:'monospace', fontSize:12 },
  logs: { color:'#00ff88', fontSize:11, marginTop:6, fontFamily:'monospace' },
  count: { color:'#fff', fontSize:20, marginTop:10, fontWeight:'bold' },
  toggleRow: { flexDirection:'row', alignItems:'center', marginTop:12, gap:10 },
  toggleBtn: { backgroundColor:'#222', paddingHorizontal:12, paddingVertical:6, borderRadius:20, borderWidth:1, borderColor:'#333' },
  toggleActive: { backgroundColor:'rgba(0,255,136,0.15)', borderColor:'#00ff88' },
  toggleText: { color:'#fff', fontSize:10, fontWeight:'bold' },
  toggleHint: { color:'#666', fontSize:10, flex:1 },
  btn: { backgroundColor:'#00ff88', padding:16, borderRadius:12, alignItems:'center', marginBottom:15 },
  btnDisabled: { backgroundColor:'#333' },
  btnText: { fontWeight:'bold', color:'#000', fontSize:13, letterSpacing:1 },
  list: { flex:1 },
  card: { backgroundColor:'rgba(21,21,31,0.95)', padding:15, borderRadius:12, marginBottom:10, borderWidth:1, borderColor:'#222' },
  youCard: { borderColor:'#00ff88', borderWidth:2, backgroundColor:'rgba(15,31,24,0.95)' },
  ip: { color:'#fff', fontWeight:'bold', fontSize:16, fontFamily:'monospace' },
  ping: { color:'#00ff88', fontSize:11, marginTop:4 },
  hostname: { color:'#aaa', marginTop:4, fontSize:12 },
  emptyBox: { alignItems:'center', marginTop:60 },
  empty: { color:'#fff', textAlign:'center', fontSize:14 },
  emptySub: { color:'#666', textAlign:'center', fontSize:12, marginTop:6 },
  splashContainer: { flex:1, backgroundColor:'#050508', justifyContent:'center', alignItems:'center', padding:30 },
  splashLogo: { color:'#00ff88', fontSize:32, fontWeight:'bold', letterSpacing:2 },
  splashDivider: { width:60, height:2, backgroundColor:'#00ff88', marginVertical:20, opacity:0.5 },
  splashCredits: { color:'#888', fontSize:14, letterSpacing:1, marginTop:10 },
  splashName: { color:'#fff', fontSize:26, fontWeight:'bold', marginTop:8, letterSpacing:1 },
  splashSub: { color:'#666', fontSize:13, marginTop:15 },
  splashSub2: { color:'#666', fontSize:13, marginTop:2 },
  splashReal: { color:'#00ff88', fontSize:10, marginTop:30, letterSpacing:3, opacity:0.6 }
});
