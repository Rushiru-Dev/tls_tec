import { GoogleSignin } from '@react-native-google-signin/google-signin';
import RNFS from 'react-native-fs';
import { DeviceEventEmitter, NativeModules } from 'react-native';
import SQLite from 'react-native-sqlite-storage';
import { getDatabase, restoreDatabaseFile } from '../database/database';
import { GOOGLE_DRIVE_SCOPE, GOOGLE_WEB_CLIENT_ID } from '../config/googleDrive';
import { getAppPreference, saveAppPreference } from './settingsService';

const driveFilesUrl = 'https://www.googleapis.com/drive/v3/files';
const driveUploadUrl = 'https://www.googleapis.com/upload/drive/v3/files';
const backupFileName = 'tls_tec_backup.db';
const snapshotFileName = 'tls_tec_snapshot.db';
const deviceBackupFileName = 'tls_tec_device_backup.db';
let configured = false;
let scheduledBackupInProgress = false;
let driveBackupInProgress = false;
let driveRestoreInProgress = false;

export const DRIVE_BACKUP_PROGRESS_EVENT = 'tlsTecDriveBackupProgress';
export type DriveBackupProgress = {
  status: 'progress' | 'complete' | 'error';
  progress: number;
  message: string;
  automatic: boolean;
};

function reportDriveBackupProgress(event: DriveBackupProgress) {
  DeviceEventEmitter.emit(DRIVE_BACKUP_PROGRESS_EVENT, event);
}

function configureGoogleSignIn() {
  if (!GOOGLE_WEB_CLIENT_ID.endsWith('.apps.googleusercontent.com')) {
    throw new Error('Add the Web application Client ID in src/config/googleDrive.ts first.');
  }
  if (!configured) {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      scopes: [GOOGLE_DRIVE_SCOPE],
    });
    configured = true;
  }
}

export async function connectGoogleDrive(): Promise<string> {
  configureGoogleSignIn();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success') throw new Error('Google sign-in was cancelled.');
  return response.data.user.email;
}

export function getConnectedGoogleEmail(): string | null {
  try {
    configureGoogleSignIn();
    return GoogleSignin.getCurrentUser()?.user.email ?? null;
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string> {
  configureGoogleSignIn();
  if (!GoogleSignin.getCurrentUser()) {
    if (GoogleSignin.hasPreviousSignIn()) {
      const signIn = await GoogleSignin.signInSilently();
      if (signIn.type !== 'success') {
        throw new Error('Reconnect your Google account in Settings before restoring a Drive backup.');
      }
    } else {
      throw new Error('Connect a Google account before using Drive backup.');
    }
  }
  const tokens = await GoogleSignin.getTokens();
  return tokens.accessToken;
}

async function driveRequest(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Google Drive request failed (${response.status}). ${details}`.trim());
  }
  return response;
}

async function makeLocalDatabaseSnapshot(): Promise<string> {
  const database = await getDatabase();
  const path = `${RNFS.DocumentDirectoryPath}/${snapshotFileName}`;
  if (await RNFS.exists(path)) await RNFS.unlink(path);
  const sqlPath = path.replace(/'/g, "''");
  await database.executeSql(`VACUUM INTO '${sqlPath}'`);
  return path;
}

/** Save a durable backup in the app's private on-device Documents directory. */
export async function backupDatabaseToDevice(): Promise<string> {
  const snapshotPath = await makeLocalDatabaseSnapshot();
  const backupPath = `${RNFS.DocumentDirectoryPath}/${deviceBackupFileName}`;
  try {
    if (await RNFS.exists(backupPath)) await RNFS.unlink(backupPath);
    await RNFS.moveFile(snapshotPath, backupPath);
    return backupPath;
  } finally {
    if (await RNFS.exists(snapshotPath)) await RNFS.unlink(snapshotPath);
  }
}

export async function getDeviceBackupInfo(): Promise<{
  path: string;
  directory: string;
  fileName: string;
  exists: boolean;
}> {
  const path = `${RNFS.DocumentDirectoryPath}/${deviceBackupFileName}`;
  return {
    path,
    directory: RNFS.DocumentDirectoryPath,
    fileName: deviceBackupFileName,
    exists: await RNFS.exists(path),
  };
}

export async function restoreDatabaseFromDevice(): Promise<void> {
  const backupPath = `${RNFS.DocumentDirectoryPath}/${deviceBackupFileName}`;
  if (!(await RNFS.exists(backupPath))) {
    throw new Error('No backup file was found on this device.');
  }
  await restoreDatabaseFile(backupPath);
}

export async function restoreDatabaseFromPickedFile(): Promise<void> {
  const picker = NativeModules.BackupFilePicker as
    | { pickBackupFile: () => Promise<string> }
    | undefined;
  if (!picker) throw new Error('The phone file picker is unavailable. Rebuild the Android app and try again.');

  const pickedPath = await picker.pickBackupFile();
  const importPath = `${RNFS.DocumentDirectoryPath}/tls_tec_import_backup.db`;
  if (await RNFS.exists(importPath)) await RNFS.unlink(importPath);
  await RNFS.copyFile(pickedPath, importPath);

  try {
    await restoreDatabaseFile(importPath);
    await RNFS.unlink(importPath);
  } catch (error) {
    throw error;
  }
}

async function findLatestDriveBackup(token: string): Promise<{ id: string; modifiedTime?: string } | null> {
  const query = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${backupFileName}' and trashed = false`,
    orderBy: 'modifiedTime desc',
    pageSize: '1',
    fields: 'files(id,name,modifiedTime)',
  });
  const response = await driveRequest(`${driveFilesUrl}?${query}`, token);
  const data = (await response.json()) as {
    files?: Array<{ id: string; modifiedTime?: string }>;
  };
  return data.files?.[0] ?? null;
}

