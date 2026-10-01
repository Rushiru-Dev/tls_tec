import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'react-native-sqlite-storage';

export async function runMigrations(database: SQLiteDatabase): Promise<void> {
  await database.executeSql('PRAGMA foreign_keys = ON');
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      description TEXT NOT NULL,
      unit_price REAL NOT NULL CHECK (unit_price >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    )
  `);
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    )
  `);
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      installation_address TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      net_total REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER,
      category_name TEXT NOT NULL,
      item_model TEXT NOT NULL,
      item_description TEXT NOT NULL,
      serial_number TEXT,
      warranty TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price REAL NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);
  await database.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)',
  );
  await migrateProductDataFromAsyncStorage(database);
}

async function migrateProductDataFromAsyncStorage(
  database: SQLiteDatabase,
): Promise<void> {
  const markerKey = '@tls_tec/product-data-sqlite-migrated';
  if ((await AsyncStorage.getItem(markerKey)) === 'true') return;

  const [savedCategories, savedProducts] = await Promise.all([
    AsyncStorage.getItem('@tls_tec/product-categories'),
    AsyncStorage.getItem('@tls_tec/products'),
  ]);
  const categories: string[] = savedCategories
    ? JSON.parse(savedCategories)
    : [];
  const products: Array<{
    category: string;
    model: string;
    description: string;
    unitPrice: number;
  }> = savedProducts ? JSON.parse(savedProducts) : [];

  for (const category of categories) {
    await database.executeSql(
      'INSERT OR IGNORE INTO categories (name) VALUES (?)',
      [category.trim()],
    );
  }
  for (const product of products) {
    const categoryName = product.category.trim();
    if (!categoryName || !product.model?.trim()) continue;
    await database.executeSql(
      'INSERT OR IGNORE INTO categories (name) VALUES (?)',
      [categoryName],
    );
    const [categoryResult] = await database.executeSql(
      'SELECT id FROM categories WHERE name = ?',
      [categoryName],
    );
    const categoryId = categoryResult.rows.item(0)?.id as number | undefined;
    if (categoryId === undefined) continue;
    await database.executeSql(
      `INSERT INTO products (category_id, model, description, unit_price)
       SELECT ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM products WHERE category_id = ? AND model = ?
       )`,
      [
        categoryId,
        product.model.trim(),
        product.description?.trim() ?? '',
        Number(product.unitPrice) || 0,
        categoryId,
        product.model.trim(),
      ],
    );
  }

  await AsyncStorage.setItem(markerKey, 'true');
  await Promise.all([
    AsyncStorage.removeItem('@tls_tec/product-categories'),
    AsyncStorage.removeItem('@tls_tec/products'),
  ]);
}
