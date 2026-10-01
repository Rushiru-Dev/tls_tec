import { getDatabase } from '../database/database';

export type AppSettings = {
  businessName: string;
  businessAddress: string;
  businessMobile: string;
  businessEmail: string;
  invoiceTerms: string;
  invoicePrefix: string;
};

export const defaultAppSettings: AppSettings = {
  businessName: 'TLS Technology',
  businessAddress: 'Kerewa, Karandeniya',
  businessMobile: '0771009727 / 0716346166',
  businessEmail: 'tlsandaruwan@gmail.com',
  invoiceTerms: '',
  invoicePrefix: 'IN/',
};

const settingKeys: Record<keyof AppSettings, string> = {
  businessName: 'business-name',
  businessAddress: 'business-address',
  businessMobile: 'business-mobile',
  businessEmail: 'business-email',
  invoiceTerms: 'invoice-terms',
  invoicePrefix: 'invoice-prefix',
};

export async function getAppSettings(): Promise<AppSettings> {
  const database = await getDatabase();
  const values = await Promise.all(
    (Object.keys(settingKeys) as Array<keyof AppSettings>).map(async key => {
      const [result] = await database.executeSql(
        'SELECT value FROM app_settings WHERE key = ?',
        [settingKeys[key]],
      );
      const stored = result.rows.item(0)?.value;
      return [key, typeof stored === 'string' ? stored : defaultAppSettings[key]] as const;
    }),
  );
  return { ...defaultAppSettings, ...Object.fromEntries(values) } as AppSettings;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const database = await getDatabase();
  await database.transaction(tx => {
    (Object.keys(settingKeys) as Array<keyof AppSettings>).forEach(key => {
      tx.executeSql(
        'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
        [settingKeys[key], settings[key].trim()],
      );
    });
  });
}

export async function getAppPreference(key: string): Promise<string | null> {
  const database = await getDatabase();
  const [result] = await database.executeSql(
    'SELECT value FROM app_settings WHERE key = ?',
    [`settings-${key}`],
  );
  const value = result.rows.item(0)?.value;
  return typeof value === 'string' ? value : null;
}

export async function saveAppPreference(
  key: string,
  value: string,
): Promise<void> {
  const database = await getDatabase();
  await database.executeSql(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [`settings-${key}`, value],
  );
}