async function uploadDatabaseSnapshotToDrive(token: string, automatic: boolean): Promise<void> {
  const localPath = await makeLocalDatabaseSnapshot();
  try {
    const latest = await findLatestDriveBackup(token);
    let fileId = latest?.id;

    if (!fileId) {
      const created = await driveRequest(driveFilesUrl, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: backupFileName,
          mimeType: 'application/vnd.sqlite3',
          parents: ['appDataFolder'],
        }),
      });
      fileId = ((await created.json()) as { id: string }).id;
    }

    const fileInfo = await RNFS.stat(localPath);
    const session = await driveRequest(
      `${driveUploadUrl}/${fileId}?uploadType=resumable`,
      token,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'application/vnd.sqlite3',
          'X-Upload-Content-Length': String(fileInfo.size),
        },
      },
    );
    const uploadUrl = session.headers.get('Location') ?? session.headers.get('location');
    if (!uploadUrl) throw new Error('Google Drive did not provide an upload session.');

    const upload = await RNFS.uploadFiles({
      toUrl: uploadUrl,
      method: 'PUT',
      binaryStreamOnly: true,
      files: [{
        name: 'file',
        filename: backupFileName,
        filepath: localPath,
        filetype: 'application/vnd.sqlite3',
      }],
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.sqlite3',
      },
      progress: ({ totalBytesExpectedToSend, totalBytesSent }) => {
        const progress = totalBytesExpectedToSend > 0
          ? Math.min(99, Math.floor((totalBytesSent / totalBytesExpectedToSend) * 100))
          : 0;
        reportDriveBackupProgress({
          status: 'progress',
          progress,
          message: automatic ? 'Automatic backup uploading to Google Drive…' : 'Uploading backup to Google Drive…',
          automatic,
        });
      },
    }).promise;
    if (upload.statusCode < 200 || upload.statusCode >= 300) {
      throw new Error(`Google Drive upload failed (${upload.statusCode}). ${upload.body}`.trim());
    }
  } finally {
    if (await RNFS.exists(localPath)) await RNFS.unlink(localPath);
  }
}

export async function backupDatabaseToDrive(): Promise<void> {
  if (driveRestoreInProgress) {
    throw new Error('Restore එකක් සිදුවෙමින් පවතී. අවසන් වූ පසු නැවත උත්සාහ කරන්න.');
  }
  if (scheduledBackupInProgress || driveBackupInProgress) {
    throw new Error('Backup එකක් දැනටමත් සිදුවෙමින් පවතී. කරුණාකර මොහොතකින් නැවත උත්සාහ කරන්න.');
  }

  driveBackupInProgress = true;
  reportDriveBackupProgress({
    status: 'progress',
    progress: 0,
    message: 'Preparing backup for Google Drive…',
    automatic: false,
  });
  try {
    const token = await getAccessToken();
    await uploadDatabaseSnapshotToDrive(token, false);
    reportDriveBackupProgress({ status: 'complete', progress: 100, message: 'Backup saved to Google Drive.', automatic: false });
  } catch (error) {
    reportDriveBackupProgress({
      status: 'error',
      progress: 0,
      message: error instanceof Error ? error.message : 'Google Drive backup failed.',
      automatic: false,
    });
    throw error;
  } finally {
    driveBackupInProgress = false;
  }
}

