import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Animated,
  AppState,
  DeviceEventEmitter,
  Easing,
  Image,
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRef } from 'react';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import {
  DRIVE_BACKUP_PROGRESS_EVENT,
  runScheduledBackupIfDue,
  type DriveBackupProgress,
} from './src/services/backupService';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [backupNotice, setBackupNotice] = useState<DriveBackupProgress | null>(null);

  const isLoading = showSplash || !themeLoaded;

  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 2400);
    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    let isActive = true;

    AsyncStorage.getItem('@tls_tec/theme')
      .then(savedTheme => {
        if (isActive && savedTheme !== null) {
          setDarkMode(savedTheme === 'dark');
        }
      })
      .catch(error => {
        console.warn('Could not load saved theme:', error);
      })
      .finally(() => {
        if (isActive) {
          setThemeLoaded(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const subscription = DeviceEventEmitter.addListener(
      DRIVE_BACKUP_PROGRESS_EVENT,
      (event: DriveBackupProgress) => {
        setBackupNotice(event);
        if (hideTimer) clearTimeout(hideTimer);
        if (event.status !== 'progress') {
          hideTimer = setTimeout(() => setBackupNotice(null), event.status === 'error' ? 6000 : 3500);
        }
      },
    );
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const runDueBackup = () => {
      void runScheduledBackupIfDue().catch(error => {
        console.warn('Scheduled Google Drive backup failed:', error);
      });
    };
    runDueBackup();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') runDueBackup();
    });
    return () => subscription.remove();
  }, [isLoading]);

  const handleToggleDarkMode = () => {
    const nextDarkMode = !darkMode;
    setDarkMode(nextDarkMode);
    AsyncStorage.setItem(
      '@tls_tec/theme',
      nextDarkMode ? 'dark' : 'light',
    ).catch(error => console.warn('Could not save selected theme:', error));
  };

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={isLoading || darkMode ? 'light-content' : 'dark-content'}
      />
      {isLoading ? (
        <SplashScreen />
      ) : (
        <AppContent
          darkMode={darkMode}
          onToggleDarkMode={handleToggleDarkMode}
          backupNotice={backupNotice}
        />
      )}
    </SafeAreaProvider>
  );
}

function SplashScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const loadingProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(loadingProgress, {
      toValue: 1,
      duration: 2400,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [loadingProgress]);

  return (
    <ImageBackground
      source={require('./src/img/splash_bg.png')}
      style={styles.splash}
      resizeMode="cover"
    >
      <View
        style={[styles.splashOverlay, { paddingTop: safeAreaInsets.top + 24 }]}
      >
        <View style={styles.logoArea}>
          <Image
            source={require('./src/img/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="TLS Tec logo"
          />
        </View>
        <View
          style={[styles.footer, { bottom: safeAreaInsets.bottom + 24 }]}
          accessibilityLabel="Loading TLS Tec"
        >
          <Text style={styles.footerText}>RDK (PVT) LTD</Text>
          <View style={styles.loadingTrack}>
            <Animated.View
              style={[
                styles.loadingBar,
                {
                  width: loadingProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

function AppContent({
  darkMode,
  onToggleDarkMode,
  backupNotice,
}: {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  backupNotice: DriveBackupProgress | null;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.appContent}>
      <HomeScreen darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} />
      {backupNotice && (
        <View
          pointerEvents="none"
          style={[
            styles.backupNotice,
            {
              top: insets.top + 10,
              backgroundColor: darkMode ? '#24252B' : '#FFFFFF',
              borderColor: darkMode ? '#3A3C43' : '#E7E8EB',
            },
          ]}
        >
          <View style={styles.backupNoticeHeading}>
            <Text style={[styles.backupNoticeTitle, { color: darkMode ? '#FFFFFF' : '#202127' }]}>
              {backupNotice.status === 'error'
                ? 'Backup failed'
                : backupNotice.status === 'complete'
                  ? backupNotice.automatic ? 'Automatic backup complete' : 'Backup complete'
                  : backupNotice.message}
            </Text>
            {backupNotice.status === 'progress' && (
              <Text style={styles.backupNoticePercent}>{backupNotice.progress}%</Text>
            )}
          </View>
          {backupNotice.status === 'progress' ? (
            <View style={styles.backupNoticeTrack}>
              <View style={[styles.backupNoticeBar, { width: `${backupNotice.progress}%` }]} />
            </View>
          ) : (
            <Text style={[styles.backupNoticeMessage, { color: darkMode ? '#C9CAD0' : '#6B6D75' }]}>
              {backupNotice.status === 'complete'
                ? 'Your latest data is saved to Google Drive.'
                : backupNotice.message}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  appContent: { flex: 1 },
  backupNotice: {
    position: 'absolute',
    left: 18,
    right: 18,
    zIndex: 100,
    elevation: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  backupNoticeHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  backupNoticeTitle: { flex: 1, fontSize: 13, fontWeight: '800' },
  backupNoticePercent: { color: '#E51D2A', fontSize: 12, fontWeight: '800' },
  backupNoticeTrack: { height: 5, backgroundColor: '#F1DADD', borderRadius: 4, overflow: 'hidden', marginTop: 9 },
  backupNoticeBar: { height: '100%', backgroundColor: '#E51D2A', borderRadius: 4 },
  backupNoticeMessage: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  splash: {
    flex: 1,
  },
  splashOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  logoArea: {
    width: '80%',
    maxWidth: 420,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '75%',
    height: '75%',
  },
  footer: {
    position: 'absolute',
    alignSelf: 'center',
    width: '72%',
    alignItems: 'center',
  },
  footerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 12,
  },
  loadingTrack: {
    width: '100%',
    height: 4,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  loadingBar: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#E51D2A',
  },
});

export default App;
