import React, { useEffect, useRef, useState } from 'react';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

if (Platform.OS !== 'web') void SplashScreen.preventAutoHideAsync().catch(() => {});
import WebView from 'react-native-webview';
import * as Location from 'expo-location';
import { SITE_URL, TABS, isSiteUrl, pageInfo, externalUrlAllowed } from './src/navigation';
import { AppHistory } from './src/history';
import { parseNavigationMessage, WEB_NAVIGATION_SCRIPT } from './src/web-navigation';

export default function App() {
  useEffect(() => { const timer = setTimeout(() => { void SplashScreen.hideAsync().catch(() => {}); }, 900); return () => clearTimeout(timer); }, []);
  return <SafeAreaProvider><Marketplace /></SafeAreaProvider>;
}

function Marketplace() {
  const dark = useColorScheme() === 'dark';
  const c = dark
    ? { bg: '#111111', surface: '#1b1b1b', ink: '#faf7f4', muted: '#b8aaa7', accent: '#ff8c87', line: '#342827', soft: '#382020' }
    : { bg: '#faf7f4', surface: '#ffffff', ink: '#241614', muted: '#7f716d', accent: '#9b0000', line: '#eee4df', soft: '#fff0ec' };
  const web = useRef<WebView<object>>(null);
  const history = useRef(new AppHistory(SITE_URL));
  const source = useRef(SITE_URL);
  const [sourceUrl, setSourceUrl] = useState(SITE_URL);
  const [url, setUrl] = useState(SITE_URL);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const page = pageInfo(url);

  const loadPage = useCallback((target: string) => {
    if (source.current === target) {
      // Website links can change the visible page without changing source.
      web.current?.injectJavaScript(`window.location.replace(${JSON.stringify(target)}); true;`);
    } else {
      source.current = target;
      setSourceUrl(target);
    }
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const previous = history.current.back();
      if (!previous) return false;
      setFailed(false);
      setUrl(previous);
      loadPage(previous);
      return true;
    });
    return () => subscription.remove();
  }, [loadPage]);

  function navigate(path: string) {
    const target = new URL(path, SITE_URL).href;
    if (!isSiteUrl(target)) return;
    history.current.visit(target);
    setFailed(false);
    setUrl(target);
    // Keep one WebView and its server session; track Back independently of canGoBack.
    loadPage(target);
  }
  function openExternal(target: string) {
    if (!externalUrlAllowed(target)) return;
    void Linking.openURL(target).catch(() => Alert.alert('Unable to open link', 'Please check that the required app is installed.'));
  }
  function retry() { setFailed(false); web.current?.reload(); }
  async function allowLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    Alert.alert(permission.granted ? 'Location is ready' : 'Location is turned off', permission.granted ? 'Use the location picker on the page to choose your delivery address.' : 'You can still enter your delivery address manually. Enable location in your phone settings to use GPS.');
  }
  async function allowMediaCapture() {
    let granted = true;
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      granted = result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
        && result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
    }
    web.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('mangwaoo:media-permission',{detail:{granted:${granted}}}));true;`);
  }

  if (Platform.OS === 'web') return <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}><View style={s.center}>
    <Text style={[s.wordmark, { color: c.accent }]}>mangwaoo.</Text>
    <Text style={[s.title, { color: c.ink }]}>Your everyday delivery partner</Text>
    <Text style={[s.description, { color: c.muted }]}>Shop, order and manage your account on Mangwaoo.</Text>
    <Pressable onPress={() => openExternal(SITE_URL)} style={s.primary}><Text style={s.primaryText}>Open Mangwaoo</Text></Pressable>
  </View></SafeAreaView>;

  return <SafeAreaView edges={['top', 'bottom']} style={[s.screen, { backgroundColor: c.surface }]}>
    <StatusBar style={dark ? 'light' : 'dark'} />
    <View style={[s.header, { borderColor: c.line }]}>
      <View style={{ flex: 1 }}><Text style={[s.eyebrow, { color: c.muted }]}>YOUR EVERYDAY DELIVERY PARTNER</Text><Text accessibilityRole="header" style={[s.wordmark, { color: c.accent }]}>mangwaoo<Text style={{ color: c.ink }}>.</Text></Text></View>
      <Pressable accessibilityLabel="Reload page" onPress={retry} style={[s.headerButton, { backgroundColor: c.soft }]}><Text style={{ color: c.accent, fontSize: 24 }}>↻</Text></Pressable>
      <Pressable accessibilityLabel="Enable delivery location" onPress={() => void allowLocation().catch(() => Alert.alert('Location unavailable', 'Please enter your address on the page.'))} style={[s.headerButton, { backgroundColor: c.soft }]}><Text style={{ color: c.accent, fontSize: 22 }}>⌖</Text></Pressable>
      {!page.dashboard && <Pressable accessibilityLabel="Open basket" onPress={() => navigate('/cart')} style={[s.basket, { backgroundColor: c.soft }]}><Text style={[s.link, { color: c.accent }]}>Basket ↗</Text></Pressable>}
    </View>
    <View style={{ height: 2, backgroundColor: c.line }}>{loading && <View style={{ width: `${Math.max(5, progress * 100)}%`, height: 2, backgroundColor: c.accent }} />}</View>
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <WebView<object> ref={web} source={{ uri: sourceUrl }} style={[s.screen, { backgroundColor: c.bg }]}
        applicationNameForUserAgent="MangwaooApp/1.1" sharedCookiesEnabled geolocationEnabled
        injectedJavaScript={WEB_NAVIGATION_SCRIPT}
        onMessage={({ nativeEvent }) => {
          if (isSiteUrl(nativeEvent.url)) {
            try {
              const request = JSON.parse(nativeEvent.data) as { type?: string };
              if (request.type === 'mangwaoo:request-media-permission') {
                void allowMediaCapture().catch(() => {
                  web.current?.injectJavaScript("window.dispatchEvent(new CustomEvent('mangwaoo:media-permission',{detail:{granted:false}}));true;");
                });
                return;
              }
            } catch { /* Navigation messages are parsed below. */ }
          }
          const message = parseNavigationMessage(nativeEvent.data, nativeEvent.url, SITE_URL);
          if (!message) return;
          if (message.mode === 'push') history.current.visit(message.url);
          else if (message.mode === 'replace') history.current.replace(message.url);
          else history.current.restore(message.url);
          setUrl(message.url);
        }}
        allowsBackForwardNavigationGestures allowsInlineMediaPlayback mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        pullToRefreshEnabled setSupportMultipleWindows mixedContentMode="never" allowFileAccess={false}
        originWhitelist={['http://*', 'https://*', 'tel:*', 'mailto:*', 'whatsapp:*', 'geo:*']}
        onShouldStartLoadWithRequest={(request) => {
          // The website CSP governs embedded maps and verification frames.
          if (request.isTopFrame === false) return true;
          if (isSiteUrl(request.url)) return true;
          openExternal(request.url); return false;
        }}
        onOpenWindow={({ nativeEvent }) => { if (isSiteUrl(nativeEvent.targetUrl)) navigate(nativeEvent.targetUrl); else openExternal(nativeEvent.targetUrl); }}
        onNavigationStateChange={(state) => {
          if (!isSiteUrl(state.url)) return;
          setUrl(state.url);
        }}
        onLoadStart={() => { setLoading(true); setProgress(0); }}
        onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
        onHttpError={({ nativeEvent }) => { if (nativeEvent.url === url && nativeEvent.statusCode >= 400) { setFailed(true); setLoading(false); } }}
        onContentProcessDidTerminate={() => web.current?.reload()} renderError={() => <View />}
      />
      {loading && progress < 0.15 && !failed && <View pointerEvents="none" style={[s.loadingPill, { backgroundColor: c.surface, borderColor: c.line }]}><ActivityIndicator size="small" color={c.accent} /><Text style={{ color: c.muted, fontSize: 12 }}>Getting things ready…</Text></View>}
      {failed && <View style={[s.error, { backgroundColor: c.bg }]}>
        <View style={[s.errorBadge, { backgroundColor: c.soft }]}><Text style={{ color: c.accent, fontSize: 40 }}>↻</Text></View>
        <Text style={[s.title, { color: c.ink }]}>Let’s get you connected</Text>
        <Text style={[s.description, { color: c.muted }]}>We couldn’t load this page. Check your connection and try again.</Text>
        <Pressable style={s.primary} onPress={retry}><Text style={s.primaryText}>Try again</Text></Pressable>
        <Pressable style={{ padding: 18 }} onPress={() => navigate('/')}><Text style={[s.link, { color: c.accent }]}>Back to home</Text></Pressable>
      </View>}
    </View>
    {!page.dashboard && <View accessibilityRole="tablist" style={[s.tabs, { borderColor: c.line }]}>{TABS.map((tab) => {
      const selected = page.tab === tab.id;
      return <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected }} onPress={() => navigate(tab.path)} style={({ pressed }) => [s.tab, { opacity: pressed ? 0.6 : 1 }]}>
        <View style={[s.tabIconWrap, { backgroundColor: selected ? c.soft : 'transparent' }]}><Text style={[s.tabIcon, { color: selected ? c.accent : c.muted }]}>{tab.icon}</Text></View>
        <Text style={{ fontSize: 10, color: selected ? c.accent : c.muted, fontWeight: selected ? '800' : '500' }}>{tab.label}</Text>
        {selected && <View style={[s.dot, { backgroundColor: c.accent }]} />}
      </Pressable>;
    })}</View>}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  eyebrow: { fontSize: 7, fontWeight: '700', letterSpacing: 1.1, marginBottom: 3 }, wordmark: { fontSize: 26, fontWeight: '900', letterSpacing: -1.4 },
  headerButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, basket: { minHeight: 38, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, link: { fontSize: 12, fontWeight: '700' },
  tabs: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 5, borderTopWidth: StyleSheet.hairlineWidth }, tab: { flex: 1, alignItems: 'center', minHeight: 58, gap: 3 }, tabIconWrap: { width: 46, height: 29, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, tabIcon: { fontSize: 22, fontWeight: '600' }, dot: { width: 4, height: 4, borderRadius: 2 },
  loadingPill: { position: 'absolute', top: 16, alignSelf: 'center', flexDirection: 'row', gap: 9, alignItems: 'center', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 30, borderWidth: 1 },
  error: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 30 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }, errorBadge: { width: 78, height: 78, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  title: { fontSize: 23, fontWeight: '800', letterSpacing: -0.6, marginVertical: 10, textAlign: 'center' }, description: { fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 300, marginBottom: 22 }, primary: { backgroundColor: '#9b0000', borderRadius: 16, paddingHorizontal: 36, paddingVertical: 16 }, primaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
