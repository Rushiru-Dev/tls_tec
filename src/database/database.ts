import SQLite, { type SQLiteDatabase } from 'react-native-sqlite-storage';
import { runMigrations } from './migrations';

SQLite.enablePromise(true);

let databasePromise: Promise<SQLiteDatabase> | undefined;

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabase({
      name: 'tls_tec.db',
      location: 'default',
    }).then(async database => {
      try {
        await runMigrations(database);
        return database;
      } catch (error) {
        databasePromise = undefined;
        await database.close();
        throw error;
      }
    });
  }
  return databasePromise;
}

export async function closeDatabase(): Promise<void> {
  const current = databasePromise;
  databasePromise = undefined;
  if (current) {
    const database = await current;
    await database.close();
  }
}

/** Replace the app database with a previously downloaded SQLite snapshot. */
export async function restoreDatabaseFile(filePath: string): Promise<void> {
  await closeDatabase();
  // react-native-sqlite-storage resolves createFromLocation relative to the
  // app Documents/Files directory rather than accepting a full absolute path.
  const importFileName = filePath.slice(filePath.lastIndexOf('/') + 1);
  // A unique name avoids deleting a validation database that may not exist yet;
  // Android's SQLite plugin reports "couldn't delete database" for that case.
  const validationName = `tls_tec_validate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.db`;
  const validationDb = await SQLite.openDatabase({
    name: validationName,
    location: 'default',
    createFromLocation: importFileName,
  });
  try {
    const [check] = await validationDb.executeSql('PRAGMA quick_check');
    if (check.rows.item(0)?.quick_check !== 'ok') {
      throw new Error('The downloaded backup is not a valid SQLite database.');
    }
  } finally {
    await validationDb.close();
    try {
      await SQLite.deleteDatabase({ name: validationName, location: 'default' });
    } catch {
      // A leftover validation copy is harmless; each restore uses a fresh name.
    }
  }

  await SQLite.deleteDatabase({ name: 'tls_tec.db', location: 'default' });

  databasePromise = SQLite.openDatabase({
    name: 'tls_tec.db',
    location: 'default',
    createFromLocation: importFileName,
  }).then(async database => {
    try {
      await runMigrations(database);
      return database;
    } catch (error) {
      databasePromise = undefined;
      await database.close();
      throw error;
    }
  });
  await databasePromise;
}
