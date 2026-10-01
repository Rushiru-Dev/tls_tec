import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import {
  defaultAppSettings,
  getAppPreference,
  getAppSettings,
  saveAppPreference,
  saveAppSettings,
  type AppSettings,
} from '../services/settingsService';
import {
  backupDatabaseToDrive,
  backupDatabaseToDevice,
  connectGoogleDrive,
  getBackupTimestamp,
  getConnectedGoogleEmail,
  getDeviceBackupInfo,
  restoreDatabaseFromDevice,
  restoreDatabaseFromPickedFile,
  restoreLatestDatabaseFromDrive,
  saveBackupTimestamp,
} from '../services/backupService';

type Props = { darkMode: boolean };

export default function SettingsScreen({ darkMode }: Props) {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [autoBackup, setAutoBackup] = useState(false);
  const [lastBackup, setLastBackup] = useState('No backup yet');
  const [lastDeviceBackup, setLastDeviceBackup] = useState('No backup yet');
  const [deviceBackupExists, setDeviceBackupExists] = useState(false);
  const [deviceBackupPath, setDeviceBackupPath] = useState('');
  const [deviceBackupFileName, setDeviceBackupFileName] = useState('tls_tec_device_backup.db');
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [driveWorking, setDriveWorking] = useState(false);
  const [driveRestoreLoading, setDriveRestoreLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const colors = darkMode
    ? { surface: '#1C1D23', border: '#2B2D35', heading: '#F4F4F6', text: '#E7E7EA', muted: '#A0A2AA', input: '#111216' }
    : { surface: '#FFFFFF', border: '#E7E8EB', heading: '#18191E', text: '#24252B', muted: '#7B7E87', input: '#FFFFFF' };

  useEffect(() => {
    Promise.all([
      getAppSettings(),
      getAppPreference('backup-frequency'),
      getAppPreference('auto-backup'),
      getAppPreference('last-backup'),
      getAppPreference('drive-account-email'),
      getAppPreference('last-device-backup'),
      getDeviceBackupInfo(),
    ])
      .then(([saved, savedFrequency, savedAuto, savedBackup, savedAccount, savedDeviceBackup, deviceBackupInfo]) => {
        setSettings(saved);
        setFrequency(savedFrequency === 'daily' ? 'daily' : 'weekly');
        setAutoBackup(savedAuto === 'true');
        if (savedBackup) setLastBackup(formatBackupDate(savedBackup));
        setGoogleEmail(getConnectedGoogleEmail() ?? savedAccount);
        setDeviceBackupExists(deviceBackupInfo.exists);
        setDeviceBackupPath(deviceBackupInfo.directory);
        setDeviceBackupFileName(deviceBackupInfo.fileName);
        if (savedDeviceBackup) setLastDeviceBackup(formatBackupDate(savedDeviceBackup));
      })
      .catch(() => Alert.alert('Settings', 'Could not load saved settings.'))
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof AppSettings, value: string) =>
    setSettings(current => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await saveAppSettings(settings);
      Alert.alert('Settings saved', 'Business details and invoice options have been saved.');
    } catch {
      Alert.alert('Settings', 'Could not save your settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const setBackupOption = async (key: string, value: string) => {
    try {
      await saveAppPreference(key, value);
    } catch {
      Alert.alert('Settings', 'Could not save the backup preference.');
    }
  };

  const connectDrive = async () => {
    setDriveWorking(true);
    try {
      const email = await connectGoogleDrive();
      setGoogleEmail(email);
      await saveAppPreference('drive-account-email', email);
      Alert.alert('Google Drive connected', `Connected as ${email}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Google Sign-In', message);
    } finally {
      setDriveWorking(false);
    }
  };

  const backupNow = async () => {
    setDriveWorking(true);
    try {
      await backupDatabaseToDrive();
      const timestamp = new Date().toISOString();
      await saveBackupTimestamp(timestamp);
      await saveAppPreference('last-backup', timestamp);
      await saveAppPreference('last-auto-backup-check', timestamp);
      setLastBackup(formatBackupDate(timestamp));
      Alert.alert('Backup complete', 'Your SQLite database was backed up to Google Drive.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Google Drive Backup', message);
    } finally {
      setDriveWorking(false);
    }
  };

  const backupToDevice = async () => {
    setDriveWorking(true);
    try {
      const backupPath = await backupDatabaseToDevice();
      const timestamp = new Date().toISOString();
      await saveAppPreference('last-device-backup', timestamp);
      setLastDeviceBackup(formatBackupDate(timestamp));
      setDeviceBackupExists(true);
      setDeviceBackupPath(backupPath.slice(0, backupPath.lastIndexOf('/')));
      setDeviceBackupFileName(backupPath.slice(backupPath.lastIndexOf('/') + 1));
      Alert.alert('Backup saved', 'A database backup was saved on this device.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Device Backup', message);
    } finally {
      setDriveWorking(false);
    }
  };

  const restoreFromDevice = () => {
    Alert.alert(
      'Restore from this device?',
      'This replaces the current local database with the saved device backup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDriveWorking(true);
              try {
                await restoreDatabaseFromDevice();
                Alert.alert('Restore complete', 'The device backup has been restored.');
              } catch (error) {
                const message = getErrorMessage(error);
                Alert.alert('Device Restore', message);
              } finally {
                setDriveWorking(false);
              }
            })();
          },
        },
      ],
    );
  };

  const shareDeviceBackup = async () => {
    setDriveWorking(true);
    try {
      const backupInfo = await getDeviceBackupInfo();
      if (!backupInfo.exists) {
        Alert.alert('No device backup', 'Save a backup to this device before sharing it.');
        return;
      }
      const sharePath = `${RNFS.CachesDirectoryPath}/${backupInfo.fileName}`;
      if (await RNFS.exists(sharePath)) await RNFS.unlink(sharePath);
      await RNFS.copyFile(backupInfo.path, sharePath);
      await Share.open({
        title: 'Share TLS Tec database backup',
        message: 'TLS Tec database backup file',
        url: `file://${sharePath}`,
        type: 'application/octet-stream',
        filename: backupInfo.fileName,
        useInternalStorage: true,
        failOnCancel: false,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      Alert.alert('Share Backup', message);
    } finally {
      setDriveWorking(false);
    }
  };

  const restoreFromSharedFile = () => {
    Alert.alert(
      'Restore from a backup file?',
      'Choose the .db backup you received in WhatsApp or another app. This replaces the current local database.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose File',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDriveWorking(true);
              try {
                await restoreDatabaseFromPickedFile();
                Alert.alert('Restore complete', 'The selected backup file has been restored.');
              } catch (error) {
                const message = getErrorMessage(error);
                if (!message.toLowerCase().includes('cancelled')) {
                  Alert.alert('Restore from File', message);
                }
              } finally {
                setDriveWorking(false);
              }
            })();
          },
        },
      ],
    );
  };

  const restoreFromDrive = () => {
    Alert.alert(
      'Data Restore කරන්නද?',
      'මෙමගින් දැනට App එකේ ඇති සියලුම දත්ත Google Drive එකේ ඇති Backup එකෙන් Replace වෙනවා. ඔබට විශ්වාසද?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Restore',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDriveWorking(true);
              setDriveRestoreLoading(true);
              try {
                await restoreLatestDatabaseFromDrive();
                const saved = await getBackupTimestamp();
                setLastBackup(saved ? formatBackupDate(saved) : 'Restored from Drive');
                Alert.alert(
                  'සාර්ථකයි! 🎉',
                  'දත්ත සාර්ථකව Restore වුණා. අලුත් දත්ත පෙනීමට කරුණාකර App එක Restart කරන්න.',
                  [{ text: 'OK' }],
                );
              } catch (error) {
                const message = getErrorMessage(error);
                Alert.alert('අසාර්ථකයි ❌', message || 'Data Restore කිරීමට නොහැකි විය.');
              } finally {
                setDriveRestoreLoading(false);
                setDriveWorking(false);
              }
            })();
          },
        },
      ],
    );
  };

  const field = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
    multiline = false,
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.heading }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.multiline,
          { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
        ]}
      />
    </View>
  );

  const section = (title: string, children: React.ReactNode) => (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.heading }]}>{title}</Text>
      {children}
    </View>
  );

  if (loading) return <View style={styles.loading}><Text style={{ color: colors.muted }}>Loading settings…</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {section('Google Drive Sync', <>
        <View style={styles.driveStatus}>
          <View style={[styles.statusDot, googleEmail ? styles.connected : styles.disconnected]} />
          <View style={styles.driveStatusCopy}>
            <Text style={[styles.rowTitle, { color: colors.heading }]}>{googleEmail ? `Connected: ${googleEmail}` : 'Google account not connected'}</Text>
            <Text style={[styles.rowHint, { color: colors.muted }]}>{googleEmail ? 'Backups are stored in this app’s private Drive data.' : 'Connect Drive to enable cloud backup and restore.'}</Text>
          </View>
        </View>
        <ActionButton disabled={driveWorking} title={googleEmail ? 'Reconnect Google Account' : 'Connect Google Account'} onPress={() => { void connectDrive(); }} />
        <View style={[styles.preferenceRow, { borderTopColor: colors.border }]}>
          <View style={styles.driveStatusCopy}>
            <Text style={[styles.rowTitle, { color: colors.heading }]}>Automatic backup</Text>
            <Text style={[styles.rowHint, { color: colors.muted }]}>When enabled, checks for a due backup when the app opens or returns to the foreground.</Text>
          </View>
          <Switch
            value={autoBackup}
            onValueChange={value => {
              setAutoBackup(value);
              void setBackupOption('auto-backup', String(value));
            }}
            trackColor={{ false: colors.border, true: '#F2A1A7' }}
            thumbColor={autoBackup ? '#E51D2A' : '#F4F4F5'}
          />
        </View>
        <View style={styles.frequencyRow}>
          {(['daily', 'weekly'] as const).map(option => (
            <Pressable
              key={option}
              onPress={() => {
                setFrequency(option);
                void setBackupOption('backup-frequency', option);
              }}
              style={[styles.frequencyOption, { borderColor: frequency === option ? '#E51D2A' : colors.border, backgroundColor: frequency === option ? '#FDEBED' : colors.input }]}
            >
              <Text style={[styles.frequencyText, { color: frequency === option ? '#D91825' : colors.text }]}>{option === 'daily' ? 'Daily' : 'Weekly'}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.backupButtons}>
          <ActionButton disabled={driveWorking} title={driveWorking ? 'Working…' : 'Backup Now'} onPress={() => { void backupNow(); }} />
          <ActionButton disabled={driveWorking} title="Restore Latest Backup from Google Drive" secondary loading={driveRestoreLoading} onPress={restoreFromDrive} />
        </View>
        <Text style={[styles.lastBackup, { color: colors.muted }]}>Last Backup: {lastBackup}</Text>
      </>)}

      {section('Backup on this Device', <>
        <Text style={[styles.rowHint, { color: colors.muted }]}>
          Save a database backup in this app’s private phone storage. It stays on this device and is removed if the app is uninstalled.
        </Text>
        <View style={[styles.fileLocation, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Text style={[styles.fileLocationLabel, { color: colors.muted }]}>Backup file</Text>
          <Text selectable style={[styles.fileLocationValue, { color: colors.text }]}>{deviceBackupFileName}</Text>
          <Text style={[styles.fileLocationLabel, styles.locationLabel, { color: colors.muted }]}>Save location</Text>
          <Text selectable style={[styles.fileLocationValue, styles.pathValue, { color: colors.text }]}>{deviceBackupPath || 'Loading location…'}</Text>
          <Text style={[styles.rowHint, { color: colors.muted }]}>{deviceBackupExists ? 'Backup file is saved on this device.' : 'The file will be created here when you save a backup.'}</Text>
        </View>
        <View style={styles.backupButtons}>
          <ActionButton disabled={driveWorking} title={driveWorking ? 'Working…' : 'Save Backup to Device'} onPress={() => { void backupToDevice(); }} />
          <ActionButton disabled={driveWorking || !deviceBackupExists} title="Share Backup File" secondary onPress={() => { void shareDeviceBackup(); }} />
          <ActionButton disabled={driveWorking || !deviceBackupExists} title="Restore from Device" secondary onPress={restoreFromDevice} />
          <ActionButton disabled={driveWorking} title="Restore from WhatsApp / File" secondary onPress={restoreFromSharedFile} />
        </View>
        <Text style={[styles.lastBackup, { color: colors.muted }]}>Last Device Backup: {lastDeviceBackup}</Text>
      </>)}

      {section('TLS Technology Details', <>
        {field('Business Name', settings.businessName, value => update('businessName', value), 'TLS Technology')}
        {field('Address', settings.businessAddress, value => update('businessAddress', value), 'Business address')}
        {field('Mobile Numbers', settings.businessMobile, value => update('businessMobile', value), '077... / 071...')}
        {field('Email', settings.businessEmail, value => update('businessEmail', value), 'business@example.com')}
      </>)}

      {section('Invoice Settings', <>
        {field('Invoice Number Prefix', settings.invoicePrefix, value => update('invoicePrefix', value), 'IN/')}
        {field('Invoice Terms & Conditions', settings.invoiceTerms, value => update('invoiceTerms', value), 'Warranty and service terms…', true)}
        <Text style={[styles.rowHint, { color: colors.muted }]}>The prefix is saved as a default for invoice numbering. Invoice numbers are still entered manually on the invoice form.</Text>
        <Pressable onPress={save} disabled={saving} style={({ pressed }) => [styles.saveButton, (pressed || saving) && styles.pressed]}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Settings'}</Text>
        </Pressable>
      </>)}

      {section('About App', <View style={styles.aboutContent}>
        <Text style={[styles.aboutCredit, { color: colors.text }]}>Developed by RDK (Pvt) Ltd.</Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            void Linking.openURL('https://www.rdksoftware.com').catch(() =>
              Alert.alert('Website', 'Could not open www.rdksoftware.com.'),
            );
          }}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.aboutLink}>www.rdksoftware.com</Text>
        </Pressable>
      </View>)}
    </ScrollView>
  );
}

function formatBackupDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object') {
    const details = JSON.stringify(error);
    if (details && details !== '{}') return details;
  }
  return 'The operation failed. Please try again.';
}

function ActionButton({ title, onPress, secondary = false, disabled = false, loading = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, secondary && styles.secondaryButton, (pressed || disabled) && styles.pressed]}>
      <View style={styles.actionButtonContent}>
        {loading && <ActivityIndicator size="small" color={secondary ? '#D91825' : '#FFFFFF'} />}
        <Text style={[styles.actionButtonText, secondary && styles.secondaryButtonText]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 18, paddingBottom: 130, gap: 13 },
  loading: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center' },
  section: { borderWidth: 1, borderRadius: 15, padding: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  field: { marginBottom: 11 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, fontSize: 14 },
  multiline: { minHeight: 92, paddingVertical: 10 },
  driveStatus: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  disconnected: { backgroundColor: '#E5A000' },
  connected: { backgroundColor: '#22A45A' },
  driveStatusCopy: { flex: 1 },
  rowTitle: { fontSize: 13, fontWeight: '700' },
  rowHint: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  actionButton: { minHeight: 43, borderRadius: 10, backgroundColor: '#E51D2A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  actionButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#D7D9DF' },
  secondaryButtonText: { color: '#D91825' },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 13 },
  frequencyRow: { flexDirection: 'row', gap: 9, marginTop: 11 },
  frequencyOption: { minHeight: 38, flex: 1, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  frequencyText: { fontSize: 12, fontWeight: '700' },
  backupButtons: { gap: 8, marginTop: 12 },
  lastBackup: { fontSize: 11, marginTop: 10 },
  fileLocation: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 11 },
  fileLocationLabel: { fontSize: 11, fontWeight: '700' },
  fileLocationValue: { fontSize: 12, marginTop: 4 },
  locationLabel: { marginTop: 9 },
  pathValue: { lineHeight: 17 },
  saveButton: { minHeight: 47, borderRadius: 11, backgroundColor: '#E51D2A', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  aboutContent: { gap: 5 },
  aboutCredit: { fontSize: 13, fontWeight: '700' },
  aboutLink: { color: '#D91825', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  pressed: { opacity: 0.75 },
});