export async function restoreLatestDatabaseFromDrive(): Promise<void> {
  if (scheduledBackupInProgress || driveBackupInProgress) {
    throw new Error('Backup එකක් සිදුවෙමින් පවතී. කරුණාකර තත්පර කීපයකින් උත්සාහ කරන්න.');
  }
  if (driveRestoreInProgress) {
    throw new Error('Restore එකක් දැනටමත් සිදුවෙමින් පවතී. කරුණාකර මොහොතකින් නැවත උත්සාහ කරන්න.');
  }

  driveRestoreInProgress = true;
  const localPath = `${RNFS.DocumentDirectoryPath}/tls_tec_restore.db`;
  let restored = false;
  try {
    const token = await getAccessToken();
    const latest = await findLatestDriveBackup(token);
    if (!latest) {
      throw new Error('ඔබගේ Google Account එකේ කිසිදු Backup එකක් හමු වූයේ නැත.');
    }
    if (await RNFS.exists(localPath)) await RNFS.unlink(localPath);

    const download = await RNFS.downloadFile({
      fromUrl: `${driveFilesUrl}/${latest.id}?alt=media`,
      toFile: localPath,
      headers: { Authorization: `Bearer ${token}` },
    }).promise;
    if (download.statusCode < 200 || download.statusCode >= 300) {
      throw new Error(`Google Drive download failed (${download.statusCode}).`);
    }
    const downloadedFile = await RNFS.stat(localPath);
    if (Number(downloadedFile.size) === 0) {
      throw new Error('Google Drive returned an empty backup file.');
    }
    await restoreDatabaseFile(localPath);
    restored = true;
    const backupTimestamp = latest.modifiedTime || new Date().toISOString();
    await saveBackupTimestamp(backupTimestamp);
    await saveAppPreference('last-backup', backupTimestamp);
    // A restore is not a backup. Keep the scheduled backup timer from immediately
    // uploading the restored data over the Drive copy as soon as the app resumes.
    await saveAppPreference('last-auto-backup-check', new Date().toISOString());
  } finally {
    if (restored && await RNFS.exists(localPath)) await RNFS.unlink(localPath);
    driveRestoreInProgress = false;
  }
}

export async function getBackupTimestamp(): Promise<string | null> {
  const database = await getDatabase();
  const [result] = await database.executeSql(
    "SELECT value FROM app_settings WHERE key = 'settings-last-backup'",
  );
  const value = result.rows.item(0)?.value;
  return typeof value === 'string' ? value : null;
}

export async function saveBackupTimestamp(timestamp: string): Promise<void> {
  const database = await getDatabase();
  await database.executeSql(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('settings-last-backup', ?)",
    [timestamp],
  );
}

/** Runs a due scheduled backup whenever the app is opened or returns to foreground. */
export async function runScheduledBackupIfDue(): Promise<boolean> {
  if (scheduledBackupInProgress || driveBackupInProgress || driveRestoreInProgress) return false;
  scheduledBackupInProgress = true;
  try {
    const enabled = await getAppPreference('auto-backup');
    if (enabled !== 'true' || !getConnectedGoogleEmail()) return false;

    const frequency = await getAppPreference('backup-frequency');
    const previous =
      (await getAppPreference('last-auto-backup-check')) ??
      (await getBackupTimestamp());
    const interval = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const previousTime = previous ? new Date(previous).getTime() : 0;
    const due = !previousTime || !Number.isFinite(previousTime) || Date.now() - previousTime >= interval;
    if (!due) return false;

    reportDriveBackupProgress({
      status: 'progress',
      progress: 0,
      message: 'Automatic backup preparing for Google Drive…',
      automatic: true,
    });
    const token = await getAccessToken();
    await uploadDatabaseSnapshotToDrive(token, true);
    const timestamp = new Date().toISOString();
    await saveBackupTimestamp(timestamp);
    await saveAppPreference('last-backup', timestamp);
    await saveAppPreference('last-auto-backup-check', timestamp);
    reportDriveBackupProgress({ status: 'complete', progress: 100, message: 'Automatic backup complete.', automatic: true });
    return true;
  } catch (error) {
    reportDriveBackupProgress({
      status: 'error',
      progress: 0,
      message: error instanceof Error ? error.message : 'Automatic Google Drive backup failed.',
      automatic: true,
    });
    throw error;
  } finally {
    scheduledBackupInProgress = false;
  }
}

export async function validateLocalSqliteSupport(): Promise<boolean> {
  return Boolean(SQLite && RNFS.DocumentDirectoryPath);
}
